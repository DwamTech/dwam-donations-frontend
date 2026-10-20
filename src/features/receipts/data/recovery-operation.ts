import { parseRecoveryFragment, type FragmentState } from "./recovery-fragment";

// Laravel whereUuid accepts the canonical hexadecimal shape without a version restriction.
export function receiptUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function protectedReceiptPath(uuid: unknown) {
  if (!receiptUuid(uuid)) throw new Error("Invalid receipt identifier");
  return `/api/donation-receipts/${uuid}/download`;
}
export interface RecoveryExchangeResponse { message: "Receipt recovery completed."; data: { receipt_uuid: string } }
export function parseExchangeResponse(value: unknown, tokenId: string): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid exchange");
  const envelope = value as Record<string, unknown>;
  const data = envelope.data;
  if (envelope.message !== "Receipt recovery completed." || !data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid exchange");
  const uuid = (data as Record<string, unknown>).receipt_uuid;
  if (!receiptUuid(uuid) || uuid.toLowerCase() === tokenId.toLowerCase()) throw new Error("Invalid handoff");
  return uuid;
}
export type RecoveryState = { status: FragmentState | "loading" | "exchanging" | "authorized" | "denied" | "uncertain" | "service-error" | "downloading" | "download-offered" | "download-error"; receiptUuid?: string; message?: string };
export const MAX_RECEIPT_BYTES = 20 * 1024 * 1024;
export async function readPrivatePdf(response: Response): Promise<{ blob: Blob; filename: string }> {
  const type = response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const cache = response.headers.get("Cache-Control") ?? "";
  if (type !== "application/pdf" || !/^attachment\s*;/i.test(disposition) || !/\bprivate\b/i.test(cache) || !/\bno-store\b/i.test(cache) || !/\bno-cache\b/i.test(response.headers.get("Pragma") ?? "")) {
    await response.body?.cancel();
    throw new Error("Invalid private PDF response");
  }
  const size = Number(response.headers.get("Content-Length"));
  if (size > MAX_RECEIPT_BYTES) { await response.body?.cancel(); throw new Error("PDF too large"); }
  if (!response.body) throw new Error("Missing PDF");
  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_RECEIPT_BYTES) throw new Error("PDF too large");
      chunks.push(chunk.value.slice().buffer as ArrayBuffer);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  const blob = new Blob(chunks, { type: "application/pdf" });
  if (await blob.slice(0, 5).text() !== "%PDF-") throw new Error("Invalid PDF bytes");
  const name = disposition.match(/\bfilename="(receipt-[A-Za-z0-9._-]+\.pdf)"/i)?.[1];
  return { blob, filename: name ?? "receipt.pdf" };
}

