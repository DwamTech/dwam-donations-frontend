# Phase 02A same-origin deployment contract

Phase 02D-2B adds a disabled financial client. The historical GET-only example below remains unchanged; see [the separate checkout activation contract](CHECKOUT_INTEGRATION.md) for future explicitly approved POST routes and cookie/Origin requirements. No mutation forwarding has been enabled.

Phase 02E-1 supplies the Next page `/payment-return`, which must stay on the frontend page upstream. It requires no API forwarding or capability cookies. The Paymob notification URL stays separately routed to Laravel; never expose `/api/payments/paymob/webhook` through this public frontend. Future approved return URLs must point to the fixed page on the approved public origin. No production proxy setting was changed.

Phase 02E-2-F2 supplies `/receipts/recover` and `/receipt-recovery` on the page upstream, without expanding the local bridge. The browser now explicitly exchanges a one-time recovery credential, then explicitly downloads using the response's authorized receipt UUID and browser cookies. See [receipt boundaries and future exact routes](RECEIPT_RECOVERY.md). No receipt API handler or production receipt routing was enabled: the exact three receipt routes still require separately approved external same-origin forwarding. The project bridge must not be used for capability-bearing traffic.

This file is guidance only. No proxy, deployment, DNS, TLS or backend setting has been changed.

Browser-facing public API paths are `/api/donation-projects` and `/api/donation-projects/{numeric-id}`. The current UI fetches read-only data in Server Components using the server-only `DONATIONS_BACKEND_ORIGIN`. It makes no cross-origin browser API requests.

## Local development

Set `LOCAL_PUBLIC_API_PROXY=true` and the server-only origin in this frontend's `.env.local`, then run `npm run dev`. The two exact App Router GET handlers forward the collection or numeric project ID, with a six-second timeout, no cookies/authorization forwarding, no redirects, no-store responses, and sanitized error messages. Collection query keys are explicitly allowlisted. HEAD and mutation methods are rejected. Nested update routes and all admin/auth/payment paths are absent.

In production these handlers return 404 even when the flag is true. They are a development convenience, not production proxy enforcement. No generic Next rewrite is configured.

## Production edge

The external reverse proxy must route only these Phase 02A methods and paths to Laravel:

| Method | Path |
| --- | --- |
| GET | `/api/donation-projects` |
| GET | `/api/donation-projects/[1-9][0-9]*` |

Deny every other `/api/` path at the public edge. Do not route `/api/admin`, `/api/donor`, `/api/payments`, `/sanctum`, or future donation/checkout/receipt mutations in this phase. The backend's broader future-phase deployment document is not the Phase 02A allowlist.

Illustrative Nginx locations (merge with reviewed TLS/upstream configuration):

```nginx
# Define laravel_public and donations_next upstreams for your infrastructure.
location = /api/donation-projects {
    if ($request_method != GET) { return 405; }
    proxy_set_header Cookie "";
    proxy_set_header Authorization "";
    proxy_hide_header Set-Cookie;
    proxy_pass http://laravel_public;
}
location ~ ^/api/donation-projects/[1-9][0-9]*$ {
    if ($request_method != GET) { return 405; }
    proxy_set_header Cookie "";
    proxy_set_header Authorization "";
    proxy_hide_header Set-Cookie;
    proxy_pass http://laravel_public;
}
location /api/ { return 404; }
location / { proxy_pass http://donations_next; }
```

Retain other backend deny rules, including `/sanctum/`; do not replace them with the site's catch-all. Set trusted forwarding headers at the edge using actual infrastructure values, restrict direct upstream access, apply suitable public-read rate limits, and keep funding responses uncached unless a separately reviewed freshness policy is approved. No wildcard CORS is needed. Stage and test exact route/method matching before deployment. Media delivery needs a separately reviewed public asset mapping or public storage origin; do not broaden the API allowlist for images.

Set `SITE_ORIGIN` to the approved public origin and `DONATIONS_BACKEND_ORIGIN` to the internal origin in the Next server environment. Never place internal URLs or credentials in `NEXT_PUBLIC_` variables. No real deployment hostname is embedded in source.
