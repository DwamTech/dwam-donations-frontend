# Phase 02E-2 — Receipt recovery and PDF download contract audit

Date: 2026-10-20, Africa/Cairo.

## A. Initial state

Continued the Phase 02E-1 frontend in `D:\Code\Donations\donations-frontend`, retaining its 65-test baseline, neutral payment return, public project experience, donor/billing/review and disabled financial checkout. Read `AGENTS.md`, prior reports, checkout/API/proxy documentation and installed Next Server/Client Component, client directive and custom-header guidance before editing.

The frontend is still outside Git. No initialization, dependency, commit or deployment was added. Backend/dashboard were inspected read-only. Before/after SHA-256 hashes of tracked HEAD diff plus porcelain status were identical: Laravel `5dc66790d77e9a7a1e3bcaf402fe4d803031f46fefecb3f7206e99c0e911055a`; dashboard `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. Existing Laravel work was preserved. No real environment, database, financial service or production proxy was changed.

## B. Verified receipt recovery contract

**Blocking finding: no existing browser handoff supplies the receipt UUID needed for protected PDF download.** The required identifier audit preceded implementation.

| Step | Actual contract | Receipt UUID available to browser? |
| --- | --- | --- |
| Request | POST `/api/donation-receipts/recovery-requests`, JSON `receipt_number,email`; neutral 202 `{message:string}` | No |
| Recovery email | Configured frontend URL, default path `/receipt-recovery`, fragment `#token_id=<token UUID>&secret=<one-time secret>` | No; token UUID belongs to a different model |
| Exchange | POST `/api/donation-receipts/recovery-exchanges`, JSON `token_id,secret`; 200 message plus receipt scope/capability cookies | No |
| Download | GET `/api/donation-receipts/{receiptUuid}/download`, protected by receipt scope/capability or authenticated ownership | Requires the missing receipt UUID |

Evidence read directly:

- `routes/api.php:84–86`, receipt recovery/download controllers and both `StoreDonationReceiptRecovery*` request classes.
- `DonationReceiptRecoveryRequestService`, `DonationReceiptRecoveryToken`, `DonationReceiptRecoveryLinkFactory`, recovery mail class and Blade view, recovery delivery/communication code.
- `DonationReceiptRecoveryExchangeService` and `EnsureDonationReceiptRecoveryExchangeOrigin`.
- `GuestDonationReceiptBrowserScope`, `GuestDonationReceiptCapabilityService`, receipt download controller/service and private disk configuration.
- Relevant receipt resources, original receipt-available mail/template, `config/donation_receipts.php`, public-subdomain proxy deployment guidance and receipt foundation/capability MySQL feature tests.

The link factory sends only token UUID/secret. The recovery mail contains that URL, not another receipt identifier or protected target. The original receipt-available template includes a receipt number and explicitly has no download link/attachment. Exchange's internal service finds the receipt row but returns only cookie objects to its controller; the public controller exposes only a completion message. HttpOnly cookies cannot be decoded/read by the frontend to discover a locator. No public status/resource contract supplies it elsewhere.

The backend foundation test `test_recovery_exchange_consumes_once_rotates_capability_and_downloads_with_new_cookies` knows `$receipt->uuid` from its own database fixture before requesting download. That proves backend authorization behavior in its test environment, not a browser identifier handoff. Tests were inspected as source only, not executed.

Request validation is required receipt-number string/max64 and required email/max255. The service conceals missing, mismatched, unready and ineligible receipts, and catches internal failures; validated input still receives neutral 202. Eligible requests create a 15-minute token, deduplicate recent unconsumed requests and enqueue delivery intent. Neither 202 nor delivery intent proves an email was delivered.

Exchange accepts UUID token ID and a 43-character base64url secret. Invalid-shaped, expired, consumed, revoked, wrong-recipient or ineligible cases are concealed as 404; runtime unavailability can return 503. Successful exchange atomically consumes the token, clears its delivery envelope and rotates receipt scope/capability authority. An uncertain response must not be blindly retried.

Receipt scope/capability cookies are host-only, HttpOnly, SameSite Strict, Path `/api/donation-receipts`, Secure in production or configured secure sessions, with 129600-minute scope / 90-day capability lifetime. They bind to server-held scope/donation/purpose and are not JavaScript credentials. Exchange middleware validates approved configured/public Origin and safe browser Fetch Metadata, rejecting hostile or partially supplied browser header combinations. The frontend does not change these rules.

