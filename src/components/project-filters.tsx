import Link from "next/link";
import { changeProjectFilters, countryName, countryOptions, projectHref, type ProjectQuery } from "@/features/projects/data/query";

export function ProjectFilters({ query, categoryName }: { query: ProjectQuery; categoryName?: string | null }) {
  const countryRemoved = changeProjectFilters(query, { country_code: undefined });
  const categoryRemoved = changeProjectFilters(query, { donation_project_category_id: undefined });
  const sorted = query.sort !== "created_at";
  const active = !!(query.country_code || query.donation_project_category_id || sorted);
  return <div className="discovery-controls">
    <form action="/projects" method="get" aria-label="تصفية المشاريع" className="filter-form">
      <div className="filter-field"><label htmlFor="project-country">الدولة</label>
        <select id="project-country" name="country_code" defaultValue={query.country_code ?? ""} aria-describedby="country-help">
          <option value="">كل الدول</option>{countryOptions().map(country => <option key={country.code} value={country.code}>{country.name}</option>)}
        </select>
      </div>
      <div className="filter-field"><label htmlFor="project-sort">ترتيب المشاريع</label>
        <select id="project-sort" name="sort" defaultValue={query.sort}>
          <option value="created_at">الأحدث إنشاءً</option><option value="acceptance_ends_at">الأبعد موعدًا لانتهاء التبرع</option><option value="target_amount_minor">الأعلى هدفًا للتمويل</option>
        </select>
      </div>
      {query.donation_project_category_id && <input type="hidden" name="donation_project_category_id" value={query.donation_project_category_id} />}
      <button type="submit" className="primary-button">عرض النتائج ←</button>
      {active && <Link className="outline-link" href="/projects">مسح الكل</Link>}
    </form>
    <p className="filter-help" id="country-help">قائمة الدول وفق معيار ISO؛ قد لا تتوفر مشاريع في كل دولة. لاستكشاف تصنيف، اختر رابط التصنيف على أحد المشاريع.</p>
    {active && <nav className="applied-filters" aria-label="خيارات العرض المطبّقة"><span>المطبّق الآن:</span>
      {query.country_code && <Link href={projectHref(countryRemoved)} aria-label={`إزالة تصفية الدولة: ${countryName(query.country_code)}`}>{countryName(query.country_code)} <span aria-hidden="true">×</span></Link>}
      {query.donation_project_category_id && <Link href={projectHref(categoryRemoved)} aria-label="إزالة تصفية التصنيف">{categoryName || `التصنيف رقم ${query.donation_project_category_id}`} <span aria-hidden="true">×</span></Link>}
      {sorted && <Link href={projectHref(changeProjectFilters(query, { sort: "created_at" }))} aria-label="إعادة الترتيب إلى الأحدث">{query.sort === "acceptance_ends_at" ? "الأبعد موعدًا للانتهاء" : "الأعلى هدفًا"} <span aria-hidden="true">×</span></Link>}
    </nav>}
  </div>;
}
