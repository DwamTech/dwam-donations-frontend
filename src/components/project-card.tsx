import { ProjectImage } from "@/features/projects/components/project-image";
import Link from "next/link";
import { changeProjectFilters, projectHref, type ProjectQuery } from "@/features/projects/data/query";
import type { DonationProject } from "@/features/projects/types/project";
import { formatMoney } from "@/lib/formatters/money";
import { publicProjectLabels } from "@/features/projects/data/presentation";
import { DonationLink } from "@/features/donors/donation-link";

function countryName(code: string) {
  try { return new Intl.DisplayNames("ar", { type: "region" }).of(code) ?? code; } catch { return code; }
}
export function ProjectCard({ project, discoveryQuery, donorCheckout = false }: { project: DonationProject; discoveryQuery?: ProjectQuery; donorCheckout?: boolean }) {
  const percentage = Math.min(100, Math.max(0, project.progress_percent));
  const status = publicProjectLabels[project.public_state];
  return <article className="project-card">
    <div className="project-image">
      <ProjectImage key={project.cover_image?.url} src={project.cover_image?.url ?? null} alt={project.cover_image?.caption || project.title} />
      {project.country_code && <span className="country-pill">{discoveryQuery ? <Link href={projectHref(changeProjectFilters(discoveryQuery, { country_code: project.country_code }))} aria-label={`عرض مشاريع ${countryName(project.country_code)}`}>{countryName(project.country_code)}</Link> : countryName(project.country_code)}</span>}
    </div>
    <div className="project-body">
      {project.category.name && <div className="eyebrow">{discoveryQuery && project.category.id ? <Link className="category-discovery" href={projectHref(changeProjectFilters(discoveryQuery, { donation_project_category_id: String(project.category.id) }))} aria-label={`عرض مشاريع تصنيف ${project.category.name}`}>{project.category.name} <span aria-hidden="true">←</span></Link> : project.category.name}</div>}
      <h3><Link className="project-title-link" href={`/projects/${project.id}`}>{project.title}</Link></h3>
      {project.short_description && <p>{project.short_description}</p>}
      <span className="project-status">{status}</span>
      <div className="progress-row"><span>التقدّم {project.progress_percent.toLocaleString("ar-EG")}%</span><span>صافي المحصّل</span></div>
      <progress max={100} value={percentage} aria-label={`تقدّم تمويل ${project.title}`} />
      {(project.progress_percent > 100 || project.progress_percent < 0) && <p className="data-note">نسبة المصدر خارج النطاق المعتاد؛ عُرضت كما وردت.</p>}
      <div className="funding"><strong><bdi>{formatMoney(project.collected_amount_minor, project.currency)}</bdi></strong><span>من هدف <bdi>{formatMoney(project.target_amount_minor, project.currency)}</bdi></span></div>
      {project.accepts_donations && (donorCheckout ? <Link className="outline-link" href={`/account/donate/${project.id}`}>تبرع الآن ←</Link> : <DonationLink className="outline-link" projectId={project.id}>تبرع الآن ←</DonationLink>)}
    </div>
  </article>;
}
