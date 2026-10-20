# Phase 02B — Project discovery and filtering

Date: 2026-10-20, Africa/Cairo.

## A. Initial state

Continued the existing `D:\Code\Donations\donations-frontend` implementation. Phase 02A already provided the Arabic homepage, published-project listing, strict resource validation, exact money formatting, loading/failure states, shared layout and a development-only GET bridge. The existing green/off-white/gold design and Alexandria font were retained.

Read `AGENTS.md`, README, the Phase 02A report, API documentation, and relevant installed Next.js guides for page searchParams, Server Components, forms and server configuration. No application was scaffolded and no dependencies were added.

Git status was inspected before implementation. The frontend directory is **not currently a Git repository**; it was not initialized or committed. Laravel had existing tracked and untracked modifications; the dashboard was clean. Hashes of each protected repository's tracked diff plus porcelain status were identical before and after this work, preserving their existing changes. No backend, dashboard, environment, deployment or payment configuration was edited. An existing development server on port 3000 was left running.

## B. Verified backend filters

Evidence was read directly from these Laravel files:

- `routes/api.php:75`: public collection route maps to `DonationProjectController::publicIndex`.
- `routes/api.php:78`: public project read route maps to `publicShow`.
- `app/Modules/Donations/Http/Controllers/DonationProjectController.php:4`: public query implementation and admin category implementation.
- `routes/api.php:110`: donation-category listing is admin-only, protected by `auth:sanctum`, `dashboard.actor`, and `donations.categories.view`.
- `app/Modules/Donations/Services/DonationProjectService.php`: country codes are uppercased and validated with `League\ISO3166::alpha2`.
- `app/Modules/Donations/Http/Resources/DonationProjectResource.php`: actual public category/country, money, media and progress fields.

| Criterion | Actual support | Phase 02B behavior |
| --- | --- | --- |
| Publication | Public query always restricts to `published` | Preserved; no visitor-supplied status |
| Country | Exact `country_code` equality | ISO country selector and card country links; server-side filtering |
| Category | Exact `donation_project_category_id` equality | Real category links on listing cards and shared URLs; server-side filtering |
| Sort | `created_at`, `acceptance_ends_at`, `target_amount_minor`; all descending, then ID descending | Native sort select with accurate descending labels |
| Text search | Not implemented by public query | No search input or page-local substitute |
| Reference search | Not implemented by public query | Not exposed/forwarded |
| Funding-status filter | Not implemented by public query | Not exposed/forwarded |
| Ascending sort | Not implemented by public query | Not exposed/forwarded |
| Public donation categories | No public route; available route is admin-only | No global category dropdown or extra endpoint |
| Countries with published projects | No public discovery catalog | No claim that the country list represents available project destinations |

The public controller accepts an ordinary `Request`, with no separate public filter validator. Frontend parsing therefore validates supported inputs before forwarding. Unrelated public product/library taxonomies were not repurposed as donation categories.

**Selector limitations:** The country selector uses a 249-code ISO reference snapshot matched to the installed Laravel `vendor/league/iso3166/src/ISO3166.php` dataset. Arabic labels are generated with Intl. This is valid reference data, not demo data or an inferred project-country catalog. UI copy warns that some countries may have no projects. Category discovery is **link-based, not a complete selector**: only category IDs/names on real resource records become links. There is no extra catalog fetch, no exhaustive catalog inferred from a paginated result, and no guessed category label. A selected category with no verified name is explicitly labeled by its ID.

## C. Implemented functionality

- Country selection and all three real sort modes, submitted with a native GET form.
- Category links on project cards, using actual `category.id/name`; country badges also provide functional discovery links on the listing.
- Combined country/category filtering through the existing server-side API client.
- Visible applied country/category/sort indicators with accessible individual removal links.
- Clear All to remove applied options and pagination.
- Filter-preserving previous/next, out-of-range first-page recovery and retry links.
- Filtered result summary using the real paginator `total/from/to/current_page` values.
- Separate no-matches, unfiltered-empty, out-of-range and unavailable states.
- Clean normalized URLs and canonical metadata for applied state.

Filter controls remain available when Laravel is unavailable. The retry action uses a normal same-origin reload, retaining applied filters and page so it makes a fresh server request. No client-side financial collection, sample project fallback or unsupported search is introduced.

## D. URL contract

Supported page parameters:

| Parameter | Normalization |
| --- | --- |
| `country_code` | Trim; uppercase; accept only one of the 249 verified ISO alpha-2 codes |
| `donation_project_category_id` | Trim; positive decimal integer; normalize leading zeros; keep exact string representation; frontend safety bound of signed 64-bit maximum |
| `sort` | `created_at` default, `acceptance_ends_at`, or `target_amount_minor`; other values use default |
| `page` | Positive integer ≤ 2147483647; malformed input becomes 1 |

