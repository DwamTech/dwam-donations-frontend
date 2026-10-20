# Phase 02D-2A — Billing information and final review

Date: 2026-10-20, Africa/Cairo.

## A. Initial state

Extended the existing Phase 02D-1 `/donate/[project]` experience in `D:\Code\Donations\donations-frontend`. Existing numeric project verification, exact amount parsing, Arabic/Persian digit handling, required guest fields, optional anonymity, in-memory review, project summaries and read-only APIs were retained. No application or dependency was added.

Read `AGENTS.md`, README, the previous reports/API documentation and installed Next.js Server/Client Component and `use client` guides. Git state was inspected first: the frontend remains outside Git, Laravel has pre-existing work, and the dashboard is clean. No Git initialization, commit or deployment occurred. Protected working-state diff/status hashes were identical before and after this phase.

## B. Verified billing contract

Inspected read-only:

- `DwamCMS/app/Modules/Donations/Http/Requests/CreateDonationPaymentRequest.php`
- `app/Modules/Donations/DTOs/DonationBillingData.php`
- `app/Modules/Donations/Http/Controllers/GuestDonationPaymentController.php`
- `app/Modules/Donations/Services/DonationPaymentCreationService.php`
- `app/Modules/Donations/Services/DonationPaymentBillingSnapshotService.php`
- `app/Modules/Payments/Services/{PaymentService,GatewayManager}.php`
- `tests/Feature/Donations/MySqlConcurrency/DonationPaymentCreationMySqlTest.php`, supporting concurrency worker and financial concurrency tests.

The existing backend tests were inspected as source evidence only. No Laravel test, financial request or database operation was executed.

**Important refinement of the previous audit:** the HTTP request's `billing.country` rule is merely required/string/size 2, but the called `DonationBillingData::fromProviderInput` uppercases it and accepts **only `EG`**. The frontend mirrors this real narrower contract, rather than exposing a global billing-country list. This limitation is independent of project country or discovery filters.

All eleven fields below are required strings. No billing field is optional/nullable:

| Nested field | Maximum length / additional rule |
| --- | --- |
| `billing.first_name` | 120 characters |
| `billing.last_name` | 120 characters |
| `billing.phone_number` | 32 characters total; DTO regex `\A\+?[0-9][0-9\s\-()]{5,31}\z` |
| `billing.email` | 255 characters; DTO applies PHP `FILTER_VALIDATE_EMAIL` |
| `billing.street` | 255 characters |
| `billing.building` | 100 characters |
| `billing.floor` | 50 characters |
| `billing.apartment` | 50 characters |
| `billing.city` | 120 characters |
| `billing.state` | 120 characters |
| `billing.country` | Request size 2; DTO uppercase normalization, value must be `EG` |

`billing` must be the exact allowed-key array. The DTO rejects unknown keys and requires every field. It trims each string, rejects empty/invalid UTF-8 and remaining C0/DEL control characters, and rejects case-insensitive placeholder values `n/a`, `na`, and `-`. It does not invent missing values. Field lengths are checked with `mb_strlen`. The snapshot service captures canonical payer data and requires the same billing fingerprint on replay; changing billing for an already linked payment is not an interchangeable retry.

Top-level payment request requirements:

- `gateway_code`: required string, max 50, ASCII letters/digits/underscore/hyphen only. Syntax alone does not imply eligibility: `GatewayManager` additionally checks payment enablement, an existing enabled gateway, configured enablement and supported currency; a registered driver is needed for checkout.
- `Idempotency-Key` header: merged into validated `idempotency_key`, required UUID format with versions 1–5 and valid variant.
- `billing`: the exact nested object above.
- Prohibited request fields include `amount`, `amount_minor`, `currency`, `payment_id`, `payment_reference`, `user_id`, `donor_id`, `status`, and `reservation_state`.

