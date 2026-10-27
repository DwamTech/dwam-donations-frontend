"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDonorSession } from "./session";
import { accountReturnPath } from "./session-state";
import { AccountDashboard, type AccountView } from "./account-dashboard";

export function DonorPortal({ view = "overview", returnTo = "/account" }: { view?: AccountView; returnTo?: string }) {
  const { session, refresh, signedIn } = useDonorSession();
  const router = useRouter();
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const submitting = useRef(false);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting.current) return;
    const form = event.currentTarget; const input = new FormData(form);
    if (creatingAccount && input.get("password") !== input.get("password_confirmation")) { setMessage("كلمتا المرور غير متطابقتين."); return; }
    submitting.current = true; setBusy(true); setMessage("");
    try {
      const body = { email: input.get("email"), password: input.get("password"), ...(creatingAccount ? { name: input.get("name"), password_confirmation: input.get("password_confirmation") } : {}) };
      const r = await fetch(creatingAccount ? "/api/donor/registration" : "/api/donor/session", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { setMessage(r.status === 401 ? "بيانات الدخول غير صحيحة أو الحساب غير مؤهل لحساب متبرع. راجع بياناتك." : "تعذرت خدمة الحسابات. راجع بياناتك وأعد المحاولة."); return; }
      const result = await r.json();
      if (!Number.isSafeInteger(result.data?.id) || typeof result.data.name !== "string" || typeof result.data.email !== "string") throw new Error();
      signedIn(result.data); form.reset(); setCreatingAccount(false); setShowPassword(false);
      const verified = await refresh();
      if (verified.status === "authenticated" && accountReturnPath(returnTo) !== "/account") router.replace(accountReturnPath(returnTo));
    } catch { setMessage("لم نتمكن من تأكيد الجلسة. أعد تسجيل الدخول قبل المتابعة."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <section className="section donor-account" dir="rtl"><header className="donor-account-heading"><p className="kicker">كل عطاء، وله حكاية</p><h1>{view === "contributions" ? "تبرعاتي" : view === "receipts" ? "إيصالاتي" : "حسابي"}</h1><p>تابع تبرعاتك وإيصالاتك من مكان واحد.</p></header>
    {session.status === "loading" ? <p role="status">جارٍ التحقق من حسابك…</p> : session.status === "authenticated" ? <AccountDashboard key={session.profile.id} view={view} /> : <>
      {session.status === "expired" && <p role="alert" className="donor-login-error">انتهت جلسة حسابك. سجّل الدخول للمتابعة؛ لن يتحول تبرعك إلى تبرع ضيف.</p>}
      {session.status === "unavailable" && <div className="notice" role="alert"><p>تعذر التحقق من الحساب حاليًا.</p><button className="outline-button" onClick={() => void refresh()}>إعادة التحقق</button></div>}
      <div className="donor-account-layout"><form key={creatingAccount ? 'registration' : 'login'} id="donor-auth-form" className="donor-login-card" method="dialog" onSubmit={login} aria-labelledby="donor-login-title" aria-busy={busy}>
      <h2 id="donor-login-title">{creatingAccount ? 'إنشاء حساب' : 'تسجيل الدخول'}</h2><p className="donor-login-description">{creatingAccount ? 'أدخل بياناتك لإنشاء حساب ومتابعة تبرعاتك القادمة.' : 'لديك حساب بالفعل؟ أدخل بياناتك للمتابعة.'}</p>
      {creatingAccount && <div className="donation-field"><label htmlFor="donor-name">الاسم</label><input id="donor-name" name="name" type="text" required autoComplete="name" placeholder="اكتب اسمك" maxLength={255} /></div>}
      <div className="donation-field"><label htmlFor="donor-email">البريد الإلكتروني</label><input id="donor-email" name="email" type="email" dir="ltr" placeholder="name@example.com" required autoComplete="username" maxLength={255} /></div>
      <div className="donation-field"><label htmlFor="donor-password">كلمة المرور</label><div className="donor-password-field"><input id="donor-password" name="password" type={showPassword ? 'text' : 'password'} dir="ltr" placeholder={creatingAccount ? '٨ أحرف على الأقل' : 'أدخل كلمة المرور'} required autoComplete={creatingAccount ? 'new-password' : 'current-password'} minLength={creatingAccount ? 8 : undefined} maxLength={1024} /><button type="button" className="donor-password-toggle" aria-controls="donor-password" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'إخفاء' : 'إظهار'}</button></div></div>
      {creatingAccount && <div className="donation-field"><label htmlFor="donor-password-confirmation">تأكيد كلمة المرور</label><input id="donor-password-confirmation" name="password_confirmation" type="password" dir="ltr" required autoComplete="new-password" minLength={8} maxLength={1024} placeholder="أعد كتابة كلمة المرور" /></div>}
      {message && <p className="donor-login-error" role="alert">{message}</p>}
      <button type="submit" className="primary-button donor-login-submit" disabled={busy}>{busy ? creatingAccount ? 'جارٍ إنشاء الحساب…' : 'جارٍ تسجيل الدخول…' : creatingAccount ? 'إنشاء حساب' : 'تسجيل الدخول'}</button>
      <p className="donor-account-switch">{creatingAccount ? 'لديك حساب بالفعل؟' : 'ليس لديك حساب؟'} <button type="button" disabled={busy} aria-controls="donor-auth-form" onClick={() => { setCreatingAccount(value => !value); setShowPassword(false); setMessage(''); }}>{creatingAccount ? 'تسجيل الدخول' : 'أنشئ حسابًا'}</button></p>
    </form><aside className="donor-guest-card" aria-labelledby="donor-guest-title"><p className="kicker">عطاؤك يبدأ بخطوة</p><h2 id="donor-guest-title">أول زيارة لك؟</h2><p>يمكنك اختيار مشروع والتبرع مباشرة كضيف، دون الحاجة إلى إنشاء حساب.</p><Link className="primary-button" href="/projects">تصفّح المشاريع والتبرع</Link><p className="donor-guest-recovery">تبرعت كضيف من قبل؟<br /><Link className="text-button" href="/receipts/recover">استرجاع إيصال التبرع ←</Link></p></aside></div>
    </>}
  </section>;
}

export { DonorDetails } from "./donor-details";