## C. Recovery request UX

Implemented **`/receipts/recover`** with Arabic labels, required receipt number/email, field-associated errors, first-invalid-input focus, a live request/result message, busy guard and responsive styling. It visibly warns that downloading through the emailed link is unavailable in this version. Visitors can navigate to home and published projects.

The validator trims surrounding whitespace, enforces the actual length bounds, rejects receipt control characters and uses ordinary email syntax checks. It does not invent a receipt-number grammar or claim exact equivalence with Laravel email validation. Server validation remains final.

An explicit submit sends only `{receipt_number,email}` to the fixed relative endpoint with JSON, same-origin credentials, no-store and redirect rejection. There is no auto-submit or retry. A synchronous in-flight guard excludes repeated clicks. Successful neutral 202 always displays the same conditional wording regardless of upstream message content, without confirming existence, token creation or email delivery. Input state is cleared after acceptance or terminal uncertainty.

Fixed Arabic errors cover invalid format, throttling and service/authorization unavailability. Upstream exception/validation text is never echoed. A disconnect, 15-second timeout, malformed body or unexpected success becomes terminal uncertainty; no automatic second send occurs. Ordinary explicit error resubmission remains a visitor action. No recovery request was sent to real Laravel or an email provider.

The native form uses preventDefault, non-network `method=dialog`, no serializing input names, disabled-before-hydration controls and a JavaScript-disabled explanation. No application URL, storage, cookie or analytics contains entered PII. Browser autofill is not application persistence.

## D. Recovery link handling

Implemented **`/receipt-recovery`**, matching the actual factory's default path and existing public-origin deployment example. The Server Component consumes no query/request/token props. Only the small Client Component accesses the fragment after hydration.

Its helper reads once into a local variable, clears fragment/query through fixed-path `history.replaceState`, then parses exactly one token ID and secret. It rejects missing/malformed/duplicate/conflicting/unknown parameters, bad UUID-v4 or secret syntax, whitespace and oversized fragments. Only a local status is retained; credentials are not placed in React state, DOM, attributes, server props or storage. Repeated Strict Mode effect calls reuse the status without rereading credentials. A subsequent hash navigation creates a fresh local inspection and clears that fragment too. If history clearing fails, no parsing/network continuation occurs and the UI advises closing the page.

A locally well-formed link displays honest unavailable guidance. Local format validation does **not** establish backend validity, expiration, receipt existence or authorization. No exchange/download button appears, and no token is consumed. Missing/malformed links get corresponding local guidance without a status lookup. Refresh after fragment removal cannot restore the credential; no app persistence or replacement token exists. With JavaScript disabled the page explains that the fragment was not processed and should not be shared.

## E. Capability exchange

**Not executed or exposed as an active frontend flow because of the verified receipt-locator blocker.** Consuming a one-time link and rotating browser authority while leaving the visitor without a downloadable target would not complete recovery. The page deliberately makes no exchange call and immediately discards the local credential after format inspection.

There is no JavaScript cookie inspection, replacement browser-readable capability, exchange proxy or hidden automatic recovery operation. Invalid/used/expired-token server outcomes remain intentionally indistinguishable in the verified contract, but cannot be exercised by this UI until the locator gap is resolved. No fake authorized/receipt-available state was introduced merely to satisfy a state checklist.

Future implementation must use exact `token_id,secret`, browser-owned Cookie/Origin, strict runtime response validation, explicit user action, an in-flight/Strict Mode guard, credential cleanup and no unsafe retry after uncertain consumption. Those exchange transport/browser tests are **BLOCKED**, not reported as passing in this phase.

## F. Protected PDF download

**BLOCKED — not implemented.** No token UUID, receipt number, email or guessed URL is substituted for receipt UUID. No PDF lookup, public static file, Blob URL, Next download handler/cache or dummy action was added.

The inspected download endpoint requires the actual receipt UUID plus authenticated ownership or guest receipt scope/capability. Missing, wrong-scope, expired or ineligible/not-ready cases are deliberately concealed with 404; an explicit invalid bearer authentication can return 401; infrastructure failure can return 503 and throttling 429.

