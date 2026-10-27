"use client";
import { useRef, useState } from "react";
import type { GuestReview } from "../data/guest-draft";
import type { BillingDetails } from "../data/billing-draft";
import { disabledCheckout, type CheckoutConfig } from "../data/checkout-config";
import { createCheckoutOperation, operationSnapshot, type OperationState, type Stage } from "../data/checkout-operation";
import { DonationReview } from "./donation-review";
import Link from "next/link";
import { useDonorSession } from "@/features/donors/session";

const stages: Record<Stage, string> = { intent: "جارٍ تسجيل طلب التبرع", reserve: "جارٍ التحقق من إمكانية حجز المبلغ", payment: "جارٍ تجهيز عملية الدفع", checkout: "جارٍ تجهيز صفحة الدفع الآمنة" };
export function CheckoutReview({ project, guest, billing, onEdit, config = disabledCheckout }: {
  project: { id: number; title: string; currency: string; reference?: string }; guest: GuestReview; billing: BillingDetails;
  onEdit: (step: "entry" | "billing") => void; config?: CheckoutConfig;
}) {
  const operation = useRef<ReturnType<typeof createCheckoutOperation> | null>(null);
  const verifying = useRef(false);
  const [checking, setChecking] = useState(false);
  const { refresh } = useDonorSession();
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<OperationState>({ status: "ready", stage: "intent" });
  async function proceed() {
    if (!config.enabled || verifying.current) return;
    verifying.current = true; setChecking(true);
    try {
      const session = await refresh();
      const matches = config.authenticated ? session.status === "authenticated" : session.status === "guest";
      if (!matches) {
        setState({ status: "attention", stage: state.stage, message: session.status === "authenticated" ? "أصبحت مسجل الدخول. تابع من مسار التبرع بحسابك." : "تعذر التحقق من جلسة التبرع. سجّل الدخول أو أعد التحقق قبل المتابعة." });
        return;
      }
      if (!operation.current) {
        try {
          const snapshot = operationSnapshot(project, guest, billing, config);
          operation.current = createCheckoutOperation(snapshot, { onState: setState, navigate: url => window.location.assign(url) });
          setStarted(true);
        } catch {
          setState({ status: "attention", stage: "intent", message: "تعذّر تجهيز الطلب بأمان. لم يتم إرسال البيانات." });
          return;
        }
      }
      await operation.current.run();
    } finally { verifying.current = false; setChecking(false); }
  }
  const active = checking || state.status === "working" || state.status === "redirecting";
  return <DonationReview project={project} guest={guest} billing={billing} started={started} onEdit={step => { if (!operation.current?.hasStarted()) onEdit(step); }}>
    <div className="checkout-operation" aria-busy={active}>
      {!config.enabled ? <p className="review-boundary" role="status">إرسال التبرع والدفع غير متاحين حاليًا. يمكنك مراجعة بياناتك وتعديلها فقط.</p> : <>
        <p className="detail-note">عند المتابعة تُرسل البيانات للتحقق من الطلب والحجز، ثم تُفتح صفحة مزوّد الدفع. الانتقال إليها لا يؤكد إتمام التبرع.</p>
        <p role={state.status === "attention" || state.status === "recoverable" ? "alert" : "status"} aria-live="polite">
          {state.status === "working" ? stages[state.stage] : state.status === "redirecting" ? "جارٍ الانتقال لصفحة الدفع الآمنة؛ لم يُؤكّد إتمام التبرع." : state.message}
        </p>
        {(state.status === "ready" || state.status === "recoverable" || active) && <button type="button" className="primary-button" disabled={active} onClick={proceed}>{state.status === "recoverable" ? "إعادة محاولة الخطوة بالبيانات نفسها" : active ? "يرجى الانتظار…" : "إرسال الطلب والمتابعة للدفع ←"}</button>}
        {state.status === "attention" && config.authenticated && <Link className="text-button" href={`/account?next=${encodeURIComponent(`/account/donate/${project.id}`)}`}>تسجيل الدخول والتحقق من تبرعاتي</Link>}
        {started && <p className="field-help">لا تُعد تحميل الصفحة أو تبدأ طلبًا آخر إذا كانت النتيجة غير مؤكدة. لا تتوفر هنا استعادة الحالة أو إلغاء الحجز؛ قد يبقى الحجز حتى انتهاء مهلته. لا تُحفظ بياناتك لاستعادتها بعد المغادرة.</p>}
      </>}
    </div>
  </DonationReview>;
}
