# Phase 02D-2B — Intent, reservation, payment and checkout integration

Date: 2026-10-20, Africa/Cairo.

## A. Initial state

Extended the existing Phase 02D-2A implementation in `D:\Code\Donations\donations-frontend`. The Arabic homepage, discovery, numeric-ID details/media, exact monetary formatting, donor entry, eleven-field EG-only billing and final review remain intact. No scaffold, dependency, application route or financial proxy was added.

Read `AGENTS.md`, README, API/phase documentation and installed Next 16 Server/Client Component and environment-variable guidance. The frontend remains outside Git; no initialization, commit or deployment occurred. Laravel contained pre-existing work and the dashboard was clean. Before/after SHA-256 hashes of tracked HEAD diff plus porcelain state were identical: Laravel `5dc66790d77e9a7a1e3bcaf402fe4d803031f46fefecb3f7206e99c0e911055a`; dashboard `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

Before implementation, the read-only public-project probe at `http://127.0.0.1:8000/api/donation-projects?per_page=1` returned `ECONNREFUSED`. Work continued against source-verified contracts and isolated mocks. No Laravel financial request, test/database operation, environment edit or backend/dashboard write occurred. The existing port-3000 frontend was left running and returned HTTP 200 after checks.

## B. Verified payment contracts

Read-only evidence includes:

- `DwamCMS/routes/api.php:79–83`: exact guest POST routes, reference constraint, throttling and Origin middleware.
- `StoreGuestDonationIntentRequest`, `GuestDonationIntentController`, `DonationIntentService`, `DonationIntentResource`: allowed fields, exact major-unit grammar, server-configured currency/ceiling, scoped UUID-v4 idempotency, creation/replay and cookie issuance.
- `GuestDonationReservationController`, `DonationReservationService`, `GuestDonationReservationResource`, `GuestDonationReservationCapabilityService`: credential checks, locked eligibility/capacity validation, activation replay and expiration.
- `CreateDonationPaymentRequest`, `GuestDonationPaymentController`, `DonationPaymentCreationService`, `GuestDonationPaymentAuthorizationService`, `DonationPaymentBillingSnapshotService`, `DonationBillingData`: exact billing/gateway payload, immutable fingerprints, separate payment identity and consumed guest authority.
- `GuestDonationCheckoutController`, `DonationCheckoutOrchestrationService`, `DonationCheckoutClaimService`: authorized checkout claim, provider initiation/review boundaries and response.
- `GuestDonationRequestScope`, payment/checkout capability services and `EnsureGuestDonationReservationOrigin`: server-owned scope, cookie paths/attributes and exact approved Origin.
- `GatewayManager`, `config/payments.php`, routes/provider registration: configured eligibility and hosted-checkout settings. No public eligible-gateway catalog was found.
- Guest intent/reservation feature tests and MySQL payment-creation/checkout feature tests, inspected as source only. In particular, the guest payment test expects a second use of the consumed payment capability to return 404.

| Operation | Method/path | Request | Successful response |
| --- | --- | --- | --- |
| Intent | POST `/api/donations` | `name,email,phone,amount,donation_project_id,is_public_anonymous`; UUID-v4 `Idempotency-Key` header | 201 new / 200 replay; `data` resource containing reference, money/currency, state, anonymity, creation time, project and general flag |
| Reserve | POST `/api/donations/{reference}/reserve` | Empty JSON object; browser scope/reservation cookies; approved Origin | 200; `data.reference,status,reservation{applicable,state,expires_at},next_step` |
| Payment | POST `/api/donations/{reference}/payment` | `gateway_code,billing`; separate UUID header; browser payment authority | 201 new / 200 replay; `{data:{donation_reference},idempotent_replay:boolean}` |
| Checkout | POST `/api/donations/{reference}/checkout` | Empty JSON object; checkout authority and approved Origin | 200; `{data:{checkout_url,expires_at}}` |

Payment request UUID rules accept versions 1–5; the client deliberately generates v4 for both independent operations. There is no invented payment resource or browser-supplied amount/currency at payment creation. Capability/source denials can deliberately return 404. Reservation conflicts return 409; payment validation/conflict/unavailable responses include 422/409/503. Checkout rejection/review/unavailability includes 422/409/503. Laravel can also return request validation, throttling or generic authorization errors.

