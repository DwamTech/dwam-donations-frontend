import { validateGuestDraft, type GuestDraft } from "./guest-draft";
import { validateBilling, type BillingDraft } from "./billing-draft";
import type { CheckoutConfig } from "./checkout-config";

export type Stage = "intent" | "reserve" | "payment" | "checkout";
export interface IntentResponse { data: { reference: string; amount_minor: number | string; currency: string; status: string; reservation_state: string; is_public_anonymous: boolean; created_at: string | null; project: { reference: string; title: string } | null; is_general: boolean } }
export interface ReservationResponse { data: { reference: string; status: string; reservation: { applicable: boolean; state: string; expires_at: string | null }; next_step: string } }
export interface PaymentResponse { data: { donation_reference: string }; idempotent_replay: boolean }
export interface CheckoutResponse { data: { checkout_url: string; expires_at: string | null } }
export type OperationState = Readonly<{ status: "ready" | "working" | "recoverable" | "attention" | "redirecting"; stage: Stage; message?: string }>;
type Project = { id: number; currency: string; reference?: string };
export const uuidV4 = () => crypto.randomUUID();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function operationSnapshot(project: Project, draft: GuestDraft, billing: BillingDraft, config: CheckoutConfig, key = uuidV4) {
  const donor = validateGuestDraft(draft, project.currency).review;
  const payer = validateBilling(billing).billing;
  if (!config.enabled || !/^[A-Za-z0-9_-]{1,50}$/.test(config.gateway) || !Number.isSafeInteger(project.id) || project.id < 1 || !donor || !payer) throw new Error("Unavailable operation");
  const intentKey = key(), paymentKey = key();
  if (!uuid.test(intentKey) || !uuid.test(paymentKey) || intentKey === paymentKey) throw new Error("Unavailable operation identity");
  return Object.freeze({
    intent: Object.freeze({ name: donor.name, email: donor.email, phone: donor.phone, amount: donor.amount, donation_project_id: project.id, is_public_anonymous: donor.is_public_anonymous }),
    payment: Object.freeze({ gateway_code: config.gateway, billing: Object.freeze(payer) }),
    intentKey, paymentKey, amountMinor: donor.amount_minor, currency: project.currency, projectReference: project.reference,
    hosts: Object.freeze([...config.hosts]),
    authenticated: config.authenticated === true,
  });
}
type Snapshot = ReturnType<typeof operationSnapshot>;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid envelope");
  return value as Record<string, unknown>;
}
function data(value: unknown) { return object(object(value).data); }
function minor(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) return value;
  throw new Error("Invalid amount");
}
function instant(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error("Invalid expiry");
  return Date.parse(value);
}
export function checkoutDestination(value: unknown, hosts: readonly string[], now = Date.now()) {
  const result = data(value);
  if (typeof result.checkout_url !== "string" || /[\s\\\x00-\x1f\x7f]/.test(result.checkout_url)) throw new Error("Invalid checkout");
  const url = new URL(result.checkout_url);
  if (url.protocol !== "https:" || url.username || url.password || url.port || !hosts.includes(url.hostname) || url.hash) throw new Error("Unapproved checkout");
  // Null is part of the upstream contract, but cannot prove a usable session lifetime.
  if (instant(result.expires_at) <= now) throw new Error("Expired checkout");
  return { url: url.href, expires: instant(result.expires_at) };
}
class RequestFailure extends Error { constructor(readonly status: number, readonly wellFormed: boolean) { super("Request unavailable"); } }
function errorEnvelope(value: unknown) {
  try {
    const envelope = object(value);
    if (typeof envelope.message !== "string") return false;
    if (envelope.errors !== undefined) {
      const errors = object(envelope.errors);
      if (!Object.values(errors).every(messages => Array.isArray(messages) && messages.every(message => typeof message === "string"))) return false;
    }
    return true;
  } catch { return false; }
}
const messages: Record<number, string> = {
  400: "تعذّر قبول الطلب. لا تبدأ طلبًا آخر قبل مراجعة الحالة.",
  401: "تعذّر التحقق من صلاحية المتابعة في هذه الجلسة.",
  403: "المتابعة غير مسموحة في هذه الجلسة.",
  404: "تعذّر التحقق من صلاحية المتابعة؛ قد تكون الجلسة أو مهلة الحجز انتهت. هذا لا يعني حذف المشروع.",
  409: "تعذّرت المتابعة بسبب تعارض أو حالة تتطلب المراجعة. لم يُؤكّد إتمام التبرع.",
  422: "لم يقبل الخادم البيانات أو الطلب. لا تبدأ عملية جديدة قبل مراجعة الحالة.",
  429: "طلبات كثيرة. انتظر قليلًا قبل إعادة المحاولة بالبيانات نفسها.",
  503: "خدمة الدفع غير متاحة حاليًا. لم يُؤكّد إتمام التبرع.",
};

