export type RecoveryDraft = { receipt_number: string; email: string };
export type RecoveryErrors = Partial<Record<keyof RecoveryDraft, string>>;
export function validateRecoveryRequest(draft: RecoveryDraft) {
  const receipt_number = draft.receipt_number.trim(), email = draft.email.trim();
  const errors: RecoveryErrors = {};
  if (!receipt_number || Array.from(receipt_number).length > 64 || /[\x00-\x1f\x7f]/.test(receipt_number)) errors.receipt_number = "أدخل رقم الإيصال كما ورد في رسالتك، بحد أقصى ٦٤ حرفًا.";
  if (!email || Array.from(email).length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "أدخل بريدًا إلكترونيًا صحيحًا بحد أقصى ٢٥٥ حرفًا.";
  return { errors, value: Object.keys(errors).length ? null : { receipt_number, email } };
}
export type RequestState = { status: "ready" | "working" | "accepted" | "error" | "uncertain"; message?: string };
export const neutralRecoveryMessage = "إذا كانت البيانات مطابقة لإيصال متاح للاسترجاع، سيتم إرسال تعليمات الاسترجاع إلى البريد الإلكتروني المسجل. هذا لا يؤكد وجود الإيصال أو إرسال الرسالة أو وصولها.";

export function createRecoveryRequest(deps: { fetch?: typeof fetch; onState?: (state: RequestState) => void; timeoutMs?: number } = {}) {
  const request = deps.fetch ?? fetch;
  let state: RequestState = { status: "ready" }, busy = false;
  function update(next: RequestState) { state = next; deps.onState?.(next); }
  async function submit(draft: RecoveryDraft) {
    if (busy || state.status === "accepted" || state.status === "uncertain") return;
    const { value } = validateRecoveryRequest(draft);
    if (!value) return;
    busy = true; update({ status: "working" });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 15000);
    try {
      const response = await request("/api/donation-receipts/recovery-requests", {
        method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error", signal: controller.signal,
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_number: value.receipt_number, email: value.email }),
      });
      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || Array.isArray(body) || typeof (body as Record<string, unknown>).message !== "string") throw new Error("Invalid response");
      if (response.status === 202) update({ status: "accepted", message: neutralRecoveryMessage });
      else if (response.status === 422 || response.status === 400) update({ status: "error", message: "تعذّر قبول تنسيق الطلب. راجع رقم الإيصال والبريد دون افتراض وجود إيصال مطابق." });
      else if (response.status === 429) update({ status: "error", message: "طلبات كثيرة. انتظر قليلًا قبل المحاولة مجددًا." });
      else if (response.status >= 400 && response.status < 500) update({ status: "error", message: "خدمة طلب الاسترجاع غير متاحة حاليًا. لا يمكن تحديد حالة أي إيصال من هذه النتيجة." });
      else if (response.status === 503) update({ status: "error", message: "الخدمة غير متاحة مؤقتًا. يمكنك المحاولة لاحقًا." });
      else throw new Error("Uncertain response");
    } catch {
      update({ status: "uncertain", message: "تعذّر تأكيد نتيجة طلب الإرسال. قد يكون النظام استلمه؛ لا نعيد إرساله تلقائيًا ولا نؤكد وصول رسالة. راجع بريدك لاحقًا." });
    } finally { clearTimeout(timer); busy = false; }
  }
  return { submit, getState: () => state };
}
