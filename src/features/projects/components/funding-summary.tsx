import type { DonationProject } from "../types/project";
import Link from "next/link";
import { publicProjectLabels, projectDate } from "../data/presentation";
import { formatMoney } from "@/lib/formatters/money";

export function FundingSummary({ project }: { project: DonationProject }) {
  const start = projectDate(project.acceptance_starts_at);
  const end = projectDate(project.acceptance_ends_at);
  return <aside className="funding-summary" aria-labelledby="funding-heading"><p className="kicker">التمويل بوضوح</p><h2 id="funding-heading">هدفٌ يجمعنا</h2>
    <p className="funding-state">{publicProjectLabels[project.public_state]}</p>
    <dl className="detail-amounts"><div><dt>صافي المحصّل</dt><dd><bdi>{formatMoney(project.collected_amount_minor, project.currency)}</bdi></dd></div><div><dt>هدف التمويل</dt><dd><bdi>{formatMoney(project.target_amount_minor, project.currency)}</bdi></dd></div></dl>
    <p className="detail-progress-label">التقدّم {project.progress_percent.toLocaleString("ar-EG")}%</p><progress max={100} value={Math.min(100, Math.max(0, project.progress_percent))} aria-label={`تقدّم تمويل ${project.title}`} />
    {(project.progress_percent < 0 || project.progress_percent > 100) && <p className="data-note">نسبة المصدر خارج النطاق المعتاد؛ عُرضت كما وردت.</p>}
    <dl className="capacity"><div><dt>السعة المتبقية بعد الحجوزات</dt><dd><bdi>{formatMoney(project.remaining_amount_minor, project.currency)}</bdi></dd></div></dl>
    <p className="detail-note">هذه السعة كما يوردها النظام بعد احتساب الحجوزات. قد تتغير، ولا تضمن قبول تبرع جديد. نسبة التقدّم تعتمد على صافي المحصّل فقط.</p>
    {(start || end) && <div className="project-dates"><h3>فترة قبول التبرعات المسجّلة</h3><dl>{start && <div><dt>تبدأ</dt><dd><time dateTime={project.acceptance_starts_at!}>{start}</time></dd></div>}{end && <div><dt>تنتهي</dt><dd><time dateTime={project.acceptance_ends_at!}>{end}</time></dd></div>}</dl><p className="detail-note">التوقيت: القاهرة. نشر المشروع وحده لا يعني أن فترة قبول التبرعات مفتوحة الآن.</p></div>}
    {project.accepts_donations ? <div className="contribution-note"><h3>حضّر مساهمتك</h3><p>راجع المبلغ والبيانات قبل المتابعة. يتحقق النظام من أهلية التبرع والسعة المتاحة عند الإرسال.</p><Link className="primary-button contribution-link" href={`/donate/${project.id}`}>إدخال المبلغ والبيانات ←</Link></div>
      : <div className="contribution-note"><h3>{publicProjectLabels[project.public_state]}</h3><p>يبقى سجل الحملة ومعلومات تمويلها متاحين للاطلاع. اكتمال التمويل لا يعني اكتمال تنفيذ المشروع.</p><Link className="outline-link" href="/projects">استكشف المشاريع النشطة ←</Link></div>}
  </aside>;
}
