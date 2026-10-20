# Phase 02D-1 — Donation amount and guest information

Date: 2026-10-20, Africa/Cairo.

## A. Initial state

Continued the Phase 02C implementation in `D:\Code\Donations\donations-frontend`. Existing homepage, discovery/filtering, numeric-ID project details, media, resource validation, exact monetary formatting and read-only API integration were preserved.

Read `AGENTS.md`, the existing README/contract/reports and installed Next guides for Server/Client Components and dynamic route params. Inspected Git state before implementation. The frontend remains outside Git; no repository was initialized. Laravel's pre-existing modifications and the clean dashboard state were preserved. Before/after hashes of each protected repository's tracked diff plus porcelain status were identical. No backend, dashboard, environment, production configuration or database was changed.

No dependency or scaffold was added. Existing Next 16.4.2/React 19.3.1/TypeScript 5.9.3 and the Node test infrastructure remain in use.

## B. Verified donation form contract

Read-only evidence:

- `DwamCMS/routes/api.php`: guest intent, reservation, payment and checkout routes.
- `app/Modules/Donations/Http/Requests/StoreGuestDonationIntentRequest.php`: exact allowed/prohibited fields and header preparation.
- `app/Modules/Donations/Services/DonationIntentService.php`: amount grammar, precision/ceiling, configured currency, eligibility and scoped idempotency behavior.
- `app/Modules/Donations/Http/Controllers/GuestDonationIntentController.php`: intent response and server-issued guest capability cookies.
- `GuestDonationReservationController`, `DonationReservationService`, `GuestDonationReservationResource`: reservation authorization, capacity checks, response and expiry.
- `CreateDonationPaymentRequest`, `GuestDonationPaymentController`, `GuestDonationCheckoutController`: future payment/billing/checkout contracts.
- `GuestDonationRequestScope`, reservation/payment/checkout capability services and `EnsureGuestDonationReservationOrigin`: cookie and origin requirements.

`POST /api/donations` validates:

| Field | Actual backend rule |
| --- | --- |
| `name` | Required string, min 1/max 255 characters |
| `email` | Required Laravel `email`, max 255 characters |
| `phone` | Required string matching `^\+?[0-9][0-9\s\-()]{5,31}$` |
| `amount` | Required string, max 32 characters; service applies exact monetary grammar and bounds |
| `donation_project_id` | Nullable integer, exists in `donation_projects.id`; selected-project flow must use its verified numeric ID |
| `is_public_anonymous` | Optional/sometimes boolean, defaults false |
| `idempotency_key` | Required UUID-v4 string, derived from the `Idempotency-Key` header by `prepareForValidation` |

Prohibited: `user_id`, `donor_id`, `status`, `payment_status`, `payment_id`, `payment_reference`, `provider_id`, `provider_reference`, `reservation_state`, `reservation_expires_at`, `ledger_id`, `amount_minor`, `currency`, `collected_amount_minor`, `reserved_amount_minor`.

**Amount is a decimal string in major currency units**, not an integer-minor-unit request field. The service accepts a nonnegative integer part with no leading zeros except zero itself, and optional decimal digits up to the configured precision. JPY uses 0, KWD/BHD 3, every other currency 2. It rejects zero, malformed syntax, excess precision and amounts above its safe configured maximum.

The intent currency comes from backend `donations.currency`, not browser input. The selected project must be published, use that currency, have both acceptance dates, and satisfy start ≤ now < end. Intents do not guarantee reservation capacity. The configured maximum is the valid `donations.max_amount_minor` bounded by `PHP_INT_MAX`; invalid configuration falls back to the technical maximum. The local PHP probe confirmed 8-byte integers and `PHP_INT_MAX=9223372036854775807`.

The public project resource does **not** expose the current configured lower commercial amount ceiling or current global donation currency. This frontend uses the verified project currency for local display/precision and the verified local 64-bit technical ceiling for validation. Actual configured currency, any lower ceiling, live eligibility and capacity must be revalidated by the authoritative backend in Phase 02D-2. They are not claimed verified by local review.

No POST or financial mutation against Laravel was executed while discovering these contracts.

## C. Implemented pages