Successful backend delivery uses `application/pdf`, attachment filename, `Cache-Control: private, no-store, max-age=0`, `Pragma:no-cache`, nosniff and no-referrer. It validates private receipt-disk readiness, ledger eligibility, document hash and mandatory download audit. This source evidence does not establish a functional frontend PDF download. Positive PDF/wrong-scope/not-ready/cookie download tests remain blocked pending an authorized locator handoff.

## G. Proxy security

No receipt forwarding or development bridge was added. Existing project GET handlers remain unchanged and production-disabled. Browser request transport uses only relative recovery-request POST; the external same-origin edge route remains a separate staging prerequisite. Tests use injected responses and a loopback HTTP server, not the actual backend. They send no email.

HTTP suites prove Next does not forward recovery-request POST, exchange POST, receipt collection/discovery or UUID download paths to the project upstream. Admin/internal-payment/webhook denials remain. No generic `/api/*` proxy, wildcard CORS, cookie domain rewrite or production Nginx change exists.

Future exact receipt methods/paths, Cookie/Set-Cookie preservation, backend Origin/Fetch Metadata enforcement, private no-cache delivery and explicit denial requirements are documented in [RECEIPT_RECOVERY.md](RECEIPT_RECOVERY.md). Cookie-stripping project-read examples must not be reused for receipt authority. Real proxy/cookie integration is not claimed.

Both recovery pages use noindex/nofollow, fixed transaction-free metadata, no secret canonical and path-scoped no-referrer HTTP/meta policy. No third-party media, embeds or telemetry was introduced. Fragments are browser-only; genuine secrets must never be put in search parameters. Next development debug data and infrastructure logs can still include incoming query strings; log redaction remains a staging responsibility.

## H. Files changed

New:

- `src/app/receipts/recover/page.tsx` — request page/metadata and explicit download limitation.
- `src/app/receipt-recovery/page.tsx` — factory-matching landing/metadata and navigation.
- `src/features/receipts/data/recovery-request.ts` — field validation, exact request DTO, guarded transport and neutral/sanitized states.
- `src/features/receipts/data/recovery-fragment.ts` — strict parsing, URL-cleaning order and status-only inspection.
- `src/features/receipts/components/recovery-request-form.tsx` — private in-memory form and accessible states.
- `src/features/receipts/components/recovery-link.tsx` — browser fragment hygiene, Strict Mode guard and honest blocked guidance.
- `tests/receipt-recovery.test.mjs` — 13 focused request/fragment/privacy/transport tests.
- `docs/RECEIPT_RECOVERY.md`, `docs/PHASE_02E_2_REPORT.md` — audited blocker, supported behavior and future boundary.

Modified:

- `src/app/payment-return/page.tsx` — fixed link to the implemented recovery-request page; no receipt identity or outcome inference.
- `src/app/globals.css` — compact recovery form/landing layouts and phone targets.
- `next.config.ts` — no-referrer headers on the two new page paths.
- `scripts/verify-routes.mjs` — new page/metadata/query/offline/deny-path coverage and updated neutral return-link assertion.
- `README.md`, `docs/PROXY.md`, `docs/CHECKOUT_INTEGRATION.md` — current partial delivery and explicit download blocker.

No package/dependency, API handler, original checkout/financial activation logic, environment file, backend/dashboard, payment settlement, schema, production proxy or earlier phase report was changed.

## I. Tests

| Command/check | Actual result |
| --- | --- |
| `npm run lint` | PASS — zero errors/warnings |
| `npm run typecheck` | PASS — strict TypeScript |
| `npm run test` | PASS — 78 tests; all 65 prior tests plus 13 new |
| `npm run build` | PASS — both recovery pages included as static routes |
| `npm run test:routes` | PASS — actual production Next HTTP checks with isolated project upstream |
| `node scripts/verify-routes.mjs --dev` | PASS — actual isolated development Next HTTP checks |
| Read-only Laravel public-project probe | `ECONNREFUSED`; live backend not verified |
| Protected working-state hashes | PASS — identical before/after |
| Existing port-3000 frontend | HTTP 200; preserved |

New unit coverage checks required/length-bound fields, exact allowlisted DTO, no PII query, same-origin/no-store/redirect policy, neutral non-enumerating 202, invalid format/throttling/unavailable responses, double submission, malformed/disconnected/abort-timeout uncertainty, no automatic resend, exact factory-shaped fragments, invalid/duplicate/unknown parameters, cleanup-before-validation, repeated inspection, SSR nonserializing disabled form and absence of credential/exchange/download UI. Privacy source checks enforce no storage, cookie inspection, raw logging, exchange call, guessed download or status transport.

