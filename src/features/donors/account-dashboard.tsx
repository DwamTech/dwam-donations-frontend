"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useDonorSession } from "./session";
import { accountDate, collectionLabel, issuedReceipts, paymentLabels, checkoutMessage, type Contribution, type Receipt } from "./contributions";
import { formatMoney } from "@/lib/formatters/money";
import { ProjectImage } from "@/features/projects/components/project-image";

export type AccountView = "overview" | "contributions" | "receipts";
function ReceiptCard({ receipt, donation }: { receipt: Receipt; donation: Contribution }) {
  return <article className="donor-receipt-card"><div><h3>إيصال <bdi>{receipt.number}</bdi></h3><p>{donation.project?.title ?? "تبرع عام"}</p><p>تاريخ الإصدار: <time dateTime={receipt.issued_at ?? undefined}>{accountDate(receipt.issued_at)}</time></p></div>
    {receipt.generation_status === "ready" ? <a className="outline-link" href={`/api/donor/receipts/${encodeURIComponent(receipt.uuid)}`}>تنزيل PDF</a> : <span className="receipt-pending" role="status">الإيصال قيد التجهيز</span>}
    <Link className="text-button" href={`/account/contributions/${donation.id}`}>تفاصيل التبرع ←</Link></article>;
}
export function ContributionCard({ donation, detail = false }: { donation: Contribution; detail?: boolean }) {
  return <article className="donor-contribution">
    <div className="donor-contribution-heading">{donation.project?.cover_image?.url && <div className="donor-project-thumbnail"><ProjectImage src={donation.project.cover_image.url} alt={donation.project.cover_image.caption || donation.project.title} /></div>}<div><h3>{donation.project?.title ?? "تبرع عام"}</h3><p>المرجع: <bdi>{donation.reference}</bdi></p><p>التاريخ: <time dateTime={donation.created_at ?? undefined}>{accountDate(donation.created_at)}</time></p></div><strong><bdi>{formatMoney(donation.amount_minor_exact, donation.currency)}</bdi></strong></div>
    <dl className="donor-contribution-facts"><div><dt>حالة الدفع</dt><dd>{donation.checkout?.state === "requires_review" ? "تحتاج مراجعة لدى بوابة الدفع أو مراجعة مالية" : donation.checkout?.state === "processing" ? "قيد المعالجة — لا تُعد الدفع" : donation.checkout?.state === "expired" ? "انتهت مهلة الدفع" : donation.payment_status ? paymentLabels[donation.payment_status] ?? donation.payment_status : "لم يبدأ الدفع"}</dd></div><div><dt>حالة التحصيل</dt><dd>{collectionLabel(donation)}</dd></div><div><dt>المسترد المؤكد</dt><dd><bdi>{formatMoney(donation.refunded_amount_minor, donation.currency)}</bdi></dd></div></dl>
    {donation.checkout && donation.status === "initiated" && <p className="checkout-status-note">{checkoutMessage(donation.checkout)}</p>}
    <div className="donor-contribution-footer">{detail ? donation.project?.id && <Link className="text-button" href={`/projects/${donation.project.id}`}>عرض المشروع ←</Link> : <Link className={donation.checkout?.can_resume ? "primary-button" : "text-button"} href={`/account/contributions/${donation.id}`}>{donation.checkout?.can_resume ? "مراجعة واستكمال الدفع ←" : "تفاصيل التبرع ←"}</Link>}<span>{issuedReceipts(donation).length ? `${issuedReceipts(donation).length} إيصال` : donation.status === "confirmed" ? "الإيصال قيد الإعداد" : "يصدر الإيصال بعد تأكيد التحصيل"}</span></div>
  </article>;
}
export function AccountDashboard({ view = "overview" }: { view?: AccountView }) {
  const { session, refresh, signedOut } = useDonorSession();
  const [rows, setRows] = useState<Contribution[]>([]);
  const [page, setPage] = useState(1);
  const [last, setLast] = useState(1);
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    async function load() {
      setReady(false); setRows([]); setMessage("");
      try {
        const r = await fetch(`/api/donor/contributions${page > 1 ? `?page=${page}` : ""}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        if (r.status === 401) { await refresh(); return; }
        if (!r.ok) throw new Error();
        const result = await r.json();
        if (!Array.isArray(result.data) || !Number.isSafeInteger(result.meta?.last_page) || result.meta.last_page < 1) throw new Error();
        if (!cancelled) { setRows(result.data); setLast(result.meta.last_page); setReady(true); }
      } catch { if (!cancelled) setMessage("تعذر تحميل السجل. أعد المحاولة؛ لم يتم تأكيد أي تغيير في تبرعاتك."); }
    }
    void load();
    return () => { cancelled = true; controller.abort(); };
  }, [page, version, refresh]);
  async function logout() {
    if (busy) return; setBusy(true);
    try {
      const r = await fetch("/api/donor/logout", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!r.ok) throw new Error();
      signedOut();
    } catch { setMessage("تعذر إنهاء الجلسة. حاول مرة أخرى."); } finally { setBusy(false); }
  }
  if (session.status !== "authenticated") return null;
  const profile = session.profile;
  const receipts = rows.flatMap(donation => issuedReceipts(donation).map(receipt => ({ donation, receipt })));
  return <div className="donor-dashboard"><div className="donor-welcome"><div><p className="kicker">أهلًا {profile.name}</p><h2>عطاؤك وإيصالاتك في مكان واحد</h2><p>تابع حالة الدفع والتحصيل لكل تبرع مرتبط بحسابك.</p></div><Link className="primary-button" href="/account/projects">تبرع الآن من حسابك ←</Link></div>
    <nav className="account-tabs" aria-label="أقسام حسابي"><Link href="/account" aria-current={view === "overview" ? "page" : undefined}>حسابي</Link><Link href="/account/contributions" aria-current={view === "contributions" ? "page" : undefined}>تبرعاتي</Link><Link href="/account/receipts" aria-current={view === "receipts" ? "page" : undefined}>إيصالاتي</Link></nav>
    <div className="donor-dashboard-layout"><aside className="donor-sidebar"><section className="donor-profile-card"><div className="donor-avatar" aria-hidden="true">{Array.from(profile.name.trim())[0] || "♡"}</div><h2>{profile.name}</h2><p className="donor-profile-email" dir="ltr">{profile.email}</p><button className="outline-button" disabled={busy} onClick={logout}>تسجيل الخروج</button></section><section className="donor-recovery-card"><h2>تبرعت كضيف من قبل؟</h2><p>تبرعات الضيف لها وصول مستقل، ولا تُضاف إلى حسابك بمجرد تطابق البريد.</p><Link className="text-button" href="/receipts/recover">استرجاع إيصال الضيف ←</Link></section></aside>
      <section className="donor-history" aria-labelledby="donor-history-title"><header className="donor-history-heading"><div><h2 id="donor-history-title">{view === "receipts" ? "إيصالاتي" : "تبرعاتي"}</h2><p>{view === "receipts" ? "إيصالات تبرعاتك المؤكدة، مع تنزيل محمي." : "حالة الدفع مستقلة عن تأكيد التحصيل."}</p></div><button className="outline-button" disabled={!ready && !message} onClick={() => setVersion(v => v + 1)}>تحديث السجل</button></header>
      {message && <p className="donor-login-error" role="alert">{message}</p>}{!ready && !message && <p role="status">جارٍ تحميل السجل…</p>}
      {ready && view !== "receipts" && (rows.length ? <div className="donor-contribution-list">{rows.map(donation => <ContributionCard key={donation.id} donation={donation} />)}</div> : <div className="donor-history-empty"><h3>رحلة عطائك تبدأ من هنا</h3><p>لا توجد تبرعات مرتبطة بهذا الحساب.</p><Link className="text-button" href="/account/projects">استكشف المشاريع ←</Link></div>)}
      {ready && (view === "receipts" || view === "overview") && <section className="account-receipts" aria-label="إيصالاتي">{view === "overview" && <h3>إيصالاتي</h3>}{receipts.length ? receipts.map(({ donation, receipt }) => <ReceiptCard key={receipt.uuid} donation={donation} receipt={receipt} />) : <div className="donor-history-empty"><h3>لا توجد إيصالات {last > 1 ? "في هذه الصفحة" : "حتى الآن"}</h3><p>يظهر الإيصال هنا بعد إصداره لتبرع مؤكد التحصيل.</p></div>}{last > 1 && <p className="detail-note">الإيصالات المعروضة تخص صفحة التبرعات الحالية. تصفح الصفحات الأخرى لعرض باقي الإيصالات.</p>}</section>}
      {last > 1 && <nav className="pagination" aria-label="صفحات سجل الحساب"><button className="outline-button" disabled={page <= 1 || !ready} onClick={() => setPage(p => p - 1)}>السابق</button><span>صفحة {page} من {last}</span><button className="outline-button" disabled={page >= last || !ready} onClick={() => setPage(p => p + 1)}>التالي</button></nav>}
      </section></div></div>;
}
