"use client";
import { useEffect, useReducer, useRef, useSyncExternalStore, type FormEvent } from "react";
import { validateGuestDraft, type DraftField } from "../data/guest-draft";
import { initialBillingFlow, billingFlowReducer } from "../data/billing-flow";
import { validateBilling, type BillingField } from "../data/billing-draft";
import { BillingFields } from "./billing-fields";
import { CheckoutReview } from "./checkout-review";
import { disabledCheckout, type CheckoutConfig } from "../data/checkout-config";
import { currencyPrecision } from "@/lib/formatters/money";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
export function GuestDonationForm({ project, checkout = disabledCheckout, initialContact }: { project: { id: number; title: string; currency: string; reference?: string }; checkout?: CheckoutConfig; initialContact?: { name: string; email: string } }) {
  const [state, dispatch] = useReducer(billingFlowReducer, { ...initialBillingFlow, guest: { ...initialBillingFlow.guest, draft: { ...initialBillingFlow.guest.draft, ...(initialContact ? { name: initialContact.name, email: initialContact.email } : {}) } } });
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const form = useRef<HTMLFormElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const guest = state.guest;
  useEffect(() => { if (state.step !== "entry") stepHeading.current?.focus(); }, [state.step]);
  function focusField(prefix: "guest" | "billing", field: DraftField | BillingField) {
    requestAnimationFrame(() => form.current?.querySelector<HTMLInputElement | HTMLSelectElement>(`#${prefix}-${field}`)?.focus());
  }
  function edit(step: "entry" | "billing") {
    dispatch({ type: "edit", step });
    focusField(step === "entry" ? "guest" : "billing", step === "entry" ? "amount" : "first_name");
  }
  function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.step === "entry") {
      const { errors } = validateGuestDraft(guest.draft, project.currency);
      dispatch({ type: "next", currency: project.currency });
      const first = Object.keys(errors)[0] as DraftField | undefined;
      if (first) focusField("guest", first);
    } else if (state.step === "billing") {
      const { errors } = validateBilling(state.billing);
      dispatch({ type: "review", currency: project.currency });
      const first = Object.keys(errors)[0] as BillingField | undefined;
      if (first) focusField("billing", first);
    }
  }
  function field(field: DraftField, label: string, type = "text", autoComplete?: string) {
    const error = guest.errors[field];
    return <div className="donation-field"><label htmlFor={`guest-${field}`}>{label} <span aria-hidden="true">*</span></label>
      <input id={`guest-${field}`} type={type} autoComplete={autoComplete} required value={guest.draft[field]}
        dir={field === "email" || field === "phone" ? "ltr" : undefined} maxLength={field === "name" || field === "email" ? 255 : undefined}
        aria-invalid={!!error} aria-describedby={error ? `guest-${field}-error` : undefined}
        onChange={event => dispatch({ type: "guest", action: { type: "field", field, value: event.target.value } })} />
      {error && <p className="field-error" id={`guest-${field}-error`}>{error}</p>}</div>;
  }
  const errors = state.step === "entry" ? guest.errors : state.billingErrors;
  return <section className="donation-entry" aria-labelledby="donation-step-heading">
    <ol className="donation-steps" aria-label="خطوات مراجعة المعلومات"><li aria-current={state.step === "entry" ? "step" : undefined}>١. المبلغ والبيانات</li><li aria-current={state.step === "billing" ? "step" : undefined}>٢. الفوترة</li><li aria-current={state.step === "review" ? "step" : undefined}>٣. المراجعة</li></ol>
    <noscript><p className="notice">فعّل JavaScript لإدخال البيانات ومراجعتها محليًا. لا تُرسل أي بيانات في هذه الصفحة.</p></noscript>
    <h2 id="donation-step-heading" tabIndex={-1} ref={stepHeading}>{state.step === "entry" ? "حدد المبلغ وعرّفنا بك" : state.step === "billing" ? "بيانات الفوترة" : "راجع مساهمتك المقترحة"}</h2>
    {state.step === "review" && guest.review && state.billingReview
      ? <CheckoutReview project={project} guest={guest.review} billing={state.billingReview} config={checkout} onEdit={edit} />
      : <><p className="detail-note">الحقول المعلّمة بنجمة مطلوبة. لا تحفظ هذه الصفحة بياناتك؛ إعادة تحميلها تبدأ مراجعة جديدة.</p>
        {/* No native data serialization or network submission, including before hydration. */}
        <form key={state.step} method="dialog" noValidate onSubmit={advance} ref={form} aria-label={state.step === "entry" ? checkout.authenticated ? "مبلغ المساهمة وبيانات التواصل" : "مبلغ المساهمة وبيانات الزائر" : "بيانات الفوترة"}>
          <fieldset disabled={!ready}><legend className="sr-only">{state.step === "entry" ? "المبلغ وبيانات التواصل" : "بيانات الفوترة"}</legend>
            {state.step === "entry" ? <>
              <div className="donation-field amount-field"><label htmlFor="guest-amount">مبلغ المساهمة المقترح <span aria-hidden="true">*</span></label><div className="amount-input"><input id="guest-amount" type="text" inputMode="decimal" dir="ltr" autoComplete="off" required maxLength={64} value={guest.draft.amount} onChange={event => dispatch({ type: "guest", action: { type: "field", field: "amount", value: event.target.value } })} aria-invalid={!!guest.errors.amount} aria-describedby={`amount-help${guest.errors.amount ? " guest-amount-error" : ""}`} /><span>{project.currency}</span></div>
                <p className="field-help" id="amount-help">أرقام عربية أو لاتينية، دون فواصل آلاف. {currencyPrecision(project.currency) ? "استخدم النقطة أو الفاصلة العشرية العربية ٫ للكسور، مثل ١٫٥ أو 1.5." : "هذه العملة تستخدم أعدادًا صحيحة دون كسور."}</p>{guest.errors.amount && <p className="field-error" id="guest-amount-error">{guest.errors.amount}</p>}</div>
              {field("name", "الاسم", "text", "name")}{field("email", "البريد الإلكتروني", "email", "email")}{field("phone", "رقم الهاتف", "tel", "tel")}
              <div className="anonymous-choice"><input id="guest-anonymous" type="checkbox" checked={guest.draft.is_public_anonymous} onChange={event => dispatch({ type: "guest", action: { type: "anonymous", value: event.target.checked } })} aria-describedby="anonymous-help" /><div><label htmlFor="guest-anonymous">أفضّل عدم عرض اسمي علنًا</label><p id="anonymous-help" className="field-help">خيار اختياري؛ يظل إدخال الاسم وبيانات التواصل مطلوبًا.</p></div></div>
            </> : <BillingFields draft={state.billing} errors={state.billingErrors} onChange={(field, value) => dispatch({ type: "billing-field", field, value })} />}
            {Object.values(errors).some(Boolean) && <p className="field-error" role="alert">راجع الحقول المبيّنة قبل المتابعة.</p>}
            <div className="billing-actions">{state.step === "billing" && <button className="outline-button" type="button" onClick={() => edit("entry")}>العودة إلى المبلغ والبيانات</button>}<button className="primary-button donation-review-button" type="submit">{state.step === "entry" ? "متابعة إلى بيانات الفوترة ←" : "مراجعة المبلغ والبيانات ←"}</button></div>
          </fieldset>
        </form>
      </>}
  </section>;
}
