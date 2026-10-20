import Link from "next/link";
export const metadata = { title: "الصفحة غير موجودة", robots: { index: false, follow: true } };
export default function NotFound() {
  return <section className="section empty-state"><p className="kicker">404</p><h1>هذه الصفحة غير موجودة</h1><p>يمكنك متابعة رحلتك من المشاريع المنشورة.</p><Link className="primary-button" href="/projects">استكشف المشاريع ←</Link></section>;
}
