# Phase 02D-2B integration and activation contract

The client implementation exists; real financial traffic remains disabled. Phase 02E-1 now supplies the neutral GET page `/payment-return`, matching the backend deployment contract's intended path. It has passed isolated HTTP checks; actual staging/gateway/browser acceptance remains unverified. No production configuration is changed by this document. Do not enable checkout merely because the page exists. A gateway return never establishes settlement. No public donation-status polling endpoint is assumed.

## Neutral browser return (Phase 02E-1)

`/payment-return` renders without a donation session, cookies or backend connectivity. It does not consume query/fragment content, infer outcome, display references, poll status or replay checkout. Its metadata is noindex/nofollow with no transaction canonical/OG data; metadata and the path-scoped HTTP header use `no-referrer`. Receipt messaging is conditional and does not assert that email was sent/delivered. Its link opens the implemented recovery-request form. Backend F1 and frontend F2 now provide explicit one-time recovery exchange plus protected PDF using only the response's `data.receipt_uuid`. See [the current receipt contract](RECEIPT_RECOVERY.md). This separate recovery operation never infers settlement, changes financial activation or obtains a receipt identity from payment-return parameters.

For later authorized staging, the intended settings are:

```dotenv
# Illustrative approved public host only; do not apply without staging approval.
DONATIONS_PUBLIC_ORIGIN=https://donations.example.com
DONATIONS_PUBLIC_PAYMENT_RETURN_URL=https://donations.example.com/payment-return
PAYMOB_REDIRECTION_URL=https://donations.example.com/payment-return
# Frontend server settings must identify the same public origin and fixed URL.
SITE_ORIGIN=https://donations.example.com
DONATIONS_VERIFIED_RETURN_URL=https://donations.example.com/payment-return
```

The backend mapper requires configured approved and Paymob redirect URLs to match exactly and their normalized origin to match the approved public origin. No backend hardcoded path requires `/payment/return`; the existing deployment example uses `/payment-return`, which this phase implements. If an actual deployed redirect uses another path, both backend return URL settings and the frontend verified-return URL need separately approved alignment with `/payment-return`; this phase does not change environment values or add aliases. Leave `APP_URL` on the CMS. Keep `PAYMOB_NOTIFICATION_URL` on the separate Laravel webhook; `/api/payments/paymob/webhook` is denied on the public frontend, and `/payment-return` is not a webhook receiver.

