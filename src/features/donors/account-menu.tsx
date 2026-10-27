"use client";
import Link from "next/link";
import { useDonorSession } from "./session";
import type { MouseEvent } from "react";

export function AccountMenu() {
  const { session } = useDonorSession();
  function close(event: MouseEvent<HTMLAnchorElement>) {
    event.currentTarget.closest(".account-menu")?.removeAttribute("open");
    event.currentTarget.closest(".mobile-menu")?.removeAttribute("open");
  }
  return <details className="account-menu"><summary>حسابي</summary><nav aria-label="قائمة حسابي"><Link onClick={close} href="/account">{session.status === "authenticated" ? "حسابي" : "تسجيل الدخول"}</Link><Link onClick={close} href="/account/contributions">تبرعاتي</Link><Link onClick={close} href="/account/receipts">إيصالاتي</Link></nav></details>;
}
