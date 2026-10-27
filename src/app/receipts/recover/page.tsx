import type { Metadata } from "next";
import Link from "next/link";
import { RecoveryRequestForm } from "@/features/receipts/components/recovery-request-form";

export const metadata: Metadata = {
  title: "طلب استرجاع الإيصال", description: "طلب تعليمات آمنة لاسترجاع إيصال دون عرض بياناته أو تأكيد وجوده.",
  robots: { index: false, follow: false }, referrer: "no-referrer",
  openGraph: { title: "طلب استرجاع الإيصال", description: "تعليمات استرجاع الإيصال عبر البريد الإلكتروني." },
};
export default function ReceiptRecoveryRequestPage() {
  return <section className="section receipt-page" aria-labelledby="receipt-request-heading"><p className="kicker">خصوصية معلوماتك أولًا</p><h1 id="receipt-request-heading">طلب تعليمات استرجاع الإيصال</h1>
    <p>أدخل رقم الإيصال والبريد المستخدم للتبرع. لا يؤكد الطلب وجود إيصال أو إرسال بريد، ولا يعرض حالة التبرع.</p>
    <aside className="notice" aria-label="العثور على رقم الإيصال"><h2>أين أجد رقم الإيصال؟</h2><p>ابحث عن رسالة المنصة بعنوان «إيصال التبرع متاح» في كل البريد، بما فيه الرسائل غير المرغوب فيها (Spam). تحتوي الرسالة على رقم الإيصال ورابط هذه الصفحة. رسالة Paymob ورقم عمليتها ليسا رقم إيصال المنصة.</p><p>إذا وجدت رسالة المنصة في Spam، يمكنك تعليمها بأنها ليست رسالة غير مرغوب فيها. لا تحتاج إلى التبرع أو الدفع مرة أخرى للحصول على الإيصال.</p></aside>
    <p className="notice">إذا وصلت رسالة الاسترجاع، افتح رابطها في متصفحك ثم اختر التحقق من الرابط للوصول إلى تنزيل الإيصال المحمي. لا نؤكد وصول الرسالة أو توفر الملف قبل تحقق النظام.</p>
    <RecoveryRequestForm />
    <nav className="hero-actions" aria-label="التنقل من طلب الاسترجاع"><Link href="/" prefetch={false}>الرئيسية</Link><Link href="/projects" prefetch={false}>المشاريع المنشورة</Link></nav>
  </section>;
}
