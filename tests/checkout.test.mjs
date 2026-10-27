import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTypescript } from "./load-typescript.mjs";
const { operationSnapshot, createCheckoutOperation, checkoutDestination, uuidV4 } = await loadTypescript("../src/features/donations/data/checkout-operation.ts");
const { checkoutConfig, disabledCheckout } = await loadTypescript("../src/features/donations/data/checkout-config.ts");
const { CheckoutReview } = await loadTypescript("../src/features/donations/components/checkout-review.tsx");
const { DonorSessionProvider } = await loadTypescript("../src/features/donors/session.ts");
const { DonationReview } = await loadTypescript("../src/features/donations/components/donation-review.tsx");
const project = { id: 1, title: "Synthetic project", reference: "PROJECT-TEST", currency: "EGP" };
const donor = () => ({ amount: "12.34", name: "Synthetic Guest", email: "guest@example.test", phone: "+201001234567", is_public_anonymous: true });
const billing = () => ({ first_name: "Synthetic", last_name: "Payer", phone_number: "+201001234567", email: "payer@example.test", street: "Test Street", building: "12", floor: "2", apartment: "3", city: "Test City", state: "Test State", country: "EG" });
const config = { enabled: true, gateway: "synthetic", hosts: ["checkout.example.test"] };
const now = Date.parse("2026-10-20T12:00:00Z"), future = "2026-10-20T12:30:00Z";
const reference = "DON-SYNTHETIC1";
const responses = () => [
  { data: { reference, amount_minor: 1234, currency: "EGP", status: "initiated", reservation_state: "none", is_public_anonymous: true, created_at: "2026-10-20T12:00:00Z", project: { reference: project.reference, title: project.title }, is_general: false } },
  { data: { reference, status: "initiated", reservation: { applicable: true, state: "active", expires_at: future }, next_step: "payment_not_initiated" } },
  { data: { donation_reference: reference }, idempotent_replay: false },
  { data: { checkout_url: "https://checkout.example.test/session?key=synthetic", expires_at: future } },
];
const snapshot = () => operationSnapshot(project, donor(), billing(), config);
function harness(handler) {
  const requests = [], navigation = [], states = [];
  const values = responses();
  const operation = createCheckoutOperation(snapshot(), { now: () => now, timeoutMs: 30,
    onState: state => states.push(state), navigate: url => navigation.push(url),
    fetch: async (path, options) => {
      const index = requests.length;
      requests.push({ path, ...options });
      const custom = handler ? await handler(index, path, options) : undefined;
      return custom ?? Response.json(values[index], { status: index === 0 || index === 2 ? 201 : 200 });
    },
  });
  return { operation, requests, navigation, states };
}
test("financial activation fails closed without every explicit environment approval and configuration", () => {
  assert.deepEqual(checkoutConfig({}), disabledCheckout);
  const env = { DONATIONS_MUTATIONS_ENABLED: "true", DONATIONS_INTEGRATION_VERIFIED: "true", DONATIONS_PAYMENT_RETURN_VERIFIED: "true", DONATIONS_VERIFIED_RETURN_URL: "https://public.example.test/payment-return", SITE_ORIGIN: "https://public.example.test", DONATIONS_GATEWAY_CODE: "synthetic", DONATIONS_CHECKOUT_HOSTS: "checkout.example.test" };
  assert.equal(checkoutConfig(env).enabled, true);
  for (const field of Object.keys(env)) assert.equal(checkoutConfig({ ...env, [field]: "" }).enabled, false, field);
  for (const hosts of ["*.example.test", "https://checkout.example.test", "checkout.example.test:443", "checkout.example.test,", "localhost"]) assert.equal(checkoutConfig({ ...env, DONATIONS_CHECKOUT_HOSTS: hosts }).enabled, false);
  assert.equal(checkoutConfig({ ...env, DONATIONS_VERIFIED_RETURN_URL: "https://foreign.example.test/return" }).enabled, false);
  assert.throws(() => operationSnapshot(project, donor(), billing(), disabledCheckout));
});
test("snapshot explicitly maps canonical major units and eleven billing fields with separate secure UUID-v4 keys", () => {
  const result = operationSnapshot(project, { ...donor(), amount: "١٢٫٣٤", amount_minor: "malicious", currency: "USD" }, { ...billing(), payment_id: 99 }, config);
  assert.deepEqual(Object.keys(result.intent).sort(), ["amount", "donation_project_id", "email", "is_public_anonymous", "name", "phone"]);
  assert.equal(result.intent.amount, "12.34"); assert.equal(result.amountMinor, "1234");
  assert.deepEqual(Object.keys(result.payment).sort(), ["billing", "gateway_code"]);
  assert.deepEqual(result.payment.billing, billing());
  for (const key of [result.intentKey, result.paymentKey, uuidV4()]) assert.match(key, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.notEqual(result.intentKey, result.paymentKey);
  assert.throws(() => { result.payment.billing.street = "Changed"; });
  assert.throws(() => { result.intent.amount = "50"; });
});
test("changed unsent review gets a fresh operation identity; invalid donors, billing and Egypt-only country cannot submit", () => {
  const a = snapshot(), b = operationSnapshot(project, { ...donor(), amount: "20" }, billing(), config);
  assert.notEqual(a.intentKey, b.intentKey); assert.equal(a.intent.amount, "12.34"); assert.equal(b.intent.amount, "20");
  assert.throws(() => operationSnapshot(project, { ...donor(), amount: "0" }, billing(), config));
  assert.throws(() => operationSnapshot(project, donor(), { ...billing(), country: "US" }, config));
  assert.throws(() => operationSnapshot(project, donor(), { ...billing(), street: "" }, config));
  assert.throws(() => operationSnapshot(project, donor(), billing(), config, () => "not-a-uuid"));
});
test("four-stage orchestration sends exact relative routes, browser credentials and distinct operation headers", async () => {
  const h = harness(); await h.operation.run();
  assert.deepEqual(h.requests.map(r => r.path), ["/api/donations", `/api/donations/${reference}/reserve`, `/api/donations/${reference}/payment`, `/api/donations/${reference}/checkout`]);
  for (const r of h.requests) {
    assert.equal(r.method, "POST"); assert.equal(r.credentials, "same-origin"); assert.equal(r.redirect, "error"); assert.equal(r.cache, "no-store");
    assert.equal(r.headers.Cookie, undefined); assert.equal(r.headers.Origin, undefined);
  }
  assert.notEqual(h.requests[0].headers["Idempotency-Key"], h.requests[2].headers["Idempotency-Key"]);
  assert.equal(h.requests[1].headers["Idempotency-Key"], undefined);
  assert.equal(h.navigation.length, 1); assert.equal(h.operation.getState().status, "redirecting");
  assert.deepEqual(h.states.filter(s => s.status === "working").map(s => s.stage), ["intent", "reserve", "payment", "checkout"]);
  await h.operation.run(); assert.equal(h.requests.length, 4);
});
test("double clicks share one in-flight operation", async () => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const h = harness(async index => { if (index === 0) await wait; });
  const first = h.operation.run(); await h.operation.run(); assert.equal(h.requests.length, 1);
  release(); await first; assert.equal(h.requests.length, 4);
});
test("confirmed rejection permits an identical-key intent retry including a valid 200 replay envelope", async () => {
  let count = 0;
  const h = harness(() => {
    if (count++ === 0) return Response.json({ message: "Throttled" }, { status: 429 });
    return Response.json(responses()[count - 2]);
  });
  await h.operation.run(); assert.equal(h.operation.getState().status, "recoverable");
  await h.operation.run(); assert.equal(h.navigation.length, 1);
  assert.equal(h.requests[0].body, h.requests[1].body);
  assert.equal(h.requests[0].headers["Idempotency-Key"], h.requests[1].headers["Idempotency-Key"]);
});
test("payment unavailable retry retains immutable billing/key and never recreates confirmed intent or reservation", async () => {
  let paymentCount = 0;
  const h = harness((index, path) => {
    if (path.endsWith("/payment")) return ++paymentCount === 1 ? Response.json({ message: "Disabled gateway" }, { status: 503 }) : Response.json({ ...responses()[2], idempotent_replay: true });
    if (path.endsWith("/checkout")) return Response.json(responses()[3]);
  });
  await h.operation.run(); assert.equal(h.operation.getState().status, "recoverable");
  await h.operation.run(); assert.equal(h.navigation.length, 1);
  assert.equal(h.requests.filter(r => r.path === "/api/donations").length, 1);
  const attempts = h.requests.filter(r => r.path.endsWith("/payment"));
  assert.equal(attempts[0].body, attempts[1].body); assert.equal(attempts[0].headers["Idempotency-Key"], attempts[1].headers["Idempotency-Key"]);
});
for (const [stage, index] of ["intent", "reserve", "payment", "checkout"].map((s, i) => [s, i])) {
  test(`${stage}: ambiguous disconnect stops without duplicate operations or a redirect`, async () => {
    const h = harness(i => { if (i === index) throw new TypeError("Synthetic network failure with sensitive details"); });
    await h.operation.run(); assert.equal(h.operation.getState().status, "attention");
    await h.operation.run(); assert.equal(h.requests.length, index + 1); assert.equal(h.navigation.length, 0);
    assert.doesNotMatch(h.operation.getState().message, /Synthetic|sensitive/);
  });
  test(`${stage}: malformed success requires attention and never advances`, async () => {
    const h = harness(i => i === index ? Response.json({ data: {} }) : undefined);
    await h.operation.run(); assert.equal(h.operation.getState().status, "attention"); assert.equal(h.requests.length, index + 1); assert.equal(h.navigation.length, 0);
  });
}
test("actual abort timeout during payment needs attention because guest capability may have been consumed", async () => {
  const h = harness((i, path, options) => i === 2 ? new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("Timeout", "AbortError")), { once: true })) : undefined);
  await h.operation.run(); assert.equal(h.operation.getState().status, "attention"); assert.equal(h.requests.length, 3); assert.equal(h.navigation.length, 0);
});
test("capacity conflict and concealed capability denial never imply project deletion or payment success", async () => {
  for (const status of [400, 401, 403, 404, 409, 422, 429, 503, 500]) {
    const h = harness(i => i === 1 ? Response.json({ message: "Internal secret exception", errors: { secret: ["Never display"] } }, { status }) : undefined);
    await h.operation.run(); assert.equal(h.operation.getState().status, [409, 429].includes(status) ? "recoverable" : "attention");
    assert.equal(h.navigation.length, 0); assert.equal(h.requests.length, 2);
    assert.doesNotMatch(h.operation.getState().message, /Internal|secret|Never display/);
  }
});
test("invalid billing, expired authority and conflict responses stop payment without checkout", async () => {
  for (const status of [404, 409, 422]) {
    const h = harness(i => i === 2 ? Response.json({ message: "Rejected" }, { status }) : undefined);
    await h.operation.run(); assert.equal(h.requests.length, 3); assert.equal(h.navigation.length, 0); assert.equal(h.operation.getState().status, "attention");
  }
});
test("explicit reservation conflict retries only that same donation and does not invent capacity", async () => {
  let attempts = 0;
  const h = harness((i, path) => {
    if (path.endsWith("/reserve")) return ++attempts === 1 ? Response.json({ message: "Reservation cannot be created." }, { status: 409 }) : Response.json(responses()[1]);
    if (path.endsWith("/payment")) return Response.json(responses()[2], { status: 201 });
    if (path.endsWith("/checkout")) return Response.json(responses()[3]);
  });
  await h.operation.run(); assert.equal(h.operation.getState().status, "recoverable");
  await h.operation.run(); assert.equal(h.navigation.length, 1);
  assert.equal(h.requests.filter(r => r.path === "/api/donations").length, 1);
  const reservations = h.requests.filter(r => r.path.endsWith("/reserve"));
  assert.equal(reservations.length, 2); assert.equal(reservations[0].path, reservations[1].path); assert.equal(reservations[0].body, "{}");
});
test("expired reservation prevents payment and malformed error HTML cannot authorize retries", async () => {
  const h = harness(i => i === 1 ? Response.json({ data: { ...responses()[1].data, reservation: { applicable: true, state: "active", expires_at: "2026-10-20T11:59:00Z" } } }) : undefined);
  await h.operation.run(); assert.equal(h.requests.length, 2); assert.equal(h.operation.getState().status, "attention");
  const malformed = harness(() => new Response("<h1>Unavailable</h1>", { status: 503 }));
  await malformed.operation.run(); assert.equal(malformed.operation.getState().status, "attention");
});
test("intent mismatches including unsafe integer money cannot advance to reservation", async () => {
  for (const changes of [{ currency: "USD" }, { amount_minor: 9007199254740992 }, { reference: "../admin" }, { project: { reference: "OTHER", title: "Wrong" } }, { is_general: true }]) {
    const h = harness(i => i === 0 ? Response.json({ data: { ...responses()[0].data, ...changes } }) : undefined);
    await h.operation.run(); assert.equal(h.requests.length, 1); assert.equal(h.operation.getState().status, "attention");
  }
});
test("hosted checkout requires an exact approved HTTPS host, no credentials and a future expiry", () => {
  assert.match(checkoutDestination(responses()[3], config.hosts, now).url, /^https:\/\/checkout.example.test\//);
  for (const url of ["javascript:alert(1)", "data:text/html,test", "file:///tmp/test", "http://checkout.example.test/", "https://user:secret@checkout.example.test/", "https://checkout.example.test.evil.test/", "https://sub.checkout.example.test/", "//checkout.example.test/", "https://checkout.example.test:8443/", "https://checkout.example.test\\@evil.test/", "https://evil.test/", "https://checkout.example.test/#callback"]) assert.throws(() => checkoutDestination({ data: { checkout_url: url, expires_at: future } }, config.hosts, now));
  for (const expires_at of [null, "invalid", "2026-10-20T11:59:00Z", "2026-10-20T12:00:00Z"]) assert.throws(() => checkoutDestination({ data: { checkout_url: responses()[3].data.checkout_url, expires_at } }, config.hosts, now));
});
test("unapproved checkout response never navigates after payment creation", async () => {
  const h = harness(i => i === 3 ? Response.json({ data: { checkout_url: "https://evil.test/", expires_at: future } }) : undefined);
  await h.operation.run(); assert.equal(h.navigation.length, 0); assert.equal(h.operation.getState().status, "attention");
});
test("disabled real review has no submission action; started review disables both edit buttons and avoids false creation claims", () => {
  const guest = { ...donor(), amount_minor: "1234" };
  const html = renderToStaticMarkup(createElement(DonorSessionProvider, { enabled: false }, createElement(CheckoutReview, { project, guest, billing: billing(), onEdit() {} })));
  assert.match(html, /غير متاحين حاليًا/); assert.equal((html.match(/<button/g) ?? []).length, 2);
  assert.doesNotMatch(html, /إرسال الطلب والمتابعة|تم التبرع بنجاح/);
  const started = renderToStaticMarkup(createElement(DonationReview, { project, guest, billing: billing(), onEdit() {}, started: true }));
  assert.equal((started.match(/disabled=""/g) ?? []).length, 2);
  assert.doesNotMatch(started, /لم يُنشأ تبرع/);
});
test("transaction modules never persist, inspect cookies, log payloads or infer return status", async () => {
  const source = (await Promise.all(["data/checkout-operation.ts", "data/checkout-config.ts", "components/checkout-review.tsx"].map(file => readFile(new URL(`../src/features/donations/${file}`, import.meta.url), "utf8")))).join("\n");
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|console\.|sendBeacon|XMLHttpRequest|URLSearchParams|\.headers\.get\(["']set-cookie|\.getSetCookie|payment_status\s*=/i);
});
test("isolated HTTP mock sequence exercises transport and simulated cookie delivery without a financial proxy", async () => {
  const recorded = [], values = responses();
  const server = createServer(async (req, res) => {
    let body = ""; for await (const chunk of req) body += chunk;
    const index = recorded.length;
    recorded.push({ path: req.url, cookie: req.headers.cookie, body: JSON.parse(body) });
    if (index > 0) assert.match(req.headers.cookie, /synthetic_scope=test/);
    res.writeHead(index === 0 || index === 2 ? 201 : 200, { "Content-Type": "application/json", "Set-Cookie": "synthetic_scope=test; Path=/api/donations; HttpOnly; SameSite=Strict" });
    res.end(JSON.stringify(values[index]));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    let cookie = "", destination;
    // Test-only browser simulation. Application code never reads/sets Cookie or Set-Cookie.
    const browser = async (path, options) => {
      assert.equal(options.credentials, "same-origin"); assert.ok(path.startsWith("/api/donations"));
      const response = await fetch(new URL(path, origin), { ...options, headers: { ...options.headers, ...(cookie ? { Cookie: cookie } : {}) } });
      cookie = response.headers.getSetCookie()[0]?.split(";")[0] ?? cookie;
      return response;
    };
    const operation = createCheckoutOperation(snapshot(), { fetch: browser, now: () => now, navigate: url => { destination = url; } });
    await operation.run(); assert.equal(operation.getState().status, "redirecting");
    assert.equal(recorded.length, 4); assert.match(destination, /^https:\/\/checkout.example.test\//);
    assert.deepEqual(recorded.map(r => r.path), ["/api/donations", `/api/donations/${reference}/reserve`, `/api/donations/${reference}/payment`, `/api/donations/${reference}/checkout`]);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