`GuestDonationPaymentController` validates capability/source state and calls the billing DTO before payment creation. Invalid billing becomes a sanitized 422 response; authorization/source-state denials can be deliberately 404; replay conflicts 409; disabled/unsupported gateway/currency 503. No such operation was invoked in this phase.

## C. Implemented UX

The existing route now provides three compact local steps:

1. **Donation amount and donor information:** preserves exact monetary validation, guest identity/contact and optional anonymity.
2. **Billing:** requests separate first/last names, billing contact, and all seven address fields. Arabic copy explains that the upcoming payment step requires these details; it makes no claim about unrelated organizational address use. All required fields are labeled. Country has an empty initial choice and only the verified Egypt option.
3. **Final review:** shows selected project, exact amount/currency, donor identity/contact/anonymity and all billing identity/contact/address values. Separate functional Edit Donation and Edit Billing buttons return to the chosen step.

First/last names remain empty until entered explicitly; donor full name is never split. No street/building/floor/apartment/city/state/country defaults or placeholder values are supplied. No postal code, card number, CVV, bank account or gateway-credentials field was added.

Billing email and phone are initially taken only from validated donor contact. Untouched copied contact follows later validated donor changes. An edited or deliberately cleared billing email/phone is preserved rather than overwritten. Billing address/names and guest values survive backward navigation during the page session.

The UI uses the existing RTL palette/font, unboxed step indicator, paired desktop name/address fields and single-column mobile fields. There is no fixed overlay or additional full-page route. Required errors are associated with their field, announced through an error summary, and focus moves to the first invalid input/select. Step changes focus the heading; explicit Edit actions focus the first relevant input. Native billing autocomplete uses a separate `section-billing` scope.

All review messaging remains explicit that no donation, reservation or payment has been created. There is no functioning payment/checkout button.

## D. Billing validation and state

`billing-draft.ts` defines the eleven-field draft, labels/length metadata, errors, canonical billing output and validator. Validation trims strings, applies Unicode-aware length bounds, rejects invalid Unicode/control characters and the backend's exact placeholder list, normalizes Arabic/Persian phone digits to ASCII, uppercases country and enforces `EG`. Canonical output is constructed from the known eleven fields rather than spreading raw state or unknown input keys.

The billing phone additionally enforces the DTO's 32-character total limit, which can be stricter than the older guest-phone grammar when a leading plus is present. A copied value that fails billing constraints is reported for correction; it is not silently truncated or replaced.

Billing email performs a conventional nonempty/syntax/domain-dot/length check. It is not claimed to duplicate every edge case of PHP `FILTER_VALIDATE_EMAIL`, Unicode normalization, or every browser's native email handling. PHP/backend validation remains authoritative. No DNS/network email validation occurs.

`billing-flow.ts` composes the original unchanged guest reducer/validator instead of duplicating the donor model. It owns only the three-step navigation, billing draft/errors, contact-edit tracking and canonical billing review snapshot. Final review revalidates both drafts; invalid donation data returns to entry, and invalid billing remains in billing. Editing either section clears the old final billing review; editing amount also clears the old validated donation snapshot. A subsequent final review is rebuilt from current values.

Repeated Next/Review actions are guarded by current step, so queued/double submissions cannot jump over billing or double-advance. No global state library was introduced. Exact amount validation, canonical major-unit strings, minor-unit string formatting, server-owned funding totals and capacity/eligibility caveats are unchanged.

## E. Privacy and security

Donor and billing values remain in component/reducer memory. No application storage, cookies, URL query state, analytics, logging, browser-readable capability secret or auth token was introduced. Test data is synthetic; no real customer details are printed in test output. Browser-controlled autofill is independent of application persistence.

The existing native-submission safeguards remain: `preventDefault`, non-network `method="dialog"`, no serializing `name` attributes, controls disabled before hydration, and a JavaScript-disabled explanation. Billing uses the same safeguards. Rendering escapes donor/address values; no raw HTML injection was introduced.

