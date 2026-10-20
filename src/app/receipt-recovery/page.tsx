import type { Metadata } from "next";
import Link from "next/link";
import { RecoveryLink } from "@/features/receipts/components/recovery-link";

export const metadata: Metadata = {
  title: "رابط استرجاع الإيصال", description: "إرشادات آمنة لرابط استرجاع الإيصال دون عرض بيانات الإيصال أو التبرع.",
  robots: { index: false, follow: false }, referrer: "no-referrer",
  openGraph: { title: "رابط استرجاع الإيصال", description: "تعامل آمن مع رابط الاسترجاع." },
};
// URL fragments remain browser-only; no request/search props are consumed here.
export default function ReceiptRecoveryLandingPage() {
  return <section className="section receipt-page" aria-labelledby="receipt-link-heading"><p className="kicker">الوصول الآمن للإيصال</p><h1 id="receipt-link-heading">رابط استرجاع الإيصال</h1>
    <p>الرابط مخصص للاستخدام مرة واحدة. لا تشاركه، ولا تعتبر فتح هذه الصفحة تأكيدًا لوجود إيصال أو اكتمال التبرع.</p>
    <RecoveryLink />
    <nav className="hero-actions" aria-label="التنقل من رابط الاسترجاع"><Link href="/receipts/recover" prefetch={false}>طلب تعليمات استرجاع</Link><Link href="/" prefetch={false}>الرئيسية</Link><Link href="/projects" prefetch={false}>المشاريع المنشورة</Link></nav>
  </section>;
}