The actual request operation also sends one POST through a test-only loopback HTTP server, verifying path/body/neutral result. It is not a mail service and no real recipient is contacted. No cookie jar or capability success was fabricated for this phase, because there is no justified exchange/download flow to test end to end.

Production/development HTTP suites check the two routes with no query and malicious synthetic identifier/email/secret/redirect queries, fixed links, noindex/nofollow/referrer headers, empty/private form markup, explicit download limitation and zero upstream activity. They repeat after stopping the mock backend. Whole production HTML excludes synthetic query markers; development tests inspect public markup because Next dev serializes request debugging props. Fragment removal itself is checked through the same pure helper used by the Client Component; real hydrated URL/history behavior is not claimed from HTTP.

All existing project/discovery/media/money/donor/billing/review, checkout and neutral-return regressions pass. No failed executed gate remains. Temporary test servers/snapshots were cleaned up without stopping the user's server.

**Blocked checks:** actual one-time capability exchange, invalid/expired/used token authorization responses, lost-exchange recovery, protected PDF success/unauthorized/wrong-scope/not-ready and real browser cookie continuity. Their backend contracts were read; they were not executed or represented as frontend successes. This is a missing public handoff, not a test failure hidden by a mock receipt UUID.

## J. Visual review

**VISUAL/BROWSER REVIEW NOT VERIFIED.** No browser automation or preview tool was available. No rendered screenshots, hydrated clicks, browser history/fragment removal, keyboard/screen-reader, autofill or mobile overflow pass is claimed.

Manual review at 1440px desktop and 360px mobile should capture request entry/errors/neutral acceptance/throttling/uncertainty and landing missing/malformed/local-format-blocked states, using synthetic data and an isolated mock only. Confirm first-error focus, live announcements, no serializing native GET, fixed navigation, no horizontal overflow and URL cleanup before any application API action. Open a second synthetic fragment on the same page and refresh after cleanup; confirm no restoration, exchange or download request. With JS disabled confirm form disablement and secret-handling guidance. Do not use real customer tokens, send email or exercise live PDF access to obtain screenshots.

## K. Remaining contract/environment gaps

1. **Required contract change:** provide the browser with the actual receipt UUID or an exact protected download target through an explicitly authorized recovery handoff, retaining server capability authorization. An authenticated exchange response or approved link contract could supply a locator, but this phase does not choose new fields or modify Laravel. Token UUID is not receipt UUID; public enumeration/status lookup is not a substitute.
2. Reverify the updated end-to-end contract with source/tests, then implement explicit single-use exchange and protected download without unsafe ambiguity retry. Add backend tests that follow only browser-visible information, not fixture-known receipt UUIDs.
3. Verify real backend connectivity and approved public recovery frontend URL/Origin, mail delivery, TLS, external exact-route proxying and unmodified Cookie/Set-Cookie/Fetch Metadata behavior in separately authorized isolated staging. No deployment has been configured here.
4. Complete real browser fragment-cleanup, Strict Mode, cross-site cookie, privacy/accessibility/mobile and no-cache download acceptance after the contract exists. Keep financial checkout disabled and avoid advertising recovery as a complete download flow while this gap remains.

## L. Next phase readiness

The supported request/neutral-response UI and strict fragment hygiene are reusable. Public project browsing/details, exact donation entry, billing/review, disabled checkout and neutral payment return remain intact. The return page now points only to the real recovery-request page, which prominently discloses the download limitation.

Exchange/PDF work must resume only against the repaired, independently approved locator contract. No backend workaround, public receipt resource, download guess or capability substitute was added in preparation. Live/backend/browser acceptance and existing production activation prerequisites remain separate work.

## M. Final verdict

**BLOCKED — end-to-end Phase 02E-2 receipt recovery/PDF download lacks an authorized receipt-UUID handoff.**

The safely supported request page, factory-matching fragment-cleaning landing, privacy/navigation and automated regressions are implemented and pass all executed gates. Exchange and download intentionally remain unavailable so an unrecoverable one-time link is not consumed and no identifier is invented. This is **not** complete end-to-end recovery. No real email, capability exchange, PDF access, financial operation, backend/dashboard edit, environment activation, commit or deployment occurred.
