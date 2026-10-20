import { billingFields, type BillingDraft, type BillingErrors, type BillingField } from "../data/billing-draft";

export function BillingFields({ draft, errors, onChange }: { draft: BillingDraft; errors: BillingErrors; onChange: (field: BillingField, value: string) => void }) {
  return <><p className="billing-purpose">تتطلب خطوة الدفع المقبلة بيانات فوترة منفصلة. أدخل الاسم الأول واسم العائلة صراحةً؛ يمكنك تعديل البريد والهاتف المنقولين من بيانات المتبرع. هذه مراجعة محلية، ولا تُرسل البيانات الآن.</p>
    <div className="billing-fields">{(Object.keys(billingFields) as BillingField[]).map(field => {
      const config = billingFields[field];
      const id = `billing-${field}`;
      const error = errors[field];
      return <div className={`donation-field billing-${field}`} key={field}>
        <label htmlFor={id}>{config.label} <span aria-hidden="true">*</span></label>
        {field === "country" ? <select id={id} value={draft.country} required autoComplete="section-billing country" aria-invalid={!!error} aria-describedby={`billing-country-help${error ? ` ${id}-error` : ""}`} onChange={event => onChange(field, event.target.value)}><option value="">اختر دولة عنوان الفوترة</option><option value="EG">مصر (EG)</option></select>
          : <input id={id} type={field === "email" ? "email" : field === "phone_number" ? "tel" : "text"} required maxLength={config.max} value={draft[field]}
            dir={field === "email" || field === "phone_number" ? "ltr" : undefined} autoComplete={config.autoComplete === "off" ? "off" : `section-billing ${config.autoComplete}`}
            aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} onChange={event => onChange(field, event.target.value)} />}
        {field === "country" && <p className="field-help" id="billing-country-help">تدعم بيانات الفوترة في هذه الخطوة عناوين في مصر فقط. اختر الدولة بنفسك.</p>}
        {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
      </div>;
    })}</div><p className="field-help">كل حقول الفوترة مطلوبة. أدخل بيانات عنوانك الفعلية، ولا تستخدم قيمًا افتراضية مثل N/A.</p>
  </>;
}