New route: **`/donate/[project]`**, using the existing numeric-ID detail reader and strict resource validation. A route-specific loading state announces project verification. Invalid/missing/unpublished IDs invoke the existing not-found boundary; outages/malformed or mismatched resources show retry/back navigation with **no entry form**. Next's established streamed not-found/noindex behavior is preserved.

The project detail funding area now links to this real implemented route with “enter amount and details” wording. It does not claim an available checkout.

The donation page includes breadcrumbs, the selected title above the form, honest local-review introduction and a real project summary: cover or missing-image fallback, reference, currency, target, net collected, source progress/financial status and remaining capacity after reservations. Financial values are server-rendered snapshots, never modified by form state. The page is dynamic/no-store and `noindex, follow`.

It explains that published status alone does not establish an open acceptance window, displayed capacity can change, and reviewing a proposed amount neither confirms acceptance nor reserves funds. A verified published project can be reviewed locally without pretending the future reservation step has succeeded.

## D. Amount validation

Reusable `validateAmount` in `features/donations/data/guest-draft.ts`:

- Accepts Latin, Arabic-Indic and Eastern Arabic/Persian digits; normalizes them to ASCII.
- Accepts a single dot or Arabic decimal separator `٫`; trims outer whitespace.
- Rejects commas/grouping separator `٬`, internal grouping spaces, mixed/duplicate separators, exponents, signs, leading-zero integers, trailing decimal points and excess precision. It does not guess whether a comma means grouping or decimals.
- Requires a positive nonzero amount and applies the actual currency precision without rounding.
- Preserves canonical major-unit text and derives an exact minor-unit **string** with concatenation/padding and BigInt. No floating-point monetary conversion is used.
- Enforces the backend's 32-character normalized amount limit and the verified 64-bit technical maximum. It can also accept a known lower ceiling for reuse in Phase 02D-2; no unknown business ceiling is invented now.

Examples: `١٢٫٣٤` → major `12.34`, minor `1234` for EGP; `0.001` → minor `1` for KWD; JPY rejects fractional input. EGP `92233720368547758.07` is represented exactly at the technical ceiling, while `.08` beyond it is rejected. Review formatting reuses `formatMoney`.

Suggested amounts were omitted because custom entry fulfills this phase without inventing commercial defaults. No input is compared to displayed remaining capacity as if that guaranteed a reservation; the backend intent contract itself does not promise capacity at entry time.

## E. Guest information

Required name, email and phone have explicit Arabic labels, native text/email/tel types, appropriate autocomplete and field-associated errors. Name/email enforce 255-character bounds. The shared validator trims surrounding whitespace and normalizes Arabic phone digits while retaining permitted formatting. Phone syntax follows the verified regex, with multiline values rejected as inappropriate telephone input.

Email validation provides an ordinary missing/syntax/length check; it does not claim full equivalence with Laravel's RFC email validator or perform DNS/network lookup. Final server validation remains required in Phase 02D-2.

Optional anonymity maps to the actual `is_public_anonymous` flag. The wording means “do not display my name publicly”; it does not promise to hide identity from backend processing or remove required contact fields. No address, credentials, billing or other unnecessary personal fields are requested now.

Controls have visible focus, linked `aria-describedby`/`aria-invalid` errors and a validation announcement. Invalid review attempts focus the first field with an error. Amount entry supports decimal keyboards and explicit currency labeling.

## F. Review experience

Entry and review are two local states managed by the same tested pure reducer used by the Client Component. Successful validation creates a local snapshot with the selected project, exactly formatted amount/currency, name, email, normalized phone and anonymity preference. Focus moves to the review heading.

The only review action is **Edit amount and details**. It returns to entry with draft values retained and the amount focused. Editing invalidates the previous review snapshot; a new review runs validation again. Errors keep the visitor in entry. Project-keyed form instances prevent a draft being reused for a different selected project.

The review explicitly says no donation, reservation or payment was created. There is no inactive payment button, fake confirmation or functioning backend-submit action.

## G. Security and privacy

Guest state exists only in React memory. No app LocalStorage/SessionStorage, cookies, URL state, analytics, logging, fetch, XHR, beacon, Server Action, capability token or idempotency-key generation was introduced. Browser-managed autofill remains under browser/user control and is not application persistence.

