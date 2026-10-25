import Link from "next/link";
import { Suspense } from "react";
import { ProjectGrid } from "@/components/project-grid";
import { ProjectUnavailable, ProjectsLoading } from "@/components/project-state";
import { Hero, HowItWorks, Transparency, Closing } from "@/components/home-sections";
import { getDonationProjects } from "@/lib/projects";
import { canonical, site } from "@/lib/config/site";
export const metadata = { alternates: { canonical: canonical("/") },
  openGraph: { type: "website", locale: "ar_EG", siteName: site.name, title: site.name, description: site.description, url: canonical("/") } };
export const dynamic = "force-dynamic";
async function LatestProjects() {
  const result = await getDonationProjects(1, 6);
  return result.page ? <ProjectGrid projects={result.page.data} /> : <ProjectUnavailable />;
}
export default function HomePage() {
  return <><Hero /><section className="impact-strip" aria-label="وضوح المشروع"><div><strong>هدف واضح</strong><span>تعرف إلى غاية كل مشروع</span></div><div><strong>تقدّم معلن</strong><span>صافي التمويل كما يورده النظام</span></div><div><strong>اختيارك له معنى</strong><span>ابدأ بالقضية الأقرب إليك</span></div></section>
    <section className="section featured"><div className="section-heading"><div><p className="kicker">المشاريع النشطة</p><h2>فرص للعطاء،<br /><em>ومساحة للأمل.</em></h2><p className="section-description">حملات متاحة للتبرع، بحسب تحقق الخادم من الفترة والسعة المتبقية.</p></div><Link href="/projects" className="outline-link">كل المشاريع ←</Link></div><Suspense fallback={<ProjectsLoading />}><LatestProjects /></Suspense></section>
    <HowItWorks /><Transparency /><Closing /></>;
}
