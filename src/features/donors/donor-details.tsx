"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useDonorSession } from "./session";
import { ContributionCard } from "./account-dashboard";
import { accountDate, issuedReceipts, checkoutMessage, type Contribution } from "./contributions";
import { SavedPaymentReview, type SavedReview } from "./saved-payment-review";
import { disabledCheckout, type CheckoutConfig } from "@/features/donations/data/checkout-config";

export function DonorDetails({ id, checkout = disabledCheckout }: { id: string; checkout?: CheckoutConfig }) {
  const { session, refresh } = useDonorSession();
  const [donation, setDonation] = useState<Contribution | null>(null);
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);
  const [review, setReview] = useState<SavedReview | null>(null);
  const identity = session.status === "authenticated" ? session.profile.id : null;
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setDonation(null); setReview(null); setMessage("");
      if (identity === null) return;
      try {
        const r = await fetch(`/api/donor/contributions/${encodeURIComponent(id)}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        if (r.status === 401) { await refresh(); return; }
        if (!r.ok) throw new Error();
        const result = await r.json();
        if (!result.data || String(result.data.id) !== id || !Array.isArray(result.data.receipts)) throw new Error();
        if (!controller.signal.aborted) { setDonation(result.data); setReview(result.checkout_review ?? null); }
      } catch { if (!controller.signal.aborted) setMessage("هذا التبرع غير متاح في حسابك، أو تعذر تحميله حاليًا."); }
    }
    void load();
    return () => controller.abort();
  }, [id, identity, refresh, version]);
  const login = `/account?next=${encodeURIComponent(`/account/contributions/${id}`)}`;
  return <section className="section donor-account donor-detail"><header className="donor-account-heading"><p className="kicker">حسابي · تبرعاتي</p><h1>{review ? "مراجعة ومتابعة الدفع" : "تفاصيل التبرع"}</h1><p>تابع حالة طلبك والدفع والتحصيل والإيصال.</p></header>{session.status !== "authenticated" ? <div className="notice"><p role="status">{session.status === "loading" ? "جارٍ التحقق من الجلسة…" : "سجّل الدخول بحساب مالك التبرع لعرض التفاصيل."}</p><Link className="text-button" href={login}>تسجيل الدخول</Link></div> : <>
    {donation && review && <SavedPaymentReview key={`${id}-${version}`} id={id} review={review} config={checkout} decision={donation.checkout} />}
    {donation?.checkout?.can_start_new && donation.project?.id && <div className="donor-new-request"><p>يمكنك بدء تبرع جديد مستقل. التبرع السابق يظل محفوظًا بحالته، ولا يُعاد استخدامه أو تعديل مبلغه.</p><Link className="outline-link" href={`/account/donate/${donation.project.id}`}>بدء تبرع جديد مستقل</Link></div>}
    {message && <div role="alert"><p>{message}</p><button className="outline-button" onClick={() => setVersion(v => v + 1)}>إعادة المحاولة</button></div>}{!donation && !message && <p role="status">جارٍ تحميل التبرع…</p>}{donation && <><ContributionCard donation={donation} detail /><div className="donor-detail-status"><h2>متابعة العملية</h2><p>{checkoutMessage(donation.checkout)}</p><button className="outline-button" onClick={() => setVersion(v => v + 1)}>تحديث حالة التبرع</button></div><section className="account-receipts"><h2>إيصالات هذا التبرع</h2>{issuedReceipts(donation).map(receipt => <div className="donor-receipt-card" key={receipt.uuid}><div><h3><bdi>{receipt.number}</bdi></h3><p>تاريخ الإصدار: {accountDate(receipt.issued_at)}</p></div>{receipt.generation_status === "ready" ? <a className="outline-link" href={`/api/donor/receipts/${encodeURIComponent(receipt.uuid)}`}>تنزيل PDF</a> : <span>الإيصال قيد التجهيز</span>}</div>)}{!issuedReceipts(donation).length && <p>{donation.status === "confirmed" ? "لم يصدر إيصال بعد. سيظهر هنا بعد إصداره." : "لا يوجد إيصال صادر حتى الآن. يصدر بعد تأكيد التحصيل."}</p>}<p className="detail-note">الإيصال الأصلي يوثّق مبلغ التبرع عند إصداره. المبالغ المستردة المؤكدة تظهر بشكل منفصل أعلاه.</p></section></>}
  </>}<Link className="text-button" href="/account/contributions">العودة إلى تبرعاتي ←</Link></section>;
}
