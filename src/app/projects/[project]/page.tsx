import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDonationProject, getDonationProjects } from "@/lib/projects";
import { canonical, site } from "@/lib/config/site";
import { descriptionText, publicMediaUrl } from "@/features/projects/data/presentation";
import { ProjectMedia } from "@/features/projects/components/project-media";
import { FundingSummary } from "@/features/projects/components/funding-summary";
import { ProjectGrid } from "@/components/project-grid";
import { ProjectUpdates } from "@/features/projects/components/project-updates";

type Props = { params: Promise<{ project: string }>; searchParams?: Promise<{ updates_page?: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await getDonationProject((await params).project);
  if (result.status === "not-found") notFound();
  if (result.status !== "ready") return { title: "تعذّر تحميل المشروع مؤقتًا", robots: { index: false, follow: true } };
  const project = result.project;
  const description = descriptionText(project);
  const path = `/projects/${project.id}`;
  const cover = publicMediaUrl(project.cover_image?.url);
  const image = cover && (cover.startsWith("http") ? cover : canonical(cover));
  return { title: project.title, description: description || undefined, alternates: { canonical: canonical(path) },
    openGraph: { type: "website", locale: "ar_EG", siteName: site.name, title: project.title, description: description || undefined,
      url: canonical(path), images: image ? [{ url: image, alt: project.cover_image?.caption || project.title }] : [] } };
}
async function RecentProjects({ currentId }: { currentId: number }) {
  const { page } = await getDonationProjects(1, 4);
  const projects = page?.data.filter(project => project.id !== currentId).slice(0, 3);
  if (!projects?.length) return null;
  return <section className="recent-projects"><div className="section-heading"><div><p className="kicker">تابع اكتشافك</p><h2>من أحدث المشاريع المنشورة</h2></div><Link className="outline-link" href="/projects">كل المشاريع ←</Link></div><ProjectGrid projects={projects} /></section>;
}
export default async function ProjectPage({ params, searchParams }: Props) {
  const identifier = (await params).project;
  const result = await getDonationProject(identifier);
  if (result.status === "not-found") notFound();
  if (result.status !== "ready") return <section className="section detail-outage" role="status"><p className="kicker">تعذّر الاتصال مؤقتًا</p><h1>نعود إليك بتفاصيل المشروع قريبًا</h1><p>تعذّر تحميل التفاصيل حاليًا. لا يعني ذلك أن المشروع غير موجود.</p><div className="hero-actions"><a className="primary-button" href={`/projects/${identifier}`}>إعادة المحاولة ←</a><Link className="outline-link" href="/projects">العودة إلى المشاريع</Link></div></section>;
  const project = result.project;
  const updatesQuery = (await searchParams)?.updates_page;
  const updatesPage = updatesQuery && /^[1-9]\d{0,8}$/.test(updatesQuery) ? Number(updatesQuery) : 1;
  let country = project.country_code;
  try { country = country ? new Intl.DisplayNames("ar", { type: "region" }).of(country) || country : null; } catch {}
  return <article className="section project-detail"><nav className="breadcrumbs" aria-label="مسار التنقل"><ol><li><Link href="/">الرئيسية</Link></li><li><Link href="/projects">المشاريع</Link></li><li aria-current="page">{project.title}</li></ol></nav>
    <header className="detail-heading"><p className="kicker">{project.category.name || "من المشاريع المنشورة"}</p><h1>{project.title}</h1><div className="project-facts"><span>المرجع: <bdi>{project.reference}</bdi></span>{country && <span>{country}</span>}{project.beneficiary_count !== null && <span>المستفيدون: {project.beneficiary_count.toLocaleString("ar-EG")}</span>}</div>{project.short_description && <p className="detail-introduction">{project.short_description}</p>}</header>
    <div className="detail-layout"><div className="detail-main"><ProjectMedia project={project} /><section className="project-description"><p className="kicker">حكاية المشروع</p><h2>عن المشروع</h2>{project.description ? <div className="description-text">{project.description}</div> : <p className="detail-note">لم يُنشر وصف تفصيلي لهذا المشروع بعد.</p>}</section></div><FundingSummary project={project} /></div>
    <Suspense fallback={null}><ProjectUpdates id={project.id} page={updatesPage} /></Suspense>
    <p className="detail-back"><Link className="outline-link" href="/projects">العودة إلى اكتشاف المشاريع ←</Link></p>
    <Suspense fallback={null}><RecentProjects currentId={project.id} /></Suspense>
  </article>;
}
