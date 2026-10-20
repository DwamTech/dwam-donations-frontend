# Phase 02E-2-F2 — Complete secure receipt recovery and PDF download

Date: 2026-10-20, Africa/Cairo.

## A. Initial state

Extended the existing Phase 02E-2 frontend in `D:\Code\Donations\donations-frontend`. Its 78-test baseline implemented private recovery requests, strict fragment parsing/cleanup and an intentionally blocked landing because no receipt locator reached the browser. Backend F1 subsequently repaired that contract. Existing project/discovery/media, donor/billing/review, neutral payment return and disabled checkout were preserved.

Read `AGENTS.md`, the backend F1 report/current receipt API contract, existing frontend receipt/proxy/checkout documentation and relevant installed Next Server/Client Component guidance. No dependency, scaffold, Git initialization, commit or deployment was added. No backend/dashboard, environment, database or production proxy was changed. Backend and dashboard working-state hashes before/after are identical: Laravel `82fe8b6e7b5a1a747e8ef614ccbc8b7706b3d8f54ee46b65a49496ec6e363b8c`; dashboard `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

## B. Updated backend contract

Re-read the actual exchange controller, receipt issuance service, protected PDF controller, Laravel UUID route constraint and `DwamCMS/docs/donations/DONATIONS_RECEIPT_RECOVERY_API_CONTRACT.md`. Successful exchange is exactly HTTP 200 with the existing message and new locator:

```json
{
  "message": "Receipt recovery completed.",
  "data": { "receipt_uuid": "actual-authorized-receipt-uuid" }
}
```

Server-owned receipt scope/capability cookies remain the authority. The locator comes from the receipt authorized through the token; it is not the token UUID, a bearer secret, public lookup key or settlement confirmation. The backend's prior 36-test verification is source/report evidence from F1, not a backend suite rerun in this frontend-only phase.

Receipt issuance currently uses `Str::uuid()`. The public download route's actual `whereUuid` constraint accepts canonical hexadecimal UUID shape without restricting its version; frontend response validation mirrors that shape and accepts multiple UUID versions rather than assuming v4. It rejects a returned locator equal to the token UUID, including case variants. The existing factory-issued token fragment retains its separately audited v4/43-character-secret syntax.

Download remains protected GET `/api/donation-receipts/{receiptUuid}/download`, returning an attachment with `application/pdf`, private/no-store cache control, no-cache Pragma, nosniff and no-referrer. Unauthorized/expired/wrong-scope/not-ready cases remain concealed; infrastructure/throttling can return 503/429. Backend source and cookies were inspected read-only; no real recovery endpoint, customer token, email or PDF was exercised.

## C. Implemented recovery flow

`/receipts/recover` keeps its exact two-field request, validation, neutral 202, privacy/error/throttle handling and in-flight guard. Outdated download-unavailable wording was replaced with instructions to open the emailed link, explicitly verify it, then request the protected PDF. It still does not promise existence or mail delivery.

`/receipt-recovery` uses the existing strict fragment parser and fixed-path URL cleanup. A locally well-formed link now offers **“التحقق من رابط الاسترجاع”** without claiming authorization. An explicit click performs one consuming exchange. Only a validated success enables **“تنزيل الإيصال PDF”**, using the response UUID and the same browser context. Download is also explicit; exchange does not auto-download.

The component presents missing/malformed/cleanup-failed, locally-ready, exchanging, authorized, denied, uncertain, temporary-service/throttle, downloading, download-error and browser-handoff states. Fixed Arabic messages never expose upstream errors or identifiers. Terminal/error headings receive programmatic focus; action states have live announcements, busy/disabled guards and existing responsive RTL styling. Actual browser focus/announcements remain unverified.

Home/projects/recovery-request links remain functional. Payment return still ignores every query/fragment and never identifies a receipt, polls settlement or starts recovery automatically. No financial activation changed.

## D. Fragment security

The browser captures the fragment temporarily, invokes fixed-path `history.replaceState` to remove fragment/query, then parses exactly one `token_id` and `secret`. Unknown/duplicate/conflicting/missing/malformed/overlong input is rejected. If cleanup fails, no exchange is permitted.

Pending credentials live only inside the private operation closure, outside React presentation state/props, DOM, Server Components/Actions, URLs, application cookies, storage, analytics or logs. Public state contains only status, fixed messages and the authorized non-secret locator after success. The credential holder is cleared when exchange begins; the local input object is released immediately after request dispatch and terminal cleanup clears remaining application references. The browser necessarily owns its outgoing network request while sending it.

Repeated effects invoke an initialization guard and do not re-read an empty fragment, discard pending authority or send a request. A new unsent hash can replace pending input only after URL cleanup. Once exchange is attempted, later hashes are cleaned but cannot restart that operation. No replacement token is generated.

Effect cleanup defers disposal by one microtask and compares a lifecycle generation. Immediate Strict Mode reattachment cancels that release; genuine unmount discards pending authority/locator, aborts work and releases temporary PDFs. Late async results cannot update state or offer a file after disposal. Refresh starts a new empty operation and never attempts cookie-based lookup or memory restoration. Model tests cover repeated capture and disposal; real React/browser replay is explicitly not claimed.

## E. Recovery exchange

The operation sends only `{token_id,secret}` to the fixed relative POST path, with same-origin credentials, Accept/JSON content type, no-store, redirect rejection and a 15-second abort timeout. It sets no manual Cookie/Origin, reads no Set-Cookie/HttpOnly authority and performs no generic forwarding.

Success requires HTTP 200, valid object envelope, the exact legacy completion message and canonical `data.receipt_uuid` distinct from token ID. Only that returned locator reaches transient state. Missing/invalid/mismatched locator, malformed response, disconnect, unexpected status or timeout becomes **uncertain**, with no PDF action or retry. A synchronous attempt flag is set before awaiting and never reset; duplicate clicks and repeated effects cannot consume the token twice.

Concealed 404 gives neutral expired/used/unavailable-link guidance rather than a nonexistence claim. Other authorization/format failures are sanitized. 429/503 show service/throttle guidance and do not reuse the token automatically. All terminal exchange outcomes release credentials and offer only existing navigation to request instructions manually. Sending a request, obtaining a link or receiving a cookie is never interpreted as completed donation/payment/download.

## F. Protected PDF

The protected URL derives only from the validated response locator. Token UUID, receipt number, email, payment reference and return query values cannot form a download through the operation. No PDF action exists before validated exchange, and no automatic download starts on success.

Laravel's attachment headers support ordinary navigation. This implementation uses a **bounded fetch/Blob path** to keep denial, not-ready/unavailable and malformed/non-PDF errors in Arabic on the recovery page, preserving its authorized context. It avoids a second preflight/status request or duplicate PDF fetch. No private bytes pass through Next, a third party or public storage.

The explicit GET uses same-origin credentials, no-store, redirect rejection and a 30-second abort timeout. Before browser handoff it requires HTTP 200, `application/pdf`, attachment disposition, private/no-store cache control, no-cache Pragma and `%PDF-` signature. This screens headers/signature; it is not a full PDF parser and does not replace backend document integrity/eligibility. Rejected/oversized streams are cancelled. A **20 MiB frontend byte limit** bounds memory even without Content-Length; this is not a backend business ceiling and could reject a larger otherwise-valid document.

A safe server `receipt-...pdf` filename is retained; otherwise a fixed `receipt.pdf` is used. An opaque object URL is assigned only to a temporary download anchor, which is removed after dispatch. The URL is revoked after a 30-second dispatch window, before replacement, on failed click and on unmount. No secret/receipt UUID enters that Blob URL and no PDF is persisted by the application. UI wording says the file was handed to the browser and explicitly cannot confirm saving on the device.

401/403/404 removes the locator/download action and gives neutral recovery guidance. 429/503, network or invalid-PDF outcomes retain the locator for an explicit protected-GET retry. No download failure can re-exchange the consumed token, start a donation or create a recovery request automatically.

## G. Same-origin security

Only the three verified browser operations are used:

| Method | Path |
| --- | --- |
| POST | `/api/donation-receipts/recovery-requests` |
| POST | `/api/donation-receipts/recovery-exchanges` |
| GET | `/api/donation-receipts/{validated UUID}/download` |

The existing Next project GET bridge is unchanged and unsuitable for receipt cookies. No receipt bridge/handler, generic API proxy or production rewrite was needed for isolated tests. Production/development route checks continue to deny receipt/internal/admin/Payments forwarding at Next; a separately approved external proxy is required for a real deployment.

Laravel retains host-only HttpOnly Strict-SameSite receipt cookies, Secure policy, `/api/donation-receipts` path, server scope/purpose/donation binding and expiration. No frontend cookie reconstruction/domain rewrite or global CORS/session change occurred. The client cannot prove a proxy delivered cookies merely from JSON success; protected GET denial handles missing authority without fabricating a file.

Noindex/nofollow, fixed metadata and path-scoped no-referrer remain. No third-party image/embed/script or analytics was added. Application code does not persist/log PII, secrets, receipt IDs or PDFs. Infrastructure request-log redaction, approved Origin/Fetch Metadata and genuine browser cookie behavior remain staging responsibilities.

## H. Files changed

New:

- `src/features/receipts/data/recovery-operation.ts` — private credential lifecycle, response/UUID validation, one-attempt exchange and protected PDF/error handling.
- `src/features/receipts/data/browser-pdf.ts` — temporary browser download/object-URL lifetime and cleanup.
- `tests/receipt-exchange.test.mjs` — 15 new operation/PDF/security/HTTP simulation tests.
- `docs/PHASE_02E_2_F2_REPORT.md` — this report.

Modified:

- `src/features/receipts/data/recovery-fragment.ts` — retain strict parser; replace the blocked/discard-only inspector with the guarded operation integration.
- `src/features/receipts/components/recovery-link.tsx` — explicit verification/download UI, ephemeral ownership, focus and Strict Mode/unmount cleanup.
- `src/app/receipts/recover/page.tsx` — current verification/download instructions.
- `src/app/globals.css` — status-heading/action sizing and disabled treatment.
- `tests/receipt-recovery.test.mjs` — preserve original request/parser/privacy checks while adapting the capture guard/audit to the completed feature.
- `scripts/verify-routes.mjs` — current request guidance assertion; all prior offline/query/proxy/metadata regressions retained.
- `README.md`, `docs/RECEIPT_RECOVERY.md`, `docs/PROXY.md`, `docs/CHECKOUT_INTEGRATION.md` — repaired handoff, current behavior and remaining external gates.

Existing routes and no-referrer `next.config.ts` settings were reused. No dependency/package/lockfile, API handler, financial operation, activation flag, environment, backend/dashboard, database, production proxy or earlier phase report was modified.

## I. Tests

| Command/check | Actual final result |
| --- | --- |
| `npm run lint` | PASS — zero errors/warnings |
| `npm run typecheck` | PASS — strict TypeScript |
| `npm run test` | PASS — **93 tests**, 0 failures; 78 retained/adapted plus 15 new |
| `npm run build` | PASS — Next 16.4.2; recovery pages retained as static route shells |
| `npm run test:routes` | PASS — actual production Next HTTP regressions with isolated project upstream |
| `node scripts/verify-routes.mjs --dev` | PASS — actual isolated development Next HTTP regressions |
| Read-only Laravel localhost:8000 public-project probe | `ECONNREFUSED`; live receipt connectivity not verified |
| Backend/dashboard working-state hashes | Identical before/after |

The new tests exercise the same operation used by the Client Component: cleanup-before-request, no effect-triggered fetch, pending authority across repeated capture, cleanup failure, invalid/duplicate/unknown fragments, unsent replacement, refresh loss, exact POST DTO, relative credentials, success and UUID versions, token-ID substitution, missing/malformed locator, concealed/expired/used and service failures, disconnect/malformed body/abort uncertainty, no exchange retry, duplicate clicks, no auto-download, protected GET from response UUID only, authorization denial and explicit GET retry.

PDF tests cover attachment/private cache metadata, signature, size bound, safe filename, no offered file on failure, temporary URL revocation on dispatch/replacement/failure/disposal, and suppressed late results after unmount. Public state snapshots contain neither token UUID nor secret. Existing privacy/source checks now allow only the intended transports while continuing to prohibit storage, cookie inspection, logging and status polling.

An isolated loopback HTTP server runs the real exchange/PDF operation using synthetic token, receipt, cookies and PDF bytes. It issues two synthetic Set-Cookie headers, authorizes PDF only for the matching simulated scope/capability and receipt, rejects absent/wrong cookies, cross-receipt requests and one-time replay. A test-only cookie jar simulates delivery; application code never reads/sets these headers. This does **not** establish Laravel cryptography, actual HttpOnly/Secure/SameSite enforcement, approved browser Origin or production proxy correctness. A separate retained loopback test covers neutral recovery requests. No real mail, token, customer file or provider was contacted.

All homepage/discovery/filter/detail/media/money/donor/billing/review, checkout-default-disablement and neutral-return checks remain. HTTP tests still prove no upstream receipt/financial forwarding by Next, offline page rendering, privacy metadata and no query reflection. Initial SSR has no credential or functional exchange/PDF action before browser capture. Development framework debug serialization remains distinguished from public markup; full production HTML is checked for synthetic-query non-reflection.

An initial lint warning about reading a changing generation ref during cleanup was resolved by capturing the stable lifecycle lease object while preserving the intentional replay-generation check. No final warning or failed gate remains. Temporary QA servers/snapshots were cleaned up; the user's development server was not stopped.

## J. Browser review

**NOT VERIFIED.** No browser automation/preview tool was available. Tests cover controller/helper logic, real initial SSR and HTTP transport; they do not establish actual hydrated clicks, browser history cleanup, React effect replay, focused announcements, file saving, keyboard/screen-reader behavior or visual overflow.

Manual review at 1440px desktop and 360px mobile should capture request entry/neutral result, valid-fragment ready state after visible cleanup, explicit exchange processing, authorized download, denied/expired link, uncertain exchange and failed-PDF retry. Use only synthetic data and an authorized isolated mock/staging instance. Verify repeated clicks, Strict Mode replay, a new hash before/after submission, refresh after cleanup/exchange, unmount cancellation/object-URL release, no persistent app data, no automatic API/download, visible focus and no horizontal overflow. An actual browser download must be observed before claiming file-saving acceptance.

## K. Remaining deployment gates

The previous receipt-locator contract gap is resolved. Remaining gates are external verification, not missing frontend handoff:

1. Provide authorized staging with real backend connectivity and approved recovery frontend/public origin configuration matching `/receipt-recovery`.
2. Independently approve/verify exactly the three receipt routes/methods at the same-origin edge, preserving Cookie/Set-Cookie attributes, Origin/Fetch Metadata, private cache headers, TLS and trusted forwarding while denying unrelated routes.
3. Verify mail delivery and real single-use/expiry/ambiguity behavior with isolated authorized recipients, never actual customer tokens for QA.
4. Complete genuine browser cookie, fragment, Strict Mode, accessibility/mobile and observed PDF handling. Review the bounded Blob approach/20 MiB limit against actual document sizes.
5. Verify infrastructure log redaction and absence of third-party telemetry for recovery material. Keep payment activation disabled and preserve all prior checkout staging prerequisites.

No environment/proxy activation, real recovery request, real email, production PDF or financial operation was performed to satisfy tests.

## L. Final verdict

**COMPLETE — Phase 02E-2-F2 frontend recovery exchange and protected PDF implementation with isolated integration checks.**

The explicit one-time exchange consumes the repaired `data.receipt_uuid` contract and enables only a cookie-protected, response-derived PDF operation. Strict credential hygiene, ambiguity handling, bounded private file delivery and all required runnable tests pass. Real browser/proxy/mail/staging readiness remains **NOT VERIFIED**. Backend/dashboard and financial boundaries are unchanged; no Git initialization, commit or deployment occurred.
