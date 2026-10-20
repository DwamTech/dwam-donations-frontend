# Phase 02C — Project details and media experience

Date: 2026-10-20, Africa/Cairo.

## A. Initial state

Extended `D:\Code\Donations\donations-frontend` in place. The Phase 02B baseline contained the Arabic homepage, URL-driven discovery, country/category filters, descending sort, paginator, strict collection validation, exact minor-unit formatting and an opt-in development GET bridge.

Read `AGENTS.md`, the existing README/contract/phase documentation and installed Next.js guides for dynamic page params, generated metadata, request-local memoization, and not-found/loading semantics. Next.js remains 16.4.2, React 19.3.1 and TypeScript 5.9.3; no dependency or scaffold was added.

The frontend is still not a Git repository; no repository was initialized or committed. Protected repositories were inspected read-only. Hashes of tracked diff plus porcelain status were unchanged before/after this phase: Laravel retained its existing modifications and the dashboard remained clean. No backend, dashboard, database, environment or deployment configuration was changed.

## B. Verified project detail contract

Read these actual source files:

- `DwamCMS/routes/api.php:75–78`: public collection/detail and project-update routes.
- `app/Modules/Donations/Http/Controllers/DonationProjectController.php`: `publicShow` model binding, eager loading and publication restriction.
- `app/Modules/Donations/Models/{DonationProject,DonationModel}.php`: no custom route key; media sorted by `sort_order`, then `id`.
- `app/Modules/Donations/Http/Resources/{DonationProjectResource,DonationProjectMediaResource}.php`: actual resource/envelope/media fields.
- `app/Modules/Donations/Services/{DonationProjectService,DonationProjectMediaService}.php`: description storage, lifecycle rules and approved asset MIME types.
- `app/Modules/Donations/Http/Controllers/PublicDonationProjectUpdateController.php` and update/media resources: separate published-update contract.

**Identifier:** Laravel binds `{project}` to the default numeric primary key. No custom Donations project binding, UUID/reference key, or public slug resolution was found. Frontend routes use `/projects/{numeric-id}`. Identifiers must be positive decimal strings without leading zeros, bounded by the frontend's signed-64-bit safety limit. Invalid identifiers are rejected before any upstream request. Response resource IDs must also match the requested identifier.

**Endpoint/envelope:** `GET /api/donation-projects/{id}` returns `{ "data": DonationProject }`. Missing or unpublished projects return 404. `publicShow` requires `status === published` and loads `category` and `media`. Publication alone does not guarantee an open acceptance window. Public lifecycle `status` is omitted from the resource.

Fields used by detail UI/metadata:

| Fields | Use |
| --- | --- |
| `id`, `title`, `reference` | Detail navigation, document heading/title, reference |
| `category.id/name/slug`, `country_code` | Category and localized country presentation; existing discovery remains compatible |
| `short_description`, `description` | Summary, full escaped description, metadata excerpt |
| `beneficiary_count` | Rendered when non-null, including an explicit supplied zero |
| `currency`, `target_amount_minor`, `collected_amount_minor` | Exact goal and net collected display |
| `remaining_amount_minor`, `progress_percent`, `financial_status` | Explicit net-of-reservations capacity, authoritative progress and funding state |
| `cover_image`, `gallery_images`, `videos` | Actual storage URLs, captions, MIME types and resource ordering |
| `acceptance_starts_at`, `acceptance_ends_at` | Meaningful acceptance timestamps, localized in Cairo time |

Media fields remain `id, uuid, type, url, mime_type, caption, sort_order`. The first ordered image is the cover and the remaining ordered images form the gallery. URLs are built from storage disk/path; model `external_url` is not exposed. No media/provider URL was invented.

The controller accepts description as a nullable string and the service stores it directly. The public contract declares no Markdown/HTML content format or sanitization guarantee. The page renders the complete value as escaped plain text with preserved paragraph/newline spacing; HTML-like input remains literal text.

## C. Implemented pages

New dynamic route: **`/projects/[project]`**, with a route-specific loading state and existing global error/not-found boundaries.

The page supplies functional breadcrumbs, project title/reference/category/country, optional summary/beneficiary count, cover/gallery/video, full description, funding sidebar, dates, back-to-discovery navigation and a restrained contribution explanation for the future donation workflow.

`getDonationProject` is a reusable server-only reader with shared strict resource validation, no-store fetching, six-second timeout, redirect rejection and distinct `ready`, `not-found`, and `unavailable` outcomes. React `cache` reuses the result within a render request so metadata and body perform one detail read; it is not a persistent financial cache.

Optional recent projects use one first-page collection request with `per_page=4`, exclude the current project ID and show at most three published records. They are labeled “latest published,” not algorithmically related. A failure or empty eligible result omits the optional section. It does not break the detail page.

Titles on homepage, listing, filtered-listing and recent-project cards now open `/projects/{id}`. Country/category filter links remain separate sibling actions, without nested anchors or a whole-card click overlay. Discovery query/pagination behavior is preserved.

No donation form, intent, reservation, checkout, payment request, transaction page or fake Donate Now URL was added.

## D. Media experience

