import Link from 'next/link';
import { getDonationProject } from '@/lib/projects';
import { DonationCheckoutEntry } from '@/features/donors/checkout-entry';
import { checkoutConfig } from '@/features/donations/data/checkout-config';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'تبرع من حسابك', robots: { index: false, follow: false } };
export default async function OwnedDonationPage({ params }: { params: Promise<{ project: string }> }) {
  const result = await getDonationProject((await params).project);
  if (result.status !== 'ready' || !result.project.accepts_donations) return <section className="section"><h1>المشروع غير متاح لتبرع جديد</h1><Link href="/projects">المشاريع</Link></section>;
  const p = result.project;
  const config = checkoutConfig(process.env);
  return <section className="section"><h1>تبرع من حسابك: {p.title}</h1><p>تأكد من <Link href="/account">تسجيل الدخول</Link> قبل الإرسال. تُنسب الملكية إلى حسابك الموثق. بيانات التواصل هنا تساعد في إعداد بيانات الفوترة.</p>
    <DonationCheckoutEntry owned project={{ id: p.id, title: p.title, currency: p.currency, reference: p.reference }} checkout={{ ...config, enabled: config.enabled && process.env.DONOR_PORTAL_ENABLED === 'true', authenticated: true }} />
  </section>;
}
