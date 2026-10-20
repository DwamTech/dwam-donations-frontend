import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTypescript } from "./load-typescript.mjs";
const { validateAmount, validateGuestDraft, guestDraftReducer, initialDraftState, TECHNICAL_MAX_MINOR } = await loadTypescript("../src/features/donations/data/guest-draft.ts");
const { GuestDonationForm } = await loadTypescript("../src/features/donations/components/guest-donation-form.tsx");
const valid = () => ({ amount: "12.34", name: "زائر اختبار", email: "guest@example.test", phone: "+20 (100) 123-4567", is_public_anonymous: false });

test("major-unit strings convert exactly with backend currency precision", () => {
  assert.deepEqual(validateAmount("12.34", "EGP"), { ok: true, major: "12.34", minor: "1234" });
  assert.equal(validateAmount("0.01", "USD").minor, "1");
  assert.equal(validateAmount("12", "JPY").minor, "12");
  for (const currency of ["KWD", "BHD"]) assert.equal(validateAmount("12.345", currency).minor, "12345");
});
test("Arabic, Persian and Latin numerals have unambiguous exact normalization", () => {
  for (const value of [" ١٢٫٣٤ ", "۱۲٫۳۴", "١٢.٣٤", "12.34"]) assert.deepEqual(validateAmount(value, "EGP"), { ok: true, major: "12.34", minor: "1234" });
});
test("zero, negatives, excess precision, ambiguous separators and exponent notation fail without rounding", () => {
  for (const value of ["", "0", "0.00", "-1", "+1", ".5", "1.", "01.5", "1.234", "1,50", "1,000", "١٬٠٠٠", "1 000", "1.٢٫3", "1e3", "Infinity", "NaN"]) assert.equal(validateAmount(value, "EGP").ok, false, value);
  assert.equal(validateAmount("1.0", "JPY").ok, false);
  assert.equal(validateAmount("1.2345", "KWD").ok, false);
});
test("large amounts preserve exactness and respect technical or supplied lower ceilings", () => {
  assert.equal(validateAmount("92233720368547758.07", "EGP").minor, TECHNICAL_MAX_MINOR);
  assert.equal(validateAmount("92233720368547758.08", "EGP").ok, false);
  assert.equal(validateAmount("9223372036854775807", "JPY").minor, TECHNICAL_MAX_MINOR);
  assert.equal(validateAmount("9223372036854775.807", "KWD").minor, TECHNICAL_MAX_MINOR);
  assert.equal(validateAmount("9".repeat(100), "EGP").ok, false);
  assert.equal(validateAmount("10.01", "EGP", "1000").ok, false);
  assert.equal(validateAmount("10", "EGP", "1000").ok, true);
});
test("guest requirements map to their own fields and preserve supported anonymity", () => {
  const result = validateGuestDraft({ ...valid(), name: "  زائر اختبار  ", phone: "+٢٠ (١٠٠) ١٢٣-٤٥٦٧", is_public_anonymous: true }, "EGP");
  assert.deepEqual(result.errors, {}); assert.equal(result.review.name, "زائر اختبار");
  assert.equal(result.review.phone, "+20 (100) 123-4567"); assert.equal(result.review.is_public_anonymous, true);
  for (const field of ["name", "email", "phone"]) assert.ok(validateGuestDraft({ ...valid(), [field]: " " }, "EGP").errors[field]);
  assert.ok(validateGuestDraft({ ...valid(), name: "س".repeat(256) }, "EGP").errors.name);
  for (const email of ["invalid", "a@@example.test", "a b@example.test", "a".repeat(256) + "@example.test"]) assert.ok(validateGuestDraft({ ...valid(), email }, "EGP").errors.email);
  for (const phone of ["abc123", "12345", "1".repeat(33), "123456\n789"]) assert.ok(validateGuestDraft({ ...valid(), phone }, "EGP").errors.phone);
});
test("review and edit use the same in-memory reducer as the real component", () => {
  let state = initialDraftState;
  for (const field of ["amount", "name", "email", "phone"]) state = guestDraftReducer(state, { type: "field", field, value: valid()[field] });
  state = guestDraftReducer(state, { type: "anonymous", value: true });
  state = guestDraftReducer(state, { type: "review", currency: "EGP" });
  assert.equal(state.step, "review"); assert.equal(state.review.amount_minor, "1234"); assert.equal(state.review.is_public_anonymous, true);
  state = guestDraftReducer(state, { type: "edit" });
  assert.equal(state.step, "entry"); assert.equal(state.draft.email, valid().email); assert.equal(state.draft.amount, "12.34"); assert.equal(state.review, null);
  state = guestDraftReducer(state, { type: "field", field: "amount", value: "0" });
  state = guestDraftReducer(state, { type: "review", currency: "EGP" });
  assert.equal(state.step, "entry"); assert.ok(state.errors.amount); assert.equal(state.review, null);
  state = guestDraftReducer(state, { type: "field", field: "amount", value: "20" });
  state = guestDraftReducer(state, { type: "review", currency: "EGP" });
  assert.equal(state.review.amount_minor, "2000");
  assert.equal(initialDraftState.draft.amount, "", "Reducer never mutates the shared initial state");
});
test("real initial React form has labeled controls and cannot natively serialize guest data", () => {
  const html = renderToStaticMarkup(createElement(GuestDonationForm, { project: { id: 1, title: "مشروع اختبار", currency: "EGP" } }));
  assert.match(html, /method="dialog"/); assert.match(html, /<fieldset disabled=""/);
  for (const field of ["amount", "name", "email", "phone"]) { assert.match(html, new RegExp(`id="guest-${field}"`)); assert.match(html, new RegExp(`for="guest-${field}"`)); }
  assert.match(html, /autoComplete="name"/); assert.match(html, /type="email"/); assert.match(html, /type="tel"/);
  assert.doesNotMatch(html, /<(?:input|select|textarea)[^>]*\bname=/);
  assert.doesNotMatch(html, /action="[^" ]*\?/);
});
test("donation entry contains no network, storage, capability, analytics or logging operations", async () => {
  const component = await readFile(new URL("../src/features/donations/components/guest-donation-form.tsx", import.meta.url), "utf8");
  const model = await readFile(new URL("../src/features/donations/data/guest-draft.ts", import.meta.url), "utf8");
  const additional = await Promise.all(["data/billing-draft.ts", "data/billing-flow.ts", "components/billing-fields.tsx", "components/donation-review.tsx"].map(file => readFile(new URL(`../src/features/donations/${file}`, import.meta.url), "utf8")));
  const source = component + model + additional.join("\n");
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie|console\.|\/api\/(?:donations|payments)|router\.(?:push|replace)|URLSearchParams|randomUUID/);
});