Repeated/conflicting values are discarded for that field rather than choosing an arbitrary first/last value. Unknown keys, empty fields and explicit defaults are removed. Default sort and page 1 are omitted from generated URLs. Normalization redirects to one clean `/projects?...` URL and never forwards unknown keys to Laravel. Category existence is determined by backend results; the frontend does not invent an existence catalog.

An illustrative combined URL is `/projects?country_code=EG&donation_project_category_id=3&sort=target_amount_minor&page=2`; category 3 is an example/test identifier, not a production-category assertion.

The native form omits `page`, so apply resets to page 1. Category links, country badge links, and individual option removals also reset page while preserving other valid choices. Pagination changes only page. Clear All uses `/projects`. Shared links and refresh reconstruct state on the server. Browser history uses ordinary navigation, with no client-only filter state to synchronize; actual back/forward browser trials remain unverified.

The public listing fixes `per_page=12`. Its incoming `per_page` is not supported. The existing development API bridge accepts validated/clamped `per_page` for its public collection contract and shares the same country/category/page/sort parser. No endpoint was added.

## E. UI/UX changes

Added a restrained horizontal filter area above the results, with explicit labels, native selects, one Apply action, optional Clear All, a short explanation of country/category option scope, and wrapping applied-option links.

On phones, controls stack to the available width, selects use 16px text, and pagination has at least 44px-high link targets. Desktop fields have a 330px maximum rather than stretching across the page. Existing grid breakpoints and the page's editorial heading were preserved.

Cards now use a fixed 32:19 image aspect ratio, flexible content bodies and aligned financial sections. Long titles remain fully visible, long country badges can wrap, and large monetary text can wrap without clipping. Category discovery links have visible underlines and native focus support. Cards still have no detail-page links or donation actions. Homepage cards retain their original presentation; discovery links are enabled only in the listing.

Source/HTTP verification confirms semantic labels, `aria-describedby`, applied-option navigation labels, result status announcements, `aria-current`, next/previous relations, RTL attributes and focus CSS. Browser-rendered contrast/keyboard/screen-reader/mobile behavior is **not verified** in this phase.

## F. API integration

Continues to read `GET /api/donation-projects` through the existing `getDonationProjects` function. Supported query construction is centralized in `features/projects/data/query.ts` and reused by server rendering and the existing development bridge. Each listing request makes one collection API request; metadata and filter options require no additional upstream fetches. Tests assert that request count.

The response remains the verified Laravel resource collection: `data`, `links`, `meta`. There is no new DTO, financial field, category endpoint, country endpoint or generic proxy. Pagination links are derived from metadata and remain on the public origin.

Server-only origin configuration, no-store fetching, timeout/redirect handling and strict runtime resource validation were preserved. Money formatting is unchanged and continues to preserve exact minor-unit fractions and large integer strings. Goal, net collected, remaining/reserved concepts and progress remain distinct. Source progress is displayed as supplied, while bars clamp visually and show an inconsistency note for out-of-range percentages.

The same-origin deployment model is unchanged. The development bridge remains opt-in and disabled in production, forwarding only its two pre-existing public GET paths. Production proxy enforcement is still external. No production environment or deployment configuration was changed.

## G. Files changed

New:

- `src/features/projects/data/query.ts` — ISO reference codes, validation, normalization, URL changes and backend query construction.
- `src/components/project-filters.tsx` — native country/sort form, applied options and removal/reset links.
- `docs/PHASE_02B_REPORT.md` — this report.

Modified:

- `src/app/projects/page.tsx` — URL state, normalization redirect, metadata, filtered summaries/empty states and pagination.
- `src/lib/projects.ts` — accepts filters through the existing shared server API client.
- `src/app/api/donation-projects/route.ts` — shared validation in the existing collection bridge.
- `src/components/project-card.tsx` — optional real category/country discovery links.
- `src/components/project-grid.tsx` — passes listing discovery state to cards.
- `src/components/project-state.tsx` — retry URL support and fresh native reload.
- `src/app/globals.css` — responsive discovery controls and card sizing/wrapping.
- `tests/contracts.test.mjs` — six additional focused query tests; existing financial/contract tests retained.
- `scripts/verify-routes.mjs` — filter-aware test-only mock, expanded production/development assertions, isolated dev snapshot lifecycle.
- `README.md`, `docs/PUBLIC_API_CONTRACT.md` — current discovery behavior and explicit limitations.

The Phase 02A report remains a historical record. Package/dependency files, production `next.config.ts`, environment files, protected repositories and payment code were not modified. Build output remains ignored.

## H. Tests

