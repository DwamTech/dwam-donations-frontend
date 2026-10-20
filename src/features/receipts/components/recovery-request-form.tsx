"use client";
import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { createRecoveryRequest, validateRecoveryRequest, type RecoveryDraft, type RecoveryErrors, type RequestState } from "../data/recovery-request";

const subscribe = () => () => {};
const clientReady = () => true, serverReady = () => false;
const emptyDraft: RecoveryDraft = { receipt_number: "", email: "" };
export function RecoveryRequestForm() {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState<RecoveryErrors>({});
  const [state, setState] = useState<RequestState>({ status: "ready" });
  const operation = useRef<ReturnType<typeof createRecoveryRequest> | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const outcome = useRef<HTMLParagraphElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateRecoveryRequest(draft);
    setErrors(validation.errors);
    if (!validation.value) {
      const first = Object.keys(validation.errors)[0];
      form.current?.querySelector<HTMLInputElement>(`#recovery-${first}`)?.focus();
      return;
    }
    if (!operation.current) operation.current = createRecoveryRequest({ onState: setState });
    await operation.current.submit(draft);
    if (["accepted", "uncertain"].includes(operation.current.getState().status)) {
      setDraft(emptyDraft);
      requestAnimationFrame(() => outcome.current?.focus());
    }
  }
  return <div className="receipt-request">
    <noscript><p>فعّل JavaScript لإدخال البيانات وإرسال الطلب بأمان. لا تُرسل بياناتك في عنوان الصفحة.</p></noscript>
    {state.status === "accepted" || state.status === "uncertain"
      ? <p className="notice" role="status" tabIndex={-1} ref={outcome}>{state.message}</p>
      : <form method="dialog" noValidate onSubmit={submit} ref={form} aria-label="طلب تعليمات استرجاع الإيصال" aria-busy={state.status === "working"}>
        <fieldset disabled={!ready || state.status === "working"}><legend className="sr-only">رقم الإيصال والبريد الإلكتروني</legend>
          <div className="donation-field"><label htmlFor="recovery-receipt_number">رقم الإيصال <span aria-hidden="true">*</span></label><input id="recovery-receipt_number" value={draft.receipt_number} onChange={event => setDraft({ ...draft, receipt_number: event.target.value })} required maxLength={64} autoComplete="off" dir="ltr" aria-invalid={!!errors.receipt_number} aria-describedby={errors.receipt_number ? "recovery-receipt_number-error" : "recovery-number-help"} /><p id="recovery-number-help" className="field-help">استخدم رقم الإيصال الوارد في رسالتك، وليس رقم عملية بوابة الدفع.</p>{errors.receipt_number && <p id="recovery-receipt_number-error" className="field-error">{errors.receipt_number}</p>}</div>
          <div className="donation-field"><label htmlFor="recovery-email">البريد الإلكتروني <span aria-hidden="true">*</span></label><input id="recovery-email" type="email" value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} required maxLength={255} autoComplete="email" dir="ltr" aria-invalid={!!errors.email} aria-describedby={errors.email ? "recovery-email-error" : undefined} />{errors.email && <p id="recovery-email-error" className="field-error">{errors.email}</p>}</div>
          {Object.keys(errors).length > 0 && <p role="alert" className="field-error">راجع الحقول الموضحة قبل الإرسال.</p>}
          <button className="primary-button" type="submit">إرسال طلب التعليمات ←</button>
        </fieldset>
        <p role={state.status === "error" ? "alert" : "status"}>{state.status === "working" ? "جارٍ إرسال طلب التعليمات…" : state.message}</p>
      </form>}
  </div>;
}