The form prevents default submission, uses `method="dialog"`, omits serialization `name` attributes from guest controls and keeps its fieldset disabled until hydration. JavaScript-disabled visitors get an explanatory message and cannot enter/submit through the disabled form. Dialog submission outside a dialog terminates without navigation after the submit event, per the [HTML form submission algorithm](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#form-submission-algorithm); React handles that event locally. These safeguards prevent an accidental native GET from placing personal data in a URL.

No new API/proxy route was created. The existing GET-only project bridge and same-origin architecture are unchanged. Integration recorder assertions observed **only public project GET requests** upstream, with no donation intent, reservation, payment or checkout writes. Existing tests may send rejection probes to the read-only bridge, but no financial mutation is forwarded.

The internal review's `amount_minor` is derived display state, not an allowed future intent request field. Phase 02D-2 must explicitly select allowed fields and send canonical major-unit `amount`; it must not serialize/spread the review object wholesale.

## H. Files changed

New:

- `src/app/donate/[project]/{page.tsx,loading.tsx}`
- `src/features/donations/data/guest-draft.ts`
- `src/features/donations/components/guest-donation-form.tsx`
- `tests/guest-draft.test.mjs`
- `tests/load-typescript.mjs` — uses already installed TypeScript/React to load pure modules and render the real initial form without a testing dependency.
- `docs/PHASE_02D_1_REPORT.md`

Modified:

- `src/features/projects/components/funding-summary.tsx` — real entry link, preserved funding presentation.
- `src/app/globals.css` — responsive entry/review/summary, labels/errors/focus and amount controls.
- `scripts/verify-routes.mjs` — new route/error/privacy checks and GET-only upstream assertions; existing regressions retained.
- `README.md` — current routes, monetary/privacy behavior and future payload caveat.

No package/dependency, backend/dashboard, environment, financial logic, production proxy or payment configuration file was changed. Existing phase reports remain historical records.

## I. Tests

| Command/check | Actual result |
| --- | --- |
| `npm run lint` | PASS — no errors or warnings |
| `npm run typecheck` | PASS — strict TypeScript |
| `npm run test` | PASS — 25 tests, 0 failures (17 retained + 8 new) |
| `npm run build` | PASS — new `/donate/[project]` included |
| `npm run test:routes` | PASS — actual production Next HTTP integration with isolated mock |
| `node scripts/verify-routes.mjs --dev` | PASS — actual development Next HTTP integration with isolated mock |
| `php -r` integer-size probe | 8-byte integer, maximum `9223372036854775807` |
| Frontend environment/backend read probe | No frontend backend origin configured; fallback localhost:8000 probe returned `ECONNREFUSED` |

New unit tests cover currency precision, Arabic/Persian/Latin normalization, valid/invalid custom amounts, zero/negative/ambiguous input, huge integers/overflow/lower ceiling, required guest fields, supported anonymity, actual reducer review/edit/revalidation, real initial React form labels/disabled/nonserializing markup, and absence of network/storage/logging operations in form/model source.

HTTP tests verify the actual project-detail → donation link; one verified detail GET for donation entry; project identity/summary/currency; all input IDs; optional anonymity and review wording; noindex; safe native form markup; missing media; invalid/missing/unpublished IDs; unavailable/malformed/mismatched project recovery without an entry form; and only approved project GET traffic upstream. Phases 02A/02B/02C homepage/filtering/details/media/metadata/proxy regressions remain included.

The actual review/edit reducer and server-rendered form were exercised. Browser hydration, clicking Review/Edit, focus movement, autofill and rendered viewport behavior were **not** executed in a browser and are not claimed verified by these tests.

## J. Visual review — NOT VERIFIED

No browser automation/preview tool was available. No desktop/mobile screenshots or browser interaction/accessibility pass is claimed.

Manual review required at 1440×1000 desktop and 360×800 mobile:

1. Capture `02d1-entry-desktop.png` and `02d1-entry-mobile.png` for a real verified project. Check title visibility before amount entry, image/summary, exact financial labels and readable controls without horizontal overflow/fixed overlays.
2. Capture `02d1-errors-mobile.png`: submit empty/invalid fields, inspect linked Arabic errors and first-error focus. Try `١٢٫٣٤`, `۱۲٫۳۴`, decimal precision errors and ambiguous separators.
3. Capture `02d1-review-mobile.png`: use clearly identified test information, review exact currency/guest values, then Edit and confirm draft values/focus. Re-review a changed amount and anonymity choice.
4. Inspect browser Network while entering/reviewing/editing: no intent/reserve/payment/checkout request. Confirm the URL has only the numeric project path and no entered values; inspect app storage/cookies for no new form state.
5. Capture unavailable and missing-media states. With JavaScript disabled, confirm controls remain disabled and the explanatory message is readable. Keyboard-test the entry link, amount, name/email/phone, checkbox, Review and Edit; review focus visibility and announcements.

Use only read-only live project data or isolated test fixtures; do not create real donations or modify databases for review.

## K. Phase 02D-2 readiness

The current draft/review model supplies exact canonical major-unit amount and validated guest input, but intentionally performs none of this future sequence:

1. **Intent:** explicitly construct `name,email,phone,amount,donation_project_id,is_public_anonymous`; create a secure UUID-v4 `Idempotency-Key` header for the operation. Backend uses configured currency, current project dates/publication and actual amount ceiling. First creation is 201, matching replay 200, conflicting scoped facts 409. Preserve an operation key for a retry of identical facts; do not reuse it for changed facts. The browser-scope namespace is server-issued, not invented by this form.
2. **Intent response/cookies:** `DonationIntentResource` returns `reference,amount_minor,currency,status,reservation_state,is_public_anonymous,created_at,project{reference,title}|null,is_general`. `GuestDonationIntentController` issues server-managed scope/reservation/cancellation/receipt cookies and payment authorization at the appropriate stage. The scope cookie is encrypted/HttpOnly; financial capability cookies use HttpOnly, `/api/donations`, strict SameSite, and Secure in production/configured secure sessions. JavaScript must not read/store capability credentials.
3. **Reservation:** `POST /api/donations/{reference}/reserve`, using the same browser scope and reservation capability cookies plus approved origin. Backend rechecks eligibility/currency and locks/checks live target/collected/reserved counters. Capacity failure is 409; missing/invalid authority is deliberately 404. Resource returns `reference,status,reservation{applicable,state,expires_at},next_step`; `next_step` is `payment_not_initiated`. Successful activation can issue payment capability. Snapshot capacity from this page is never authoritative.
4. **Payment:** `POST /api/donations/{reference}/payment` requires capability authorization, `gateway_code`, a valid payment idempotency header, and the verified `billing` object. Its allowed billing fields are `first_name,last_name,phone_number,email,street,building,floor,apartment,city,state,country`; country has size 2 and all these fields are required by the request contract. Phase 02D-1 guest identity does not satisfy that whole billing contract. Amount/currency/payment identity remain server-owned. Successful response returns donation reference plus replay flag and server-issued checkout cookie; payment-creation idempotency regex permits UUID versions 1–5.
5. **Checkout:** `POST /api/donations/{reference}/checkout` requires the same browser scope and checkout capability plus authorized unexpired state. Successful response provides `data.checkout_url` and `expires_at`. Handle capability/source-state denial, expired reservations, gateway rejection, timeout/review states and unsupported/disabled gateway/currency without inventing success. A browser redirect is not proof of completed payment.

Future browser writes must remain same-origin, with exact externally approved production routes/methods, approved Origin behavior and preserved capability Cookie/Set-Cookie attributes. No wildcard CORS or generic proxy is justified. The current development bridge still exposes only the existing public project GET paths; no financial route was added in preparation.

Before enabling real writes, separately verify configured currency/ceiling, billing requirements, enabled gateway, cookie/origin behavior, retry/error recovery and backend-authoritative payment confirmation in the intended environment. These requirements are documented from source, not tested against live transactions in this phase.

## L. Final verdict

**COMPLETE — Phase 02D-1 frontend-only amount, guest information and local review/edit.**

All required automated quality gates pass. No intent, reservation, payment, checkout, capability token or fake success state was created. Live Laravel connectivity and browser-rendered interaction/visual review remain **NOT VERIFIED**. Backend/dashboard/production configuration are unchanged; no Git initialization, commit or deployment occurred.