## C. Implementation

`checkout-operation.ts` implements a reusable, explicit in-memory operation with ready, working, recoverable, attention and redirecting states. Working states identify intent/reserve/payment/checkout. It retains only frozen request snapshots, independent keys, necessary reference/expiry and confirmed-stage flags. Runtime validation checks external envelopes and facts before advancing.

`CheckoutReview` composes the existing final review. It revalidates donor/amount and billing when Proceed is clicked, constructs one immutable snapshot, and creates the operation synchronously before awaiting requests. A synchronous in-flight guard prevents queued/double clicks from duplicating work. Review editing locks from the first send, including when the result is ambiguous. Before sending, edits retain the original flow behavior and the next reviewed operation receives new keys. No unsent operation survives an edit because snapshots are created only on Proceed.

The default disabled review displays an Arabic unavailable explanation and the existing two Edit actions, without a payment submission action. The page introduces sending only as an explicit later action if service is available. No form auto-submission or payment-success state exists. Server-rendered project totals are never changed by transaction state.

## D. Donation intent

The intent body explicitly selects the six allowed fields. `amount` is canonical major-unit decimal text; derived display `amount_minor`, currency and reducer/backend-owned fields are excluded. Exact amount/precision checks and Arabic/Persian digit normalization reuse the original validator. Browser `crypto.randomUUID()` supplies secure independent v4 keys; unavailable secure facilities fail before sending.

The response must carry a safe donation reference, exact matching amount/currency/anonymity, the selected project's verified reference, initiated/none state, a creation timestamp and a targeted-project resource. Unsafe numeric amounts, mismatches or malformed envelopes stop before reservation. New 201 and replay 200 envelopes are supported without inventing replay flags on this resource.

Explicit throttling can retry the same frozen intent/key. An ambiguous first intent is **not** retried: its server-issued browser-scope cookie may have been lost with the response, and the same UUID in a different scope can create another intent. The operation remains attention-required rather than generating a replacement identity.

## E. Reservation

Reservation uses only the validated server reference. Browser-managed cookies and approved Origin provide authority; no capability is synthesized or inspected. The client requires a matching initiated response, applicable/active reservation, a future ISO expiration and `payment_not_initiated` next step.

A well-formed 409 offers manual retry of that same donation's reservation, without recreating intent or claiming capacity. Source inspection confirms a rejected reservation rolls back without consuming its capability. A 404 explains that session/authority/expiry could prevent continuation and explicitly does not mean project deletion. An ambiguous activation stops for attention: the payment capability service explicitly cannot redeliver an already-issued credential lost with an activation response.

Local expiry is checked before payment, checkout and navigation as an additional fail-closed guard; Laravel still decides authoritative time, eligibility and capacity. No frontend subtraction, counter mutation or acceptance promise is added.

## F. Payment creation

The frozen payment DTO contains only the deliberately configured gateway identifier and eleven canonical validated billing fields. Country remains EG; payer identity/address is never synthesized. A separate payment-specific UUID-v4 header is retained with identical billing on permitted retries.

There is no default provider. Activation requires a deliberately approved non-secret gateway code plus explicitly approved checkout hosts. `GatewayManager` remains authoritative for service enablement, enabled gateway/configuration, currency and registered driver. A rejected/disabled gateway never triggers fallback.

The response requires matching donation reference and boolean `idempotent_replay`. Explicit verified-controller 503 or throttling can retry that same payment request without rerunning confirmed intent/reservation. Validation/capability/conflict errors stop for attention. An ambiguous payment cannot safely be treated as ordinary guest replay: successful creation consumes/revokes the capability, and the controller can deny its reuse before reaching the internal service's replay branch. Tests of replay-shaped responses validate frontend parsing only; they do not assert that a consumed guest capability is replayable over live HTTP.

## G. Checkout

Checkout starts only after a validated payment response. Response validation requires an HTTPS URL on an exact approved host, no embedded credentials, backslashes/control whitespace, nonstandard port or fragment, and a parseable future ISO expiration. Subdomain/suffix lookalikes and unapproved hosts fail. The destination comes only from the validated backend response and is passed to `window.location.assign`; no browser query destination is read.

