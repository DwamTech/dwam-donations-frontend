# Secure receipt recovery and protected PDF - Phase 02E-2-F2

The backend F1 receipt-locator repair is consumed by the completed frontend recovery operation. Implementation and isolated mock tests pass; actual external proxy, browser cookies, mail and staging remain unverified. Financial checkout stays disabled. Earlier blocked-phase reports are historical.

## Verified sequence

1. `/receipts/recover` sends only `{receipt_number,email}` to POST `/api/donation-receipts/recovery-requests`. Validated 202 is always neutral and does not prove receipt existence, token creation, email delivery or settlement. The existing request form/error/privacy behavior remains.
2. The existing email URL points to `/receipt-recovery#token_id=<token UUID>&secret=<43-character base64url secret>`. This default path matches the backend factory/deployment contract. The token UUID is not a receipt UUID.
3. Browser-only capture removes fragment/query using a fixed `history.replaceState` target before parsing. Strict syntax rejects duplicates, unknown/conflicting parameters, malformed or overlong data. Valid credentials live only in a private closure until the explicit Verify action. Effects never exchange automatically.
4. POST `/api/donation-receipts/recovery-exchanges` sends only `{token_id,secret}`. The HTTP 200 response must contain the exact existing message `Receipt recovery completed.` and `data.receipt_uuid`. UUID syntax follows Laravel `whereUuid`: canonical hexadecimal shape, without a version restriction. A response substituting the token UUID is rejected.
5. Laravel's server-managed scope/capability cookies remain the authority. The returned UUID only locates the protected file. It never replaces cookies or establishes settlement.
6. An explicit PDF action sends GET `/api/donation-receipts/{validated response UUID}/download` with browser credentials. No guessed/public download path or status lookup exists.

## One-time safety and lifecycle

Capture initializes once per operation, preserving a valid pending credential across repeated Strict Mode effects. A new unsent fragment can replace the draft after URL cleanup. After any exchange attempt, another hash is cleaned but cannot restart or replace that operation. All public operation state contains only status, fixed messages and, after success, the non-secret receipt locator. No secret enters React presentation state, DOM, server props/actions, application cookies, storage or logs.

One synchronous guard excludes duplicate exchange/download clicks. The exchange attempt flag is set before awaiting fetch and never reset. Exchange uses a 15-second abort timeout, relative URL, JSON/Accept, same-origin credentials, no-store and redirect rejection. No manual Cookie/Origin or capability inspection occurs. The holder clears its credential when the request starts; application-local request input is released after dispatch, and terminal cleanup discards all remaining references. The browser necessarily retains its own network request while sending.

404 means neutral invalid/expired/used/unavailable authority, not receipt nonexistence. Other authorization/format errors are sanitized. 429/503 are terminal service/throttle states for this token, with manual navigation to request new instructions. Disconnect, abort, malformed response, missing/invalid locator or unexpected success is uncertain and never retries a potentially consumed token. No replacement token or automatic recovery request is generated.

On actual component unmount, effect cleanup schedules a one-microtask release. An immediate Strict Mode reattachment invalidates that cleanup generation; a genuine unmount disposes the operation, clears pending credentials/UUID, aborts in-flight work, suppresses late state/file delivery and revokes temporary PDFs. Refresh starts with no retained locator or credential; browser cookie presence never triggers a lookup/exchange.

## PDF delivery choice

Laravel's attachment supports direct navigation. This frontend instead uses bounded fetch/Blob to keep the authorized recovery page available for Arabic handling of denied capability, unready file, infrastructure error and malformed/non-PDF response. It avoids a second preflight/status lookup or duplicate PDF fetch. No private PDF is copied through Next or a third-party service.

The GET has a 30-second abort timeout, same-origin credentials, no-store and redirect rejection. A successful response must be HTTP 200, `application/pdf`, attachment disposition, private/no-store cache control and no-cache Pragma. Bytes must begin with `%PDF-`. This is header/signature screening, not a full PDF parser or substitute for backend integrity/eligibility checks. Streamed bytes are capped at **20 MiB** to bound client memory, even without Content-Length. This is a frontend safety limit, not an invented backend business rule; larger legitimate files would require separately reviewed delivery UX. Rejected/oversized streams are cancelled.

A safe server `receipt-...pdf` filename is retained; otherwise a fixed `receipt.pdf` is used. An opaque object URL is attached only to a temporary browser download anchor. It is revoked after a 30-second dispatch window, before replacement, on failed click or on unmount. Neither the one-time secret nor receipt UUID is embedded in that Blob URL. No PDF is persisted by the application. The UI says the file was handed to the browser; it cannot prove saving to disk.

401/403/404 download responses remove the locator/action and give neutral recovery guidance without declaring that a receipt never existed. 429/503, transport errors and invalid PDF preserve the locator for an explicit protected-GET retry. Retrying download never re-exchanges the consumed token or starts a donation. No polling or automatic download exists.

## Backend cookies and authority (unchanged)

Scope/capability cookies remain HttpOnly, host-only, SameSite Strict, Path `/api/donation-receipts`, Secure in production/configured secure sessions. Scope lifetime is 129600 minutes; receipt capability lifetime is 90 days. Recovery token expiry is a separate 15 minutes. Browser fetch must preserve these server-issued attributes through the external proxy. Receipt download still checks scope/donation/purpose, private disk/readiness, current financial eligibility, document hash and mandatory audit. A known UUID or other receipt's cookies never authorize the file.

## Exact external routes, no Next receipt bridge

| Method | Approved candidate path |
| --- | --- |
| POST | `/api/donation-receipts/recovery-requests` |
| POST | `/api/donation-receipts/recovery-exchanges` |
| GET | `/api/donation-receipts/{canonical UUID}/download` |

These are future independently approved edge routes, not deployment changes. Existing Next project GET forwarding remains unchanged, cookie-stripping and production-disabled. It cannot carry receipt authority. No receipt route handler/bridge was needed for isolated testing and none was added. A frontend without an external receipt proxy safely reports unavailable/uncertain operations rather than fabricating authority.

Preserve browser Cookie/Origin/Fetch Metadata and individual Set-Cookie headers unchanged; preserve private no-cache PDF headers and avoid server/CDN caching. Never spoof security headers, broaden CORS, rewrite cookie domains/paths or accept arbitrary upstream destinations. Deny other methods and admin, donor, Payments, Sanctum, generic receipt collection/search and public static PDFs. Stage exact matching, TLS, direct-upstream restrictions and trusted forwarding separately.

Before staging, align `DONATION_RECEIPTS_RECOVERY_FRONTEND_URL` with the approved `/receipt-recovery` page and configure the existing public origin/exchange allowed origin as already documented by Laravel. No actual environment was changed here. Mail/proxy/browser tests must use an authorized isolated environment; no real customer token/email/PDF was used in F2.

## Privacy and acceptance

Recovery pages retain noindex/nofollow, no-referrer HTTP/meta policy and fixed metadata without canonical identifiers or third-party media/analytics. Incoming query strings can still appear in infrastructure logs or Next development debug data; real secrets must stay in fragments, with separately verified log redaction.

Unit/controller tests and an isolated HTTP server verify exchange/locator/PDF composition, one-time denial and simulated Cookie/Set-Cookie delivery. The test-only cookie jar deliberately does not establish genuine browser HttpOnly/Secure/SameSite enforcement, Laravel cryptography or production proxy correctness. Browser fragment removal, actual React replay/focus, desktop/mobile layout and observed file saving remain NOT VERIFIED without a browser tool. See [the F2 report](PHASE_02E_2_F2_REPORT.md).
