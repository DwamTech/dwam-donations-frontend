"use client";
import { useEffect, useRef, useState } from "react";
import { createRecoveryOperation, type RecoveryState } from "../data/recovery-operation";
import { createPdfOffer } from "../data/browser-pdf";

export function RecoveryLink() {
  const operation = useRef<ReturnType<typeof createRecoveryOperation> | null>(null);
  const pdf = useRef<ReturnType<typeof createPdfOffer> | null>(null);
  const lifetime = useRef({ generation: 0 });
  const heading = useRef<HTMLHeadingElement>(null);
  const [state, setState] = useState<RecoveryState>({ status: "loading" });
  useEffect(() => {
    const lease = lifetime.current;
    const current = ++lease.generation;
    if (!operation.current) {
      pdf.current = createPdfOffer();
      operation.current = createRecoveryOperation({ browser: {
        read: () => window.location.hash,
        clear: () => window.history.replaceState(window.history.state, "", "/receipt-recovery"),
      }, onState: setState, offerPdf: (blob, filename) => pdf.current?.offer(blob, filename) });
    }
    operation.current.capture();
    const changedFragment = () => operation.current?.capture(true);
    window.addEventListener("hashchange", changedFragment);
    return () => {
      window.removeEventListener("hashchange", changedFragment);
      // Strict Mode immediately attaches again. A real unmount releases memory
      // after that replay window, aborts pending work and revokes temporary PDFs.
      queueMicrotask(() => {
        if (lease.generation !== current) return;
        operation.current?.dispose(); pdf.current?.dispose();
        operation.current = null; pdf.current = null;
      });
    };
  }, []);
  useEffect(() => {
    if (!["loading", "ready", "exchanging", "downloading"].includes(state.status)) heading.current?.focus();
  }, [state.status]);
  const busy = state.status === "exchanging" || state.status === "downloading";
  const downloadable = !!state.receiptUuid && ["authorized", "download-error", "download-offered", "downloading"].includes(state.status);
  return <div className="receipt-link-state" aria-busy={busy}>
    <h2 tabIndex={-1} ref={heading}>التحقق والوصول للإيصال</h2>
    <div role="status" aria-live="polite">
    {state.status === "loading" && <p>تُزال بيانات رابط الاسترجاع من عنوان الصفحة عند تفعيل JavaScript. لا يجري التحقق من إيصال أو إرسال أي طلب.</p>}
    {state.status === "missing" && <p>لا توجد بيانات رابط استرجاع في هذه الصفحة. افتح رابط الرسالة دون مشاركته. إعادة التحميل لا تعيد بيانات الرابط بعد إزالتها.</p>}
    {state.status === "invalid" && <p>الرابط غير مكتمل أو تنسيقه غير صالح. أُزيلت بياناته من عنوان الصفحة ولم نستخدمه للتحقق من أي إيصال.</p>}
    {state.status === "unavailable" && <p>تعذّر تنظيف عنوان الرابط بأمان. لم نرسل بياناته؛ أغلق الصفحة ولا تشارك عنوانها.</p>}
    {state.status === "ready" && <p>أُزيلت بيانات الرابط من العنوان. تنسيقه صحيح محليًا، لكنه يحتاج إلى تحقق النظام قبل إتاحة الإيصال. يستخدم التحقق الرابط مرة واحدة.</p>}
    {state.status === "exchanging" && <p>جارٍ التحقق من صلاحية رابط الاسترجاع…</p>}
    {state.status === "authorized" && <p>أجاز النظام الوصول إلى الإيصال في هذه الجلسة. يمكنك طلب تنزيل ملف PDF المحمي؛ لم يبدأ التنزيل بعد.</p>}
    {state.status === "downloading" && <p>جارٍ استلام ملف الإيصال المحمي…</p>}
    {state.message && <p>{state.message}</p>}
    </div>
    {(state.status === "ready" || state.status === "exchanging") && <button className="primary-button" type="button" disabled={busy} onClick={() => operation.current?.exchange()}>التحقق من رابط الاسترجاع</button>}
    {downloadable && <button className="primary-button" type="button" disabled={busy} onClick={() => operation.current?.download()}>تنزيل الإيصال PDF</button>}
    <p className="field-help">الصلاحية مرتبطة بهذه الجلسة وملفات الارتباط المحمية. إعادة تحميل الصفحة لا تستعيد الرابط أو الإيصال من الذاكرة. لا تشارك رابط الرسالة.</p>
    <noscript><p>يتطلب تنظيف الرابط JavaScript. لم نقرأ الرابط أو نرسل بياناته. أغلق الصفحة ولا تشارك عنوانها.</p></noscript>
  </div>;
}
