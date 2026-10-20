import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { loadTypescript } from "./load-typescript.mjs";
const { createRecoveryOperation, parseExchangeResponse, protectedReceiptPath, receiptUuid, readPrivatePdf, MAX_RECEIPT_BYTES } = await loadTypescript("../src/features/receipts/data/recovery-operation.ts");
const { createPdfOffer } = await loadTypescript("../src/features/receipts/data/browser-pdf.ts");
const token = "12345678-1234-4123-8123-123456789abc", uuid = "98765432-1234-7123-8123-123456789abc", secret = "S".repeat(43);
const fragment = `#token_id=${token}&secret=${secret}`;
const success = () => ({ message: "Receipt recovery completed.", data: { receipt_uuid: uuid } });
const pdfHeaders = { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="receipt-SYNTHETIC.pdf"', "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
const pdfResponse = (headers = {}) => new Response("%PDF-1.7\nsynthetic test bytes\n%%EOF", { headers: { ...pdfHeaders, ...headers } });
function harness(handler, options = {}) {
  const events = [], calls = [], states = [], offered = [];
  let hash = options.hash ?? fragment;
  const op = createRecoveryOperation({ browser: {
    read() { events.push("read"); return hash; },
    clear() { events.push("clear"); if (options.clearFails) throw new Error("Synthetic history denial"); hash = ""; },
  }, onState: state => states.push(state), timeoutMs: 20,
  offerPdf: (blob, filename) => offered.push({ blob, filename }),
  fetch: async (path, init) => {
    events.push("request"); calls.push({ path, ...init });
    return handler ? handler(path, init, calls.length) : path.endsWith("/download") ? pdfResponse() : Response.json(success());
  } });
  return { op, events, calls, states, offered, changeHash: value => { hash = value; }, hash: () => hash };
}
test("capture removes the fragment before explicit exchange, repeated effects preserve pending authority and state hides secrets", async () => {
  const h = harness(); h.op.capture(); h.op.capture();
  assert.deepEqual(h.events, ["read", "clear"]); assert.equal(h.hash(), ""); assert.equal(h.op.getState().status, "ready"); assert.equal(h.calls.length, 0);
  assert.doesNotMatch(JSON.stringify(h.op.getState()), new RegExp(`${token}|${secret}`));
  await h.op.exchange(); assert.equal(h.op.getState().status, "authorized"); assert.equal(h.op.getState().receiptUuid, uuid);
  assert.deepEqual(h.events, ["read", "clear", "request"]);
  const request = h.calls[0]; assert.equal(request.path, "/api/donation-receipts/recovery-exchanges");
  assert.equal(request.method, "POST"); assert.equal(request.credentials, "same-origin"); assert.equal(request.cache, "no-store"); assert.equal(request.redirect, "error");
  assert.deepEqual(Object.keys(request.headers).sort(), ["Accept", "Content-Type"]); assert.deepEqual(JSON.parse(request.body), { token_id: token, secret });
  assert.equal(h.offered.length, 0, "Exchange never starts a download");
  assert.doesNotMatch(JSON.stringify(h.states), new RegExp(`${token}|${secret}`));
});
test("cleanup failure, missing and invalid fragments never permit network actions", async () => {
  for (const options of [{ clearFails: true }, { hash: "" }, { hash: "#bad" }, { hash: fragment + "&secret=" + secret }, { hash: fragment + "&receipt_uuid=" + uuid }]) {
    const h = harness(undefined, options); h.op.capture(); await h.op.exchange(); await h.op.download(); assert.equal(h.calls.length, 0); assert.equal(h.offered.length, 0);
  }
});
test("double clicks, repeated effects and new hashes cannot repeat an in-flight or consumed exchange", async () => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const h = harness(async () => { await wait; return Response.json(success()); });
  h.op.capture(); const first = h.op.exchange(); await h.op.exchange(); h.op.capture();
  h.changeHash(fragment); h.op.capture(true); assert.equal(h.hash(), ""); assert.equal(h.calls.length, 1);
  release(); await first; await h.op.exchange(); assert.equal(h.calls.length, 1);
});
test("unsent fragment replacement discards old credentials while a new page cannot restore a cleared fragment", async () => {
  const h = harness(); h.op.capture();
  const changed = "N".repeat(43); h.changeHash(`#token_id=${token}&secret=${changed}`); h.op.capture(true); await h.op.exchange();
  assert.equal(JSON.parse(h.calls[0].body).secret, changed);
  const refreshed = harness(undefined, { hash: h.hash() }); refreshed.op.capture(); assert.equal(refreshed.op.getState().status, "missing"); await refreshed.op.exchange(); assert.equal(refreshed.calls.length, 0);
});
test("receipt UUID parser follows canonical backend route syntax, supports multiple versions and rejects token substitution", () => {
  for (const version of ["1", "4", "7", "8"]) assert.equal(receiptUuid(`98765432-1234-${version}123-8123-123456789abc`), true);
  for (const value of [undefined, null, 1, "", "../download", token + "/download", "not-a-uuid"]) { assert.equal(receiptUuid(value), false); assert.throws(() => protectedReceiptPath(value)); }
  assert.equal(parseExchangeResponse(success(), token), uuid);
  for (const value of [null, [], {}, { message: "Receipt recovery completed." }, { message: "wrong", data: { receipt_uuid: uuid } }, { ...success(), data: { receipt_uuid: token } }, { ...success(), data: { receipt_uuid: token.toUpperCase() } }, { ...success(), data: { receipt_uuid: "invalid" } }]) assert.throws(() => parseExchangeResponse(value, token));
});
test("missing or malformed success locator becomes uncertain and never offers PDF or retries", async () => {
  for (const body of [{ message: "Receipt recovery completed." }, { ...success(), data: {} }, { ...success(), data: { receipt_uuid: token } }, { ...success(), data: { receipt_uuid: "bad" } }]) {
    const h = harness(() => Response.json(body)); h.op.capture(); await h.op.exchange();
    assert.equal(h.op.getState().status, "uncertain"); assert.equal(h.op.getState().receiptUuid, undefined);
    await h.op.exchange(); await h.op.download(); assert.equal(h.calls.length, 1); assert.equal(h.offered.length, 0);
  }
});
test("concealed, expired, used and unavailable exchange responses are sanitized and terminal for the token", async () => {
  for (const status of [400, 401, 403, 404, 422, 429, 503]) {
    const h = harness(() => Response.json({ message: "Internal secret detail", data: { receipt_uuid: uuid } }, { status }));
    h.op.capture(); await h.op.exchange(); assert.equal(h.op.getState().status, [429, 503].includes(status) ? "service-error" : "denied");
    assert.doesNotMatch(JSON.stringify(h.op.getState()), /Internal|secret detail/); assert.equal(h.op.getState().receiptUuid, undefined);
    await h.op.exchange(); await h.op.download(); assert.equal(h.calls.length, 1);
  }
});
test("disconnect, malformed JSON, unexpected status and timeout after possible consumption never retry", async () => {
  for (const handler of [() => { throw new TypeError("Sensitive network data"); }, () => new Response("<html>private</html>"), () => Response.json(success(), { status: 201 }), (path, init) => new Promise((resolve, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("Timeout", "AbortError")), { once: true }))]) {
    const h = harness(handler); h.op.capture(); await h.op.exchange(); assert.equal(h.op.getState().status, "uncertain"); await h.op.exchange(); assert.equal(h.calls.length, 1);
    assert.doesNotMatch(h.op.getState().message, /Sensitive|private/);
  }
});
test("only the validated response UUID forms the protected GET, with no secret or automatic download", async () => {
  const h = harness(); await h.op.download(); assert.equal(h.calls.length, 0); h.op.capture(); await h.op.download(); assert.equal(h.calls.length, 0);
  await h.op.exchange(); assert.equal(h.calls.length, 1); await h.op.download();
  assert.equal(h.calls[1].path, `/api/donation-receipts/${uuid}/download`); assert.doesNotMatch(h.calls[1].path, new RegExp(`${token}|${secret}|\\?`));
  assert.equal(h.calls[1].method, "GET"); assert.equal(h.calls[1].credentials, "same-origin"); assert.equal(h.calls[1].cache, "no-store"); assert.equal(h.calls[1].body, undefined);
  assert.deepEqual(h.calls[1].headers, { Accept: "application/pdf" }); assert.equal(h.offered.length, 1); assert.equal(h.offered[0].blob.type, "application/pdf"); assert.equal(h.offered[0].filename, "receipt-SYNTHETIC.pdf");
  assert.equal(h.op.getState().status, "download-offered"); assert.match(h.op.getState().message, /لا نستطيع تأكيد حفظ الملف/);
});
test("protected access denial removes the download action without re-exchanging or inferring nonexistence", async () => {
  for (const status of [401, 403, 404]) {
    const h = harness(path => path.endsWith("/download") ? Response.json({ message: "private" }, { status }) : Response.json(success()));
    h.op.capture(); await h.op.exchange(); await h.op.download(); assert.equal(h.op.getState().status, "denied"); assert.equal(h.op.getState().receiptUuid, undefined);
    await h.op.exchange(); await h.op.download(); assert.equal(h.calls.length, 2); assert.equal(h.offered.length, 0);
  }
});
test("download outage, throttling and invalid PDF permit only explicit protected GET retries", async () => {
  for (const failure of [() => Response.json({ message: "unavailable" }, { status: 503 }), () => Response.json({ message: "limited" }, { status: 429 }), () => new Response("HTML", { headers: pdfHeaders }), () => pdfResponse({ "Content-Type": "text/html" }), () => { throw new TypeError("network failure"); }]) {
    let downloadCount = 0;
    const h = harness(path => path.endsWith("/download") ? ++downloadCount === 1 ? failure() : pdfResponse() : Response.json(success()));
    h.op.capture(); await h.op.exchange(); await h.op.download(); assert.equal(h.op.getState().status, "download-error"); assert.equal(h.offered.length, 0);
    await h.op.exchange(); assert.equal(h.calls.length, 2); await h.op.download(); assert.equal(h.offered.length, 1); assert.equal(h.calls.filter(c => c.method === "POST").length, 1);
  }
});
test("PDF validation requires private/no-store attachment headers, signature and bounded size", async () => {
  assert.equal((await readPrivatePdf(pdfResponse())).filename, "receipt-SYNTHETIC.pdf");
  for (const changes of [{ "Cache-Control": "public" }, { "Content-Disposition": "inline" }, { Pragma: "" }, { "Content-Length": String(MAX_RECEIPT_BYTES + 1) }]) await assert.rejects(readPrivatePdf(pdfResponse(changes)));
  assert.equal((await readPrivatePdf(pdfResponse({ "Content-Disposition": 'attachment; filename="../../unsafe.pdf"' }))).filename, "receipt.pdf");
  const huge = new Response(new Uint8Array(MAX_RECEIPT_BYTES + 1), { headers: pdfHeaders }); await assert.rejects(readPrivatePdf(huge));
});
test("PDF object URLs are revoked after dispatch, replacement, failed click and unmount disposal", async () => {
  const events = [];
  let count = 0;
  const offer = createPdfOffer({ create: () => `blob:synthetic-${++count}`, revoke: url => events.push(["revoke", url]), click: (url, filename) => events.push(["click", url, filename]) }, 10);
  offer.offer(new Blob(["test"]), "receipt.pdf"); offer.offer(new Blob(["test"]), "receipt.pdf");
  assert.ok(events.some(e => e[0] === "revoke" && e[1] === "blob:synthetic-1"));
  await new Promise(resolve => setTimeout(resolve, 15)); assert.ok(events.some(e => e[0] === "revoke" && e[1] === "blob:synthetic-2"));
  offer.offer(new Blob(["test"]), "receipt.pdf"); offer.dispose(); assert.ok(events.some(e => e[0] === "revoke" && e[1] === "blob:synthetic-3"));
  let revoked = false;
  const failed = createPdfOffer({ create: () => "blob:failed", revoke: () => { revoked = true; }, click() { throw new Error("Synthetic browser failure"); } });
  assert.throws(() => failed.offer(new Blob(), "receipt.pdf")); assert.equal(revoked, true);
});
test("unmount disposal clears pending authority, aborts work and suppresses late PDF/state delivery", async () => {
  const h = harness(); h.op.capture(); h.op.dispose(); await h.op.exchange(); assert.equal(h.calls.length, 0); assert.equal(h.op.getState().receiptUuid, undefined);
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const pending = harness(async () => { await wait; return Response.json(success()); });
  pending.op.capture(); const run = pending.op.exchange(); pending.op.dispose(); assert.equal(pending.calls[0].signal.aborted, true); release(); await run;
  assert.equal(pending.op.getState().status, "missing"); assert.equal(pending.offered.length, 0);
});
test("loopback recovery exchange and PDF require simulated scope/capability cookies and reject replay/cross-receipt access", async () => {
  let used = false; const calls = [];
  const server = createServer(async (req, res) => {
    let raw = ""; for await (const chunk of req) raw += chunk;
    calls.push({ path: req.url, method: req.method });
    if (req.url === "/api/donation-receipts/recovery-exchanges" && req.method === "POST" && !used && JSON.stringify(JSON.parse(raw)) === JSON.stringify({ token_id: token, secret })) {
      used = true; res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store", "Set-Cookie": ["synthetic_scope=bound; HttpOnly; Secure; SameSite=Strict; Path=/api/donation-receipts", "synthetic_cap=authorized; HttpOnly; Secure; SameSite=Strict; Path=/api/donation-receipts"] }); res.end(JSON.stringify(success())); return;
    }
    if (req.url === protectedReceiptPath(uuid) && req.method === "GET" && req.headers.cookie?.includes("synthetic_scope=bound") && req.headers.cookie?.includes("synthetic_cap=authorized")) { res.writeHead(200, pdfHeaders); res.end("%PDF-1.7\nsynthetic\n%%EOF"); return; }
    res.writeHead(404, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify({ message: "Receipt unavailable." }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`; let cookies = ""; const offered = [];
    // Test-only browser simulation; production never reads Set-Cookie or writes Cookie.
    const browser = async (path, options) => {
      assert.equal(options.credentials, "same-origin"); assert.ok(path.startsWith("/api/donation-receipts/"));
      const response = await fetch(new URL(path, origin), { ...options, headers: { ...options.headers, ...(cookies ? { Cookie: cookies } : {}) } });
      if (response.headers.getSetCookie().length) cookies = response.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
      return response;
    };
    const operation = createRecoveryOperation({ browser: { read: () => fragment, clear() {} }, fetch: browser, offerPdf: blob => offered.push(blob) });
    operation.capture(); assert.equal(calls.length, 0); await operation.exchange(); assert.equal(operation.getState().receiptUuid, uuid);
    await operation.download(); assert.equal(offered.length, 1);
    assert.deepEqual(calls.slice(0, 2), [{ path: "/api/donation-receipts/recovery-exchanges", method: "POST" }, { path: protectedReceiptPath(uuid), method: "GET" }]);
    assert.equal((await fetch(origin + protectedReceiptPath(uuid))).status, 404);
    assert.equal((await fetch(origin + protectedReceiptPath(uuid), { headers: { Cookie: "synthetic_scope=wrong; synthetic_cap=authorized" } })).status, 404);
    assert.equal((await browser(protectedReceiptPath(token), { credentials: "same-origin", method: "GET" })).status, 404);
    assert.equal((await browser("/api/donation-receipts/recovery-exchanges", { credentials: "same-origin", method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token_id: token, secret }) })).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
