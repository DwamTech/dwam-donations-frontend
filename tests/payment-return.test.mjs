import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("neutral return is a server-only page with no request state, status transport or financial orchestration", async () => {
  const source = await readFile(new URL("../src/app/payment-return/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /["']use client["']|searchParams|useSearchParams|useEffect|useState|cookies\s*\(|headers\s*\(|\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie|console\.|\/api\/|checkout-operation|GuestDonationForm|location\.|router\.|dangerouslySetInnerHTML/);
  const imports = [...source.matchAll(/^import\s+.*$/gm)].map(match => match[0]);
  assert.deepEqual(imports, ['import type { Metadata } from "next";', 'import Link from "next/link";'], "No transaction/telemetry imports can execute when returning");
  assert.match(source, /index: false, follow: false/);
  assert.match(source, /referrer: "no-referrer"/);
});
