# Donations public frontend — Phases 02A–02F-1

## Public-site polish (Phase 02F-1)

Homepage guidance now describes local entry/review and currently disabled payment. Receipt recovery is reachable from the homepage and footer. Shared navigation targets, wrapping and skip-link focus were refined without changing the visual identity or financial flows.

`SITE_ORIGIN` accepts an HTTP(S) origin only, without credentials, path, query or fragment. Invalid/missing configuration omits absolute canonical URLs and sitemap entries. Listing metadata shares one request-local read with the page, uses normalized self-canonicals, and marks filters, non-default sorts, empty/out-of-range results and outages `noindex, follow`. Normal populated pagination remains indexable. Dynamic project metadata remains resource-specific; donation/return/recovery pages retain noindex.

Runtime `/robots.txt` allows workflow crawling so their noindex can be read and disallows `/api/`. Runtime `/sitemap.xml` contains home/projects plus at most 100 published numeric project URLs from one validated public listing request. It is a bounded discovery seed; older projects remain discoverable through pagination. No recursive traversal, build-time Laravel dependency, financial fields, private workflow URLs or invented dates are added. Outages omit project entries. No unsupported organization structured data or unapproved legal pages are published.

Headless Chrome reviewed synthetic flows at 1440/820/390/360px. Run `node scripts/verify-routes.mjs --browser` after building to repeat the isolated review; Chrome must be installed at the script's explicit path; a private temporary profile and its dynamically allocated loopback debugger port are used. This QA script intercepts synthetic receipt requests in the browser only; it adds no application proxy. Screenshots and limitations are in `qa/phase-02f-1/` and the [Phase 02F-1 report](docs/PHASE_02F_1_REPORT.md). This does not establish live backend, gateway, SMTP, browser-cookie or production-proxy acceptance.

Standalone Arabic-first public frontend at `D:\Code\Donations\donations-frontend`. The existing project was inspected and extended, rather than replaced. No changes to Laravel or the dashboard are needed for this phase.

## Local setup

Use Node.js 20.9+ (verified here with Node 24.19.0).

```powershell
cd D:\Code\Donations\donations-frontend
npm ci
Copy-Item .env.example .env.local
# Set the new frontend's DONATIONS_BACKEND_ORIGIN to your running Laravel origin.
npm run dev
```

Visit `http://localhost:3000`. For a different port, run `npm run dev -- --port 3017` and update this app's `SITE_ORIGIN`. Do not modify the backend or dashboard environment files.

| Setting | Purpose |
| --- | --- |
| `SITE_ORIGIN` | Public origin used to construct canonical URLs; set to the approved site origin in production. If omitted, absolute canonical URLs are omitted instead of inventing a domain. |
| `DONATIONS_BACKEND_ORIGIN` | Server-only HTTP(S) Laravel origin, with no credentials, path, query or fragment. No `NEXT_PUBLIC_` setting is used. |
| `LOCAL_PUBLIC_API_PROXY` | Set `true` to opt into the development-only public GET bridge. Ignored in production. |