| Executed check | Final result |
| --- | --- |
| `npm run lint` | PASS, no errors or warnings |
| `npm run typecheck` | PASS, strict TypeScript |
| `npm run test` | PASS, 11 tests (5 existing + 6 query tests) |
| `npm run build` | PASS, Next.js 16.4.2 production build |
| `npm run test:routes` | PASS, actual production Next HTTP integration against an isolated mock |
| `node scripts/verify-routes.mjs --dev` | PASS, actual development Next HTTP integration against an isolated mock |
| Laravel `GET http://127.0.0.1:8000/api/donation-projects?per_page=1` | NOT CONNECTED — `ECONNREFUSED` |

Coverage includes valid countries/categories, exact category identifiers, combined filters, every supported sort, URL roundtrip/refresh, Clear All/removal URLs, filter changes resetting page, filter-preserving pagination/retry, invalid pages, invalid/duplicate/unknown parameters, actual backend query forwarding, no matches, out-of-range pages, backend HTTP failure/disconnection, malformed response, exact currency and homepage/listing regression. Server-rendered forms are checked to omit page and retain the active category. Tests inspect real generated link/form markup; they do not claim browser click, history or keyboard coverage.

An initial HTTP assertion did not account for React's HTML comment separators around text and numbers. It was corrected to compare normalized text while preserving link/form attribute checks. Initial development attempts encountered the pre-existing server's build-directory lock. The successful dev harness now copies source into an ignored temporary `.next/qa-source-*` directory, shares installed dependencies, supplies test environment values, and cleans up only its checked temporary path. It does not stop the user's existing server, copy `.env` files or alter deployment configuration. Test fixtures remain outside application code.

## I. Visual review — NOT VERIFIED

No browser automation/preview tool was available. No screenshots or rendered viewport, overflow, keyboard, back/forward, or screen-reader pass is claimed. The existing port-3000 development server still returned HTTP 200 after the isolated tests; that is a server check, not a visual review.

Exact manual review still required:

| Screenshot | Viewport | Review state |
| --- | --- | --- |
| `02b-home-desktop.png` | 1440×1000 | `/`: preserved hero, typography, project grid, shared navigation/footer |
| `02b-home-mobile.png` | 360×800 | `/`: menu expansion, hero width, text wrapping and CTA |
| `02b-projects-desktop.png` | 1440×1000 | `/projects`: country/sort controls, real counts, card alignment and image ratio |
| `02b-projects-mobile.png` | 360×800 | `/projects`: stacked controls, complete country labels, no horizontal overflow |
| `02b-filtered-mobile.png` | 360×800 | Apply a country and click a real category; review both chips, exact amounts and clear action |
| `02b-pagination-mobile.png` | 360×800 | A real filtered result with multiple pages; review wrapping and next/previous targets |
| `02b-empty-mobile.png` | 360×800 | A verified no-match combination; review explanatory text and Clear All/recovery |
| `02b-unavailable-mobile.png` | 360×800 | Isolated test instance with unreachable upstream; review retained chips and retry |

Use actual published data when Laravel is available, or clearly identified test fixtures in an isolated test instance. Do not seed or modify production data just to produce these screenshots. At 360px, compare document scroll width to client width; confirm titles, badge names and amounts do not clip. Tab through menu, country, sort, Apply, applied-option removal, category links, pagination and Clear All; confirm visible focus and meaningful labels. Apply filters from a later page and confirm page resets, refresh/share the URL, then use browser Back/Forward and confirm controls match the applied state. Inspect loading separately from empty/unavailable states and review the same routes in RTL with a screen reader.

## J. Remaining backend gaps

1. A public donation-category discovery catalog is needed before offering a complete category selector. Current category links/URL filtering work; a global dropdown is intentionally absent.
2. A public project-country facet/catalog is needed to restrict the country selector to destinations with published results. Current ISO choices are valid countries and can legitimately return zero projects.
3. Global text/reference search requires an explicit public query contract. No current-page pseudo-search was added.
4. Funding-status filtering and nearest-deadline/ascending sorting require backend support before exposing them.

These gaps were documented without modifying backend routes or introducing frontend API endpoints.

## K. Next-phase readiness

Phase 02C can build on reusable cards, exact financial presentation, verified resource types, server-only read integration, stable query-state helpers, scoped category/country discovery and the shared Arabic layout. Cards accept optional discovery state without becoming whole-card detail links, leaving room for a deliberate detail-page title/action later.

Project detail routes, galleries/video, project metadata, donation forms, reservations, payment/checkout, confirmation and receipt recovery remain unimplemented as required. Live-backend acceptance and rendered browser/accessibility review are still outstanding review tasks, not successful checks.

## L. Final verdict

**COMPLETE — Phase 02B implementation within the verified public contracts.**

The implemented country selector, category-link/shared-URL filtering, sorting, URL normalization, applied-option removal/reset, pagination and failure handling pass all final quality gates. A complete category dropdown and an available-project-country catalog are explicitly **not implemented**, because their public backend contracts are absent. Live Laravel connectivity and browser-rendered visual verification remain **NOT VERIFIED**. No checkout, detail page, dashboard feature, commit or deployment was added.
