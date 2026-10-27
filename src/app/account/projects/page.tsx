import Link from 'next/link';
import { ProjectGrid } from '@/components/project-grid';
import { ProjectUnavailable } from '@/components/project-state';
import { getDonationProjects } from '@/lib/projects';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'تبرع من حسابك', robots: { index: false, follow: false } };

export default async function DonorProjectsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const requested = (await searchParams).page;
  const page = typeof requested === 'string' && /^[1-9][0-9]{0,3}$/.test(requested) ? Number(requested) : 1;
  const result = await getDonationProjects(page, 12, { page, state: 'active', sort: 'created_at' });
  return <section className="section">
    <p className="kicker">تبرع من حسابك</p><h1>اختر مشروعًا ليبدأ عطاؤك</h1>
    <p>ستتابع خطوات التبرع باستخدام حسابك المسجل، وتجد تبرعاتك وإيصالاتك في سجلك.</p>
    <p><Link className="text-button" href="/account">العودة إلى حسابي ←</Link></p>
    {!result.page ? <ProjectUnavailable retryHref="/account/projects" /> : <>
      <ProjectGrid projects={result.page.data} donorCheckout />
      <nav className="pagination" aria-label="صفحات مشاريع التبرع">
        {page > 1 && <Link href={`/account/projects?page=${page-1}`}>السابق</Link>}
        {page < result.page.meta.last_page && page < 9999 && <Link href={`/account/projects?page=${page+1}`}>التالي</Link>}
      </nav>
    </>}
  </section>;
}