The UI uses Server Components and server-only fetches. It never makes browser API calls to the Laravel hostname. Missing configuration, unavailable Laravel, malformed responses and request timeouts show a service-unavailable message without fake project data. Requests have a six-second timeout, reject redirects, and use `cache: 'no-store'` so funding displays are refreshed per request and offline build results cannot become permanently cached pages. See the [Next.js fetch reference](https://nextjs.org/docs/app/api-reference/functions/fetch).

## Architecture

```text
public/fonts/                  Local Alexandria variable font and OFL license
src/app/                       Layout, homepage, listing, loading/error/404 routes
src/app/api/donation-projects/  Narrow development bridge (collection and numeric ID)
src/components/                Header, footer, homepage sections, cards, grids, states
src/features/projects/data/    Runtime public contract validation
src/features/projects/types/   Verified Laravel resource/collection types
src/features/projects/components/ Detail media, native video, image fallback, funding summary
src/lib/api/                   Server-only upstream access and development forwarding
src/lib/config/                Central provisional brand and canonical strategy
src/lib/formatters/            Exact minor-unit currency display
src/lib/projects.ts            Server-only public listing query
tests/                         Node tests and isolated synthetic contract fixture
scripts/verify-routes.mjs       Real Next HTTP checks against a temporary mock upstream
docs/                          Contract, deployment guidance, execution report
```

Routes: `/`, `/projects?page=1`, `/projects/{numeric-id}`, `/donate/{numeric-id}`, and `/payment-return`. Card titles open real detail pages; the detail funding area links to amount/guest/billing review. Category/country links keep their discovery behavior. The four-stage checkout integration remains disabled pending approved environment and return validation. Client Components handle review and operation state, error retry and media failures; project reads and financial summaries remain server-rendered.

## Neutral payment return (Phase 02E-1)

`/payment-return` is a public, static Arabic page matching the backend deployment contract's fixed return path. It requires no cookies, login, transaction reference or backend availability. It ignores all query/fragment values, including `success`, `hmac` and `return_to`, and never confirms payment, polls status or repeats a financial step. Conditional receipt guidance makes no claim that email was sent or delivered. Functional links lead to home/projects and the implemented recovery-request page; no receipt identity comes from the payment return.

Return metadata is `noindex, nofollow`, with neutral fixed title/description and no transaction canonical/OG information. Route-scoped HTTP and metadata referrer policy use `no-referrer`; public project indexing is unchanged. No third-party media or analytics is introduced. See [the Phase 02E-1 report](docs/PHASE_02E_1_REPORT.md) and [return configuration guidance](docs/CHECKOUT_INTEGRATION.md). All financial activation flags retain their false defaults, and no actual gateway return has been tested.

## Receipt recovery (Phase 02E-2-F2)

Backend Phase F1 repaired the previous locator gap: authorized one-time exchange now returns the existing completion message plus `data.receipt_uuid` and protected receipt cookies. The frontend consumes this verified response; it never substitutes token UUID, receipt number, email or payment-return values for receipt UUID.

`/receipts/recover` preserves its exact receipt-number/email request and neutral 202, errors/throttling and nonserializing private form. Its guidance now explains verification and protected download without promising email delivery. `/receipt-recovery` captures a factory-shaped fragment in browser memory, removes fragment/query before validation, and offers an explicit Verify action. Repeated effects preserve the pending credential without making a request. The secret never enters React presentation state, server props, URLs, storage, cookies, logs or analytics.

Only a valid HTTP 200, exact legacy completion message and canonical `data.receipt_uuid` enable an explicit protected download. The UUID follows Laravel's route shape without a hardcoded UUID version, and cannot equal the token UUID. Each page operation sends at most one exchange; failure/timeout/malformed response never retries a possibly consumed token. Terminal state clears credentials; genuine unmount aborts work and clears memory. Strict Mode cleanup is deferred one microtask so immediate effect replay cannot discard a pending link. Refresh does not restore memory or authority.

Download uses only the returned UUID with browser-managed same-origin cookies. A bounded fetch/Blob path keeps denied/unavailable/non-PDF responses in Arabic on the page, checks private attachment headers and PDF signature, and creates a temporary object URL revoked after dispatch/replacement/unmount. A 20 MiB frontend transfer bound protects memory; it is not a backend business limit. Protected GET retry never repeats exchange. The UI reports browser handoff, not verified saving or payment settlement.

Both pages retain noindex/nofollow and no-referrer. No receipt proxy was added; the existing project bridge stays GET-only. External exact-route approval and real browser cookie behavior remain staging requirements. All executed recovery traffic used synthetic isolated mocks; no real email, token or PDF was used. See [the F2 report](docs/PHASE_02E_2_F2_REPORT.md) and [current receipt contract](docs/RECEIPT_RECOVERY.md). The earlier blocked report is historical; financial checkout remains disabled.

## Donation transaction integration (Phase 02D-2B)

Final review can orchestrate intent → reservation → payment creation → hosted checkout. **Financial requests default to disabled**, independently of project-read connectivity. The disabled review offers edits and an unavailable notice, without a payment submission button. No live mutation was executed during implementation. See [the execution report](docs/PHASE_02D_2B_REPORT.md) and [activation contract](docs/CHECKOUT_INTEGRATION.md).

The server evaluates `DONATIONS_MUTATIONS_ENABLED`, `DONATIONS_INTEGRATION_VERIFIED`, and `DONATIONS_PAYMENT_RETURN_VERIFIED` (all must explicitly equal `true`), plus a nonempty configured `DONATIONS_GATEWAY_CODE`, exact DNS `DONATIONS_CHECKOUT_HOSTS`, and `DONATIONS_VERIFIED_RETURN_URL` on the HTTPS `SITE_ORIGIN`. These are operator attestations after independent verification, not discovery or proof supplied by the application. No gateway or checkout host defaults exist. Keep flags false until the existing public return page and all checkout prerequisites receive staging approval.

Enabled requests use only relative `/api/donations` POST paths and browser-managed same-origin credentials. There is **no Next mutation bridge**. An independently approved external proxy must supply those exact routes before activation. The existing GET-only bridge cannot carry this flow. Operation snapshots, separate secure UUID-v4 keys, donor/billing data and server references remain in memory; no browser storage, cookie inspection, analytics or logging is added.

Confirmed stages are retained. Explicit throttling, rejected reservation and payment-service-unavailable responses can retry the same stage with identical facts/keys. Ambiguous network or malformed responses require attention: a lost first intent response can lose the server-issued idempotency scope; reservation cannot redeliver a lost payment cookie; guest payment creation consumes its capability. The frontend never compensates by generating a fresh intent. Editing is locked once sending starts; cancellation/restart and cross-refresh recovery are unavailable. Hosted navigation requires an exact approved HTTPS host and future expiry, and never claims settlement. The implemented neutral return page never confirms settlement; no status polling is implemented.

## Amount and guest review (Phase 02D-1)

The following phase sections describe the original local-review delivery. Phase 02D-2B adds the explicitly gated transaction behavior above; when disabled, the original local-only behavior remains.

The donation-entry route verifies the published numeric project through the existing strict read client. Invalid/missing projects use the not-found boundary; upstream failures show retry/back navigation without exposing an entry form. Published status does not establish final donation eligibility; the page clearly distinguishes local review from submission, capacity reservation and payment.

`src/features/donations/data/guest-draft.ts` provides exact major-string → minor-string validation, Arabic/Persian digit normalization, guest validation and the in-memory review/edit reducer. Precision follows the backend: JPY 0, KWD/BHD 3, otherwise 2. Dot and Arabic decimal separator are accepted; grouping separators, exponent notation, excess precision, zero/negative amounts and technical overflow are rejected without rounding. The verified local PHP runtime is 64-bit. A lower configured backend amount ceiling is not public and remains authoritative in Phase 02D-2; the reusable amount validator can accept a known lower ceiling.

The form collects required name/email/phone and optional `is_public_anonymous`. Review shows exact currency, project and entered details with an Edit action. It has no functioning payment/submit-to-backend action. State is React memory only: no personal-data URLs, app storage, cookies, analytics, logs, idempotency keys, capability tokens or network writes. Native controls remain disabled until hydration, have no `name` serialization attributes, and the form uses non-network dialog submission semantics plus `preventDefault`. Browser-managed autofill is separate from application persistence. No financial bridge/proxy route was added.

See [the full Phase 02D-1 report](docs/PHASE_02D_1_REPORT.md) for exact backend fields, validation boundaries, tests and Phase 02D-2 prerequisites. The internal review's `amount_minor` is display data, **not** an allowed future intent request field; Phase 02D-2 must construct an explicit allowed-field payload using `amount` in major units.

## Billing and final review (Phase 02D-2A)

The same donation route now uses three local steps: Donation → Billing → Review. The original guest validator/reducer and exact amount rules are retained, composed by `billing-flow.ts`. Final review has separate donation/billing Edit actions; moving backward preserves drafts, while edits invalidate stale review. Repeated Next/Review actions cannot skip a step.

The required eleven-field billing draft mirrors both `CreateDonationPaymentRequest` and its stricter `DonationBillingData` DTO. **The DTO currently accepts only billing country `EG`**, rejects placeholder strings such as `N/A`, and requires real nonempty first/last name, contact and address fields including floor/apartment. The country starts empty and must be chosen explicitly. No donor name splitting, default address, postal-code field or payment credential collection is introduced.

Validated donor email/phone populate untouched billing contact fields. If a visitor edits or clears a billing contact field, later donor changes do not overwrite it. Untouched copied contact fields refresh when validated donor contact changes. All state remains in memory; no financial request, storage, personal-data URL, capability token or new proxy route exists.

See [the Phase 02D-2A report](docs/PHASE_02D_2A_REPORT.md) for actual field limits, normalization, validation limits, allowlisted future intent/payment DTO mapping, test results and unverified browser checks. The prior report's request-level two-character country rule must be read together with the deeper **EG-only DTO** requirement discovered in this phase. No gateway is assumed enabled, and no payment action is exposed.

## Project details (Phase 02C)

`/projects/[project]` uses the actual numeric Laravel primary key, not UUID, reference or invented slug. The shared server API client reads `{ data: DonationProject }` with strict validation, no-store, a six-second timeout and request-local React cache for page/metadata consistency. Invalid IDs and upstream 404s invoke Next's not-found boundary. Connection/HTTP errors, timeouts and malformed/mismatched resources show temporary recovery UI with retry, never a false permanent-not-found message.

Detail content includes breadcrumbs, title/reference/category/country, nullable beneficiary count, summary, full escaped plain-text description, cover and lazy gallery, supported native video, exact goal/net collected/remaining capacity, source progress, and meaningful Cairo-time acceptance dates. Remaining capacity is explicitly labeled as net of reservations and is not guaranteed availability. No date-based acceptance promise is inferred from publication.

Image failures have a native client fallback. Gallery order follows the resource; there is no heavy viewer or hidden gallery control. Videos play only for explicit MP4/WebM/Ogg MIME types with safe actual URLs; unknown/QuickTime/M4V types have a restrained fallback, and arbitrary iframes are never embedded. There is no subtitles/streaming-provider contract. Images use the existing unoptimized delivery policy, avoiding an arbitrary image-fetch proxy.

An optional first-page request (`per_page=4`) supplies at most three recently created published projects after excluding the current ID. It is labeled recent, not algorithmically related, and failures omit it without breaking the detail page. Public project updates were inspected but are deferred: they have a separate paginated update/media contract and are not fetched or added to the existing bridge/production allowlist.

Metadata uses real project title/description/cover and configured `SITE_ORIGIN`. Empty-media projects receive no fabricated OG image. Temporary outage metadata is `noindex, follow`; it does not claim the project is permanently removed. Under Next's existing loading boundaries, `notFound()` can produce a streamed HTTP 200 carrying the framework's 404 signal and `noindex`; before streaming it returns HTTP 404. Tests verify the not-found signal separately from outage markup. See the installed Next guide `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`.

No donation intent, reservation, payment, checkout or fake Donate Now URL is created. The funding sidebar now links to the implemented local information-review experience. See [the Phase 02C report](docs/PHASE_02C_REPORT.md) for the historical detail implementation.

## Project discovery (Phase 02B)

`/projects` now supports URL-driven country/category filtering and the actual three descending sort modes. Apply the native GET form to change country or sort; pagination always resets to the first page. Pagination, individual removal links and retry preserve the other valid choices. Clear All returns to `/projects`. Canonical metadata includes applied query state. Invalid, conflicting, repeated or unknown parameters redirect to a clean normalized URL and are not sent to Laravel.

The country selector contains 249 ISO alpha-2 reference codes matched to the backend's installed `league/iso3166` registry, localized using Intl. This is a standard country list, **not** a list of countries that currently have published projects. Some countries may return no results. Country labels on listing cards also provide functional filtering links.

**Category discovery is deliberately link-based:** listing cards link to their actual public resource category ID/name, preserving country/sort and resetting pagination. Valid category IDs in shared URLs are applied server-side; chips allow individual removal. There is no global category dropdown because Laravel exposes donation categories only to authenticated administrators. No complete category catalog is inferred from one page, and the UI does not ask visitors to guess an ID. Empty/unavailable category results use an explicit numeric-ID label when no verified category name is available.

Text/reference search, funding-status filtering, ascending sort and a live project-country catalog are not public backend capabilities. No fake controls or page-local search are provided. See [the Phase 02B report](docs/PHASE_02B_REPORT.md) for source evidence, URL rules and the remaining backend discovery gaps.

The design uses configurable green, off-white, gold, and neutral tokens in `globals.css`, self-hosted Alexandria, RTL logical borders and spacing, one/two/three-column project grids, visible focus, a skip link, and reduced-motion support. Brand name and tagline live in `src/lib/config/site.ts`.

## Contract and deployment

Read [the verified public API contract](docs/PUBLIC_API_CONTRACT.md), [reverse-proxy guidance](docs/PROXY.md), and [checkout activation contract](docs/CHECKOUT_INTEGRATION.md). Only public collection and project GET paths are eligible for the local bridge. The financial client remains disabled until explicit activation; there is no generic proxy, wildcard CORS or admin authentication.

Production must enforce the route and method allowlist externally. The local bridge returns 404 in `next start`, even with its flag enabled. It is not a substitute for Nginx allowlisting. Images use backend-provided public media URLs with explicit dimensions and unoptimized `next/image`; arbitrary upstream images are not fetched by the Next image optimizer. Configure public media URLs or a separately reviewed static-media mapping at deployment; do not expose private storage or an entire backend origin to make images work.

## Checks

```powershell
npm run test
npm run lint
npm run typecheck
npm run build
npm run test:routes
node scripts/verify-routes.mjs --dev
npm start
```

Run `build` before the production route checks. Route checks temporarily use loopback port 3217 and a random mock-upstream port, then stop their servers. The development check creates and removes a temporary source snapshot under ignored `.next/qa-source-*`, sharing existing installed dependencies, so it can run alongside a user's normal development server. It copies no `.env` files and does not change normal build/deployment configuration. Fixtures are test-only and never imported by application code. The checks verify real server query forwarding, normalization, combined filters, pagination/reset/removal URLs, sort, filtered retries, empty/failure responses and homepage regression. Unit tests also cover exact monetary precision and safe URL construction.

HTTP checks are not visual browser tests. Earlier phases had no browser automation; Phase 02F-1 additionally ran the installed headless Chrome against synthetic isolated fixtures, with remaining browser limits documented in its report. See the [Phase 02A report](docs/PHASE_02A_REPORT.md) and [Phase 02B report](docs/PHASE_02B_REPORT.md) for results and the live-backend limitation.
