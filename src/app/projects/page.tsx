import Link from "next/link";
import { cache } from "react";
import { redirect } from "next/navigation";
import { ProjectGrid } from "@/components/project-grid";
import { ProjectFilters } from "@/components/project-filters";
import { ProjectUnavailable } from "@/components/project-state";
import { getDonationProjects } from "@/lib/projects";
import { canonical, site } from "@/lib/config/site";
import { needsNormalization, parseProjectQuery, projectHref, type SearchValues } from "@/features/projects/data/query";
// Primitive keys share one request-local read across metadata and page rendering.
function listing(query: ReturnType<typeof parseProjectQuery>) {
  return listingByKey(query.page, query.country_code, query.donation_project_category_id, query.sort, query.state);
}
const listingByKey = cache((page: number, country_code: string | undefined, donation_project_category_id: string | undefined, sort: ReturnType<typeof parseProjectQuery>["sort"], state: ReturnType<typeof parseProjectQuery>["state"]) => getDonationProjects(page, 12, { page, country_code, donation_project_category_id, sort, state }));
type Props = { searchParams: Promise<SearchValues> };
export async function generateMetadata({ searchParams }: Props) {
  const query = parseProjectQuery(await searchParams);
  const { page } = await listing(query);
  const title = query.page > 1 ? `مشاريع التبرع — الصفحة ${query.page.toLocaleString("ar-EG")}` : "مشاريع التبرع";
  const description = "تصفّح مشاريع التبرع المنشورة وأهداف التمويل وصافي المحصّل، مع التصفية بالدولة والتصنيف.";
  const url = canonical(projectHref(query));
  return { title, description, alternates: { canonical: url },
    robots: { index: !!page?.data.length && query.page <= page.meta.last_page && !query.country_code && !query.donation_project_category_id && query.sort === "created_at", follow: true },
    openGraph: { type: "website", locale: "ar_EG", siteName: site.name, title, description, url } };
}
export default async function ProjectsPage({ searchParams }: Props) {
  const values = await searchParams;
  const query = parseProjectQuery(values);
  if (needsNormalization(values, query)) redirect(projectHref(query));
  const { page } = await listing(query);
  const filtered = !!(query.country_code || query.donation_project_category_id);
  const category = page?.data.find(project => String(project.category.id) === query.donation_project_category_id)?.category.name;
  const href = projectHref(query);
  return <><section className="projects-hero"><p className="kicker">اختر وجهة عطائك</p><h1>لكل مشروع حكاية.<br /><em>ولعطائك مكان.</em></h1><p>تصفّح المشاريع المنشورة، أو اختر الدولة والترتيب المناسب لك.</p></section>
    <section className="section all-projects" aria-label="اكتشاف المشاريع">
      <nav className="history-tabs" aria-label="حالة جمع التبرعات">
        {([["active", "المشاريع النشطة"], ["funded", "المشاريع المكتملة تمويلياً"], ["expired", "المشاريع المنتهية"], ["closed", "مغلق للتبرعات"], ["reserved", "السعة المحجوزة"], ["upcoming", "قريباً"]] as const).map(([state, label]) => <Link key={state} aria-current={(query.state ?? "active") === state ? "page" : undefined} href={projectHref({ ...query, state, page: 1 })}>{label}</Link>)}
      </nav>
      <ProjectFilters query={query} categoryName={category} />
      {!page ? <ProjectUnavailable retryHref={href} /> : <>
        <div className="list-meta" role="status" aria-live="polite"><span>{page.meta.total.toLocaleString("ar-EG")} {filtered ? "مشروعًا يطابق اختيارك" : "مشروعًا منشورًا"}</span><span>{page.data.length > 0 && page.meta.from !== null && page.meta.to !== null ? `عرض ${page.meta.from.toLocaleString("ar-EG")}–${page.meta.to.toLocaleString("ar-EG")} · ` : ""}الصفحة {page.meta.current_page.toLocaleString("ar-EG")}</span></div>
        {page.data.length ? <ProjectGrid projects={page.data} discoveryQuery={query} /> : <div className="empty-state" role="status"><h2>{query.page > page.meta.last_page ? "لا توجد مشاريع في هذه الصفحة" : filtered ? "لا توجد مشاريع تطابق اختيارك" : "لا توجد مشاريع منشورة الآن"}</h2><p>{filtered ? "جرّب إزالة أحد خيارات التصفية أو اعرض كل المشاريع المنشورة." : "يمكنك العودة لاحقًا للاطلاع على المشاريع الجديدة."}</p>{filtered && <Link className="outline-link" href="/projects">عرض كل المشاريع ←</Link>}</div>}
        {(page.meta.last_page > 1 || query.page > 1) && <nav className="pagination" aria-label="صفحات المشاريع">
          {query.page > 1 && query.page <= page.meta.last_page && <Link rel="prev" href={projectHref({ ...query, page: query.page - 1 })}>→ السابق</Link>}
          {query.page > page.meta.last_page ? <Link href={projectHref({ ...query, page: 1 })}>العودة إلى أول صفحة</Link> : <span aria-current="page">{page.meta.current_page.toLocaleString("ar-EG")} من {page.meta.last_page.toLocaleString("ar-EG")}</span>}
          {query.page < page.meta.last_page && <Link rel="next" href={projectHref({ ...query, page: query.page + 1 })}>التالي ←</Link>}
        </nav>}
      </>}
    </section></>;
}
