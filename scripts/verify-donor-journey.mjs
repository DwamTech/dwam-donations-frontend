// Isolated HTTPS Next.js + synthetic HTTP upstream. Never connects to Laravel/MySQL/Paymob/SMTP.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { fixturePage } from '../tests/fixture.mjs';

const root = path.resolve(import.meta.dirname, '..');
const sandbox = path.join(root, '..', '.tmp', `donor-ux-${Date.now()}`);
fs.mkdirSync(sandbox, { recursive: true });
for (const entry of ['src', 'public', 'tsconfig.json', 'next-env.d.ts', 'package.json', 'package-lock.json', 'next.config.ts', 'postcss.config.mjs']) {
  if (fs.existsSync(path.join(root, entry))) fs.cpSync(path.join(root, entry), path.join(sandbox, entry), { recursive: true });
}
fs.symlinkSync(path.join(root, 'node_modules'), path.join(sandbox, 'node_modules'), 'junction');
fs.writeFileSync(path.join(sandbox, 'public', 'synthetic-cover.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#dfe6d9"/></svg>');
const evidence = path.join(root, 'docs', 'donor-ux-01');
fs.mkdirSync(evidence, { recursive: true });
const guestReceiptEvidence = path.join(root, 'docs', 'guest-receipt-01');
fs.mkdirSync(guestReceiptEvidence, { recursive: true });
const port = 3047, origin = `https://localhost:${port}`;
const profile = { id: 101, name: 'متبرع اختباري', email: 'owner@example.test' };
const uuid = '11111111-1111-4111-8111-111111111111';
const project = { ...fixturePage().data[0], id: 1, reference: 'PROJECT-TEST', title: 'مشروع مياه اختباري', cover_image: null };
let expired = false, emptyHistory = false, counter = 9000, resumeState = 'requires_review';
const requests = [], creations = new Map();
const sample = (id, status, payment, receipts = []) => ({ id, reference: `DON-SYNTHETIC${id}`, amount_minor: 1234, amount_minor_exact: '1234', currency: 'EGP', status, reservation_state: status === 'confirmed' ? 'converted' : 'active', created_at: '2026-10-27T10:00:00Z', payment_status: payment, refunded_amount_minor: status === 'confirmed' ? '200' : '0', project: { id: 1, title: project.title, cover_image: { url: '/synthetic-cover.svg', caption: 'صورة المشروع' } }, receipts });
const rows = [sample(1001, 'initiated', 'paid'), sample(1002, 'confirmed', 'paid', [{ uuid, number: 'DR-SYNTHETIC-1', issued_at: '2026-10-27T10:00:00Z', generation_status: 'ready' }]), sample(1003, 'confirmed', 'paid', [{ uuid: '22222222-2222-4222-8222-222222222222', number: 'DR-SYNTHETIC-2', issued_at: '2026-10-27T10:00:00Z', generation_status: 'pending' }, { uuid: '33333333-3333-4333-8333-333333333333', number: 'DR-UNISSUED', issued_at: null, generation_status: 'pending' }])];
function withDecision(row) { return { ...row, checkout: { state: row.id === 1001 ? resumeState : 'completed', can_resume: row.id === 1001 && resumeState === 'resumable', can_start_new: row.id === 1001 && resumeState === 'expired' } }; }
function json(res, value, status = 200, headers = {}) { res.writeHead(status, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(value)); }
const upstream = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost'); const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    const owned = req.headers.authorization === 'Bearer 1|synthetic_donor';
    requests.push({ path: url.pathname, method: req.method, owned, key: req.headers['idempotency-key'], body });
    if (url.pathname.startsWith('/api/donor/') || url.pathname.includes('donation-receipts')) assert.equal(req.headers.origin, undefined, 'Donor BFF must keep Laravel on stateless bearer auth');
    if (url.pathname === '/api/donation-projects') { const page = fixturePage(); page.data = [project]; page.meta.last_page = 1; page.meta.total = 1; return json(res, page); }
    if (url.pathname === '/api/donation-projects/1') return json(res, { data: project });
    if (/^\/api\/donation-projects\/1\/updates/.test(url.pathname)) return json(res, { data: [], meta: { current_page: 1, last_page: 1 } });
    if (url.pathname === '/api/donor/session') return json(res, { data: profile, token: '1|synthetic_donor' });
    if (url.pathname === '/api/donor/profile') return owned && !expired ? json(res, { data: profile }) : json(res, { message: 'Unauthenticated.' }, 401);
    if (url.pathname === '/api/donor/contributions') return owned && !expired ? json(res, { data: emptyHistory ? [] : rows.map(withDecision), meta: { current_page: 1, last_page: 1 } }) : json(res, { message: 'Unauthenticated.' }, 401);
    if (/^\/api\/donor\/contributions\//.test(url.pathname)) return owned && !expired ? json(res, { data: withDecision(rows.find(r => r.id === Number(url.pathname.split('/').at(-1)))), checkout_review: url.pathname.endsWith('/1001') ? { stage: 'checkout', can_continue: resumeState === 'resumable', billing: { first_name: 'Saved', last_name: 'Payer', phone_number: '+201001234567', email: 'saved@example.test', street: 'Saved Street', building: '12', floor: '2', apartment: '3', city: 'Cairo', state: 'Cairo', country: 'EG' } } : null }) : json(res, {}, 401);
    if (url.pathname === '/api/donor/donations/1001/checkout') return owned && !expired && resumeState === 'resumable' ? json(res, { data: { checkout_url: 'https://checkout.example.test/synthetic', expires_at: new Date(Date.now() + 600000).toISOString() } }) : json(res, { message: 'Review required.' }, 409);
    if (url.pathname === `/api/donation-receipts/${uuid}/download`) {
      if (!owned || expired) return json(res, { message: 'Unauthenticated.' }, 401);
      res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="receipt-DR-SYNTHETIC-1.pdf"' }); return res.end('%PDF-1.4\nSynthetic test bytes only.');
    }
    const isOwned = url.pathname.startsWith('/api/donor/donations');
    if (/^\/api\/(?:donor\/)?donations/.test(url.pathname)) {
      if (isOwned && (!owned || expired)) return json(res, { message: 'Unauthenticated.' }, 401);
      if (url.pathname === (isOwned ? '/api/donor/donations' : '/api/donations')) {
        if (isOwned) assert.deepEqual(Object.keys(body).sort(), ['amount', 'donation_project_id', 'is_public_anonymous']);
        const key = req.headers['idempotency-key']; let record = creations.get(key);
        if (!record) { record = sample(++counter, 'initiated', null); record.reservation_state = 'none'; record.is_general = false; record.is_public_anonymous = false; record.project.reference = project.reference; creations.set(key, record); }
        return json(res, { data: record }, 201, isOwned ? {} : { 'Set-Cookie': 'donation_intent_scope=synthetic; Path=/api/donations; HttpOnly; SameSite=Strict; Secure' });
      }
      const record = [...creations.values()].find(r => String(r.id) === url.pathname.split('/')[4] || r.reference === url.pathname.split('/')[3]);
      assert(record, 'Unknown synthetic donation');
      if (!isOwned) assert.match(req.headers.cookie ?? '', /donation_intent_scope=synthetic/);
      if (url.pathname.endsWith('/reserve')) return json(res, { data: { reference: record.reference, status: 'initiated', reservation: { applicable: true, state: 'active', expires_at: new Date(Date.now() + 600000).toISOString() }, next_step: 'payment_not_initiated' } });
      if (url.pathname.endsWith('/payment')) return json(res, { data: { donation_reference: record.reference }, idempotent_replay: false }, 201);
      if (url.pathname.endsWith('/checkout')) return json(res, { data: { checkout_url: 'https://checkout.example.test/synthetic', expires_at: new Date(Date.now() + 600000).toISOString() } });
    }
    return json(res, { message: 'Not found in synthetic upstream' }, 404);
  } catch (error) { json(res, { message: 'Synthetic harness failed' }, 500); process.stderr.write(`${error.stack}\n`); }
});
upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
const upstreamPort = upstream.address().port;
const output = fs.openSync(path.join(sandbox, 'next-test.log'), 'w');
const server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--port', String(port), '--experimental-https', '--experimental-https-key', path.join(root, 'certificates/localhost-key.pem'), '--experimental-https-cert', path.join(root, 'certificates/localhost.pem')], {
  cwd: sandbox, windowsHide: true, stdio: ['ignore', output, output], env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', SITE_ORIGIN: origin, DONATIONS_BACKEND_ORIGIN: `http://127.0.0.1:${upstreamPort}`, DONOR_PORTAL_ENABLED: 'true', DONATIONS_API_BRIDGE_ENABLED: 'true', DONATIONS_MUTATIONS_ENABLED: 'true', DONATIONS_INTEGRATION_VERIFIED: 'true', DONATIONS_PAYMENT_RETURN_VERIFIED: 'true', DONATIONS_VERIFIED_RETURN_URL: `${origin}/payment-return`, DONATIONS_GATEWAY_CODE: 'synthetic', DONATIONS_CHECKOUT_HOSTS: 'checkout.example.test' },
});
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Copy/AppData/Local/Temp/donations-03a-browser/node_modules/playwright/index.js');
let browser;
const checks = [];
async function review(page, guest = false) {
  await page.locator('#guest-amount').fill('12.34');
  if (guest) { await page.locator('#guest-name').fill('Synthetic guest'); await page.locator('#guest-email').fill('guest@example.test'); }
  await page.locator('#guest-phone').fill('+201001234567');
  await page.getByRole('button', { name: 'متابعة إلى بيانات الفوترة ←', exact: true }).click();
  for (const [key, value] of Object.entries({ first_name: 'Synthetic', last_name: 'Payer', street: 'Test Street', building: '12', floor: '2', apartment: '3', city: 'Cairo', state: 'Cairo' })) await page.locator(`#billing-${key}`).fill(value);
  await page.locator('#billing-country').selectOption('EG');
  await page.getByRole('button', { name: 'مراجعة المبلغ والبيانات ←', exact: true }).click();
  await page.getByRole('button', { name: 'إرسال الطلب والمتابعة للدفع ←', exact: true }).waitFor();
}
try {
  let connected = false;
  for (let i = 0; i < 90; i++) {
    if (server.exitCode !== null) throw new Error(`Isolated Next server stopped; inspect ${sandbox}`);
    connected = await new Promise(resolve => { const req = https.get(`${origin}/api/donor/profile`, { rejectUnauthorized: false, timeout: 1000 }, r => { r.resume(); resolve(true); }); req.on('error', () => resolve(false)); req.on('timeout', () => { req.destroy(); resolve(false); }); });
    if (connected) break; await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert(connected, 'Isolated server not ready');
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  for (const width of [1440, 390]) {
    expired = false; resumeState = 'requires_review';
    const context = await browser.newContext({ viewport: { width, height: 1000 }, ignoreHTTPSErrors: true });
    await context.route('https://checkout.example.test/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic checkout transport only</h1>' }));
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    await page.goto(`${origin}/projects/1`);
    await page.locator('.contribution-link').waitFor();
    assert.equal(await page.locator('.contribution-link').getAttribute('href'), '/donate/1');
    await page.locator('.contribution-link').click(); await page.locator('#guest-amount').waitFor();
    assert(await page.getByText('أنت تتبرع كضيف.', { exact: false }).isVisible());
    await page.goto(`${origin}/account?next=${encodeURIComponent('/account/donate/1')}`);
    await page.locator('#donor-email').fill(profile.email); await page.locator('#donor-password').fill('SyntheticPassword123');
    await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
    await page.waitForURL('**/account/donate/1'); await page.locator('#guest-amount').waitFor();
    const cookie = (await context.cookies(`${origin}/api/donor/profile`)).find(c => c.name === 'donor_session');
    assert(cookie?.httpOnly && cookie.secure && cookie.path === '/api/donor');
    assert.equal(await page.locator('#guest-email').inputValue(), profile.email);
    await page.reload(); await page.locator('#guest-amount').waitFor();
    await page.goto(`${origin}/projects/1`); await page.waitForFunction(() => document.querySelector('.contribution-link')?.getAttribute('href') === '/account/donate/1');
    await page.locator('.contribution-link').click(); await page.locator('#guest-amount').waitFor();
    const offset = requests.length;
    await review(page); await page.getByRole('button', { name: 'إرسال الطلب والمتابعة للدفع ←', exact: true }).click();
    await page.waitForURL('https://checkout.example.test/synthetic');
    const writes = requests.slice(offset).filter(r => r.method === 'POST');
    assert.deepEqual(writes.map(r => r.path.replace(/\/\d+\//, '/ID/')), ['/api/donor/donations', '/api/donor/donations/ID/reserve', '/api/donor/donations/ID/payment', '/api/donor/donations/ID/checkout']);
    assert(writes.every(r => r.owned));
    await page.goto(`${origin}/account/contributions`); await page.getByRole('heading', { name: project.title, exact: true }).first().waitFor();
    assert.equal(await page.locator('h1').textContent(), 'تبرعاتي');
    assert(await page.getByText('لم يُؤكد التحصيل', { exact: true }).isVisible());
    assert(await page.getByText('تم التحصيل', { exact: true }).first().isVisible());
    assert(await page.locator('.donor-project-thumbnail img').first().isVisible());
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(evidence, `${width}-contributions.png`), fullPage: true });
    if (width === 390) { await page.locator('.mobile-menu>summary').click(); await page.locator('.mobile-menu .account-menu>summary').click(); await page.getByRole('navigation', { name: 'قائمة حسابي' }).filter({ visible: true }).getByRole('link', { name: 'إيصالاتي', exact: true }).click(); }
    else { await page.locator('.desktop-nav .account-menu>summary').click(); await page.locator('.desktop-nav .account-menu').getByRole('link', { name: 'إيصالاتي', exact: true }).click(); }
    await page.getByRole('heading', { name: 'إيصال DR-SYNTHETIC-1', exact: true }).waitFor();
    assert.equal(await page.locator('h1').textContent(), 'إيصالاتي');
    assert.equal(await page.locator('.mobile-menu[open]').count(), 0);
    assert.equal(await page.getByText('DR-UNISSUED').count(), 0);
    assert(await page.getByText('الإيصال قيد التجهيز', { exact: true }).isVisible());
    const downloadPromise = page.waitForEvent('download'); await page.getByRole('link', { name: 'تنزيل PDF', exact: true }).click();
    const download = await downloadPromise; assert.equal(download.suggestedFilename(), 'receipt-DR-SYNTHETIC-1.pdf');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(evidence, `${width}-receipts.png`), fullPage: true });
    emptyHistory = true;
    await page.goto(`${origin}/account/receipts`); await page.getByRole('heading', { name: 'لا توجد إيصالات حتى الآن', exact: true }).waitFor();
    await page.goto(`${origin}/account/contributions`); await page.getByRole('heading', { name: 'رحلة عطائك تبدأ من هنا', exact: true }).waitFor();
    emptyHistory = false;
    await page.goto(`${origin}/account/contributions/1001`); await page.getByText('لم يُؤكد التحصيل', { exact: true }).waitFor();
    await page.getByRole('heading', { name: 'مراجعة ومتابعة الدفع', exact: true }).waitFor();
    assert(await page.getByText('saved@example.test', { exact: true }).isVisible());
    assert.equal(await page.getByRole('button', { name: 'متابعة نفس عملية الدفع ←', exact: true }).count(), 0);
    assert.equal(await page.getByRole('link', { name: 'تفاصيل التبرع ←', exact: true }).count(), 0);
    await page.getByRole('heading', { name: 'متابعة العملية', exact: true }).waitFor();
    const detailReload = page.waitForResponse(r => r.url().endsWith('/api/donor/contributions/1001') && r.status() === 200);
    await page.getByRole('button', { name: 'تحديث حالة التبرع', exact: true }).click(); await detailReload;
    await page.getByRole('heading', { name: 'متابعة العملية', exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(evidence, `${width}-details.png`), fullPage: true });
    assert.equal(await page.getByRole('button', { name: 'استكمال الدفع', exact: true }).count(), 0);
    assert(await page.getByText('تحتاج مراجعة لدى بوابة الدفع أو مراجعة مالية', { exact: true }).isVisible());
    await page.screenshot({ path: path.join(evidence, `${width}-resume-review.png`), fullPage: true });
    resumeState = 'expired';
    await page.reload(); await page.getByRole('link', { name: 'بدء تبرع جديد مستقل', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'استكمال الدفع', exact: true }).count(), 0);
    resumeState = 'resumable';
    await page.goto(`${origin}/account/contributions`);
    await page.getByRole('link', { name: 'مراجعة واستكمال الدفع ←', exact: true }).click();
    await page.getByRole('button', { name: 'استكمال الدفع', exact: true }).waitFor();
    await page.screenshot({ path: path.join(evidence, `${width}-resume-safe.png`), fullPage: true });
    const resumeOffset = requests.length, oldCreations = creations.size;
    await page.getByRole('button', { name: 'استكمال الدفع', exact: true }).click();
    await page.waitForURL('https://checkout.example.test/synthetic');
    assert.deepEqual(requests.slice(resumeOffset).filter(r => r.method === 'POST').map(r => r.path), ['/api/donor/donations/1001/checkout']);
    assert.equal(creations.size, oldCreations);
    await page.goto(`${origin}/donate/1`); await page.waitForURL('**/account/donate/1'); await page.locator('#guest-amount').waitFor();
    await review(page); expired = true; const beforeExpiry = requests.filter(r => r.method === 'POST').length;
    await page.getByRole('button', { name: 'إرسال الطلب والمتابعة للدفع ←', exact: true }).click();
    await page.getByRole('link', { name: 'تسجيل الدخول للمتابعة', exact: true }).waitFor();
    assert.equal(requests.filter(r => r.method === 'POST').length, beforeExpiry);
    await page.reload(); await page.getByRole('link', { name: 'تسجيل الدخول للمتابعة', exact: true }).waitFor();
    assert.equal(await page.locator('#guest-amount').count(), 0);
    checks.push({ width, guest_entry: true, actual_secure_session_cookie: true, refresh: true, public_cta_owned: true, owned_four_stage_transport: true, history: true, protected_receipt_pdf: true, pending_receipt: true, empty_history_and_receipts: true, mobile_desktop_navigation: true, expired_session_no_guest_fallback: true });
    await page.goto(`${origin}/receipts/recover`);
    await page.getByRole('heading', { name: 'أين أجد رقم الإيصال؟', exact: true }).waitFor();
    assert((await page.getByLabel('العثور على رقم الإيصال').textContent()).includes('Spam'));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: path.join(guestReceiptEvidence, `${width}-recovery.png`), fullPage: true });
    await context.close();
  }
  expired = false;
  const guestContext = await browser.newContext({ ignoreHTTPSErrors: true });
  await guestContext.route('https://checkout.example.test/**', r => r.fulfill({ body: 'Synthetic guest checkout' }));
  const guestPage = await guestContext.newPage(); await guestPage.goto(`${origin}/donate/1`); await guestPage.locator('#guest-amount').waitFor();
  const offset = requests.length; await review(guestPage, true); await guestPage.getByRole('button', { name: 'إرسال الطلب والمتابعة للدفع ←', exact: true }).click();
  await guestPage.waitForURL('https://checkout.example.test/synthetic');
  const guestWrites = requests.slice(offset).filter(r => r.method === 'POST'); assert.equal(guestWrites.length, 4); assert(guestWrites.every(r => r.path.startsWith('/api/donations') && !r.owned));
  await guestPage.goto(`${origin}/payment-return?success=true`); assert.equal(requests.slice(offset).filter(r => r.method === 'POST').length, 4);
  await guestContext.close();
  fs.writeFileSync(path.join(evidence, 'browser-results.json'), JSON.stringify({ isolated: true, origin, upstream: 'synthetic loopback HTTP; no Laravel/MySQL/Paymob/SMTP', checks, guest_four_stage_checkout: true, neutral_return_no_mutation: true }, null, 2));
  console.log(`PASS: isolated HTTPS donor journey at Desktop/Mobile, owned and guest transport, receipts and expiry. Evidence: ${evidence}`);
} finally {
  await browser?.close();
  server.kill(); upstream.closeAllConnections(); await new Promise(resolve => upstream.close(resolve)); fs.closeSync(output);
}