The backend allows nullable checkout expiry. This client intentionally stops on null because usable lifetime cannot be established. Checkout ambiguity, rejection, malformed response, expired session or unapproved destination never redirects or initiates a replacement donation. Redirecting copy explicitly says donation completion has not been confirmed. No card/CVV, fake return page, settlement inference or status polling was added.

## H. Same-origin security

All four client calls use fixed relative paths, POST JSON, `credentials: same-origin`, no-store, redirect rejection and a 15-second abort timeout. Only JSON/Accept and applicable Idempotency-Key headers are set. JavaScript never reads or sets Cookie/Origin, HttpOnly secrets or Set-Cookie. Laravel owns scope/capability issuance, encryption, paths, HttpOnly/SameSite/Secure attributes and authorization.

No financial Next route/bridge was needed or added. Existing public GET handlers remain unchanged and production-disabled. Next HTTP tests prove all four financial POST paths, donor payment and internal payment paths cannot reach the project upstream. Future external exact-route approval and distinct Cookie/Set-Cookie/Origin preservation are documented in [CHECKOUT_INTEGRATION.md](CHECKOUT_INTEGRATION.md); the historical cookie-stripping GET proxy example is explicitly distinguished.

PII, billing, keys and references stay in memory. No local/session storage, app cookie, personal-data URL, analytics, raw request/response logging, error-monitoring integration or wildcard CORS is introduced. Existing disabled-before-hydration/nonserializing native form safeguards remain intact. Application code never imports test fixtures.

## I. Error and retry handling

Well-formed error envelopes require a message string and, when supplied, arrays of string validation errors. Upstream message content is never displayed. Fixed Arabic messages cover 400, 401, 403, concealed 404, 409, 422, 429, 503 and other errors. Malformed/HTML responses, transport failures and timeouts use generic attention messaging without raw exceptions.

Manual recoverable paths are explicit 429 at any stage, rejected reservation 409, and payment 503. Each preserves stage identity, body and keys. There is no automatic retry. Confirmed earlier stages never rerun. All other failures stop for attention. Busy and terminal states reject repeated run attempts.

No cancellation or restart is offered, so there is no edit/restart action that silently creates a second transaction. Post-send edit controls are disabled and guarded by operation state. UI explains that a reservation may remain until expiry and that reloading cannot restore state. Actual authoritative recovery remains external/future work; no invented contact channel, reference-based polling or fresh-intent workaround appears.

## J. Files changed

New:

- `src/features/donations/data/checkout-config.ts` — explicit activation/configuration validation and default-disabled value.
- `src/features/donations/data/checkout-operation.ts` — response interfaces/validation, frozen DTO mapping, identities, stage orchestration, timeout/retry and destination validation.
- `src/features/donations/components/checkout-review.tsx` — review composition, operation ownership, progress/error/retry controls and edit locking.
- `tests/checkout.test.mjs` — 26 new focused tests, including isolated HTTP transport/cookie simulation.
- `docs/CHECKOUT_INTEGRATION.md` and this report.

Modified:

- `src/features/donations/components/guest-donation-form.tsx` — passes reviewed state/configuration into checkout review.
- `src/features/donations/components/donation-review.tsx` — optional operation content, accurate started copy and disabled edit controls.
- `src/app/donate/[project]/page.tsx` — server-evaluated non-secret client configuration, verified project reference and conditional-send wording.
- `src/app/globals.css` — compact operation status/action styling.
- `.env.example` — documented false/empty activation defaults, no real environment edit.
- `scripts/verify-routes.mjs` — force disabled test configuration and assert no financial/internal POST forwarding.
- `README.md`, `docs/PROXY.md` — current gated behavior and separate activation contract.

No package/lockfile, application API route, backend/dashboard, database, payment service, real environment, production Nginx/configuration or earlier phase report was modified.

## K. Tests

| Command/check | Final result |
| --- | --- |
| `npm run lint` | PASS — no errors/warnings |
| `npm run typecheck` | PASS — strict TypeScript |
| `npm run test` | PASS — 64 tests, 0 failures; all 38 prior tests retained plus 26 new |
| `npm run build` | PASS — Next 16.4.2 production build |
| `npm run test:routes` | PASS — real production Next HTTP regression/deny-path checks against isolated project mock |
| `node scripts/verify-routes.mjs --dev` | PASS — real development Next HTTP regression/deny-path checks against isolated project mock |
| Read-only local Laravel probe | NOT CONNECTED — `ECONNREFUSED` |
| Protected repository state hashes | PASS — identical before/after |