No API or development bridge route changed. The bridge remains GET-only and production-disabled. HTTP integration observed only approved public project GET requests upstream. No intent, reservation, payment or checkout was created; no backend/database/payment-gateway logic was modified.

## F. Future API payload mapping — documentation only

Phase 02D-2B must explicitly construct distinct DTOs from validated snapshots. The following mappings are not executed by application code in this phase.

**Donation intent body**, using a validated donor review and verified numeric project ID:

```ts
{
  name: donor.name,
  email: donor.email,
  phone: donor.phone,
  amount: donor.amount, // canonical decimal string in major units
  donation_project_id: verifiedProjectId,
  is_public_anonymous: donor.is_public_anonymous
}
```

Use an intent-specific UUID-v4 `Idempotency-Key` header. Do not include the internal display `amount_minor`, browser currency or any backend-owned payment/state fields. Amount limits/currency/window/capacity must be rechecked by the authoritative backend flow.

**Payment creation body**, only after server-authorized intent/reservation:

```ts
{
  gateway_code: verifiedEligibleGatewayCode,
  billing: {
    first_name: payer.first_name,
    last_name: payer.last_name,
    phone_number: payer.phone_number,
    email: payer.email,
    street: payer.street,
    building: payer.building,
    floor: payer.floor,
    apartment: payer.apartment,
    city: payer.city,
    state: payer.state,
    country: payer.country // explicit, validated EG in the current contract
  }
}
```

Use a separate payment-operation `Idempotency-Key` header matching the payment request rule. Do not add it as arbitrary frontend state in the body, spread the guest/billing flow object, or submit amount/currency/backend IDs. Gateway code eligibility is not chosen/assumed here. Backend snapshots require immutable canonical billing facts for the same payment replay; changing reviewed billing must not be treated as retrying identical payment facts.

Same-origin exact route/method approval, server-issued HttpOnly capability cookies, approved Origin, reservation expiry and backend-authoritative confirmation remain mandatory integration work. No capability/key is generated or sent now.

## G. Files changed

New:

- `src/features/donations/data/billing-draft.ts`
- `src/features/donations/data/billing-flow.ts`
- `src/features/donations/components/billing-fields.tsx`
- `src/features/donations/components/donation-review.tsx`
- `tests/billing-flow.test.mjs`
- `docs/PHASE_02D_2A_REPORT.md`

Modified:

- `src/features/donations/components/guest-donation-form.tsx` — three-step local composition, focus and navigation.
- `src/app/globals.css` — compact responsive billing/review layout.
- `tests/load-typescript.mjs` — resolve imported TSX presentation components in the existing test loader.
- `tests/guest-draft.test.mjs` — extend the no-network/storage/privacy source audit across billing files; retain the existing tests.
- `scripts/verify-routes.mjs` — initial-flow label/step-indicator assertions; retain upstream GET-only and previous-route regression checks.
- `README.md` — current flow, stricter DTO-country rule and report link.

The original guest-draft validator/reducer, application routes, API bridge handlers, monetary formatter, package/dependency files, backend/dashboard, environments and production configuration were not changed. No unrelated project/discovery changes were made.

## H. Tests

| Command/check | Final result |
| --- | --- |
| `npm run lint` | PASS — zero errors/warnings |
| `npm run typecheck` | PASS — strict TypeScript |
| `npm run test` | PASS — 38 tests, 0 failures; all 25 prior tests plus 13 billing tests |
| `npm run build` | PASS — Next 16.4.2 production build |
| `npm run test:routes` | PASS — actual production Next HTTP integration against isolated mock |
| `node scripts/verify-routes.mjs --dev` | PASS — actual development Next HTTP integration against isolated mock |
| Frontend environment/backend read probe | No frontend backend origin configured; read-only localhost:8000 probe returned `ECONNREFUSED` |

