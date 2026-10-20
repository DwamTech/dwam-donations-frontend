import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import ts from "typescript";
import { resolve, sep } from "node:path";
import { fixturePage, fixtureDetail } from "../tests/fixture.mjs";
function matches(html, pattern) { assert.ok(pattern.test(html.replace(/<!--.*?-->/gs, "")), `Missing expected HTML/text: ${pattern}`); }
const development = process.argv.includes("--dev");
// A temporary source snapshot avoids contending with a user's running next dev.
// It has no environment files and shares installed dependencies without installing anything.
let qaDirectory;
if (development) {
  await mkdir(".next", { recursive: true });
  qaDirectory = await mkdtemp(resolve(".next/qa-source-"));
  for (const name of ["src", "public", "package.json", "package-lock.json", "tsconfig.json", "postcss.config.mjs"]) {
    await cp(name, resolve(qaDirectory, name), { recursive: true });
  }
  await symlink(resolve("node_modules"), resolve(qaDirectory, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  // Exercise the real header configuration, changing only the isolated dev root.
  const configSource = ts.transpileModule(await readFile("next.config.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const isolatedConfig = configSource.replace("export default nextConfig;", `export default { ...nextConfig, turbopack: { ...nextConfig.turbopack, root: ${JSON.stringify(process.cwd())} } };`);
  assert.notEqual(isolatedConfig, configSource, "The isolated config must retain real config with the QA root override");
  await writeFile(resolve(qaDirectory, "next.config.mjs"), isolatedConfig);
}
let mode = "success";
let detailMode = "ready";
const requests = [];
const upstreamMethods = [];
const backend = createServer((req, res) => {
  requests.push(req.url);
  upstreamMethods.push(req.method);
  res.setHeader("Content-Type", "application/json");
  const path = new URL(req.url, "http://localhost").pathname;
  if (/^\/api\/donation-projects\/\d+$/.test(path)) {
    if (path.endsWith("/404") || path.endsWith("/405")) { res.statusCode = 404; res.end('{}'); return; }
    if (detailMode === "failure") { res.statusCode = 503; res.end('{}'); return; }
    if (detailMode === "malformed") { res.end('{"data":{"id":1}}'); return; }
    if (detailMode === "timeout") {
      const timer = setTimeout(() => res.end(JSON.stringify({ data: fixtureDetail() })), 7500);
      res.once("close", () => clearTimeout(timer)); return;
    }
    const project = fixtureDetail();
    if (detailMode === "mismatch") project.id = 2;
    if (detailMode === "no-media") { project.cover_image = null; project.gallery_images = []; project.videos = []; }
    if (detailMode === "overfunded") project.progress_percent = 125;
    res.end(JSON.stringify({ data: project })); return;
  }
  if (mode === "failure") { res.statusCode = 503; res.end('{}'); return; }
  if (mode === "malformed") { res.end('{"data":[{}]}'); return; }
  const params = new URL(req.url, "http://localhost").searchParams;
  const page = fixturePage(Number(params.get("page") || 1));
  if (mode === "recent") page.data.push({ ...page.data[0], id: 2, uuid: "recent-two", title: "مشروع حديث آخر" });
  if (mode === "discovery") {
    const all = Array.from({ length: 18 }, (_, i) => ({ ...fixturePage().data[0],
      id: i + 1, uuid: `discovery-${i}`, title: `مشروع اكتشاف ${i + 1}`,
      country_code: i < 16 ? "EG" : "JO",
      category: { id: i < 14 || i >= 16 ? 3 : 4, name: i < 14 || i >= 16 ? "التعليم" : "المياه", slug: i < 14 || i >= 16 ? "education" : "water" },
    }));
    const matches = all.filter(project => (!params.has("country_code") || project.country_code === params.get("country_code"))
      && (!params.has("donation_project_category_id") || String(project.category.id) === params.get("donation_project_category_id")));
    const perPage = Number(params.get("per_page") || 15);
    const offset = (page.meta.current_page - 1) * perPage;
    page.data = matches.slice(offset, offset + perPage);
    page.meta.total = matches.length; page.meta.last_page = Math.max(1, Math.ceil(matches.length / perPage));
    page.meta.from = page.data.length ? offset + 1 : null; page.meta.to = page.data.length ? offset + page.data.length : null;
  }
  if (mode === "empty") { page.data = []; page.meta.total = 0; page.meta.last_page = 1; }
  if (mode === "overfunded") page.data[0].progress_percent = 125;
  res.end(JSON.stringify(page));
});
backend.listen(0, "127.0.0.1"); await once(backend, "listening");
const port = 3217;
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", development ? "dev" : "start", ...(development ? [qaDirectory] : []), "--port", String(port), "--hostname", "127.0.0.1"], {
  env: { ...process.env, DONATIONS_MUTATIONS_ENABLED: "false", NEXT_TELEMETRY_DISABLED: "1", DONATIONS_BACKEND_ORIGIN: `http://127.0.0.1:${backend.address().port}`, SITE_ORIGIN: `http://localhost:${port}`, LOCAL_PUBLIC_API_PROXY: "true" },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = ""; child.stdout.on("data", d => logs += d); child.stderr.on("data", d => logs += d);
async function get(path, options) { return fetch(`http://127.0.0.1:${port}${path}`, options); }
async function verifyNeutralReturn() {
  const before = requests.length;
  let baseline;
  const urls = [
    "/payment-return",
    "/payment-return?success=true",
    "/payment-return?success=false",
    "/payment-return?id=UNTRUSTED-TXN-7788&pending=false&amount_cents=1234&currency=EGP&order=UNTRUSTED-ORDER&hmac=UNTRUSTED-SIGNATURE&data.message=Approved",
    "/payment-return?unknown=UNTRUSTED-MARKER&reference=DON-UNTRUSTED123&success=true&success=false",
    "/payment-return?data.message=%3Cscript%3EUNTRUSTED-SCRIPT%3C%2Fscript%3E&email=UNTRUSTED-EMAIL%40example.test",
    "/payment-return?return_to=https%3A%2F%2Fevil.example.test%2FUNTRUSTED-REDIRECT&next=%2Fdonate%2F1",
    "/payment-return#success=true&reference=DON-UNTRUSTED123",
  ];
  for (const [index, path] of urls.entries()) {
    const response = await get(path, index === 2 ? { headers: { Cookie: "donation_intent_scope=synthetic; donation_payment_1=synthetic", "Sec-Fetch-Site": "cross-site" } } : undefined);
    const html = await response.text();
    assert.equal(response.status, 200); assert.equal(response.redirected, false);
    assert.equal(response.headers.get("location"), null);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    matches(html, /lang="ar"/); matches(html, /dir="rtl"/);
    matches(html, /<h1 id="payment-return-heading">العودة من صفحة الدفع<\/h1>/);
    matches(html, /رجوعك من بوابة الدفع لا يؤكد نجاح العملية أو فشلها/);
    matches(html, /بعد وصول إشعار الدفع الموثوق/);
    matches(html, /لا يعني أن رسالة بريد قد أُرسلت أو وصلت/);
    matches(html, /name="robots" content="noindex, nofollow"/);
    matches(html, /name="referrer" content="no-referrer"/);
    matches(html, /property="og:title" content="العودة من صفحة الدفع"/);
    matches(html, /href="\/projects">تصفح المشاريع المنشورة/);
    matches(html, /href="\/">العودة إلى الرئيسية/);
    // Next dev serializes request props into framework debug scripts, even when a
    // page never consumes them. Verify public markup there; production verifies
    // the complete response, including its serialized framework payload.
    const publicOutput = development ? html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "") : html;
    matches(html, /href="\/receipts\/recover"/);
    assert.doesNotMatch(publicOutput, /UNTRUSTED-|evil\.example\.test|تم التبرع بنجاح|تم الدفع بنجاح|فشلت عملية الدفع|http-equiv="refresh"|rel="canonical"|href="[^" ]*(?:receipt-recovery|\/download|checkout)/);
    const section = html.match(/<section class="section payment-return"[\s\S]*?<\/section>/)?.[0];
    assert.ok(section);
    if (baseline === undefined) baseline = section;
    else assert.equal(section, baseline, "Return content must not depend on query, fragment or cookies");
  }
  assert.equal(requests.length, before, "Return page performs no backend reads, status queries or financial writes");
  const posted = await get("/payment-return", { method: "POST" });
  // next start rejects POST to this static page; next dev may render it read-only.
  assert.ok(development ? [200, 405].includes(posted.status) : posted.status === 405);
  if (posted.status === 200) matches(await posted.text(), /رجوعك من بوابة الدفع لا يؤكد نجاح العملية أو فشلها/);
  assert.equal(requests.length, before);
}
async function verifyReceiptPages() {
  const before = requests.length;
  for (const path of ["/receipts/recover", "/receipt-recovery"]) {
    for (const query of ["", "?secret=UNTRUSTED-RECOVERY-SECRET&token_id=UNTRUSTED-TOKEN&receipt_number=UNTRUSTED-RECEIPT&email=UNTRUSTED-EMAIL%40example.test&return_to=https%3A%2F%2Fevil.example.test"]) {
      const response = await get(path + query);
      const html = await response.text();
      assert.equal(response.status, 200); assert.equal(response.redirected, false);
      assert.equal(response.headers.get("set-cookie"), null);
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
      matches(html, /lang="ar"/); matches(html, /dir="rtl"/);
      matches(html, /name="robots" content="noindex, nofollow"/);
      matches(html, /name="referrer" content="no-referrer"/);
      matches(html, /href="\/projects"/); matches(html, /href="\/"/);
      const publicOutput = development ? html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "") : html;
      assert.doesNotMatch(publicOutput, /UNTRUSTED-|evil\.example\.test|rel="canonical"|href="[^" ]*\/download|href="[^" ]*\.pdf/);
      assert.doesNotMatch(html, /<(?:input|select|textarea)[^>]*\bname=/);
      if (path === "/receipts/recover") {
        matches(html, /id="recovery-receipt_number"/); matches(html, /id="recovery-email"/);
        matches(html, /method="dialog"/); matches(html, /<fieldset disabled=""/);
        matches(html, /اختر التحقق من الرابط للوصول إلى تنزيل الإيصال المحمي/);
      } else {
        matches(html, /رابط استرجاع الإيصال/); matches(html, /href="\/receipts\/recover"/);
        matches(html, /لا يجري التحقق من إيصال أو إرسال أي طلب/);
      }
    }
  }
  // The public project bridge never forwards receipt POSTs or private files.
  for (const [method, path] of [["POST", "/api/donation-receipts/recovery-requests"], ["POST", "/api/donation-receipts/recovery-exchanges"], ["GET", "/api/donation-receipts/12345678-1234-4123-8123-123456789abc/download"], ["GET", "/api/donation-receipts"], ["GET", "/receipts/12345678-1234-4123-8123-123456789abc.pdf"]]) assert.equal((await get(path, { method })).status, 404);
  assert.equal(requests.length, before, "Recovery pages and denied receipt APIs perform no project or financial upstream requests");
}
try {
  let ready = false;
  for (let n = 0; n < 50; n++) {
    try { if ((await get("/")).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, logs);
  if (process.argv.includes("--browser")) {
    const { reviewBrowser } = await import("./review-browser.mjs");
    await reviewBrowser(`http://127.0.0.1:${port}`);
  }
  // Phase 02F-1: real metadata routes, bounded published-ID sitemap and noindex.
  const robotsText = await (await get("/robots.txt")).text();
  assert.match(robotsText, /Disallow: \/api\//);
  assert.match(robotsText, /Sitemap: http:\/\/localhost:3217\/sitemap.xml/);
  assert.doesNotMatch(robotsText, /Disallow: \/(?:donate|receipt|payment-return)/);
  const beforeSitemap = requests.length;
  let sitemapText = await (await get("/sitemap.xml")).text();
  assert.equal(requests.length - beforeSitemap, 1);
  assert.match(requests.at(-1), /per_page=100/);
  assert.match(sitemapText, /<loc>http:\/\/localhost:3217\/projects\/1<\/loc>/);
  assert.doesNotMatch(sitemapText, /donate|receipt|payment-return|amount|email|uuid/);
  mode = "failure";
  sitemapText = await (await get("/sitemap.xml")).text();
  assert.match(sitemapText, /<loc>http:\/\/localhost:3217\/projects<\/loc>/);
  assert.doesNotMatch(sitemapText, /\/projects\/1/);
  const outageListing = await (await get("/projects")).text();
  matches(outageListing, /name="robots" content="noindex, follow"/);
  mode = "success";
  const listingMetadata = await (await get("/projects?country_code=EG&page=2")).text();
  matches(listingMetadata, /name="robots" content="noindex, follow"/);
  matches(listingMetadata, /property="og:title" content="مشاريع التبرع — الصفحة ٢"/);
  matches(listingMetadata, /rel="canonical" href="http:\/\/localhost:3217\/projects\?country_code=EG&amp;page=2"/);
  matches(await (await get("/donate/1")).text(), /name="robots" content="noindex, follow"/);
  await verifyNeutralReturn();
  await verifyReceiptPages();
  let response = await get("/"); let html = await response.text();
  assert.equal(response.status, 200); matches(html, /dir="rtl"/); matches(html, /lang="ar"/);
  matches(html, /مشروع اختبار العقد/); matches(html, /١٢٫٣٤/); assert.doesNotMatch(html, /href="#support"/);
  matches(html, /class="project-title-link" href="\/projects\/1"/);
  response = await get("/projects?page=2"); html = await response.text();
  assert.equal(response.headers.get("referrer-policy"), null, "Return-specific privacy header does not alter public project responses");
  assert.equal(response.status, 200); matches(html, /href="\/projects"/);
  assert.ok(requests.some(url => url.includes("page=2")));
  response = await get("/projects?page=bad"); assert.equal(response.status, 200);
  for (const path of ["/api/admin", "/missing"]) assert.equal((await get(path)).status, 404);
  // No mutation bridge exists, even with the public GET bridge opted in.
  const beforeMutationProbes = requests.length;
  for (const path of ["/api/donations", "/api/donations/DON-SYNTHETIC/reserve", "/api/donations/DON-SYNTHETIC/payment", "/api/donations/DON-SYNTHETIC/checkout", "/api/donor/donations/1/payment", "/api/payments", "/api/payments/paymob/webhook"]) {
    assert.equal((await get(path, { method: "POST" })).status, 404);
  }
  assert.equal(requests.length, beforeMutationProbes, "No financial or internal path reaches the public upstream");
  if (development) {
    assert.equal((await get("/api/donation-projects?page=2&per_page=3&sort=created_at&private=secret")).status, 200);
    assert.ok(requests.at(-1).includes("page=2")); assert.ok(!requests.at(-1).includes("private"));
    assert.equal((await get("/api/donation-projects/1")).status, 200);
    assert.equal((await get("/api/donation-projects/not-an-id")).status, 404);
    assert.equal((await get("/api/donation-projects/1/updates")).status, 404);
  } else {
    for (const path of ["/api/donation-projects", "/api/donation-projects/1"]) assert.equal((await get(path)).status, 404);
  }
  assert.equal((await get("/api/donation-projects", { method: "HEAD" })).status, 405);
  assert.equal((await get("/api/donation-projects", { method: "POST" })).status, 405);
  mode = "discovery";
  const lastQuery = () => new URL(requests.at(-1), "http://localhost").searchParams;
  for (const query of ["country_code=EG", "donation_project_category_id=3", "country_code=EG&donation_project_category_id=3"]) {
    const before = requests.length;
    html = await (await get(`/projects?${query}`)).text();
    assert.equal(requests.length - before, 1, "Each listing makes one collection request");
    for (const [key, value] of new URLSearchParams(query)) assert.equal(lastQuery().get(key), value);
    matches(html, /مشروع اكتشاف/); matches(html, /يطابق اختيارك/);
    matches(html, /aria-label="عرض مشاريع تصنيف التعليم"/);
    matches(html, /aria-label="عرض مشاريع مصر"/);
  }
  for (const [input, expected] of [
    ["/projects?country_code=eg&donation_project_category_id=003&page=-2&search=ignored", "/projects?country_code=EG&donation_project_category_id=3"],
    ["/projects?country_code=EG&country_code=JO&donation_project_category_id=3&donation_project_category_id=4&page=bad", "/projects"],
    ["/projects?country_code=ZZ&sort=title&financial_status=collecting&status=published&reference=anything", "/projects"],
  ]) {
    const normalized = await get(input); const body = await normalized.text();
    const resolved = new URL(normalized.url);
    if (resolved.pathname + resolved.search !== expected) {
      const refresh = body.match(/<meta[^>]*http-equiv="refresh"[^>]*content="\d+;url=([^"]+)"/);
      assert.equal(refresh?.[1].replaceAll("&amp;", "&"), expected, "Streamed redirect targets the normalized URL");
      await (await get(expected)).text();
    }
    const allowed = new Set(["country_code", "donation_project_category_id", "page", "per_page", "sort"]);
    assert.ok([...lastQuery().keys()].every(key => allowed.has(key)));
    assert.equal(lastQuery().get("page"), "1");
  }
  const combined = "/projects?country_code=EG&donation_project_category_id=3&sort=target_amount_minor&page=2";
  html = await (await get(combined)).text();
  assert.equal(lastQuery().get("page"), "2"); assert.equal(lastQuery().get("sort"), "target_amount_minor");
  matches(html, /١٤ مشروعًا يطابق اختيارك/);
  matches(html, /href="\/projects\?country_code=EG&amp;donation_project_category_id=3&amp;sort=target_amount_minor"/);
  matches(html, /href="\/projects\?donation_project_category_id=3&amp;sort=target_amount_minor"/);
  matches(html, /href="\/projects\?country_code=EG&amp;sort=target_amount_minor"/);
  matches(html, /action="\/projects"/); assert.doesNotMatch(html, /name="page"/);
  matches(html, /name="donation_project_category_id" value="3"/);
  matches(html, /value="EG" selected=""/);
  matches(html, /مسح الكل/); matches(html, /التعليم/); matches(html, /١٢٫٣٤/);
  // A shared URL and a refresh resolve the same server state.
  matches(await (await get(combined)).text(), /١٤ مشروعًا يطابق اختيارك/);
  html = await (await get("/projects?country_code=JO&donation_project_category_id=4")).text();
  matches(html, /لا توجد مشاريع تطابق اختيارك/); matches(html, /عرض كل المشاريع/);
  html = await (await get("/projects?country_code=EG&donation_project_category_id=3&page=99")).text();
  matches(html, /العودة إلى أول صفحة/);
  matches(html, /href="\/projects\?country_code=EG&amp;donation_project_category_id=3"/);
  await get("/projects"); assert.equal(lastQuery().get("country_code"), null); assert.equal(lastQuery().get("donation_project_category_id"), null);
  if (development) {
    await get("/api/donation-projects?country_code=eg&donation_project_category_id=003&page=2&sort=acceptance_ends_at&search=bad&reference=bad&financial_status=bad&direction=asc&private=x");
    assert.equal(lastQuery().get("country_code"), "EG"); assert.equal(lastQuery().get("donation_project_category_id"), "3");
    assert.equal(lastQuery().get("sort"), "acceptance_ends_at");
    assert.deepEqual([...lastQuery().keys()].sort(), ["country_code", "donation_project_category_id", "page", "per_page", "sort"]);
    await get("/api/donation-projects?country_code=ZZ&donation_project_category_id=-2&page=NaN&sort=title");
    assert.deepEqual([...lastQuery().keys()].sort(), ["page", "per_page"]);
    await get("/api/donation-projects?country_code=EG&country_code=JO&donation_project_category_id=3&donation_project_category_id=4");
    assert.equal(lastQuery().get("country_code"), null); assert.equal(lastQuery().get("donation_project_category_id"), null);
  }
  mode = "overfunded"; html = await (await get("/projects")).text();
  matches(html, /١٢٥/); matches(html, /value="100"/); matches(html, /خارج النطاق/);
  mode = "empty"; html = await (await get("/projects")).text(); matches(html, /لا توجد مشاريع/);
  for (mode of ["failure", "malformed"]) {
    for (const path of ["/", "/projects"]) { response = await get(path); html = await response.text(); assert.equal(response.status, 200); matches(html, /تعذّر تحميل المشاريع/); assert.doesNotMatch(html, /مشروع اختبار العقد/); }
  }
  html = await (await get(combined)).text();
  matches(html, /تعذّر تحميل المشاريع/);
  matches(html, /href="\/projects\?country_code=EG&amp;donation_project_category_id=3&amp;sort=target_amount_minor&amp;page=2"/);
  matches(html, /إزالة تصفية التصنيف/);
  // Phase 02C: detail page, request-local metadata reuse, native media and actual card links.
  mode = "recent";
  let beforeDetail = requests.length;
  response = await get("/projects/1"); html = await response.text();
  assert.equal(response.status, 200);
  assert.equal(requests.slice(beforeDetail).filter(path => path === "/api/donation-projects/1").length, 1, "Metadata and page share one detail read");
  matches(html, /مشروع تفاصيل منشور للاختبار/); matches(html, /DETAIL-01/); matches(html, /المستفيدون: ٢٥/);
  matches(html, /aria-label="مسار التنقل"/); matches(html, /صافي المحصّل/); matches(html, /١٢٫٣٤/);
  matches(html, /السعة المتبقية بعد الحجوزات/); matches(html, /٨٠٫٠٠/);
  matches(html, /فترة قبول التبرعات المسجّلة/); matches(html, /dateTime="2026-12-01T00:00:00.000Z"/);
  matches(html, /&lt;script&gt;alert/); assert.doesNotMatch(html, /<script>alert\('unsafe'\)<\/script>/);
  matches(html, /وصف طويل يحافظ على تفاصيل المشروع/);
  matches(html, /<video[^>]*controls=""[^>]*preload="none"/);
  matches(html, /لا تتوفر صيغة فيديو قابلة للتشغيل هنا/); assert.doesNotMatch(html, /<iframe/);
  assert.ok(html.indexOf("الصورة الأولى في المعرض") < html.indexOf("الصورة الثانية في المعرض"));
  matches(html, /loading="lazy"/); matches(html, /loading="eager"/);
  matches(html, /property="og:title" content="مشروع تفاصيل منشور للاختبار"/);
  matches(html, /property="og:image" content="https:\/\/media.example.test\/cover.jpg"/);
  matches(html, /rel="canonical" href="http:\/\/localhost:3217\/projects\/1"/);
  matches(html, /مشروع حديث آخر/); matches(html, /href="\/projects\/2"/);
  assert.doesNotMatch(html, /href="[^" ]*(?:checkout|payment)[^" ]*"/);
  matches(html, /href="\/donate\/1"/);
  // Phase 02D-1: verified project, frontend-only form, safe native fallback and no writes.
  beforeDetail = requests.length;
  response = await get("/donate/1"); html = await response.text();
  assert.equal(response.status, 200);
  assert.deepEqual(requests.slice(beforeDetail), ["/api/donation-projects/1"]);
  matches(html, /مشروع تفاصيل منشور للاختبار/); matches(html, /DETAIL-01/);
  matches(html, /مبلغ المساهمة المقترح/); matches(html, /method="dialog"/);
  matches(html, /<fieldset disabled=""/); matches(html, /name="robots" content="noindex/);
  for (const field of ["amount", "name", "email", "phone"]) matches(html, new RegExp(`id="guest-${field}"`));
  matches(html, /متابعة إلى بيانات الفوترة/); matches(html, /أفضّل عدم عرض اسمي علنًا/);
  matches(html, /٢\. الفوترة/); matches(html, /٣\. المراجعة/);
  matches(html, /السعة المتبقية بعد الحجوزات/); matches(html, /١٢٫٣٤/);
  assert.doesNotMatch(html, /<(?:input|select|textarea)[^>]*\bname=/);
  assert.doesNotMatch(html, /href="[^" ]*\?(?:[^" ]*&amp;)?(?:name|email|phone|amount)=/);
  assert.doesNotMatch(html, /action="[^" ]*\/api\//);
  for (const id of ["slug", "0", "01", "TEST-01"]) {
    const before = requests.length;
    html = await (await get(`/donate/${id}`)).text();
    matches(html, /NEXT_HTTP_ERROR_FALLBACK;404/); assert.equal(requests.length, before);
    assert.doesNotMatch(html, /<input[^>]*id="guest-amount"/);
  }
  for (const id of [404, 405]) {
    html = await (await get(`/donate/${id}`)).text();
    matches(html, /NEXT_HTTP_ERROR_FALLBACK;404/); assert.doesNotMatch(html, /<input[^>]*id="guest-amount"/);
  }
  detailMode = "no-media"; html = await (await get("/donate/1")).text();
  matches(html, /لا تتوفر صورة لهذا المشروع/); matches(html, /id="guest-amount"/);
  for (detailMode of ["failure", "malformed", "mismatch"]) {
    html = await (await get("/donate/1")).text(); matches(html, /تعذّر التحقق من المشروع حاليًا/);
    matches(html, /href="\/donate\/1"/); assert.doesNotMatch(html, /<input[^>]*id="guest-amount"/);
  }
  detailMode = "ready";
  for (const id of ["slug", "TEST-01", "0", "01", "9223372036854775808"]) {
    beforeDetail = requests.length;
    response = await get(`/projects/${id}`, { headers: { "User-Agent": "Twitterbot" } }); html = await response.text();
    assert.ok([200, 404].includes(response.status)); matches(html, /NEXT_HTTP_ERROR_FALLBACK;404/); matches(html, /name="robots" content="noindex/);
    assert.equal(requests.length, beforeDetail, "Invalid identifiers never reach upstream");
  }
  for (const id of [404, 405]) {
    response = await get(`/projects/${id}`, { headers: { "User-Agent": "Twitterbot" } }); html = await response.text();
    // Next's existing loading boundaries can commit 200 before notFound resolves.
    assert.ok([200, 404].includes(response.status)); matches(html, /NEXT_HTTP_ERROR_FALLBACK;404/); matches(html, /name="robots" content="noindex/);
  }
  detailMode = "no-media"; html = await (await get("/projects/1")).text();
  matches(html, /لا تتوفر صورة لهذا المشروع/); assert.doesNotMatch(html, /property="og:image"/);
  detailMode = "overfunded"; html = await (await get("/projects/1")).text();
  matches(html, /١٢٥/); matches(html, /value="100"/); matches(html, /خارج النطاق/);
  for (detailMode of ["failure", "malformed", "mismatch", "timeout"]) {
    response = await get("/projects/1"); html = await response.text();
    assert.equal(response.status, 200); matches(html, /تعذّر تحميل التفاصيل حاليًا/);
    matches(html, /href="\/projects\/1"/); matches(html, /name="robots" content="noindex/);
    assert.ok(!html.includes("NEXT_HTTP_ERROR_FALLBACK;404"), "Outage must not trigger the not-found boundary");
  }
  detailMode = "ready"; mode = "failure"; html = await (await get("/projects/1")).text();
  matches(html, /مشروع تفاصيل منشور للاختبار/); assert.doesNotMatch(html, /من أحدث المشاريع المنشورة/);
  if (development) {
    response = await get("/api/donation-projects/1?admin=true");
    assert.equal(response.status, 200); assert.equal(requests.at(-1), "/api/donation-projects/1");
    for (const path of ["/api/donation-projects/1/payment", "/api/donation-projects/1/updates", "/api/donation-projects/01"]) assert.equal((await get(path)).status, 404);
    assert.equal((await get("/api/donation-projects/1", { method: "POST" })).status, 405);
    assert.equal((await get("/api/donation-projects/1", { method: "HEAD" })).status, 405);
  }
  await new Promise(resolve => backend.close(resolve));
  await verifyNeutralReturn();
  await verifyReceiptPages();
  for (const path of ["/", "/projects"]) {
    response = await get(path); html = await response.text();
    assert.equal(response.status, 200); matches(html, /تعذّر تحميل المشاريع/);
  }
  html = await (await get("/projects/1")).text(); matches(html, /تعذّر تحميل التفاصيل حاليًا/);
  html = await (await get("/donate/1")).text(); matches(html, /تعذّر التحقق من المشروع حاليًا/);
  assert.doesNotMatch(html, /<input[^>]*id="guest-amount"/);
  assert.ok(upstreamMethods.every(method => method === "GET"), "No upstream donation, reservation, payment or checkout mutation");
  assert.ok(requests.every(path => /^\/api\/donation-projects(?:\?|\/\d+$)/.test(path)), "Only existing public project reads reach upstream");
  console.log(`PASS (${development ? "development" : "production"}): Phases 02A/02B/02C regressions + verified donation entry, numeric navigation, no form for invalid/missing/unverified projects, missing media, exact summary, noindex, form privacy safeguards, no native personal-data serialization, and GET-only project upstream traffic (no financial mutations).`);
} finally {
  const stopped = once(child, "exit");
  child.kill(); backend.close();
  if (child.exitCode === null) await stopped;
  if (qaDirectory) {
    const outputRoot = resolve(".next") + sep;
    if (!resolve(qaDirectory).startsWith(outputRoot) || !resolve(qaDirectory).includes("qa-source-")) throw new Error("Unexpected QA cleanup path");
    await rm(qaDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
