import { billingFields, type BillingDetails, type BillingField } from "../data/billing-draft";
import type { GuestReview } from "../data/guest-draft";
import { formatMoney } from "@/lib/formatters/money";
import type { ReactNode } from "react";

export function DonationReview({ project, guest, billing, onEdit, started = false, children }: { project: { title: string; currency: string }; guest: GuestReview; billing: BillingDetails; onEdit: (step: "entry" | "billing") => void; started?: boolean; children?: ReactNode }) {
  return <div className="donation-review">
    <p className="detail-note">{started ? "بدأت محاولة الإرسال. البيانات مقفلة لحماية الطلب من التكرار؛ إتمام التبرع لم يُؤكّد." : "هذه مراجعة للبيانات فقط. لم يُنشأ تبرع أو حجز أو عملية دفع."}</p>
    <h3>المساهمة وبيانات المتبرع</h3><dl><div><dt>المشروع</dt><dd>{project.title}</dd></div><div className="review-amount"><dt>المبلغ المقترح</dt><dd><bdi>{formatMoney(guest.amount_minor, project.currency)}</bdi></dd></div><div><dt>الاسم</dt><dd>{guest.name}</dd></div><div><dt>البريد الإلكتروني</dt><dd><bdi>{guest.email}</bdi></dd></div><div><dt>الهاتف</dt><dd><bdi>{guest.phone}</bdi></dd></div><div><dt>عرض الاسم علنًا</dt><dd>{guest.is_public_anonymous ? "عدم عرض الاسم علنًا" : "لم يُطلب إخفاء الاسم علنًا"}</dd></div></dl>
    <button className="outline-button" type="button" disabled={started} onClick={() => onEdit("entry")}>تعديل المبلغ وبيانات المتبرع ←</button>
    <h3 className="billing-review-heading">بيانات الفوترة</h3><dl>{(Object.keys(billingFields) as BillingField[]).map(field => <div key={field}><dt>{billingFields[field].label}</dt><dd>{field === "email" || field === "phone_number" ? <bdi>{billing[field]}</bdi> : field === "country" ? "مصر (EG)" : billing[field]}</dd></div>)}</dl>
    <button className="outline-button" type="button" disabled={started} onClick={() => onEdit("billing")}>تعديل بيانات الفوترة ←</button>
    {children ?? <p className="review-boundary">الإرسال والدفع غير متاحين حاليًا.</p>}
  </div>;
}
