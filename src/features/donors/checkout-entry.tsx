"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GuestDonationForm } from "@/features/donations/components/guest-donation-form";
import type { CheckoutConfig } from "@/features/donations/data/checkout-config";
import { useDonorSession } from "./session";

export function DonationCheckoutEntry({ project, checkout, owned = false }: {
  project: { id: number; title: string; currency: string; reference: string }; checkout: CheckoutConfig; owned?: boolean;
}) {
  const { session, refresh } = useDonorSession();
  const router = useRouter();
  useEffect(() => { if (!owned && session.status === "authenticated") router.replace(`/account/donate/${project.id}`); }, [owned, session.status, project.id, router]);
  if (session.status === "loading" || (!owned && session.status === "authenticated")) return <p role="status">جارٍ التحقق من حسابك ومسار التبرع…</p>;
  if (session.status === "unavailable") return <div className="notice" role="alert"><p>تعذر التحقق من جلسة حسابك. أعد المحاولة قبل بدء التبرع.</p><button className="outline-button" onClick={() => void refresh()}>إعادة التحقق</button></div>;
  if (session.status === "expired" || (owned && session.status !== "authenticated")) return <div className="notice" role="alert"><p>سجّل الدخول أو جدّد جلستك للمتابعة بتبرع مرتبط بحسابك.</p><Link className="primary-button" href={`/account?next=${encodeURIComponent(`/account/donate/${project.id}`)}`}>تسجيل الدخول للمتابعة</Link></div>;
  return <><p className="checkout-identity">{owned ? `التبرع من حساب ${session.status === "authenticated" ? session.profile.name : ""}. ملكية التبرع تُثبت بجلسة حسابك.` : "أنت تتبرع كضيف. لن يُضاف هذا التبرع تلقائيًا إلى حساب مسجل."}</p>
    <GuestDonationForm key={`${project.id}-${owned ? "owned" : "guest"}`} project={project} checkout={{ ...checkout, authenticated: owned }} initialContact={owned && session.status === "authenticated" ? session.profile : undefined} />
  </>;
}