/** One in-memory operation. No automatic retries, cookie inspection, or settlement inference. */
export function createCheckoutOperation(snapshot: Snapshot, dependencies: {
  fetch?: typeof fetch; navigate: (url: string) => void; onState?: (state: OperationState) => void; now?: () => number; timeoutMs?: number;
}) {
  const request = dependencies.fetch ?? fetch;
  const now = dependencies.now ?? Date.now;
  let state: OperationState = Object.freeze({ status: "ready", stage: "intent" });
  let busy = false, started = false, reference: string | undefined, donorId: number | undefined, reserved = false, paid = false, expires = 0;
  function update(next: OperationState) { state = Object.freeze(next); dependencies.onState?.(state); }
  async function post(stage: Stage) {
    const path = snapshot.authenticated
      ? stage === "intent" ? "/api/donor/donations" : `/api/donor/donations/${donorId}/${stage}`
      : stage === "intent" ? "/api/donations" : `/api/donations/${reference}/${stage}`;
    const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
    if (stage === "intent" || stage === "payment") headers["Idempotency-Key"] = stage === "intent" ? snapshot.intentKey : snapshot.paymentKey;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? 15000);
    try {
      const response = await request(path, { method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error", headers,
        body: JSON.stringify(stage === "intent" ? snapshot.authenticated ? { amount: snapshot.intent.amount, donation_project_id: snapshot.intent.donation_project_id, is_public_anonymous: snapshot.intent.is_public_anonymous } : snapshot.intent : stage === "payment" ? snapshot.payment : {}), signal: controller.signal });
      let value: unknown;
      try { value = await response.json(); } catch { throw new RequestFailure(response.status, false); }
      if (!response.ok) throw new RequestFailure(response.status, errorEnvelope(value));
      if (!(stage === "intent" || stage === "payment" ? [200, 201] : [200]).includes(response.status)) throw new Error("Unexpected success");
      return value;
    } finally { clearTimeout(timer); }
  }
  async function run() {
    if (busy || state.status === "attention" || state.status === "redirecting") return;
    busy = true; started = true;
    let stage: Stage = !reference ? "intent" : !reserved ? "reserve" : !paid ? "payment" : "checkout";
    try {
      if (!reference) {
        update({ status: "working", stage });
        const result = data(await post(stage));
        if (snapshot.authenticated) {
          if (typeof result.id !== 'number' || !Number.isSafeInteger(result.id) || result.id < 1) throw new Error('Invalid owned donation locator');
          donorId = result.id;
        }
        if (typeof result.reference !== "string" || !/^DON-[A-Z0-9]{1,100}$/.test(result.reference) || minor(result.amount_minor) !== snapshot.amountMinor || result.currency !== snapshot.currency || result.status !== "initiated" || result.reservation_state !== "none" || result.is_general !== false || result.is_public_anonymous !== snapshot.intent.is_public_anonymous) throw new Error("Invalid intent");
        const project = object(result.project);
        if (typeof project.reference !== "string" || typeof project.title !== "string" || (snapshot.projectReference && project.reference !== snapshot.projectReference)) throw new Error("Invalid project");
        instant(result.created_at);
        reference = result.reference;
      }
      if (!reserved) {
        stage = "reserve"; update({ status: "working", stage });
        const result = data(await post(stage)), reservation = object(result.reservation);
        if (result.reference !== reference || result.status !== "initiated" || result.next_step !== "payment_not_initiated" || reservation.applicable !== true || reservation.state !== "active") throw new Error("Invalid reservation");
        expires = instant(reservation.expires_at);
        if (expires <= now()) throw new Error("Expired reservation");
        reserved = true;
      }
      if (expires <= now()) throw new Error("Expired reservation");
      if (!paid) {
        stage = "payment"; update({ status: "working", stage });
        const result = object(await post(stage));
        if (data(result).donation_reference !== reference || typeof result.idempotent_replay !== "boolean") throw new Error("Invalid payment");
        paid = true;
      }
      stage = "checkout"; update({ status: "working", stage });
      if (expires <= now()) throw new Error("Expired reservation");
      const destination = checkoutDestination(await post(stage), snapshot.hosts, now());
      if (destination.expires <= now() || expires <= now()) throw new Error("Expired checkout");
      update({ status: "redirecting", stage });
      dependencies.navigate(destination.url);
    } catch (error) {
      // Intent scope is issued with its response. A lost first response cannot prove replay scope.
      // Payment consumes guest capability; checkout can have reached the provider. Both need review on ambiguity.
      const safeRetry = error instanceof RequestFailure && error.wellFormed && (error.status === 429 || (stage === "reserve" && error.status === 409) || (stage === "payment" && error.status === 503));
      update({ status: safeRetry ? "recoverable" : "attention", stage,
        message: error instanceof RequestFailure && error.wellFormed ? stage === "reserve" && error.status === 409 ? "لم يُؤكّد حجز المبلغ؛ قد لا تكفي السعة أو قد لا يسمح وضع المشروع بالمتابعة. يمكنك إعادة محاولة الحجز للطلب نفسه لاحقًا دون إنشاء طلب جديد." : messages[error.status] ?? "تعذّرت المتابعة. تحتاج حالة الطلب إلى مراجعة قبل أي محاولة جديدة." : "لم نتمكن من تأكيد نتيجة الخطوة. لا تنشئ تبرعًا آخر؛ تحتاج الحالة إلى مراجعة وقد يبقى الحجز حتى انتهاء مهلته." });
    } finally { busy = false; }
  }
  return Object.freeze({ run, getState: () => state, hasStarted: () => started });
}
