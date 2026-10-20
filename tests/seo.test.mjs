import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypescript } from "./load-typescript.mjs";
import { fixturePage } from "./fixture.mjs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
const { publicOrigin } = await loadTypescript("../src/lib/config/site.ts");
const { sitemapEntries } = await loadTypescript("../src/lib/sitemap.ts");
const { HowItWorks, Transparency } = await loadTypescript("../src/components/home-sections.tsx");
const { SiteFooter } = await loadTypescript("../src/components/site-footer.tsx");

test("public guidance describes local review and disabled payment with functional receipt navigation", () => {
  const html = renderToStaticMarkup(createElement(HowItWorks)) + renderToStaticMarkup(createElement(Transparency)) + renderToStaticMarkup(createElement(SiteFooter));
  assert.match(html, /الدفع الإلكتروني غير متاح حاليًا/);
  assert.match(html, /مراجعة البيانات لا تُنشئ تبرعًا أو حجزًا/);
  assert.match(html, /href="\/receipts\/recover"/);
  assert.match(html, /دون ضمان وجود إيصال أو وصول رسالة بريد/);
  assert.doesNotMatch(html, /ستُتاح واجهات الدفع واستعادة الإيصال لاحقًا|تُضاف المعلومات الرسمية/);
});

test("public origin accepts only configured HTTP(S) origins without credentials or extra URL components", () => {
  for (const value of [undefined, "", "broken", "ftp://example.test", "https://user:pass@example.test", "https://example.test/path", "https://example.test/?email=x", "https://example.test/#secret"]) assert.equal(publicOrigin(value), undefined);
  assert.equal(publicOrigin("https://example.test/"), "https://example.test");
  assert.equal(publicOrigin("http://localhost:3217"), "http://localhost:3217");
});
test("sitemap fails closed without public origin and degrades to public editorial paths on outage", () => {
  assert.deepEqual(sitemapEntries(undefined, fixturePage()), []);
  assert.deepEqual(sitemapEntries("https://example.test", null), [{ url: "https://example.test/" }, { url: "https://example.test/projects" }]);
});
test("sitemap bounds and deduplicates public numeric IDs without leaking project payload or workflow URLs", () => {
  const page = fixturePage();
  page.data = [page.data[0], page.data[0], ...[-1, 0, 1.5, Number.MAX_SAFE_INTEGER + 1].map(id => ({ ...page.data[0], id }))];
  assert.deepEqual(sitemapEntries("https://example.test", page).map(item => item.url), ["https://example.test/", "https://example.test/projects", "https://example.test/projects/1"]);
  page.data = Array.from({ length: 150 }, (_, i) => ({ ...page.data[0], id: i + 1 }));
  assert.equal(sitemapEntries("https://example.test", page).length, 102);
});