[Paymob's transaction-callback documentation](https://developers.paymob.com/paymob-docs/developers/transaction-callbacks) documents browser GET query callbacks separately from server POST notifications. Possible query fields include `id`, `success`, `pending`, `order`, `amount_cents`, `currency`, `hmac` and provider-specific values. None is authority for this page. Laravel verifies trusted webhook HMAC, durably ingests notifications and processes settlement separately. No browser return reference is accepted as public lookup authority.

Use synthetic URL values during local development: Next dev can serialize request props into its framework debug payload even when a page never reads them. Production tests check the entire response for non-reflection; dev tests check visible markup/metadata. Configure edge/server/telemetry request-log redaction separately for return query strings before staging; the response Referrer-Policy cannot remove the incoming URL from infrastructure logs. No logging infrastructure or production proxy is changed here.

## Configuration

Server-side environment settings, evaluated for each dynamic donation page:

| Setting | Required value before activation |
| --- | --- |
| `DONATIONS_MUTATIONS_ENABLED` | Explicit `true` after authorization |
| `DONATIONS_INTEGRATION_VERIFIED` | Explicit `true` after isolated staging validation |
| `DONATIONS_PAYMENT_RETURN_VERIFIED` | Explicit `true` only after Phase 02E return verification |
| `DONATIONS_VERIFIED_RETURN_URL` | Exact independently verified HTTPS return URL on `SITE_ORIGIN`; non-root path, no query/fragment/credentials |
| `DONATIONS_GATEWAY_CODE` | Deliberately approved eligible non-secret gateway identifier, no default |
| `DONATIONS_CHECKOUT_HOSTS` | Exact lowercase DNS hosts separated by commas; no wildcard, scheme, port or path |

Only the enabled flag, gateway identifier and approved hosts reach the Client Component. No gateway secret or internal backend origin is exposed. Boolean flags are operator attestations; the application does not assert that setting a flag verifies a deployment or implements its return page.

No public eligible-gateway discovery route was found in the inspected routes. Choose the gateway from approved backend configuration and its enabled database record/currency/registered-driver setup. Derive checkout hosts from that gateway's actual reviewed hosted-checkout configuration. `config/payments.php` contains Paymob `unified_checkout_url`/redirection configuration, but the frontend does not assume that provider is enabled or copy its default. Never configure hostnames from visitor input. No gateway fallback occurs.

## Exact future external edge allowlist

Keep existing project reads separate. Financial endpoints require browser Cookie/Origin and response Set-Cookie delivery; the cookie-stripping project-read example in `PROXY.md` must **not** be copied onto these routes.

| Method | Exact route pattern |
| --- | --- |
| POST | `/api/donations` |
| POST | `/api/donations/DON-[A-Z0-9]+/reserve` |
| POST | `/api/donations/DON-[A-Z0-9]+/payment` |
| POST | `/api/donations/DON-[A-Z0-9]+/checkout` |

Enforce anchored paths and exact methods, deny other API paths/methods including cancel, admin, donor, internal payment and nested variants. Forward approved Origin, browser Cookie, Idempotency-Key, Accept and JSON content type; preserve distinct Set-Cookie headers and original Laravel attributes. Do not merge cookie headers, cache sensitive responses, rewrite capability paths, expose tokens to JS, or broaden CORS. Laravel's scope and capability authority remain mandatory. Verify TLS, trusted forwarding, direct-upstream restrictions, body/rate limits, cookie encryption middleware and the backend's exact approved `donations.public_origin` in the intended environment. Production proxy changes need separate operational approval.

The existing development project bridge is unchanged: GET-only, no cookies, production-disabled. No financial bridge was needed: tests run the real orchestration against injected fetch responses and an isolated loopback HTTP server. The HTTP cookie jar exists only in test code and does not prove real browser SameSite/HttpOnly/Secure enforcement.

## Response and recovery policy

Intent sends only `name,email,phone,amount,donation_project_id,is_public_anonymous`; `amount` is canonical major-unit text. UUID-v4 intent identity is sent only in `Idempotency-Key`. Response is `{data:{reference,amount_minor,currency,status,reservation_state,is_public_anonymous,created_at,project,is_general}}`, status 201 or replay 200. Money, selected-project reference, currency, initiated/none state and anonymity must match the immutable snapshot before reservation.

Reserve sends `{}` to the returned reference, expects 200 with matching reference, initiated status, active/applicable reservation, future ISO expiry, and `next_step=payment_not_initiated`. It does not recompute capacity. Payment sends only configured `gateway_code` and the eleven validated canonical billing fields with a separate UUID-v4 header. It expects 201/200 `{data:{donation_reference},idempotent_replay:boolean}`. All billing fields are required and country is EG under the current DTO.

Checkout sends `{}` and requires 200 `{data:{checkout_url,expires_at}}`. Only HTTPS, exact approved host, no credentials/backslashes/control whitespace/nonstandard port/fragment, and a parseable future ISO expiry can navigate. The backend permits nullable expiry; this client deliberately fails closed for null because a usable lifetime cannot be established. Local reservation expiry is checked before payment, checkout and navigation. Backend authorization remains authoritative, including clock differences. A redirecting state is not payment success.

Each step has a 15-second abort timeout. Explicit well-formed 429 responses permit manual same-stage retry. Reservation 409 permits retrying that same donation: the inspected service rolls back rejected reservations without consuming capability. Payment 503 from its verified controller also permits manual retry with the original key and billing. Other errors stop for attention and show fixed Arabic messages, never upstream text. Laravel validation error arrays are checked structurally but not echoed.

Three source constraints prohibit blind ambiguity recovery:

1. Intent key replay is partitioned by the server-issued scope cookie. A lost first response may lose that cookie. The same UUID alone cannot prove the same namespace, so an uncertain intent is never retried automatically or offered as a new operation.
2. Repeated reservation activation can return an existing reservation, but `GuestDonationPaymentCapabilityService` explicitly never redelivers an existing payment credential. A lost activation response therefore cannot prove usable payment authority.
3. Guest payment creation consumes/revokes its capability. The controller's authorization rejects subsequent use, even though the internal creation service supports restricted replay; the backend feature test expects guest replay 404. An uncertain guest payment is never treated as safely replayable solely because a key exists.

Checkout ambiguity may already involve the provider and also stops for attention. Explicit safe retries retain all confirmed stages; malformed success/error envelopes, expired sessions, capability denials and conflicts never create another intent. All payloads and keys are frozen in one page-memory operation. Editing is disabled from the first send, including on errors. No restart/cancellation is offered, so no edit creates a second transaction; reservation expiry and unavailable cross-refresh recovery are explained. Use separately approved authoritative operational recovery where needed; do not infer outcome from query strings or create a replacement donation to repair uncertainty.

## Acceptance before enabling

Verify live read connectivity, configured global currency/actual amount ceiling, current project eligibility/capacity/expiry, eligible gateway/currency, canonical billing acceptance and immutable replay behavior. Verify external exact-path allowlisting, Origin checks, full browser cookie sequence, approved checkout host and actual return destination in an authorized isolated staging environment. Exercise rejected/ambiguous requests without creating duplicate operations. Complete desktop/mobile hydrated clicks, focus, screen-reader, overflow and browser navigation review. No real payment, database operation or environment activation was performed in this phase.
