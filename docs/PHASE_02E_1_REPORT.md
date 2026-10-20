# Phase 02E-1 — Secure neutral payment return

Date: 2026-10-20, Africa/Cairo.

## A. Initial state

Extended the existing Phase 02D-2B frontend at `D:\Code\Donations\donations-frontend`. The baseline included public discovery/details/media, exact amount validation, donor/billing/review and the disabled-by-default four-stage checkout operation with 64 passing tests. No application, dependency or repository was initialized. Read `AGENTS.md`, current documentation/reports, checkout/proxy guidance and installed Next page, metadata, Link and custom-header guides before implementation.

Laravel and dashboard remained read-only. Before/after SHA-256 hashes of tracked HEAD diff plus porcelain state were unchanged: Laravel `5dc66790d77e9a7a1e3bcaf402fe4d803031f46fefecb3f7206e99c0e911055a`; dashboard `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. Existing Laravel changes were preserved. The frontend remains outside Git; no initialization, commit or deployment occurred. No environment file, financial operation, database or production proxy was changed.

## B. Verified backend return contract

Source evidence:

- `DwamCMS/config/payments.php` maps `PAYMOB_REDIRECTION_URL` to `redirection_url` and `DONATIONS_PUBLIC_PAYMENT_RETURN_URL` to `approved_redirection_url`. `PAYMOB_NOTIFICATION_URL` is separate.
- `config/donations.php` maps `DONATIONS_PUBLIC_ORIGIN` and the fixed public payment return URL.
- `PaymobPayloadMapper::map` forwards server-configured `redirection_url` to intention creation. When the approved URL is configured, it requires exact equality with the configured redirect URL and checks its normalized origin against `donations.public_origin` through `TrustedUrl`. The approval guard is conditional, preserving the existing legacy contract; deployment must configure it rather than assume it is always active.
- `app/Support/TrustedUrl.php` parses/normalizes configured origins/paths and requires HTTPS on nonlocal hosts. No specific return path is hardcoded by the mapper. `PaymobMapperTest` verifies approved redirect equality and rejects a different approved destination.
- The existing public-subdomain deployment contract, associated with the earlier public-origin/return changes, explicitly proposes **`/payment-return`** for both backend return URL settings. Its exact intended path was retained. These are documented intended values, not a claim that the current live environment is configured.
- Existing donation checkout orchestration/claim services keep the provider operation separate from browser return. `PaymobWebhookController` accepts JSON server notifications, verifies callback HMAC, and durably ingests verified events; `PaymobWebhookSettlementService` processes trusted stored events with source/attempt/integration/money checks. Browser return does none of this.
- Receipt-available/recovery delivery services enqueue communication intent. Issuance/outbox intent does not establish delivered email, so the page promises no immediate delivery.

[Paymob's official transaction-callback documentation](https://developers.paymob.com/paymob-docs/developers/transaction-callbacks), checked during this phase, explicitly distinguishes browser **GET/query** response callbacks from server **POST/JSON** processed notifications. Its browser sample contains transaction `id`, `success`, `pending`, `order`, `amount_cents`, currency, `hmac` and other provider fields. The documentation says order updates must rely on processed callbacks. This implementation goes further for the public UI: it does not use browser fields to display an outcome at all.

No signed public return-resource contract was found that authorizes displaying a specific donation or looking up its status from a return reference. Transaction IDs, donor values and donation references supplied in the browser URL are therefore omitted. No existence check or public status API was invented. No backend tests or gateway requests were executed.

## C. Implemented route

New public route: **GET `/payment-return`**. It is a static Server Component with no request-prop consumption, API access or custom Client Component. It renders with no query, arbitrary/repeated query keys, fragment-looking URLs, absent cookies, unrelated synthetic cookies and an unavailable backend. Production rejects POST with 405; Next development mode can return the same read-only page with 200. Neither processes a POST body or acts as a webhook receiver.

The shared Arabic RTL shell and local Alexandria font remain. A small inline document-outline SVG provides a neutral visual, followed by a heading, explanation, conditional receipt guidance and functional home/projects links. No remote image, status spinner, timeline, receipt, unsupported control or recovery link was added. Return navigation prefetch is disabled. Source CSS provides a bounded desktop reading width and stacked 44px-minimum phone actions without fixed overlays.

## D. Neutral payment messaging

The title is “العودة من صفحة الدفع”. The explanation states that returning from the gateway confirms neither success nor failure and that trusted payment notification is required for system confirmation. It says confirmation can take time and that this page neither displays nor checks an individual donation's state.

Receipt guidance is conditional on confirmed donation/issued receipt and explicitly says this page does not mean an email was sent or received. No invented support contact or organization credential appears. There is no branch for `success=true`, `success=false`, an `hmac`, provider transaction identifiers, prior checkout state or cookie presence. All tested variants produce the same return section.

## E. Security

The page imports only metadata types and the framework Link component. It has no status transport, query/fragment parsing, cookie access, browser persistence, analytics/logging, trusted callback handling or checkout-operation import. It never issues intent/reserve/payment/checkout or regenerates credentials. Unknown parameters are not forwarded. Static literal navigation cannot follow `return_to` or disclose the existence of a referenced donation.

Metadata is `noindex, nofollow` with a fixed neutral title/description and fixed transaction-free Open Graph fields. No canonical or transaction reference is emitted. Both metadata and a `/payment-return`-scoped HTTP header set `no-referrer`, preventing the return URL/query from being sent as a browser referrer to later resources/navigation. Other routes' header and SEO behavior remain unchanged. No third-party resource or telemetry was introduced.

Laravel's restricted capability cookies may be absent on the initial cross-site return because of SameSite policy. The page requires no cookies and draws no conclusion from absence. It cannot restart the transaction or retrieve protected details using URL values.

Framework detail observed in testing: Next development mode serializes request props in its RSC debugging scripts even when the page ignores them. Development checks therefore verify visible markup/metadata and identical return content. Production checks verify **the complete HTML response**, including framework payload, contains none of the synthetic transaction/script/email/redirect markers. This is not hidden by changing application behavior. Only synthetic values should be used in development. Infrastructure request logs can still receive incoming query strings; staging log/telemetry redaction remains operational configuration. Referrer policy does not erase incoming logs.

## F. Existing checkout compatibility

The completed four-stage operation, snapshot/idempotency rules, response validators, activation gates and guest/billing flow were **not modified**. The new page matches the backend deployment document's intended path, so no alias or alternate callback protocol was needed. Its existence does not activate checkout or verify staging.

Later approved staging must align these settings on the same approved HTTPS public host:

```dotenv
# Documentation example only, not applied configuration.
DONATIONS_PUBLIC_ORIGIN=https://donations.example.com
DONATIONS_PUBLIC_PAYMENT_RETURN_URL=https://donations.example.com/payment-return
PAYMOB_REDIRECTION_URL=https://donations.example.com/payment-return
SITE_ORIGIN=https://donations.example.com
DONATIONS_VERIFIED_RETURN_URL=https://donations.example.com/payment-return
```

If actual deployment uses another return path, align the two backend fixed return settings and frontend verified-return setting through separately approved staging configuration. `APP_URL` remains the CMS origin; `PAYMOB_NOTIFICATION_URL` remains the distinct Laravel notification endpoint. Never route that webhook to this page or expose `/api/payments/paymob/webhook` through the public frontend proxy. No actual environment values were changed or gateway redirect initiated. All financial activation defaults remain disabled.

## G. Files changed

New:

- `src/app/payment-return/page.tsx` — static neutral page and route metadata.
- `tests/payment-return.test.mjs` — dependency/privacy boundary check.
- `docs/PHASE_02E_1_REPORT.md` — this report.

Modified:

- `src/app/globals.css` — neutral return icon, typography, guidance and phone layout.
- `next.config.ts` — narrowly scoped frontend `Referrer-Policy` header; no rewrite/proxy or activation change.
- `scripts/verify-routes.mjs` — return query/cookie/offline/security checks, POST/webhook denial, and reuse of actual Next header configuration in the isolated development snapshot. Existing installed TypeScript transpiles that configuration; only the QA Turbopack root is overridden.
- `README.md`, `docs/CHECKOUT_INTEGRATION.md`, `docs/PROXY.md` — implemented route, intended future return configuration, unchanged activation requirements and webhook separation.

No package/lockfile, original checkout operation, project/donor/billing behavior, API handler, backend/dashboard, real environment or production proxy was modified. Earlier phase reports remain historical records.

## H. Tests

| Command/check | Final result |
| --- | --- |
| `npm run lint` | PASS — zero errors/warnings |
| `npm run typecheck` | PASS — strict TypeScript |
| `npm run test` | PASS — 65 tests; all 64 prior tests retained plus one return dependency/privacy test |
| `npm run build` | PASS — Next 16.4.2; `/payment-return` prerendered as static content |
| `npm run test:routes` | PASS — actual production Next HTTP suite with isolated project upstream |
| `node scripts/verify-routes.mjs --dev` | PASS — actual isolated development Next HTTP suite |
| Read-only Laravel localhost:8000 public-project probe | `ECONNREFUSED`; live connectivity remains unverified |
| Backend/dashboard state hashes | Identical before/after |
| Existing port-3000 frontend | HTTP 200; left running |

Return HTTP checks cover no-query access, true/false success indicators, a provider-shaped query, unknown/repeated values, malicious script/email content, arbitrary external `return_to`, fragment-looking URL and synthetic/absent cookies. They assert 200 without redirect/Set-Cookie, Arabic/RTL, neutral copy, conditional email wording, noindex/nofollow, fixed OG, no transaction canonical, no-referrer HTTP/meta, fixed navigation and identical page content. The checks run both with the isolated backend available and **after it is stopped**, and assert zero upstream traffic from every return request. Production POST return receives 405; development may render neutral 200 without any processing. The public webhook path receives 404 without forwarding.

All prior homepage/discovery/detail/media/monetary/donor/billing/review tests and the 26 checkout tests remain, including disabled defaults, same-key retry, ambiguity, capability/expiry handling and safe navigation. Unit/source checks enforce that the new route cannot import transaction or telemetry code. HTTP checks establish server behavior, not hydrated browser or actual SameSite enforcement. URL fragments are not transmitted by HTTP; their absence of application interpretation is also supported by the page's lack of browser URL code.

An initial lint check rejected native internal anchors; they were replaced with framework Links with prefetch disabled. The first development non-reflection assertion also included framework debug scripts and encountered Next's automatic request serialization. It was corrected to distinguish public markup from development debug payload while preserving full production-response checks. An added method probe then exposed the framework's production-405/development-200 static-page POST difference; checks now verify each observed response and zero upstream activity without inventing a POST callback implementation. No production neutrality/security behavior was weakened. All final quality gates pass. Temporary QA servers/snapshots were cleaned up.

## I. Visual review

**VISUAL REVIEW NOT VERIFIED.** No browser automation/preview facility was available. No screenshot, hydrated click, mobile overflow, keyboard or screen-reader pass is claimed.

Manual review at 1440px desktop and 360px mobile should capture `02e1-return-desktop.png`, `02e1-return-mobile.png`, `02e1-return-success-query.png` and `02e1-return-failure-query.png`, using synthetic URLs only. Confirm calm identical messaging, no success/failure styling, readable RTL text, no clipping/horizontal scroll, visible focus and functioning home/projects navigation. Repeat with cookies absent and backend offline. Inspect Network/storage to confirm no payment/status requests or new application persistence; validate actual referrer behavior in the browser. This review requires no live payment or database write.

## J. Outstanding dependencies

The page is implemented and mock-backed HTTP behavior is verified; actual Laravel/Paymob, deployment URL agreement, browser cross-site return and email delivery remain unverified. Staging must confirm the approved public origin/fixed URL, exact Paymob redirect approval, separate backend notification route and trusted settlement processing. Edge routing, TLS, cookie/Origin behavior, request-log query redaction and browser desktop/mobile/accessibility acceptance still require separately authorized operational verification.

No financial flag should be enabled just because the route exists. All other Phase 02D-2B activation dependencies remain: eligible gateway/currency, actual amount ceiling, current project eligibility/capacity, secure exact-route mutation forwarding and authorized isolated ambiguity/recovery tests.

## K. Phase 02E-2 readiness

Receipt recovery is **not implemented** and has no placeholder link. Current backend source provides separate contracts to reverify for that phase:

- POST `/api/donation-receipts/recovery-requests` accepts receipt number/email and returns neutral 202 wording, avoiding an existence claim.
- Recovery link factory places `token_id` and one-time `secret` in the fragment of the approved recovery frontend URL. These must not become telemetry, server queries or persisted browser state.
- POST `/api/donation-receipts/recovery-exchanges` accepts UUID token ID and the secret, validates approved browser Origin/Fetch Metadata and trades authorized unexpired one-time authority for server-owned receipt cookies. Concealed invalid/expired cases return 404; infrastructure failure can return 503. The inspected response is a neutral message, not an invented public status/resource lookup.
- GET `/api/donation-receipts/{receiptUuid}/download` requires authenticated ownership or server-issued guest scope/capability and backend receipt eligibility. It returns a private no-store PDF or concealed/unavailable responses.

Phase 02E-2 must verify the actual link/receipt-UUID handoff, replay/expiration/consumption, delivery and download contracts before constructing UI, and obtain separately approved exact proxy paths/methods. It must not infer missing identifiers or use the payment-return query as receipt authority. This page supplies no tokens, identifiers or recovery transport in advance.

## L. Final verdict

**COMPLETE — Phase 02E-1 secure neutral public payment-return implementation.**

The static `/payment-return` experience and all automated quality gates pass. It does not infer payment outcome, require cookies, contact the backend, poll status, replay checkout or implement receipt recovery. Real financial mutations remain disabled. Live gateway/staging and rendered browser acceptance remain **NOT VERIFIED**. Backend/dashboard, environments and production proxy are unchanged; no deployment, Git initialization or commit occurred.
