"use client";
import { useRef, useState } from "react";
import { billingFields, type BillingDetails, type BillingField } from "@/features/donations/data/billing-draft";
import { checkoutDestination } from "@/features/donations/data/checkout-operation";
import type { CheckoutConfig } from "@/features/donations/data/checkout-config";
import { checkoutMessage, type CheckoutDecision } from "./contributions";

export type SavedReview = { billing: BillingDetails; can_continue: boolean; stage: "checkout" };
export function SavedPaymentReview({ id, review, config, decision }: { id: string; review: SavedReview; config: CheckoutConfig; decision?: CheckoutDecision }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const submitted = useRef(false);
  async function continuePayment() {
    if (submitted.current || !review.can_continue || decision?.can_resume !== true || !config.enabled) return;
    submitted.current = true; setAttempted(true); setBusy(true); setMessage("");
    try {
      const r = await fetch(`/api/donor/donations/${encodeURIComponent(id)}/checkout`, { method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!r.ok) { const result = await r.json().catch(() => null); setMessage(r.status === 401 ? "انتهت الجلسة. سجّل الدخول لمتابعة نفس التبرع." : result?.checkout ? checkoutMessage(result.checkout) : "تعذرت متابعة عملية الدفع الحالية. حدّث حالة التبرع قبل أي محاولة أخرى، ولا تبدأ دفعًا جديدًا."); return; }
      const destination = checkoutDestination(await r.json(), config.hosts);
      window.location.assign(destination.url);
    } catch { setMessage("لم نتمكن من تأكيد صلاحية رابط الدفع. حدّث حالة التبرع ولا تُعد الدفع إذا كنت أكملته بالفعل."); }
    finally { setBusy(false); }
  }
  return <section className="donation-review saved-payment-review"><h2>مراجعة بيانات الدفع المحفوظة</h2><p className="detail-note">هذه بيانات عملية الدفع المرتبطة بنفس التبرع. الرجوع للمراجعة لا ينشئ تبرعًا أو عملية دفع جديدة، ولا يعد تأكيدًا للتحصيل.</p><h3>بيانات الفوترة</h3><dl>{(Object.keys(billingFields) as BillingField[]).map(field => <div key={field}><dt>{billingFields[field].label}</dt><dd>{review.billing[field]}</dd></div>)}</dl>
    {message && <p role="alert" className="notice">{message}</p>}
    {review.can_continue && decision?.can_resume === true && config.enabled ? <><p>لو لم تُكمل الدفع، يمكنك متابعة نفس العملية. إذا دفعت بالفعل، حدّث الحالة وانتظر التأكيد بدل الدفع مرة أخرى.</p><button className="primary-button" disabled={busy || attempted} onClick={continuePayment}>{busy ? "جارٍ فتح صفحة الدفع…" : "استكمال الدفع"}</button></> : <p role="status">{decision?.can_resume && !config.enabled ? "خدمة استكمال الدفع غير مفعّلة حاليًا. حاول لاحقًا." : checkoutMessage(decision)}</p>}
  </section>;
}