- A clear cover precedes the gallery; cover images are eager-loaded, gallery/card images use lazy loading.
- Explicit dimensions and CSS aspect ratios prevent media from stretching the layout. The gallery is a simple responsive image grid, without a dependency, modal, carousel or inactive controls.
- Resource order is preserved; unusable gallery URLs are omitted without reordering usable images.
- Captions come from the API; image alt text uses the caption or project title.
- Missing or failed images get a textual visual fallback through a small Client Component. No fabricated replacement photograph or broken-image placeholder is deliberately rendered.
- URL handling accepts HTTP(S) and single-slash public-relative URLs, rejecting executable/data schemes, protocol-relative sources, backslashes/control whitespace and embedded credentials.
- Existing unoptimized Next Image delivery is retained, so Next is not made into an unrestricted remote-image fetcher. Media-host reachability/public storage mapping remains deployment-specific and unverified against live records.
- Native video is rendered only with an actual safe URL and explicit `video/mp4`, `video/webm`, or `video/ogg` MIME. Playback uses labeled native controls, `playsInline`, `preload="none"`, no autoplay, and a safe new-window file link. Load/playback errors show fallback text.
- Unknown types and QuickTime/M4V receive an unsupported-format message. No arbitrary iframe, hosted-provider embed, guessed MP4 extension or streaming integration is created.

Native controls/fallbacks are implemented, but actual image loads, browser playback/codecs and error events were not executed in a browser. The backend has no subtitle/transcript field contract; complete captioned-video accessibility is not claimed.

## E. Financial presentation

Displays exact target, net collected, source progress, public financial status and `remaining_amount_minor`. Currency formatting retains the verified JPY 0/KWD 3/BHD 3/otherwise 2 precision and BigInt display behavior. No financial arithmetic, mutation or fabricated default amount was introduced.

Remaining amount is explicitly labeled **capacity after reservations**. The resource computes `max(0, target - collected - reserved)`; it is not treated as target-minus-collected, collected money, or guaranteed future availability. Explanatory text warns that it can change and does not guarantee acceptance of a new contribution.

Progress uses the backend value, with a visually clamped 0–100 bar and the original percentage/inconsistency note for values outside that range. Funding states come from `financial_status`, not an invented public lifecycle field. Dates render only when present and parseable, with Cairo timezone labeling. The page never infers an open acceptance window from publication.

## F. SEO

Successful project metadata uses the real title, real summary/description excerpt, configured public-origin canonical `/projects/{id}`, and project-specific Open Graph title/description. A suitable actual cover URL is used for OG images; no image is fabricated for an empty-media project. Relative covers require a configured public origin to produce an absolute OG URL. No author/organization credential is invented.

The full description is never injected as HTML. The metadata excerpt strips tag-like delimiters, collapses whitespace and limits length for presentation; this is not used as an HTML sanitizer.

Upstream 404/invalid ID invokes Next `notFound()` with `noindex`. Temporary outages instead return explicit recovery UI and temporary `noindex, follow` metadata, without a not-found signal or permanent-removal claim.

**Observed framework behavior:** existing loading boundaries can begin streaming before the not-found outcome resolves. Next then retains HTTP 200 and emits `NEXT_HTTP_ERROR_FALLBACK;404` plus `noindex`; a pre-stream not-found response can return HTTP 404. This is documented by the installed `not-found.md`/loading guides. Tests verify the framework not-found signal and actual robots metadata, and verify that outage responses do not emit that signal. They do not equate every streamed not-found response with a transport-level HTTP 404.

## G. Files changed

New:

- `src/app/projects/[project]/{page.tsx,loading.tsx}`
- `src/features/projects/data/presentation.ts`
- `src/features/projects/components/{project-image.tsx,project-video.tsx,project-media.tsx,funding-summary.tsx}`
- `docs/PHASE_02C_REPORT.md`

Modified:

- `src/lib/projects.ts` — cached-per-request, strict single-project reader.
- `src/features/projects/data/contract.ts` — shared project validator and detail-envelope parsing.
- `src/components/project-card.tsx` — title detail links and reusable image-failure handling.
- `src/app/api/donation-projects/[project]/route.ts` — shared bounded identifier validation on the existing bridge.
- `src/app/globals.css` — editorial detail layout, responsive media/funding, breadcrumbs and title-link behavior.
- `tests/contracts.test.mjs`, `tests/fixture.mjs` — six additional detail/media/identifier tests and isolated detail fixture.
- `scripts/verify-routes.mjs` — detail-aware mock and actual production/development HTTP assertions.
- `README.md`, `docs/PUBLIC_API_CONTRACT.md` — current detail/media behavior and limitations.

No new API endpoint, package/dependency change, environment edit, production proxy change, commit or deployment occurred. Earlier phase reports remain historical records.

## H. Tests

