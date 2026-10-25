import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDonationProject } from "@/lib/projects";
import { ProjectImage } from "@/features/projects/components/project-image";
import { GuestDonationForm } from "@/features/donations/components/guest-donation-form";
import { fundingLabels, publicProjectLabels } from "@/features/projects/data/presentation";
import { formatMoney } from "@/lib/formatters/money";
import { checkoutConfig } from "@/features/donations/data/checkout-config";

type Props = { params: Promise<{ project: string }> };
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "مراجعة معلومات المساهمة", robots: { index: false, follow: true } };
export default async function DonatePage({ params }: Props) {
  const identifier = (await params).project;
  const result = await getDonationProject(identifier);
  if (result.status === "not-found") notFound();
  if (result.status !== "ready") return <section className="section detail-outage" role="status"><h1>تعذّر التحقق من المشروع حاليًا</h1><p>يرجى إعادة المحاولة قبل إدخال أي بيانات.</p><div className="hero-actions"><a className="primary-button" href={`/donate/${identifier}`}>إعادة المحاولة ←</a><Link className="outline-link" href="/projects">العودة إلى المشاريع</Link></div></section>;
  const project = result.project;
  if (!project.accepts_donations) return <section className="section donate-page"><h1>{publicProjectLabels[project.public_state]}</h1><p>هذا المشروع غير متاح لتبرع جديد. يمكنك الاطلاع على سجل الحملة وأرقام التمويل الفعلية.</p><div className="hero-actions"><Link className="outline-link" href={`/projects/${project.id}`}>عرض سجل المشروع ←</Link><Link className="primary-button" href="/projects">المشاريع النشطة ←</Link></div></section>;
  return <div className="section donate-page"><nav className="breadcrumbs" aria-label="مسار التنقل"><ol><li><Link href="/">الرئيسية</Link></li><li><Link href="/projects">المشاريع</Link></li><li><Link href={`/projects/${project.id}`}>{project.title}</Link></li><li aria-current="page">مراجعة المعلومات</li></ol></nav>
    <p><Link href={`/account/donate/${project.id}`}>التبرع من حساب مسجل</Link> · <Link href="/account">تسجيل الدخول وتبرعاتي</Link></p><header className="donate-heading"><p className="kicker">خطوة تبدأ بالوضوح</p><h1>مساهمتك، على بيّنة.</h1><p className="donate-selected">للمشروع: <Link href={`/projects/${project.id}`}>{project.title}</Link></p><p>أدخل المبلغ وبياناتك، ثم راجعها بهدوء. إدخال البيانات ومراجعتها لا يُنشئ تبرعًا أو حجزًا. تُرسل فقط عند اختيار المتابعة للدفع إذا كانت الخدمة متاحة.</p></header>
    <div className="donate-layout"><GuestDonationForm key={project.id} project={{ id: project.id, title: project.title, currency: project.currency, reference: project.reference }} checkout={checkoutConfig(process.env)} />
      <aside className="donation-project-summary" aria-labelledby="selected-project-heading"><div className="donation-summary-image"><ProjectImage src={project.cover_image?.url ?? null} alt={project.cover_image?.caption || project.title} /></div><p className="kicker">المشروع المختار</p><h2 id="selected-project-heading">{project.title}</h2><p className="detail-note">المرجع: <bdi>{project.reference}</bdi> · العملة: <bdi>{project.currency}</bdi></p><p className="funding-state">{fundingLabels[project.financial_status]}</p>
        <dl className="donation-summary-amounts"><div><dt>هدف التمويل</dt><dd><bdi>{formatMoney(project.target_amount_minor, project.currency)}</bdi></dd></div><div><dt>صافي المحصّل</dt><dd><bdi>{formatMoney(project.collected_amount_minor, project.currency)}</bdi></dd></div><div><dt>السعة المتبقية بعد الحجوزات</dt><dd><bdi>{formatMoney(project.remaining_amount_minor, project.currency)}</bdi></dd></div></dl>
        <p className="detail-progress-label">التقدّم {project.progress_percent.toLocaleString("ar-EG")}%</p><progress max={100} value={Math.min(100, Math.max(0, project.progress_percent))} aria-label={`تقدّم تمويل ${project.title}`} />{(project.progress_percent < 0 || project.progress_percent > 100) && <p className="data-note">نسبة المصدر خارج النطاق المعتاد؛ عُرضت كما وردت.</p>}
        <p className="detail-note">السعة المعروضة قابلة للتغيّر ولا تضمن قبول المبلغ أو حجزه. نشر المشروع لا يؤكد أن فترة قبول التبرعات مفتوحة الآن. يُتحقّق من أهلية المشروع والمبلغ عند إتاحة الإرسال الفعلي.</p><Link className="outline-link" href={`/projects/${project.id}`}>العودة إلى تفاصيل المشروع ←</Link>
      </aside>
    </div>
  </div>;
}
