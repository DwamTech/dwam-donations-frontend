import test from "node:test";
import assert from "node:assert/strict";
import { loadTypescript } from "./load-typescript.mjs";
const { donationBridge } = await loadTypescript("../src/lib/api/donation-bridge.ts");
const env = { NODE_ENV: "test", SITE_ORIGIN: "http://site.test", DONATIONS_BACKEND_ORIGIN: "http://backend.test", DONATIONS_MUTATIONS_ENABLED: "true", DONATIONS_API_BRIDGE_ENABLED: "true" };
const request = (path = "/api/donations", headers = {}, body = "{}") => new Request("http://site.test" + path, { method: "POST", headers: { Origin: env.SITE_ORIGIN, "Content-Type": "application/json", ...headers }, body });
test("exact Guest bridge preserves status, idempotency and only scoped cookies", async () => {
  let calls = 0;
  const response = await donationBridge(request(undefined, { Cookie: "admin_session=secret; donation_intent_scope=synthetic; donation_cancel_1=cancel", Authorization: "Bearer forbidden", "Idempotency-Key": "11111111-1111-4111-8111-111111111111" }), { env, fetch: async (url, options) => {
    calls++; assert.equal(url, "http://backend.test/api/donations"); assert.equal(options.headers.get("Authorization"), null); assert.equal(options.headers.get("Cookie"), "donation_intent_scope=synthetic; donation_cancel_1=cancel"); assert.equal(options.headers.get("Origin"), env.SITE_ORIGIN); assert.equal(options.headers.get("Idempotency-Key"), "11111111-1111-4111-8111-111111111111"); assert.equal(options.redirect, "error");
    const h = new Headers(); h.append("Set-Cookie", "donation_receipt_scope=value; Path=/api/donation-receipts; HttpOnly; SameSite=Strict"); h.append("Set-Cookie", "foreign=value; Path=/; HttpOnly"); h.append("Set-Cookie", "donation_payment_1=value; Domain=backend.test; HttpOnly");
    return Response.json({ data: { reference: "DON-SYNTHETIC" } }, { status: 201, headers: h });
  } });
  assert.equal(calls, 1); assert.equal(response.status, 201); assert.match(response.headers.get("Cache-Control"), /no-store/); assert.equal(response.headers.getSetCookie().length, 1); assert.match(response.headers.getSetCookie()[0], /Path=\/api\/donation-receipts/);
});
test("bridge denies cross origin, metadata, size, disabled mode and arbitrary paths before upstream", async () => {
  const fetch = () => { throw Error("Must not reach upstream"); };
  for (const path of ["/api/admin/donations", "/api/donations/DON-A/delete", "/api/donations?url=https://evil.test", "/api/donations/DON-A/checkout/extra"]) assert.equal((await donationBridge(request(path), { env, fetch })).status, 404);
  assert.equal((await donationBridge(request(undefined, { Origin: "https://evil.test" }), { env, fetch })).status, 403);
  assert.equal((await donationBridge(request(undefined, { "Sec-Fetch-Site": "cross-site" }), { env, fetch })).status, 403);
  assert.equal((await donationBridge(request(undefined, {}, "x".repeat(25000)), { env, fetch })).status, 413);
  assert.equal((await donationBridge(request(), { env: { ...env, DONATIONS_MUTATIONS_ENABLED: "false" }, fetch })).status, 503);
});
test("bridge rejects redirect/HTML/network failures and invalid PDFs without exposing upstream details", async () => {
  for (const [fetch, status] of [[async () => new Response("private trace", { status: 500 }), 500], [async () => { throw Error("secret"); }, 503]]) {
    const response = await donationBridge(request(), { env, fetch }); assert.equal(response.status, status); assert.doesNotMatch(await response.text(), /trace|secret/);
  }
  const url = "http://site.test/api/donation-receipts/11111111-1111-4111-8111-111111111111/download";
  const r = await donationBridge(new Request(url), { env, fetch: async () => new Response("%PDF-synthetic", { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="receipt-DR-1.pdf"' } }) });
  assert.equal(r.status, 200); assert.equal(await r.text(), "%PDF-synthetic");
});
