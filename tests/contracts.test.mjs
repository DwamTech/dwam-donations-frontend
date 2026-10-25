import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
async function moduleAt(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const { formatMoney } = await moduleAt("../src/lib/formatters/money.ts");
const { parseProjectPage, parseProjectDetail } = await moduleAt("../src/features/projects/data/contract.ts");
const { projectId, publicMediaUrl, playableVideo, galleryImages, projectDate, descriptionText } = await moduleAt("../src/features/projects/data/presentation.ts");
const { parseProjectQuery, projectHref, backendProjectParams, changeProjectFilters, needsNormalization, searchValues, countryOptions } = await moduleAt("../src/features/projects/data/query.ts");
const { fixturePage } = await import("./fixture.mjs");
test("money preserves backend precision for EGP, JPY, KWD, BHD and fallback", () => {
  assert.match(formatMoney(12345, "EGP"), /١٢٣٫٤٥/);
  assert.match(formatMoney(12345, "JPY"), /١٢٬٣٤٥/);
  for (const currency of ["KWD", "BHD"]) assert.match(formatMoney(12345, currency), /١٢٫٣٤٥/);
  assert.match(formatMoney(12345, "USD"), /١٢٣٫٤٥/);
  assert.match(formatMoney(1, "EGP"), /٠٫٠١/);
  assert.match(formatMoney(100, "KWD"), /٠٫١٠٠/);
});
test("large string integers remain exact; unsafe JSON numbers fail", () => {
  assert.match(formatMoney("900719925474099123", "EGP"), /٩٬٠٠٧٬١٩٩٬٢٥٤٬٧٤٠٬٩٩١٫٢٣/);
  assert.throws(() => formatMoney(Number.MAX_SAFE_INTEGER + 1, "EGP"));
});
test("real resource shape includes nullable category fields and media", () => {
  assert.equal(parseProjectPage(fixturePage()).data[0].category.name, null);
  const value = fixturePage(); value.data[0].cover_image = { id: 2, uuid: "image", type: "image", url: "/storage/a.jpg", mime_type: null, caption: null, sort_order: 0 };
  assert.equal(parseProjectPage(value).data[0].cover_image.id, 2);
});

test("Laravel null category relationships render in mixed lists and detail without changing the response", () => {
  const value = fixturePage();
  const uncategorized = { ...value.data[0], id: 2, category: null };
  value.data.push(uncategorized);
  const parsed = parseProjectPage(value);
  assert.deepEqual(parsed.data[1].category, { id: null, name: null, slug: null });
  assert.equal(parsed.data[0].id, value.data[0].id);
  assert.equal(parsed.data[1].target_amount_minor, uncategorized.target_amount_minor);
  assert.equal(uncategorized.category, null);
  assert.deepEqual(parseProjectDetail({ data: uncategorized }).category, { id: null, name: null, slug: null });
});

test("null category support still rejects missing or malformed categories and unsafe finances", () => {
  for (const category of [undefined, {}, [], "category", { id: "1", name: null, slug: null }]) {
    assert.throws(() => parseProjectDetail({ data: { ...fixturePage().data[0], category } }));
  }
  assert.throws(() => parseProjectDetail({ data: { ...fixturePage().data[0], category: null, target_amount_minor: Number.MAX_SAFE_INTEGER + 1 } }));
});
test("malformed data and imprecise money fail without inventing zero values", () => {
  for (const value of [null, {}, { data: [] }, { ...fixturePage(), meta: { current_page: -1 } }]) assert.throws(() => parseProjectPage(value));
  for (const amount of [1.5, Number.MAX_SAFE_INTEGER + 1, null, "12.3", -1]) {
    const value = fixturePage(); value.data[0].collected_amount_minor = amount;
    assert.throws(() => parseProjectPage(value));
  }
});
test("empty pages and out-of-range source progress are preserved", () => {
  const value = fixturePage(); value.data[0].progress_percent = 127.34;
  assert.equal(parseProjectPage(value).data[0].progress_percent, 127.34);
  value.data = []; value.meta.total = 0;
  assert.deepEqual(parseProjectPage(value).data, []);
});

test("country input follows the backend ISO registry and normalizes case", () => {
  assert.equal(parseProjectQuery({ country_code: " eg " }).country_code, "EG");
  assert.equal(parseProjectQuery({ country_code: "ZZ" }).country_code, undefined);
  assert.equal(parseProjectQuery({ country_code: "USA" }).country_code, undefined);
  assert.equal(countryOptions().length, 249);
  assert.ok(countryOptions().some(option => option.code === "EG" && option.name === "مصر"));
});
test("category IDs remain exact positive backend bigint identifiers", () => {
  assert.equal(parseProjectQuery({ donation_project_category_id: "003" }).donation_project_category_id, "3");
  assert.equal(parseProjectQuery({ donation_project_category_id: "9223372036854775807" }).donation_project_category_id, "9223372036854775807");
  for (const value of ["0", "-3", "3.2", "3e1", "9223372036854775808", "<script>"])
    assert.equal(parseProjectQuery({ donation_project_category_id: value }).donation_project_category_id, undefined);
});
test("combined filters survive pagination and URL roundtrip", () => {
  const query = parseProjectQuery({ country_code: "EG", donation_project_category_id: "3", page: "2", sort: "target_amount_minor" });
  const href = projectHref(query);
  assert.equal(href, "/projects?country_code=EG&donation_project_category_id=3&sort=target_amount_minor&page=2");
  assert.deepEqual(parseProjectQuery(searchValues(new URL(href, "http://localhost").searchParams)), query);
  assert.equal(backendProjectParams(query, 12).get("country_code"), "EG");
  assert.equal(backendProjectParams(query, 12).get("donation_project_category_id"), "3");
  assert.equal(backendProjectParams(query, 12).get("page"), "2");
});
test("filter changes and individual removal reset page and preserve remaining state", () => {
  const query = parseProjectQuery({ country_code: "EG", donation_project_category_id: "3", page: "5", sort: "acceptance_ends_at" });
  const changed = changeProjectFilters(query, { country_code: "JO" });
  assert.equal(changed.page, 1); assert.equal(changed.donation_project_category_id, "3");
  assert.equal(changed.sort, "acceptance_ends_at");
  const removed = changeProjectFilters(query, { country_code: undefined });
  assert.equal(projectHref(removed), "/projects?donation_project_category_id=3&sort=acceptance_ends_at");
  assert.equal(projectHref(parseProjectQuery({})), "/projects");
});
test("malformed pages, repeated filters and unsupported parameters normalize safely", () => {
  for (const page of ["0", "-1", "1.1", "1e3", "NaN", "2147483648", ["2", "3"]]) assert.equal(parseProjectQuery({ page }).page, 1);
  const raw = searchValues(new URLSearchParams("country_code=EG&country_code=JO&donation_project_category_id=3&donation_project_category_id=4&search=test&status=published&financial_status=collecting&reference=TEST&sort=title"));
  const query = parseProjectQuery(raw);
  assert.equal(query.country_code, undefined); assert.equal(query.donation_project_category_id, undefined);
  assert.equal(query.sort, "created_at"); assert.equal(projectHref(query), "/projects");
  assert.ok(needsNormalization(raw, query));
  assert.deepEqual([...backendProjectParams(query, 12).keys()], ["page", "per_page"]);
  assert.equal(needsNormalization({}, query), false);
});
test("all supported descending sort keys are forwarded, other keys are not", () => {
  for (const sort of ["acceptance_ends_at", "target_amount_minor"]) assert.equal(backendProjectParams(parseProjectQuery({ sort }), 12).get("sort"), sort);
  assert.equal(backendProjectParams(parseProjectQuery({ sort: "title", direction: "asc" }), 12).get("sort"), null);
  assert.equal(backendProjectParams(parseProjectQuery({}), 1000).get("per_page"), "100");
});

test("detail identifiers are bounded positive numeric IDs, not UUIDs/slugs/references", () => {
  assert.equal(projectId("1"), "1"); assert.equal(projectId("9223372036854775807"), "9223372036854775807");
  for (const id of ["0", "01", "-1", "1.1", "1e3", "TEST-01", "slug", "../1", "9223372036854775808", "1?admin=true"]) assert.equal(projectId(id), null);
});
test("detail envelopes use the same strict project validation with nullable media", () => {
  assert.equal(parseProjectDetail({ data: fixturePage().data[0] }).id, 1);
  for (const value of [null, {}, { data: null }, { data: [] }, { data: { ...fixturePage().data[0], currency: null } }]) assert.throws(() => parseProjectDetail(value));
});
test("media URLs reject executable schemes, protocol-relative URLs, credentials and backslashes", () => {
  assert.equal(publicMediaUrl("/storage/image.jpg"), "/storage/image.jpg");
  assert.equal(publicMediaUrl("https://media.example.test/a.jpg"), "https://media.example.test/a.jpg");
  for (const value of [null, "javascript:alert(1)", "data:image/svg+xml,x", "//evil.example/a", "/\\evil.example/a", "https://user:pass@example.test/a", "https://example.test/a\n"]) assert.equal(publicMediaUrl(value), null);
});
test("gallery retains resource order and removes only unusable image URLs", () => {
  const base = { id: 1, uuid: "image", type: "image", url: "/storage/a.jpg", caption: null, mime_type: "image/jpeg", sort_order: 9 };
  const images = [base, { ...base, id: 2, uuid: "image2", sort_order: 10 }, { ...base, id: 3, url: null }];
  assert.deepEqual(galleryImages(images).map(image => image.id), [1, 2]);
});
test("native video requires an approved browser MIME and a safe actual URL", () => {
  const base = { id: 1, uuid: "video", type: "video", url: "/storage/a.mp4", caption: null, mime_type: "video/mp4", sort_order: 0 };
  assert.equal(playableVideo(base), "/storage/a.mp4");
  for (const mime_type of [null, "text/html", "video/quicktime", "video/x-m4v"]) assert.equal(playableVideo({ ...base, mime_type }), null);
  assert.equal(playableVideo({ ...base, url: "javascript:alert(1)" }), null);
});
test("dates omit invalid values; metadata summarizes real text without markup", () => {
  assert.equal(projectDate(null), null); assert.equal(projectDate("not-a-date"), null);
  assert.ok(projectDate("2026-10-20T12:00:00.000Z"));
  assert.equal(descriptionText({ short_description: null, description: "<p>وصف المشروع</p>\n فقرة أخرى" }), "وصف المشروع فقرة أخرى");
  assert.equal(descriptionText({ short_description: null, description: "طويل ".repeat(1000) }).length, 180);
});
