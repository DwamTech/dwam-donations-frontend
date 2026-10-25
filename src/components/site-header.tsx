import Link from "next/link";
import { site } from "@/lib/config/site";

const Navigation = () => <><Link href="/">الرئيسية</Link><Link href="/projects">المشاريع</Link><Link href="/account">حساب المتبرع</Link><Link href="/#how-it-works">كيف نعمل</Link><Link href="/#transparency">الشفافية</Link></>;

export function SiteHeader() {
  return <header className="site-header">
    <Link className="brand" href="/">{site.name}<small>{site.tagline}</small></Link>
    <nav className="desktop-nav" aria-label="التنقل الرئيسي"><Navigation /></nav>
    <Link className="header-cta" href="/projects">استكشف العطاء <span aria-hidden="true">←</span></Link>
    <details className="mobile-menu"><summary>القائمة</summary><nav aria-label="التنقل على الهاتف"><Navigation /></nav></details>
  </header>;
}
