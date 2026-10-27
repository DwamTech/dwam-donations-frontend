// A separate donor authority: guest and Dashboard cookies are never forwarded.
const cookieName = 'donor_session';
async function readBounded(stream: ReadableStream<Uint8Array> | null, maximum: number) {
  const reader = stream?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  if (reader) { try { while (true) { const c = await reader.read(); if (c.done) break; size += c.value.length; if (size > maximum) { await reader.cancel(); throw Error('Response limit'); } chunks.push(c.value); } } finally { reader.releaseLock(); } }
  return Buffer.concat(chunks);
}
const fail = (status: number) => Response.json({ message: status === 401 ? 'Authentication required.' : 'Donor service unavailable.' }, { status, headers: { 'Cache-Control': 'private, no-store', Pragma: 'no-cache' } });
export async function donorBridge(request: Request, dependencies: { env?: Record<string, string | undefined>; fetch?: typeof fetch } = {}) {
  const env = dependencies.env ?? process.env;
  const url = new URL(request.url);
  const login = url.pathname === '/api/donor/session' && request.method === 'POST';
  const registration = url.pathname === '/api/donor/registration' && request.method === 'POST';
  const sessionEntry = login || registration;
  const logout = url.pathname === '/api/donor/logout' && request.method === 'POST';
  const read = request.method === 'GET' && /^\/api\/donor\/(?:profile|contributions(?:\/[1-9][0-9]{0,18})?)$/.test(url.pathname);
  const write = request.method === 'POST' && /^\/api\/donor\/donations(?:\/[1-9][0-9]{0,18}\/(?:reserve|payment|checkout|cancel))?$/.test(url.pathname);
  const download = request.method === 'GET' && /^\/api\/donor\/receipts\/[a-f0-9-]{36}$/.test(url.pathname);
  const validPage = url.pathname === '/api/donor/contributions' && request.method === 'GET'
    && [...url.searchParams.keys()].length === 1 && /^[1-9][0-9]{0,3}$/.test(url.searchParams.get('page') ?? '');
  if (!(sessionEntry || logout || read || write || download) || (url.search && !validPage)) return fail(404);
  if (env.DONOR_PORTAL_ENABLED !== 'true' || env.DONATIONS_API_BRIDGE_ENABLED !== 'true' || (write && env.DONATIONS_MUTATIONS_ENABLED !== 'true')) return fail(503);
  let origin: URL, backend: URL;
  try {
    origin = new URL(env.SITE_ORIGIN ?? ''); backend = new URL(env.DONATIONS_BACKEND_ORIGIN ?? '');
    for (const u of [origin, backend]) if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.pathname !== '/' || u.search || u.hash || (env.NODE_ENV === 'production' && u.protocol !== 'https:')) throw Error();
  } catch { return fail(503); }
  const site = request.headers.get('Sec-Fetch-Site');
  if ((request.method === 'POST' && request.headers.get('Origin') !== origin.origin) || (request.headers.has('Origin') && request.headers.get('Origin') !== origin.origin) || (site && site !== 'same-origin')) return fail(403);
  const token = (request.headers.get('Cookie') ?? '').split(';').map(c => c.trim()).find(c => c.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if (!sessionEntry && (!token || !/^[A-Za-z0-9%|_-]{1,4096}$/.test(token))) return fail(401);
  // Laravel receives a stateless server request. Browser CSRF is enforced above;
  // forwarding Origin would incorrectly select Sanctum's cookie/CSRF session flow.
  const headers = new Headers({ Accept: download ? 'application/pdf' : 'application/json' });
  if (!sessionEntry) headers.set('Authorization', 'Bearer '+decodeURIComponent(token!));
  let body: string | undefined;
  if (request.method === 'POST') {
    if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return fail(415);
    try {
      const reader = request.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      if (reader) { try { while (true) { const c = await reader.read(); if (c.done) break; size += c.value.length; if (size > 24576) { await reader.cancel(); return fail(413); } chunks.push(c.value); } } finally { reader.releaseLock(); } }
      body = Buffer.concat(chunks).toString('utf8'); JSON.parse(body);
    } catch { return fail(422); }
    headers.set('Content-Type', 'application/json');
    const key = request.headers.get('Idempotency-Key');
    if (key) { if (!/^[a-f0-9-]{36}$/i.test(key)) return fail(422); headers.set('Idempotency-Key', key); }
  }
  const upstream = download ? '/api/donation-receipts/'+url.pathname.split('/').at(-1)+'/download' : url.pathname + url.search;
  try {
    const r = await (dependencies.fetch ?? fetch)(backend.origin+upstream, { method: request.method, headers, body, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(35000) });
    if (r.status >= 500) { await r.body?.cancel(); return fail(r.status); }
    const outgoing = new Headers({ 'Cache-Control': 'private, no-store, max-age=0', Pragma: 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    const cookie = (value: string, age: number) => `${cookieName}=${value}; Path=/api/donor; HttpOnly; SameSite=Strict; Max-Age=${age}${origin.protocol === 'https:' ? '; Secure' : ''}`;
    if (download && r.ok) {
      if (r.headers.get('Content-Type')?.split(';')[0] !== 'application/pdf') return fail(503);
      const disposition = r.headers.get('Content-Disposition') ?? '';
      if (!/^attachment; filename="receipt-[A-Za-z0-9._-]+\.pdf"$/.test(disposition)) return fail(503);
      outgoing.set('Content-Type', 'application/pdf'); outgoing.set('Content-Disposition', disposition);
      const bytes = await readBounded(r.body, 20 * 1024 * 1024);
      if (bytes.subarray(0, 5).toString() !== '%PDF-') return fail(503);
      return new Response(bytes, { status: r.status, headers: outgoing });
    }
    if (r.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return fail(503);
    const value = JSON.parse((await readBounded(r.body, 1024 * 1024)).toString('utf8'));
    if (sessionEntry && r.ok) {
      if (typeof value.token !== 'string' || !/^[A-Za-z0-9|_-]{1,4096}$/.test(value.token) || !value.data || typeof value.data.name !== 'string') return fail(503);
      outgoing.append('Set-Cookie', cookie(encodeURIComponent(value.token), 7200));
      return Response.json({ data: value.data }, { status: r.status, headers: outgoing });
    }
    if (logout && r.ok) outgoing.append('Set-Cookie', cookie('', 0));
    if (r.status === 401) outgoing.append('Set-Cookie', cookie('', 0));
    return Response.json(value, { status: r.status, headers: outgoing });
  } catch { return fail(503); }
}
