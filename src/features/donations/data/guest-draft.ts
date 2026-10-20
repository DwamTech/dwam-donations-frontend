import { currencyPrecision } from "@/lib/formatters/money";

// DonationIntentService's 64-bit technical ceiling. Its configured commercial
// limit is not exposed by the public API and must be rechecked in Phase 02D-2.
export const TECHNICAL_MAX_MINOR = "9223372036854775807";
export function latinDigits(value: string) {
  return value.replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) - (digit <= "٩" ? 0x0660 : 0x06f0)));
}
export type AmountResult = { ok: true; major: string; minor: string } | { ok: false; error: string };
export function validateAmount(raw: string, currency: string, maxMinor = TECHNICAL_MAX_MINOR): AmountResult {
  const major = latinDigits(raw.trim()).replace(/٫/g, ".");
  const precision = currencyPrecision(currency);
  const pattern = precision ? new RegExp(`^(?:0|[1-9]\\d*)(?:\\.\\d{1,${precision}})?$`) : /^(?:0|[1-9]\d*)$/;
  if (!major) return { ok: false, error: "أدخل مبلغ المساهمة." };
  if (major.length > 32 || !pattern.test(major)) return { ok: false, error: precision ? `اكتب مبلغًا موجبًا دون فواصل آلاف، وبحد أقصى ${precision} خانات عشرية.` : "اكتب مبلغًا صحيحًا موجبًا دون فواصل أو كسور لهذه العملة." };
  const [whole, fraction = ""] = major.split(".");
  const minor = BigInt(whole + fraction.padEnd(precision, "0"));
  if (minor === BigInt(0)) return { ok: false, error: "يجب أن يكون المبلغ أكبر من صفر." };
  if (minor > BigInt(TECHNICAL_MAX_MINOR) || minor > BigInt(maxMinor)) return { ok: false, error: "المبلغ يتجاوز الحد التقني المسموح. أدخل مبلغًا أقل." };
  return { ok: true, major, minor: minor.toString() };
}
export type GuestDraft = { amount: string; name: string; email: string; phone: string; is_public_anonymous: boolean };
export type DraftField = Exclude<keyof GuestDraft, "is_public_anonymous">;
export type DraftErrors = Partial<Record<DraftField, string>>;
export type GuestReview = { amount: string; amount_minor: string; name: string; email: string; phone: string; is_public_anonymous: boolean };
export function validateGuestDraft(draft: GuestDraft, currency: string): { errors: DraftErrors; review: GuestReview | null } {
  const errors: DraftErrors = {};
  const amount = validateAmount(draft.amount, currency);
  const name = draft.name.trim();
  const email = draft.email.trim();
  const phone = latinDigits(draft.phone.trim());
  if (!amount.ok) errors.amount = amount.error;
  if (!name) errors.name = "أدخل اسمك.";
  else if (Array.from(name).length > 255) errors.name = "يجب ألا يزيد الاسم على 255 حرفًا.";
  if (!email) errors.email = "أدخل بريدك الإلكتروني.";
  else if (Array.from(email).length > 255 || !/^[^\s@]+@[^\s@]+$/u.test(email)) errors.email = "أدخل بريدًا إلكترونيًا صالحًا، مثل name@example.com.";
  if (!phone) errors.phone = "أدخل رقم هاتفك.";
  else if (!/^\+?[0-9][0-9\s\-()]{5,31}$/.test(phone) || /[\r\n]/.test(phone)) errors.phone = "أدخل رقم هاتف صالحًا من 6 إلى 32 خانة، مع علامة + اختيارية ومسافات أو شرطات أو أقواس.";
  if (!amount.ok || Object.keys(errors).length) return { errors, review: null };
  return { errors, review: { amount: amount.major, amount_minor: amount.minor, name, email, phone, is_public_anonymous: draft.is_public_anonymous } };
}
export type DraftState = { step: "entry" | "review"; draft: GuestDraft; errors: DraftErrors; review: GuestReview | null };
export const initialDraftState: DraftState = { step: "entry", draft: { amount: "", name: "", email: "", phone: "", is_public_anonymous: false }, errors: {}, review: null };
export type DraftAction = { type: "field"; field: DraftField; value: string } | { type: "anonymous"; value: boolean } | { type: "review"; currency: string } | { type: "edit" };
export function guestDraftReducer(state: DraftState, action: DraftAction): DraftState {
  if (action.type === "edit") return { ...state, step: "entry", review: null };
  if (action.type === "field") return { ...state, step: "entry", review: null, draft: { ...state.draft, [action.field]: action.value }, errors: { ...state.errors, [action.field]: undefined } };
  if (action.type === "anonymous") return { ...state, step: "entry", review: null, draft: { ...state.draft, is_public_anonymous: action.value } };
  const result = validateGuestDraft(state.draft, action.currency);
  return { ...state, ...result, step: result.review ? "review" : "entry" };
}
