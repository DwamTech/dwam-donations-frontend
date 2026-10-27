export type Receipt = { uuid: string; number: string; issued_at: string | null; generation_status: string };
export type CheckoutDecision = { state: string; can_resume: boolean; can_start_new: boolean };
export const checkoutMessages: Record<string, string> = {
  resumable: "يمكنك استكمال نفس عملية الدفع دون إنشاء تبرع آخر.",
  requires_review: "عملية الدفع تحتاج مراجعة مالية أو تحققًا لدى بوابة الدفع. لا يمكن إعادة المحاولة قبل اعتماد الاسترداد؛ لا تدفع مرة أخرى.",
  processing: "محاولة الدفع قيد المعالجة أو نتيجتها غير مؤكدة. انتظر التحقق من العملية ولا تُعد الدفع.",
  expired: "انتهت صلاحية الحجز أو جلسة الدفع. لا يمكن استكمال العملية السابقة.",
  insufficient_time: "الوقت المتبقي للحجز لا يكفي لبدء الدفع بأمان. لم يتم إنشاء محاولة جديدة.",
  not_ready: "لم تكتمل بيانات تجهيز الدفع لهذا الطلب. لا يمكن استكماله من المراجعة حاليًا.",
  project_unavailable: "المشروع لا يسمح باستكمال الدفع حاليًا.",
  awaiting_confirmation: "يوجد دليل دفع مسجل، لكن التحصيل لم يُؤكد بعد. لا تُعد الدفع وانتظر تحديث الحالة.",
  completed: "تم تأكيد تحصيل التبرع. يمكنك متابعة الإيصال.",
  unavailable: "استكمال الدفع غير متاح لهذه العملية حاليًا.",
};
export function checkoutMessage(decision?: CheckoutDecision) { return checkoutMessages[decision?.state ?? "unavailable"] ?? checkoutMessages.unavailable; }
export type Contribution = { checkout?: CheckoutDecision; id: number; reference: string; amount_minor_exact: string; currency: string; status: string; reservation_state?: string; created_at: string | null; payment_status: string | null; refunded_amount_minor: string; receipts: Receipt[]; project: { id?: number; title: string; cover_image?: { url: string | null; caption: string | null } | null } | null };
export const paymentLabels: Record<string, string> = { pending: "بانتظار الدفع", processing: "الدفع قيد المعالجة", paid: "مدفوع", failed: "الدفع لم يكتمل", cancelled: "الدفع ملغى", partially_refunded: "مسترد جزئيًا", refunded: "مسترد بالكامل", requires_review: "قيد المراجعة" };
export function collectionLabel(donation: Contribution) { return donation.status === "confirmed" ? "تم التحصيل" : donation.status === "cancelled" ? "ملغى — لم يُحصّل" : "لم يُؤكد التحصيل"; }
export function issuedReceipts(donation: Contribution) { return donation.status === "confirmed" ? donation.receipts.filter(receipt => !!receipt.issued_at) : []; }
export function accountDate(value: string | null) {
  return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" }).format(new Date(value)) : "غير متاح";
}
