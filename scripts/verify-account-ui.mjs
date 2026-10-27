import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Copy/AppData/Local/Temp/donations-03a-browser/node_modules/playwright/index.js');
const origin = process.env.ACCOUNT_UI_ORIGIN || 'https://localhost:3000';
const evidence = path.resolve('.next/qa-account');
fs.mkdirSync(evidence, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const checks = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const profileResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/api/donor/profile');
    await page.goto(origin + '/account', { waitUntil: 'domcontentloaded' });
    await profileResponse;
    await page.getByLabel('البريد الإلكتروني', { exact: true }).waitFor();
    assert.equal(await page.locator('.donor-login-error').count(), 0);
    assert.equal(await page.getByText('تعذر تحديث بيانات الحساب. يرجى المحاولة لاحقًا.', { exact: true }).count(), 0);
    assert(await page.getByRole('heading', { name: 'أول زيارة لك؟' }).isVisible());
    const email = await page.locator('#donor-email').boundingBox();
    assert(email.height >= 48 && email.width >= 250);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: path.join(evidence, `${width}-account.png`), fullPage: true });
    await page.locator('#donor-password').fill('synthetic-input');
    await page.getByRole('button', { name: 'إظهار', exact: true }).click();
    assert.equal(await page.locator('#donor-password').getAttribute('type'), 'text');
    await page.getByRole('button', { name: 'إخفاء', exact: true }).click();
    assert.equal(await page.locator('#donor-password').getAttribute('type'), 'password');
    // UI error handling only; never submit test credentials to the human application.
    await page.route('**/api/donor/session', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Controlled UI outage"}' }));
    await page.locator('#donor-email').fill('synthetic@example.test');
    await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
    await page.locator('.donor-login-error[role=alert]').waitFor();
    await page.getByRole('button', { name: 'أنشئ حسابًا', exact: true }).click();
    await page.getByRole('heading', { name: 'إنشاء حساب', exact: true }).waitFor();
    assert.equal(await page.locator('.donor-login-error').count(), 0);
    let registered = false, registrationCalls = 0;
    await page.route('**/api/donor/profile', route => route.fulfill({ status: registered ? 200 : 401, contentType: 'application/json', body: JSON.stringify(registered ? { data: { id: 101, name: 'متبرع جديد', email: 'new@example.test' } } : {}) }));
    await page.route('**/api/donor/contributions', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [], meta: { current_page: 1, last_page: 1 } }) }));
    await page.route('**/api/donor/registration', route => {
      registrationCalls++;
      assert.deepEqual(Object.keys(route.request().postDataJSON()).sort(), ['email', 'name', 'password', 'password_confirmation']);
      registered = true;
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { id: 101, name: 'متبرع جديد', email: 'new@example.test' } }) });
    });
    await page.locator('#donor-name').fill('متبرع جديد');
    await page.locator('#donor-email').fill('new@example.test');
    await page.locator('#donor-password').fill('SyntheticPassword123');
    await page.locator('#donor-password-confirmation').fill('DifferentPassword123');
    await page.getByRole('button', { name: 'إنشاء حساب', exact: true }).click();
    await page.getByText('كلمتا المرور غير متطابقتين.', { exact: true }).waitFor();
    assert.equal(registrationCalls, 0);
    await page.locator('#donor-password-confirmation').fill('SyntheticPassword123');
    await page.screenshot({ path: path.join(evidence, `${width}-registration.png`), fullPage: true });
    await page.getByRole('button', { name: 'إنشاء حساب', exact: true }).click();
    await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).waitFor();
    assert.equal(registrationCalls, 1);
    await page.getByRole('heading', { name: 'رحلة عطائك تبدأ من هنا' }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: path.join(evidence, `${width}-dashboard-empty.png`), fullPage: true });
    await page.route('**/api/donor/contributions', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ id: 1, reference: 'DON-SYNTHETIC-001', created_at: '2026-10-27T10:00:00Z', amount_minor: 1234, amount_minor_exact: '1234', currency: 'EGP', status: 'confirmed', payment_status: 'paid', refunded_amount_minor: '0', project: { title: 'دعم التعليم وبناء مستقبل أفضل للأطفال' }, receipts: [{ uuid: '00000000-0000-4000-8000-000000000001', number: 'DR-2026-0001', issued_at: '2026-10-27T10:00:00Z', generation_status: 'ready' }] }], meta: { current_page: 1, last_page: 1 } }) }));
    await page.getByRole('button', { name: 'تحديث السجل', exact: true }).click();
    await page.getByText('DON-SYNTHETIC-001', { exact: true }).waitFor();
    assert(await page.getByRole('link', { name: 'تنزيل PDF', exact: true }).isVisible());
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: path.join(evidence, `${width}-dashboard-history.png`), fullPage: true });
    checks.push({ width, anonymousWithoutError: true, visibleFields: true, noHorizontalOverflow: true, passwordToggle: true, explicitLoginFailureVisible: true, inlineRegistration: true, passwordConfirmation: true, registrationUiSuccess: true, dashboardEmptyState: true, contributionAndReceiptLayout: true });
    await context.close();
  }
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.route('**/api/donor/profile', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { id: 102, name: 'متبرع تجريبي', email: 'synthetic@example.test' } }) }));
  await page.route('**/api/donor/contributions', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto(origin + '/account', { waitUntil: 'domcontentloaded' });
  await page.getByText('تعذر تحميل السجل. أعد المحاولة؛ لم يتم تأكيد أي تغيير في تبرعاتك.', { exact: true }).waitFor();
  checks.push({ authenticatedHistoryFailureVisible: true });
  await context.close();
  fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify(checks, null, 2));
  console.log(JSON.stringify({ passed: true, checks }));
} finally {
  await browser.close();
}
