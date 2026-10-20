# Verified Laravel public contract

Inspected read-only on 2026-10-20:

- `DwamCMS/routes/api.php`
- `app/Modules/Donations/Http/Controllers/DonationProjectController.php`
- `app/Modules/Donations/Http/Resources/DonationProjectResource.php`
- `app/Modules/Donations/Http/Resources/DonationProjectMediaResource.php`
- `app/Modules/Donations/Models/DonationProject.php` and `DonationProjectMedia.php`
- `app/Modules/Donations/Services/DonationProjectService.php`
- Settlement/refund consumers and receipt routes for the operational explanation.

## Endpoints and publication

`GET /api/donation-projects` returns only projects with `status = published`. Both category and media are eager-loaded. No featured flag exists. The homepage takes the first six projects in the backend's default order: `created_at DESC, id DESC`. It labels them as recently created published projects, not a backend-curated selection.

`GET /api/donation-projects/{project}` uses Laravel's default numeric ID model binding and returns `{ "data": <project> }`. Neither `DonationProject` nor `DonationModel` overrides the route key and no custom Donations project binding was found. Non-published/missing projects return 404. Phase 02C implements `/projects/{numeric-id}` and keeps the existing narrow detail bridge. UUID/reference/slug routing is not supported.

Supported collection inputs:

| Input | Backend behavior |
| --- | --- |
| `page` | Laravel paginator page; frontend generates positive integer pages |
| `per_page` | Default 15; clamped to 1–100; homepage asks for 6, listing for 12 |
| `country_code` | Exact country-code filter |
| `donation_project_category_id` | Exact category-ID filter |
| `sort` | `created_at`, `acceptance_ends_at`, `target_amount_minor`; other values fall back to `created_at`; descending only |

Phase 02B exposes country/sort controls and category links using these exact fields. `direction`, admin `status`, text/reference search, funding-status filters, arbitrary request headers and other query fields are not forwarded by the local bridge. Public `publicIndex(Request $r)` has no separate request validator and only reads the two explicit filters and sort allowlist shown above; frontend normalization now runs both before server-rendered queries and in the existing development bridge.

Donation categories have only an authenticated admin catalog route (`routes/api.php:110`), protected by Sanctum, dashboard actor and `donations.categories.view`. No public donation-country catalog route exists. Unrelated product/library categories are not donation categories. Category links therefore use actual IDs/names from the public project resource; the current page is not presented as an exhaustive catalog. Shared category URLs remain supported even when the current result page has no matching category name.

`DonationProjectService::country` validates uppercase ISO alpha-2 codes using `League\ISO3166`. The frontend's 249-code reference snapshot matches the installed `vendor/league/iso3166/src/ISO3166.php` registry as of 2026-10-20. Arabic names come from Intl. These are valid standard country choices, not a claim that every country has available projects. Category IDs are positive decimal strings normalized without Number conversion, bounded by the frontend's signed-64-bit safety limit. Existence is determined by backend results rather than a fabricated category catalog.

All three sort modes are descending. `acceptance_ends_at` therefore means furthest/latest end date first, **not** nearest deadline first. UI labels reflect this. Search, reference lookup, ascending sorting, funding-status filtering and public discovery catalogs remain contract gaps.

Applied URL fields are `country_code`, `donation_project_category_id`, non-default `sort`, and `page` when greater than 1. Empty/invalid/duplicate values and unknown fields normalize away. Lowercase countries normalize to uppercase and leading-zero IDs to their positive decimal representation. Changes/removal reset page to 1; navigation and retry keep the other valid fields. The listing always requests 12 per page; incoming page-level `per_page` is unsupported. The development API bridge accepts a validated/clamped `per_page` and otherwise shares the same query normalizer.

Lifecycle transitions are draft → published/archived, published → paused/closed, paused → published/closed, closed → archived. Publishing requires valid acceptance dates and an end date in the future. Closing/archiving checks unresolved reservations. Public reads themselves filter only publication status; they do not additionally enforce acceptance dates. The frontend therefore does not claim every listed project is currently eligible to accept a donation. Public `status` is omitted by the resource; the card uses `financial_status` only.

## Project fields

