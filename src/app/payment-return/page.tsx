import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "العودة من صفحة الدفع",
  description: "معلومات عن تأكيد التبرع والإيصال بعد العودة من بوابة الدفع، دون عرض حالة عملية أو بيانات شخصية.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  // Replace inherited editorial metadata with a fixed, transaction-free description.
  openGraph: {
    title: "العودة من صفحة الدفع",
    description: "العودة من بوابة الدفع لا تؤكد نتيجة العملية.",
    type: "website",
  },
};

// Intentionally no request props, cookies, API reads, or client transaction state.
export default function PaymentReturnPage() {
  return <section className="section payment-return" aria-labelledby="payment-return-heading">
    <div className="payment-return-symbol" aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none" focusable="false"><rect x="9" y="7" width="30" height="34" rx="7" /><path d="M17 18h14M17 25h14M17 32h8" /></svg>
    </div>
    <p className="kicker">معلومات بعد العودة</p>
    <h1 id="payment-return-heading">العودة من صفحة الدفع</h1>
    <p className="payment-return-explanation">رجوعك من بوابة الدفع لا يؤكد نجاح العملية أو فشلها. يتم تأكيد حالة التبرع من خلال النظام بعد وصول إشعار الدفع الموثوق.</p>
    <div className="payment-return-guidance">
      <h2>بخصوص التأكيد والإيصال</h2>
      <p>قد يستغرق التأكيد بعض الوقت. هذه الصفحة لا تعرض حالة تبرع بعينه ولا تتحقق منها.</p>
      <p>إذا تم تأكيد التبرع وإصدار الإيصال، تُرسل معلومات الإيصال إلى البريد الإلكتروني المستخدم أثناء التبرع وفق خدمة الإرسال المتاحة. ظهور هذه الصفحة لا يعني أن رسالة بريد قد أُرسلت أو وصلت.</p>
      <p>ابحث عن رسالة المنصة بعنوان «إيصال التبرع متاح»، وراجع الرسائل غير المرغوب فيها (Spam). رسالة نجاح Paymob منفصلة عن إيصال المنصة. تحتوي رسالة المنصة عند وصولها على رقم الإيصال اللازم لطلب استرجاعه؛ لا تستخدم رقم عملية Paymob بدلًا منه.</p>
    </div>
    <nav className="hero-actions" aria-label="التنقل بعد العودة من الدفع">
      <Link className="primary-button" href="/projects" prefetch={false}>تصفح المشاريع المنشورة ←</Link>
      <Link className="outline-link" href="/" prefetch={false}>العودة إلى الرئيسية</Link>
      <Link className="outline-link" href="/receipts/recover" prefetch={false}>طلب تعليمات استرجاع الإيصال</Link>
    </nav>
  </section>;
}
