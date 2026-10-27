"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useDonorSession } from "./session";

export function DonationLink({ projectId, className, children }: { projectId: number; className?: string; children: ReactNode }) {
  const { session } = useDonorSession();
  // The public checkout also verifies the session before rendering a guest form.
  const href = session.status === "authenticated" ? `/account/donate/${projectId}`
    : session.status === "expired" ? `/account?next=${encodeURIComponent(`/account/donate/${projectId}`)}` : `/donate/${projectId}`;
  return <Link className={className} href={href}>{children}</Link>;
}
