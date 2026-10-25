"use client";
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { formatMoney } from '@/lib/formatters/money';

type Contribution = { id: number; reference: string; amount_minor: number; amount_minor_exact: string; currency: string; status: string; payment_status: string | null; refunded_amount_minor: string; receipts: { uuid: string; number: string; generation_status: string }[]; project: { title: string } | null };
const statusLabels: Record<string, string> = { initiated: 'طلب قيد المتابعة', confirmed: 'تبرع مؤكد', cancelled: 'طلب ملغى', paid: 'دفع مستلم', pending: 'دفع منتظر', processing: 'دفع قيد المعالجة', failed: 'دفع غير مكتمل', partially_refunded: 'استرداد جزئي', refunded: 'مسترد بالكامل' };
export function DonorPortal() {
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null);
  const [rows, setRows] = useState<Contribution[]>([]);
  const [pagination, setPagination] = useState({ current: 1, last: 1 });
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async (page = 1) => {
    try {
      const r = await fetch('/api/donor/profile', { cache: 'no-store', credentials: 'same-origin' });
      if (r.status === 401) { setProfile(null); setRows([]); return; }
      if (!r.ok) throw Error();
      const p = await r.json();
      if (typeof p.data?.name !== 'string' || typeof p.data?.email !== 'string') throw Error();
      setProfile(p.data);
      const history = await fetch('/api/donor/contributions'+(page > 1 ? '?page='+page : ''), { cache: 'no-store', credentials: 'same-origin' });
      if (!history.ok) throw Error(); const data = await history.json();
      if (!Array.isArray(data.data)) throw Error();
      setRows(data.data); setPagination({ current: data.meta.current_page, last: data.meta.last_page }); setMessage('');
    } catch { setMessage('تعذر تحديث بيانات الحساب. يرجى المحاولة لاحقًا.'); }
  }, []);
  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true);
    const form = event.currentTarget; const input = new FormData(form);
    try {
      const r = await fetch('/api/donor/session', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: input.get('email'), password: input.get('password') }) });
      if (!r.ok) { setMessage('تعذر تسجيل الدخول. تحقق من بيانات حساب المتبرع وحاول لاحقًا.'); return; }
      form.reset(); await load();
    } catch { setMessage('تعذرت خدمة الحسابات حاليًا.'); } finally { setBusy(false); }
  }
  async function logout() {
    if (busy) return; setBusy(true);
    try { const r = await fetch('/api/donor/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); if (!r.ok) throw Error(); setProfile(null); setRows([]); }
    catch { setMessage('تعذر إنهاء الجلسة. حاول مرة أخرى.'); } finally { setBusy(false); }
  }
  return <section className="section" dir="rtl"><h1>حساب المتبرع وتبرعاتي</h1>
    <p role="status">{message}</p>
    {!profile ? <form onSubmit={login}><p>سجّل الدخول بحسابك الحالي. يمكنك التبرع كضيف دون إنشاء حساب.</p>
      <p><label>البريد الإلكتروني <input name="email" type="email" required autoComplete="username" maxLength={255} /></label></p>
      <p><label>كلمة المرور <input name="password" type="password" required autoComplete="current-password" maxLength={1024} /></label></p>
      <button className="primary-button" disabled={busy}>تسجيل الدخول</button>
    </form> : <><p>{profile.name} — {profile.email}</p><button type="button" className="outline-button" disabled={busy} onClick={logout}>تسجيل الخروج</button> <button type="button" className="outline-button" onClick={() => void load()}>تحديث السجل</button>
      <p>الحساب يعرض تبرعاته المملوكة فقط. التبرعات السابقة كضيف تبقى مستقلة وتسترجع إيصالاتها بالبريد.</p>
      {rows.length === 0 && <p>لا توجد تبرعات مسجلة في هذا الحساب.</p>}
      {rows.map(d => <article key={d.id} className="donation-project-summary"><h2>{d.project?.title ?? 'تبرع عام'}</h2><p>المرجع: <bdi>{d.reference}</bdi></p><Link href={`/account/contributions/${d.id}`}>تفاصيل التبرع</Link><p>{formatMoney(d.amount_minor_exact, d.currency)}</p><p>{statusLabels[d.status] ?? d.status} — {d.payment_status ? statusLabels[d.payment_status] ?? d.payment_status : 'لم يبدأ الدفع'}</p>
        <p>المسترد: {formatMoney(d.refunded_amount_minor, d.currency)}</p>
        {d.receipts.map(r => <p key={r.uuid}>الإيصال {r.number}: {r.generation_status === 'ready' ? <a href={`/api/donor/receipts/${encodeURIComponent(r.uuid)}`}>تنزيل الإيصال الأصلي</a> : 'قيد التجهيز'}</p>)}
      </article>)}
      <nav aria-label="صفحات تبرعاتي">
        {pagination.current > 1 && <button type="button" onClick={() => void load(pagination.current-1)}>السابق</button>}
        {pagination.current < pagination.last && pagination.current < 9999 && <button type="button" onClick={() => void load(pagination.current+1)}>التالي</button>}
      </nav>
    </>}
    <p><Link href="/projects">اختيار مشروع</Link> · <Link href="/receipts/recover">استرجاع إيصال الضيف</Link></p>
  </section>;
}

export function DonorDetails({ id }: { id: string }) {
  const [donation, setDonation] = useState<Contribution | null>(null);
  const [message, setMessage] = useState('جارٍ تحميل السجل…');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/donor/contributions/'+encodeURIComponent(id), { cache: 'no-store', credentials: 'same-origin', signal: controller.signal })
      .then(async r => { if (!r.ok) throw Error(); return r.json(); })
      .then(value => { if (!value.data || !Array.isArray(value.data.receipts)) throw Error(); setDonation(value.data); setMessage(''); })
      .catch(() => { if (!controller.signal.aborted) setMessage('السجل غير متاح في هذه الجلسة. سجل الدخول بحسابك ثم حاول مرة أخرى.'); });
    return () => controller.abort();
  }, [id]);
  return <section className="section"><h1>تفاصيل التبرع</h1><p role="status">{message}</p>{donation && <>
    <p>المرجع: <bdi>{donation.reference}</bdi></p><p>{donation.project?.title ?? 'تبرع عام'}</p>
    <p>{formatMoney(donation.amount_minor_exact, donation.currency)} — {statusLabels[donation.status] ?? donation.status}</p>
    <p>الدفع: {donation.payment_status ? statusLabels[donation.payment_status] ?? donation.payment_status : 'لم يبدأ'}</p>
    <p>المسترد: {formatMoney(donation.refunded_amount_minor, donation.currency)}. الإيصال الأصلي يوثق المبلغ قبل أي استرداد.</p>
    {donation.receipts.map(r => <p key={r.uuid}>{r.number}: {r.generation_status === 'ready' ? <a href={`/api/donor/receipts/${encodeURIComponent(r.uuid)}`}>تنزيل الإيصال الأصلي</a> : 'قيد التجهيز'}</p>)}
  </>}<Link href="/account">العودة إلى تبرعاتي</Link></section>;
}