/** Owns secrets outside presentation state. Each mount permits at most one exchange. */
export function createRecoveryOperation(deps: {
  browser: { read: () => string; clear: () => void };
  fetch?: typeof fetch; onState?: (state: RecoveryState) => void;
  offerPdf: (blob: Blob, filename: string) => void; timeoutMs?: number;
}) {
  const request = deps.fetch ?? fetch;
  let credential: ReturnType<typeof parseRecoveryFragment> = null;
  let state: RecoveryState = { status: "loading" };
  let initialized = false, attempted = false, busy = false, disposed = false;
  let controller: AbortController | null = null;
  function update(next: RecoveryState) { if (!disposed) { state = Object.freeze(next); deps.onState?.(state); } }
  function capture(changedFragment = false) {
    if (disposed || (initialized && !changedFragment)) return;
    let fragment = "";
    try {
      fragment = deps.browser.read();
      deps.browser.clear();
      if (attempted) return; // A different hash never restarts a consumed/uncertain operation.
      credential = null;
      initialized = true;
      if (!fragment || fragment === "#") update({ status: "missing" });
      else {
        credential = parseRecoveryFragment(fragment);
        update({ status: credential ? "ready" : "invalid" });
      }
    } catch { credential = null; initialized = true; controller?.abort(); update({ status: "unavailable" }); }
    finally { fragment = ""; }
  }
  async function exchange() {
    if (disposed || busy || attempted || state.status !== "ready" || !credential) return;
    attempted = true; busy = true;
    let input = credential;
    const tokenId = input.token_id;
    credential = null;
    update({ status: "exchanging" });
    controller = new AbortController();
    const timer = setTimeout(() => controller?.abort(), deps.timeoutMs ?? 15000);
    try {
      const pending = request("/api/donation-receipts/recovery-exchanges", { method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error", signal: controller.signal,
        headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ token_id: input.token_id, secret: input.secret }) });
      input = { token_id: "", secret: "" };
      const response = await pending;
      if (disposed) return;
      if (controller.signal.aborted) throw new Error("Exchange aborted");
      if (response.status === 404) { update({ status: "denied", message: "تعذر استخدام رابط الاسترجاع. قد يكون الرابط منتهي الصلاحية أو سبق استخدامه." }); return; }
      if ([400, 401, 403, 422].includes(response.status)) { update({ status: "denied", message: "تعذّر استخدام رابط الاسترجاع في هذه الجلسة. يمكنك طلب رابط آمن جديد." }); return; }
      if ([429, 503].includes(response.status)) { update({ status: "service-error", message: response.status === 429 ? "طلبات كثيرة. انتظر قبل طلب رابط جديد؛ لن نكرر استخدام هذا الرابط تلقائيًا." : "خدمة الاسترجاع غير متاحة مؤقتًا. لن نعيد استخدام الرابط تلقائيًا؛ يمكنك طلب تعليمات جديدة لاحقًا." }); return; }
      if (response.status !== 200) throw new Error("Uncertain exchange");
      const uuid = parseExchangeResponse(await response.json(), tokenId);
      if (controller.signal.aborted) throw new Error("Exchange aborted");
      update({ status: "authorized", receiptUuid: uuid });
    } catch {
      update({ status: "uncertain", message: "تعذّر تأكيد نتيجة التحقق؛ قد يكون الرابط استُخدم بالفعل. لا نعيد المحاولة بهذا الرابط. قد تحتاج إلى طلب رابط آمن جديد." });
    } finally { input = { token_id: "", secret: "" }; credential = null; clearTimeout(timer); controller = null; busy = false; }
  }
  async function download() {
    const uuid = state.receiptUuid;
    if (disposed || busy || !receiptUuid(uuid) || !["authorized", "download-error", "download-offered"].includes(state.status)) return;
    busy = true; update({ status: "downloading", receiptUuid: uuid });
    controller = new AbortController();
    const timer = setTimeout(() => controller?.abort(), deps.timeoutMs ?? 30000);
    try {
      const response = await request(protectedReceiptPath(uuid), { method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error", signal: controller.signal, headers: { Accept: "application/pdf" } });
      if (disposed) return;
      if (controller.signal.aborted) throw new Error("Download aborted");
      if ([401, 403, 404].includes(response.status)) { update({ status: "denied", message: "تعذّر الوصول إلى الإيصال بهذه الجلسة. قد تكون صلاحية الوصول انتهت أو الملف غير متاح؛ هذا لا يؤكد عدم وجود الإيصال. يمكنك طلب رابط جديد." }); return; }
      if (response.status !== 200) { update({ status: "download-error", receiptUuid: uuid, message: response.status === 429 ? "طلبات كثيرة. انتظر قليلًا قبل إعادة محاولة التنزيل." : "تنزيل الملف غير متاح مؤقتًا. يمكنك إعادة محاولة التنزيل دون إعادة استخدام رابط التحقق." }); return; }
      const pdf = await readPrivatePdf(response);
      if (disposed) return;
      if (controller.signal.aborted) throw new Error("Download aborted");
      deps.offerPdf(pdf.blob, pdf.filename);
      update({ status: "download-offered", receiptUuid: uuid, message: "تم تسليم الملف للمتصفح لبدء التنزيل. لا نستطيع تأكيد حفظ الملف على جهازك." });
    } catch { update({ status: "download-error", receiptUuid: uuid, message: "تعذّر استلام ملف PDF صالح بأمان. يمكنك إعادة محاولة التنزيل؛ لن نعيد التحقق بالرابط المستهلك." }); }
    finally { clearTimeout(timer); controller = null; busy = false; }
  }
  function dispose() { disposed = true; credential = null; controller?.abort(); state = { status: "missing" }; }
  return { capture, exchange, download, dispose, getState: () => state };
}
