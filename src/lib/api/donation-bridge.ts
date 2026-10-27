/** Exact same-origin BFF. No caller-controlled upstream URL or credential forwarding. */
const mutation = /^\/api\/donations(?:\/DON-[A-Z0-9]{1,100}\/(?:reserve|payment|checkout|cancel))?$/;
const recovery = /^\/api\/donation-receipts\/recovery-(?:requests|exchanges)$/;
const download = /^\/api\/donation-receipts\/[a-f0-9-]{36}\/download$/i;
const cookieName = /^(?:donation_intent_scope|donation_receipt_scope|donation_(?:reservation|cancel|payment|checkout|receipt)_\d+)$/;
const failure = (status: number) => Response.json({ message: "Donation service is unavailable." }, { status, headers: { "Cache-Control": "no-store" } });

async function bounded(body: ReadableStream<Uint8Array> | null, maximum: number) {
  if (!body) return new Uint8Array();
  const reader = body.getReader(); const parts: Uint8Array[] = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > maximum) throw new Error("Body limit"); parts.push(value); } }
  catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; } return bytes;
}

export async function donationBridge(request: Request, dependencies: { env?: Record<string, string | undefined>; fetch?: typeof fetch } = {}) {
  const env = dependencies.env ?? process.env;
  const url = new URL(request.url); const path = url.pathname;
  const isDownload = request.method === "GET" && download.test(path);
  const isMutation = request.method === "POST" && (mutation.test(path) || recovery.test(path));
  if (url.search || (!isDownload && !isMutation)) return failure(404);
  if ((mutation.test(path) && env.DONATIONS_MUTATIONS_ENABLED !== "true") || env.DONATIONS_API_BRIDGE_ENABLED !== "true") return failure(503);
  let origin: URL, backend: URL;
  try {
    origin = new URL(env.SITE_ORIGIN ?? ""); backend = new URL(env.DONATIONS_BACKEND_ORIGIN ?? "");
    for (const value of [origin, backend]) if (value.username || value.password || value.pathname !== "/" || value.search || value.hash || !["http:", "https:"].includes(value.protocol) || (env.NODE_ENV === "production" && value.protocol !== "https:")) throw new Error("Origin configuration");
  } catch { return failure(503); }
  const site = request.headers.get("Sec-Fetch-Site");
  if ((isMutation && request.headers.get("Origin") !== origin.origin) || (site && site !== "same-origin") || (request.headers.has("Origin") && request.headers.get("Origin") !== origin.origin)) return failure(403);
  if (isMutation && request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") return failure(415);
  const cookies = (request.headers.get("Cookie") ?? "").split(";").map(value => value.trim()).filter(value => cookieName.test(value.split("=", 1)[0] ?? "")).join("; ");
  if (cookies.length > 16000) return failure(431);
  const headers = new Headers({ Accept: isDownload ? "application/pdf" : "application/json", Origin: origin.origin });
  if (cookies) headers.set("Cookie", cookies);
  if (isMutation) headers.set("Content-Type", "application/json");
  const key = request.headers.get("Idempotency-Key");
  if (key) { if (!/^[a-f0-9-]{36}$/i.test(key)) return failure(422); headers.set("Idempotency-Key", key); }
  let body: Uint8Array | undefined;
  try { if (isMutation) { body = await bounded(request.body, 24576); JSON.parse(new TextDecoder().decode(body)); } } catch { return failure(413); }
  try {
    const response = await (dependencies.fetch ?? fetch)(backend.origin + path, { method: request.method, headers, body: body as BodyInit | undefined, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(35000) });
    if (response.status >= 500) { await response.body?.cancel(); return failure(response.status); }
    const type = response.headers.get("Content-Type")?.split(";")[0].toLowerCase();
    if (type !== "application/json" && !(isDownload && response.ok && type === "application/pdf")) return failure(503);
    const bytes = await bounded(response.body, isDownload ? 20 * 1024 * 1024 : 1024 * 1024);
    const outgoing = new Headers({ "Content-Type": response.headers.get("Content-Type")!, "Cache-Control": "private, no-store, max-age=0", "Pragma": "no-cache", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
    const retryAfter = response.headers.get("Retry-After");
    if (retryAfter && /^\d{1,6}$/.test(retryAfter)) outgoing.set("Retry-After", retryAfter);
    if (isDownload && response.ok) {
      const disposition = response.headers.get("Content-Disposition");
      if (!disposition || !/^attachment; filename="receipt-[A-Za-z0-9._-]+\.pdf"$/.test(disposition) || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return failure(503);
      outgoing.set("Content-Disposition", disposition);
    }
    for (const cookie of response.headers.getSetCookie()) {
      const name = cookie.slice(0, cookie.indexOf("="));
      if (!cookieName.test(name) || /;\s*domain=/i.test(cookie) || !/;\s*httponly(?:;|$)/i.test(cookie)) continue;
      // The browser uses the configured site origin, even when Laravel is an HTTP loopback hop.
      outgoing.append("Set-Cookie", origin.protocol === "https:" && !/;\s*secure(?:;|$)/i.test(cookie) ? `${cookie}; Secure` : cookie);
    }
    return new Response(bytes, { status: response.status, headers: outgoing });
  } catch { return failure(503); }
}
