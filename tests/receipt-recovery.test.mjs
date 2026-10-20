import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTypescript } from "./load-typescript.mjs";
const { validateRecoveryRequest, createRecoveryRequest, neutralRecoveryMessage } = await loadTypescript("../src/features/receipts/data/recovery-request.ts");
const { parseRecoveryFragment } = await loadTypescript("../src/features/receipts/data/recovery-fragment.ts");
const { createRecoveryOperation } = await loadTypescript("../src/features/receipts/data/recovery-operation.ts");
const { RecoveryRequestForm } = await loadTypescript("../src/features/receipts/components/recovery-request-form.tsx");
const { RecoveryLink } = await loadTypescript("../src/features/receipts/components/recovery-link.tsx");
const valid = () => ({ receipt_number: "SYNTHETIC-RECEIPT-1", email: "synthetic@example.test" });
const token_id = "12345678-1234-4123-8123-123456789abc", secret = "S".repeat(43);
const fragment = `#token_id=${token_id}&secret=${secret}`;
test("request validation requires the exact receipt-number/email fields with verified length bounds", () => {
  assert.deepEqual(validateRecoveryRequest({ receipt_number: ` ${valid().receipt_number} `, email: ` ${valid().email} ` }).value, valid());
  assert.ok(validateRecoveryRequest({ ...valid(), receipt_number: "" }).errors.receipt_number);
  assert.ok(validateRecoveryRequest({ ...valid(), receipt_number: "A".repeat(65) }).errors.receipt_number);
  assert.ok(validateRecoveryRequest({ ...valid(), receipt_number: "A\nB" }).errors.receipt_number);
  assert.equal(validateRecoveryRequest({ ...valid(), receipt_number: "A".repeat(64) }).value.receipt_number.length, 64);
  for (const email of ["", "invalid", "a@@example.test", "a b@example.test", "a".repeat(256) + "@example.test"]) assert.ok(validateRecoveryRequest({ ...valid(), email }).errors.email);
});
test("request transport maps only allowed JSON fields, relative paths and browser credentials", async () => {
  const calls = [];
  const operation = createRecoveryRequest({ fetch: async (path, options) => { calls.push({ path, options }); return Response.json({ message: "If this receipt is available, recovery instructions will be sent." }, { status: 202 }); } });
  await operation.submit({ ...valid(), receipt_uuid: "not-authority", secret });
  assert.equal(calls.length, 1); assert.equal(calls[0].path, "/api/donation-receipts/recovery-requests");
  assert.deepEqual(JSON.parse(calls[0].options.body), valid());
  assert.equal(calls[0].options.method, "POST"); assert.equal(calls[0].options.credentials, "same-origin"); assert.equal(calls[0].options.redirect, "error"); assert.equal(calls[0].options.cache, "no-store");
  assert.deepEqual(Object.keys(calls[0].options.headers).sort(), ["Accept", "Content-Type"]);
  assert.deepEqual(operation.getState(), { status: "accepted", message: neutralRecoveryMessage });
  assert.doesNotMatch(operation.getState().message, new RegExp(valid().receipt_number));
  await operation.submit(valid()); assert.equal(calls.length, 1);
});
test("invalid requests never send and repeated clicks cannot enqueue another email request", async () => {
  let count = 0, release;
  const wait = new Promise(resolve => { release = resolve; });
  const operation = createRecoveryRequest({ fetch: async () => { count++; await wait; return Response.json({ message: "neutral" }, { status: 202 }); } });
  await operation.submit({ receipt_number: "", email: "" }); assert.equal(count, 0);
  const first = operation.submit(valid()); await operation.submit(valid()); assert.equal(count, 1);
  release(); await first; assert.equal(operation.getState().status, "accepted");
});
test("202 remains non-enumerating regardless of server message content", async () => {
  for (const message of ["exists", "not found", "internal failure", "neutral"]) {
    const operation = createRecoveryRequest({ fetch: async () => Response.json({ message }, { status: 202 }) });
    await operation.submit(valid()); assert.equal(operation.getState().message, neutralRecoveryMessage);
  }
});
test("validation, throttling and unavailable errors are sanitized and need manual resubmission", async () => {
  for (const status of [400, 401, 403, 404, 422, 429, 503]) {
    let count = 0;
    const operation = createRecoveryRequest({ fetch: async () => { count++; return Response.json({ message: "Raw internal sensitive error", errors: { email: ["Private data"] } }, { status }); } });
    await operation.submit(valid()); assert.equal(operation.getState().status, "error"); assert.equal(count, 1);
    assert.doesNotMatch(operation.getState().message, /Raw|sensitive|Private/);
  }
});
test("malformed or lost responses never claim email delivery and never retry automatically", async () => {
  for (const handler of [() => { throw new TypeError("network details"); }, () => Response.json({ data: {} }, { status: 202 }), () => Response.json({ message: "unexpected" }, { status: 200 }), () => new Response("<html>private</html>", { status: 503 })]) {
    let count = 0;
    const operation = createRecoveryRequest({ fetch: async () => { count++; return handler(); } });
    await operation.submit(valid()); assert.equal(operation.getState().status, "uncertain");
    await operation.submit(valid()); assert.equal(count, 1);
    assert.doesNotMatch(operation.getState().message, /network|private/);
  }
});
test("actual request timeout becomes uncertain without another send", async () => {
  let count = 0;
  const operation = createRecoveryRequest({ timeoutMs: 10, fetch: async (path, options) => { count++; return new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("Timeout", "AbortError")), { once: true })); } });
  await operation.submit(valid()); assert.equal(operation.getState().status, "uncertain"); await operation.submit(valid()); assert.equal(count, 1);
});
test("factory-shaped fragments parse exact token fields without inventing a receipt UUID", () => {
  assert.deepEqual(parseRecoveryFragment(fragment), { token_id, secret });
  assert.deepEqual(parseRecoveryFragment(`#secret=${secret}&token_id=${token_id}`), { token_id, secret });
  assert.deepEqual(Object.keys(parseRecoveryFragment(fragment)).sort(), ["secret", "token_id"]);
});
test("missing, malformed, duplicate, conflicting and extra fragment parameters are rejected", () => {
  for (const raw of ["", "#", `#token_id=${token_id}`, `#secret=${secret}`, fragment + "&secret=" + secret, fragment + "&token_id=" + token_id, fragment + "&receipt_uuid=" + token_id, fragment + "&return_to=https://evil.test", `#token_id=invalid&secret=${secret}`, `#token_id=${token_id}&secret=short`, fragment + "\n", fragment + "&" + "x".repeat(600), `?token_id=${token_id}&secret=${secret}`]) assert.equal(parseRecoveryFragment(raw), null);
});
test("fragment capture cleans the URL before validation, exposes only status and survives repeated effects", () => {
  const createFragmentInspector = browser => {
    const operation = createRecoveryOperation({ browser, fetch: () => { throw new Error("No automatic transport"); }, offerPdf() {} });
    return () => { operation.capture(); return operation.getState().status; };
  };
  const events = [];
  const inspect = createFragmentInspector({ read() { events.push("read"); return fragment; }, clear() { events.push("clear"); } });
  assert.equal(inspect(), "ready"); assert.deepEqual(events, ["read", "clear"]);
  assert.equal(inspect(), "ready"); assert.deepEqual(events, ["read", "clear"]);
  assert.equal(createFragmentInspector({ read: () => "", clear() {} })(), "missing");
  assert.equal(createFragmentInspector({ read: () => "#bad", clear() {} })(), "invalid");
  assert.equal(createFragmentInspector({ read: () => fragment, clear() { throw new Error("history denied"); } })(), "unavailable");
});
test("real SSR form cannot natively serialize PII and landing renders no credentials or exchange/download actions", () => {
  const html = renderToStaticMarkup(createElement(RecoveryRequestForm));
  assert.match(html, /method="dialog"/); assert.match(html, /<fieldset disabled=""/);
  for (const id of ["receipt_number", "email"]) { assert.match(html, new RegExp(`id="recovery-${id}"`)); assert.match(html, new RegExp(`for="recovery-${id}"`)); }
  assert.match(html, /type="email"/); assert.doesNotMatch(html, /<(?:input|select|textarea)[^>]*\bname=/);
  const landing = renderToStaticMarkup(createElement(RecoveryLink));
  assert.doesNotMatch(landing, new RegExp(`${token_id}|${secret}`));
  assert.doesNotMatch(landing, /<button|href=|<input|\/api\//);
});
test("receipt feature never persists/logs PII or capabilities, polls status or bypasses authorization", async () => {
  const files = ["data/recovery-request.ts", "data/recovery-fragment.ts", "data/recovery-operation.ts", "data/browser-pdf.ts", "components/recovery-request-form.tsx", "components/recovery-link.tsx"];
  const source = (await Promise.all(files.map(file => readFile(new URL(`../src/features/receipts/${file}`, import.meta.url), "utf8")))).join("\n");
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|console\.|sendBeacon|XMLHttpRequest|\/api\/donations\b|dangerouslySetInnerHTML|\/api\/donation-receipts[^"'`]*\/status/);
  const fragmentSource = await readFile(new URL("../src/features/receipts/data/recovery-fragment.ts", import.meta.url), "utf8");
  assert.doesNotMatch(fragmentSource, /\bfetch\s*\(/);
  const component = await readFile(new URL("../src/features/receipts/components/recovery-link.tsx", import.meta.url), "utf8");
  assert.match(component, /history\.replaceState\(window\.history\.state, "", "\/receipt-recovery"\)/);
  assert.doesNotMatch(component, /searchParams|\.search\b|fetch\s*\(/);
});
test("isolated HTTP recovery-request transport uses a fixed path and no personal-data URL", async () => {
  const calls = [];
  const server = createServer(async (req, res) => {
    let raw = ""; for await (const chunk of req) raw += chunk;
    calls.push({ path: req.url, method: req.method, body: JSON.parse(raw) });
    res.writeHead(202, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ message: "If this receipt is available, recovery instructions will be sent." }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const operation = createRecoveryRequest({ fetch: (path, options) => fetch(new URL(path, origin), options) });
    await operation.submit(valid()); assert.equal(operation.getState().status, "accepted");
    assert.deepEqual(calls, [{ path: "/api/donation-receipts/recovery-requests", method: "POST", body: valid() }]);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