| Executed command/check | Final result |
| --- | --- |
| `npm run lint` | PASS — no errors or warnings |
| `npm run typecheck` | PASS — strict TypeScript |
| `npm run test` | PASS — 17 tests, 0 failures; 11 retained + 6 new |
| `npm run build` | PASS — Next 16.4.2 production build includes `/projects/[project]` |
| `npm run test:routes` | PASS — actual production Next HTTP integration with isolated upstream |
| `node scripts/verify-routes.mjs --dev` | PASS — actual development Next HTTP integration with isolated upstream |
| Local Laravel probe | NOT CONNECTED — `127.0.0.1:8000` refused the read-only request |
| Frontend environment inspection via Next loader | No `DONATIONS_BACKEND_ORIGIN` configured for this frontend |

Unit tests cover numeric ID validation, single-resource envelope validation, nullable media, URL safety, resource gallery order, native-video MIME policy, date handling and metadata excerpt behavior, alongside existing currency/filter/collection tests.

HTTP tests retain homepage/discovery/filter/sort/pagination and proxy-scope regressions. New assertions cover published detail output; one detail request shared between page and metadata; missing/unpublished 404 outcomes; invalid IDs causing no upstream request; HTTP error, malformed envelope, mismatched ID, actual six-second timeout and disconnected upstream; null media; gallery/caption ordering; native video and no iframe; escaped script-like content in a long description; goal/collected/capacity/progress/date output; real canonical/OG values; functional card/recent links; optional recent-listing failure; development-only detail forwarding with query stripping; and rejection of mutation/admin/nested forwarding.

Initial HTTP assertions incorrectly assumed all streamed not-found responses would have HTTP 404, then incorrectly searched the entire RSC payload as if it were rendered not-found markup. Assertions were corrected against the installed framework guidance: actual 404 signal and robots tag for not-found, absence of that signal for outages. Final suites pass. No production code was changed to falsify the HTTP result.

Fixtures remain test-only. Development tests reuse the established temporary source-snapshot harness, with no `.env` copy or interference with an existing user development server. Temporary test servers and source snapshots were stopped/removed.

## I. Visual review — NOT VERIFIED

No browser automation/preview tool was available. No rendered desktop/tablet/phone, playback, image-error-event, keyboard, overflow or screenshot pass is claimed from source/HTTP checks.

Exact manual review required once a read-only live or clearly identified test project is available:

| Screenshot | Viewport | State/check |
| --- | --- | --- |
| `02c-detail-desktop.png` | 1440×1000 | `/projects/{real-id}`: title, breadcrumbs, cover/sidebar balance and exact funding labels |
| `02c-detail-tablet.png` | 820×1180 | Detail: readable columns, dates, gallery and large amounts |
| `02c-detail-mobile.png` | 360×800 | Detail: long title/reference, stacked content, monetary wrapping and no horizontal overflow |
| `02c-gallery-mobile.png` | 360×800 | Real multiple-image project: aspect ratios, lazy loads, order, captions and alt text |
| `02c-video-mobile.png` | 360×800 | Supported real file: native playback, keyboard controls, preload-none and file link; unsupported media fallback |
| `02c-no-media.png` | 360×800 | Project without media and a controlled failed-image request: stable textual fallback |
| `02c-unavailable.png` | 360×800 | Isolated instance with unreachable upstream: retry/back actions and no false not-found claim |
| `02c-not-found.png` | 360×800 | Missing/unpublished numeric ID: existing not-found boundary and discovery navigation |

Also inspect homepage and filtered-listing title links at desktop/phone widths; retain working country/category links. Tab through breadcrumbs, card titles, media links/controls and back navigation; verify focus visibility, meaningful names and no nested interactions. Compare scroll width/client width at 360px, review long Arabic description paragraphs, and check reduced-motion behavior. No database seeding, backend modification or live payment is required or authorized for this review.

## J. Outstanding contract gaps

- Public project updates are verified but **deferred**: their distinct paginated resource/media contract and any future approved edge/bridge extension deserve a focused implementation. No update is fetched, synthesized or implied on the page.
- No public video streaming-provider/embed, subtitle or transcript contract exists. Unknown MIME/provider URLs are not guessed or embedded.
- Description has no declared rich-text/Markdown format; safe plain text is implemented. Rich formatting would need an explicit content/sanitization decision.
- Live public media origins/storage reachability remain unverified. Production deployment must provide legitimate public media URLs/mapping without expanding into a generic backend proxy.
- Phase 02B catalog/search/funding-filter gaps remain unchanged; no backend workaround was added.

## K. Phase 02D readiness

The funding sidebar contains a simple, noninteractive contribution explanation where a future amount/action component can be introduced. Numeric project ID, exact currency/minor units, authoritative funding status, explicit remaining-capacity caveats and dates are available through verified contracts.

Phase 02D must implement guest intent/reservation/payment/checkout only against its separately verified contracts and authoritative confirmation behavior. No client-side assumption of available capacity or payment success is established by this phase. Detail routes, metadata, reusable media/funding components and card navigation are ready to build upon.

## L. Final verdict

**COMPLETE — Phase 02C read-only project details and media implementation.**

TypeScript, ESLint, all 17 unit tests, production build and production/development HTTP integration pass. Live Laravel connectivity and browser-rendered visual/playback/accessibility verification remain **NOT VERIFIED**. Updates/rich content/provider captions remain explicitly documented deferrals. No backend/dashboard edit, payment operation, checkout, Git initialization, commit or deployment occurred.