New coverage includes exact major-unit/allowlisted DTOs, secure separate v4 keys, frozen billing, fresh identity after an unsent review change, full request order/relative credentials, correct response facts, both replay envelope concepts, same-key retries, preservation of confirmed stages, double-click exclusion, conflicts/validation/authorization/throttling/unavailable responses, malformed success at every stage, disconnect ambiguity at every stage, actual abort-triggered payment timeout, expired reservation/checkout, malicious destinations, disabled review markup, locked edits and privacy audits.

The actual orchestration also ran through four loopback HTTP POSTs against a test-only server. A **test-only cookie jar** simulates browser cookie delivery and verifies request order and relevant cookie continuity. Production application code has no access to this jar or Set-Cookie. This verifies transport composition, not actual browser HttpOnly/SameSite/Secure/Origin enforcement or Laravel cookie cryptography. No payment provider was contacted.

Existing money/filter/detail/media/donor/billing/review/privacy tests all remain. Production/development route suites still observe only public project GET traffic upstream; financial probes stop at Next. Temporary test servers/source snapshots were cleaned up, preserving the user's server. Final code quality gates passed; no failed required check remains.

## L. Live integration status

| Area | Status |
| --- | --- |
| Frontend implementation and isolated mocks | COMPLETE; automated checks pass |
| Actual Laravel connectivity | NOT VERIFIED; local read probe refused connection |
| Actual intent/reservation/payment/checkout writes | NOT EXECUTED; real mutations remain disabled |
| Staging gateway eligibility, hosted checkout and settlement | NOT VERIFIED |
| Public payment return | NOT IMPLEMENTED in this phase; Phase 02E dependency |
| Real browser cookie/Origin delivery | NOT VERIFIED |
| Hydrated interaction, visual/mobile/accessibility review | NOT VERIFIED; no browser tool available |

Manual browser acceptance still requires an isolated approved staging/mock setup at 1440×1000 and 360×800. Capture entry/billing/review, busy stages, rejected capacity, throttling/retry, expired/capability/attention and simulated redirect states. Check keyboard/focus/live announcements, exact facts, disabled edits, no horizontal overflow, double-click prevention and unchanged financial snapshots. Inspect Network/URL/storage to confirm relative requests, browser-owned cookies and no PII persistence. Test the default-disabled review without any transaction request. Actual gateway/browser return review must wait for the approved real return implementation; do not infer success or use production transactions for screenshots.

## M. Remaining blockers before real activation

1. Provide authorized isolated staging and real public read connectivity; verify currency, lower configured amount ceiling, current project eligibility/capacity/expiry and billing acceptance.
2. Approve an eligible gateway/currency and derive exact hosted-checkout hosts from its real configuration; provide no browser credentials.
3. Implement and verify Phase 02E neutral payment return and appropriate authoritative receipt/recovery behavior. There is no status-polling substitute.
4. Independently approve and validate the four external POST routes, method/path denial, exact public Origin and full scope/capability Cookie/Set-Cookie delivery under TLS. No production proxy was changed here.
5. Exercise live-contract rejection/ambiguity/expiry handling in authorized isolated staging and complete rendered desktop/mobile/accessibility/browser acceptance.
6. Only after those checks and explicit authorization, configure the three true activation attestations, same-origin verified HTTPS return URL, gateway and exact hosts described in [the activation contract](CHECKOUT_INTEGRATION.md). Setting environment flags alone is not verification or authorization.

## N. Final verdict

**COMPLETE — Phase 02D-2B frontend implementation and runnable isolated mock tests.**

The verified four-stage integration, explicit disabled-by-default gate, immutable request identities, conservative ambiguity handling and trusted checkout navigation are implemented and pass all required automated checks. Real financial mutations remain disabled. Mock-backed completion does not authorize accepting payments or establish live Laravel, gateway, payment-return or browser readiness. No backend/dashboard change, live financial operation, commit or deployment occurred.