| Fields | Contract and use |
| --- | --- |
| `id`, `uuid`, `reference`, `title` | Project identity and title; cards display title, React keys use UUID |
| `short_description`, `description` | Nullable strings; short description rendered as escaped text; full HTML description is not injected |
| `country_code` | Nullable string; cards resolve Arabic country name through Intl |
| `beneficiary_count` | Nullable integer; typed but not rendered as a platform claim |
| `category` | Loaded object `{ id, name, slug }`; each field may be null when there is no related category (the resource returns an object, not null) |
| `currency` | Uppercase currency code supplied by backend |
| `target_amount_minor` | Integer goal; rendered exactly |
| `collected_amount_minor` | Integer net collected; confirmed refunds reduce it in the inspected refund consumer; rendered exactly |
| `remaining_amount_minor` | `max(0, target - collected - reserved)`; includes reservation effects, typed but not displayed as collected or goal progress |
| `progress_percent` | Backend's `round(collected / target * 100, 2)`, or 0 when target is zero; displayed as supplied |
| `financial_status` | `goal_reached` if collected ≥ target; else `fully_reserved` if reserved + collected ≥ target; otherwise `collecting` |
| `cover_image` | First image from the loaded media ordered by `sort_order`, then `id`; null if absent |
| `gallery_images`, `videos` | Arrays of the remaining images and of videos; typed, not shown in listing |
| `acceptance_starts_at`, `acceptance_ends_at` | Nullable ISO timestamps; typed but not used to invent publication/financial status |

No donor, reservation amount, financial-version, or admin metadata is added by this frontend.

Phase 02C renders the description as escaped text with preserved newlines. The controller accepts a nullable string and the service stores it directly; there is no declared Markdown/HTML content format or public sanitization contract. HTML-like input therefore remains literal text rather than becoming executable markup. Detail validation reuses the exact project validator from collections; the returned ID must also equal the requested ID.

`DonationProjectMediaService` attaches approved public Gallery assets. Image MIME allowlist: JPEG/PNG/GIF/WebP/AVIF. Video MIME allowlist: MP4, x-m4v, QuickTime, WebM, Ogg. Public URLs derive from storage disk/path, not `external_url`. The frontend conservatively renders native MP4/WebM/Ogg only, preserving the original MIME; it does not infer MP4 from an arbitrary URL or embed providers. Missing URLs and unavailable/unsupported media get explicit fallbacks. Gallery order is preserved exactly as delivered.

Public updates routes exist at `/api/donation-projects/{project}/updates` and `/updates/{update}`. `PublicDonationProjectUpdateController` requires a published parent, scopes records to it, filters `publication_state=published`, and paginates by `occurred_at DESC, id DESC`. The update resource returns `id,uuid,title,body,type,occurred_at,published_at,media`; public publication_state is omitted. Update media has the same media field shape. These separate envelopes/media and any future edge allowlist extension are deferred. No updates request, fabricated update or new bridge route was introduced in Phase 02C.

Media object: `{ id: number, uuid: string, type: 'image' | 'video', url: string | null, mime_type: string | null, caption: string | null, sort_order: number }`. The backend builds `url` from the storage disk/path. An `external_url` field exists on the model but is not returned by this resource. No assumed video/embed URL is synthesized. Cover captions are used as alt text, with the project title as fallback. Missing image URLs have a neutral text fallback. The URL may be absolute or public-origin-relative; only HTTP(S) and single-slash relative sources are rendered.

## Collection envelope

Laravel's default paginated resource envelope contains:

```text
data: DonationProject[]
links: { first, last, prev, next }
meta: {
  current_page, from, last_page,
  links: [{ url, label, active }],
  path, per_page, to, total
}
```

`prev`, `next`, `from`, and `to` may be null. Resource URLs belong to the backend. The UI constructs same-origin `/projects?page=N` navigation from numeric metadata instead of linking visitors to upstream paginator URLs. Invalid frontend page syntax normalizes to page 1; an out-of-range page gets an empty state and a functional return-to-first-page link.

## Precision and failure behavior

`DonationProjectService::minor` explicitly uses JPY 0 digits, KWD/BHD 3 digits, and 2 digits for every other currency. The frontend mirrors that actual rule, rather than assuming all values are cents or using a different ISO fallback. It keeps minor amounts untouched, uses BigInt quotient/remainder solely for display, and localizes whole/fraction parts with Intl. There is no payment arithmetic or financial mutation.

PHP/database drivers can serialize integer attributes as numbers or numeric strings, so monetary types accept both. Unsafe JavaScript numeric integers are rejected; exact integer strings retain precision. Missing amounts, malformed projects/pagination, non-finite progress, HTTP errors, redirects and connection/timeout failures produce service-unavailable UI. Successful empty responses get a distinct empty state. There is no synthesized financial zero or sample project fallback.

The progress bar is visually clamped to 0–100. The numeric source percentage remains visible, and out-of-range responses receive an explicit inconsistency note. Reserved money never contributes to displayed collected progress.