New tests cover all required fields/maxima; first/last name and Unicode length; control/placeholder rejection; billing email/phone; `EG` normalization/rejection of other countries; contact reuse/no auto-split/defaults; preservation of edits/cleared contact; backward/forward flow; final-review correctness; billing and amount editing/review invalidation; duplicate-action guards; real Arabic billing markup and empty country selection; real final-review markup, separate edit controls and escaped address text.

Privacy source audits include every donor/billing model/component. Real initial React form tests confirm pre-hydration disablement, labels, native types/autocomplete and no native personal-data serialization. HTTP tests retain homepage, discovery/filtering, detail/media/metadata, invalid/missing/unavailable donation project, summary and upstream GET-only assertions; they additionally check the three-step indicator and actual entry-to-billing action wording.

The first test run after composing billing failed because the existing loader assumed imported components used `.ts`; the new presentation files are `.tsx`. The loader was corrected to fall back to TSX only on a missing TS file. The original 25 tests and all new tests then passed. No production validation was weakened to make tests pass.

These are unit, reducer, real React server-markup and Next HTTP tests. They do not establish hydrated browser clicks, browser autofill, visual viewport behavior or focus/screen-reader behavior. No backend financial test/database operation was run.

## I. Visual/interactive browser review — NOT VERIFIED

No browser automation/preview tool was available; no screenshots or browser interaction pass is claimed.

Manual review required at 1440×1000 desktop and 360×800 mobile, using an isolated verified test project and clearly synthetic contact/address data:

1. `02d2a-entry-mobile.png`: amount/guest controls, three-step indicator, required labels and no overflow.
2. `02d2a-billing-desktop.png` and `02d2a-billing-mobile.png`: explicit first/last fields, contact reuse, real address fields, empty country choice, Egypt-only explanation and compact responsive layout.
3. `02d2a-billing-errors.png`: leave every field empty; try `N/A`, invalid phone/email and overlong text; confirm linked errors and first-invalid-field focus. Verify no guessed address/country/name values.
4. `02d2a-review-mobile.png`: verify donor and billing contact can differ, all address fields and exact amount/currency are visible, and both edit buttons return to the correct step.
5. Change amount, go forward and rebuild review; change/clear billing email then change donor email and confirm it is preserved. Confirm untouched billing phone updates after donor phone changes. Double-click Next/Review and verify a step cannot be skipped.
6. Tab through controls/Edit/Back; confirm visible focus and announcements. Inspect URL, storage/cookies and Network while entering/billing/review/editing: no PII URL/persistence or intent/reservation/payment/checkout request. Verify JavaScript-disabled controls remain disabled.

No real donation, database seed, backend modification or payment is required or authorized for these checks.

## J. Integration readiness

Phase 02D-2B can use validated canonical donor/amount and eleven-field billing snapshots with explicit DTO mappings, draft preservation and review invalidation. No executable request transport, endpoint, gateway selection, idempotency operation or capability handling has been added prematurely.

Before enabling financial operations, verify the actual environment's public backend connectivity, configured currency/ceiling, allowed gateway/currencies, current **EG-only billing** restriction, immutable billing replay behavior, authoritative eligibility/reservation capacity/expiry, same-origin proxy allowlist/Origin checks and HttpOnly cookie delivery. Implement isolated, authorized mutation tests and hosted-checkout/authoritative-confirmation handling separately. The existing public GET bridge is insufficient for that future flow and remains unchanged in this phase.

Backend contracts remain final authority. Country breadth, placeholder handling and PHP email edge cases must not be inferred from the request field types alone. Live Laravel and rendered browser acceptance remain outstanding, explicitly separated from successful mock-backed integration.

## K. Final verdict

**COMPLETE — Phase 02D-2A frontend-only billing and final review.**

All 38 tests, TypeScript, ESLint, production build and production/development HTTP integration pass. Live backend and browser-rendered interactive/visual checks remain **NOT VERIFIED**. No donation, reservation, payment, checkout, capability token, backend/dashboard change, production configuration change, Git initialization, commit or deployment occurred.
