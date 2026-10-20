import Link from "next/link";
import { site } from "@/lib/config/site";
export function SiteFooter() {
  return <footer><div><Link className="brand" href="/">{site.name}<small>{site.tagline}</small></Link><p>مساحة لاكتشاف المشاريع وأهدافها، واختيار ما يلامس قلبك.</p></div>
    <nav aria-label="روابط التذييل"><Link href="/">الرئيسية</Link><Link href="/projects">المشاريع</Link><Link href="/receipts/recover">استرجاع إيصال</Link></nav>
    <div className="footer-reserved"><p>© {new Date().getFullYear()} {site.name}</p></div>
  </footer>;
}
