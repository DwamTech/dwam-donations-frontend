import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTypescript } from "./load-typescript.mjs";

const { billingFields, emptyBilling, validateBilling } = await loadTypescript("../src/features/donations/data/billing-draft.ts");
const { initialBillingFlow, billingFlowReducer: reduce } = await loadTypescript("../src/features/donations/data/billing-flow.ts");
const { BillingFields } = await loadTypescript("../src/features/donations/components/billing-fields.tsx");
const { DonationReview } = await loadTypescript("../src/features/donations/components/donation-review.tsx");
const guest = () => ({ amount: "١٢٫٣٤", name: "اسم اختبار كامل", email: "donor@example.test", phone: "+٢٠١٠٠١٢٣٤٥٦٧" });
const billing = () => ({ first_name: "اسم", last_name: "اختبار", phone_number: "+201001234567", email: "billing@example.test", street: "شارع اختبار", building: "10", floor: "2", apartment: "3", city: "مدينة اختبار", state: "محافظة اختبار", country: "EG" });
function atBilling() {
  let state = initialBillingFlow;
  for (const [field, value] of Object.entries(guest())) state = reduce(state, { type: "guest", action: { type: "field", field, value } });
  return reduce(state, { type: "next", currency: "EGP" });
}
function completeBilling(state = atBilling()) {
  for (const [field, value] of Object.entries(billing())) state = reduce(state, { type: "billing-field", field, value });
  return state;
}
function atReview() { return reduce(completeBilling(), { type: "review", currency: "EGP" }); }

test("all eleven billing fields are required, including floor, apartment and explicit country", () => {
  const result = validateBilling(emptyBilling);
  assert.equal(result.billing, null);
  assert.deepEqual(Object.keys(result.errors).sort(), Object.keys(billingFields).sort());
  for (const field of Object.keys(billingFields)) assert.ok(validateBilling({ ...billing(), [field]: " " }).errors[field]);
});
test("billing normalizes whitespace, phone digits and country case without invented identity/address", () => {
  const result = validateBilling({ ...billing(), first_name: " اسم ", phone_number: "+٢٠١٠٠١٢٣٤٥٦٧", country: " eg " });
  assert.deepEqual(result.errors, {}); assert.equal(result.billing.first_name, "اسم");
  assert.equal(result.billing.phone_number, "+201001234567"); assert.equal(result.billing.country, "EG");
  assert.equal(initialBillingFlow.billing.first_name, ""); assert.equal(initialBillingFlow.billing.last_name, "");
  assert.equal(initialBillingFlow.billing.country, ""); assert.equal(initialBillingFlow.billing.building, "");
});
test("field lengths mirror request/DTO maxima and count Unicode characters", () => {
  for (const [field, config] of Object.entries(billingFields)) {
    assert.ok(validateBilling({ ...billing(), [field]: "س".repeat(config.max + 1) }).errors[field], field);
  }
  assert.ok(validateBilling({ ...billing(), first_name: "س".repeat(120), last_name: "😀".repeat(120) }).billing);
  assert.ok(validateBilling({ ...billing(), first_name: "س".repeat(121) }).errors.first_name);
});
test("placeholder values, control characters and invalid Unicode are rejected", () => {
  for (const field of Object.keys(billingFields)) {
    for (const value of ["N/A", " na ", "-", "قيمة\u0000أخرى", "قيمة\nأخرى", "\ud800"]) assert.ok(validateBilling({ ...billing(), [field]: value }).errors[field], field);
  }
});
test("billing email and phone are validated beyond the request's string rules", () => {
  for (const email of ["invalid", "a@@example.test", "a b@example.test", "a@domain"]) assert.ok(validateBilling({ ...billing(), email }).errors.email);
  for (const phone_number of ["abc123", "12345", "+" + "1".repeat(32)]) assert.ok(validateBilling({ ...billing(), phone_number }).errors.phone_number);
  assert.ok(validateBilling({ ...billing(), phone_number: "+20 (100) 123-4567" }).billing);
});
test("billing country follows the DTO's EG-only contract, not the broader discovery country list", () => {
  for (const country of ["US", "SA", "JO", "ZZ", "EGP", "E", ""]) assert.ok(validateBilling({ ...billing(), country }).errors.country, country);
  assert.equal(validateBilling({ ...billing(), country: "eg" }).billing.country, "EG");
});
test("validated donor contact is reused without splitting names or selecting a country", () => {
  const state = atBilling();
  assert.equal(state.step, "billing"); assert.equal(state.billing.email, guest().email);
  assert.equal(state.billing.phone_number, "+201001234567");
  for (const field of ["first_name", "last_name", "country", "street", "city"]) assert.equal(state.billing[field], "");
  const invalid = reduce(initialBillingFlow, { type: "next", currency: "EGP" });
  assert.equal(invalid.step, "entry"); assert.ok(invalid.guest.errors.amount); assert.equal(invalid.billing.email, "");
});
test("back/forward retains drafts and updates untouched contact while preserving billing edits, including clearing", () => {
  let state = atBilling();
  state = reduce(state, { type: "billing-field", field: "email", value: "" });
  state = reduce(state, { type: "billing-field", field: "street", value: "عنوان كتبه الزائر" });
  state = reduce(state, { type: "edit", step: "entry" });
  assert.equal(state.guest.draft.amount, guest().amount);
  state = reduce(state, { type: "guest", action: { type: "field", field: "email", value: "changed@example.test" } });
  state = reduce(state, { type: "guest", action: { type: "field", field: "phone", value: "+201111111111" } });
  state = reduce(state, { type: "next", currency: "EGP" });
  assert.equal(state.billing.email, ""); assert.equal(state.billing.phone_number, "+201111111111");
  assert.equal(state.billing.street, "عنوان كتبه الزائر");
});
test("final review requires valid donor and billing data and keeps their contact separate", () => {
  const invalid = reduce(atBilling(), { type: "review", currency: "EGP" });
  assert.equal(invalid.step, "billing"); assert.equal(invalid.billingReview, null); assert.ok(invalid.billingErrors.first_name);
  const state = atReview();
  assert.equal(state.step, "review"); assert.equal(state.guest.review.amount, "12.34");
  assert.equal(state.guest.review.amount_minor, "1234");
  assert.equal(state.guest.review.email, guest().email); assert.equal(state.billingReview.email, billing().email);
  assert.deepEqual(Object.keys(state.billingReview).sort(), Object.keys(billingFields).sort());
});
test("both edit actions invalidate final review and amount edits require a fresh review", () => {
  let state = reduce(atReview(), { type: "edit", step: "billing" });
  assert.equal(state.step, "billing"); assert.equal(state.billingReview, null);
  assert.equal(state.billing.street, billing().street); assert.ok(state.guest.review);
  state = reduce(state, { type: "billing-field", field: "building", value: "12" });
  state = reduce(state, { type: "review", currency: "EGP" });
  assert.equal(state.billingReview.building, "12");
  state = reduce(state, { type: "edit", step: "entry" });
  assert.equal(state.guest.review, null); assert.equal(state.billingReview, null);
  state = reduce(state, { type: "guest", action: { type: "field", field: "amount", value: "20.55" } });
  state = reduce(state, { type: "next", currency: "EGP" });
  assert.equal(state.step, "billing"); assert.equal(state.billingReview, null);
  state = reduce(state, { type: "review", currency: "EGP" });
  assert.equal(state.guest.review.amount_minor, "2055"); assert.equal(state.billingReview.building, "12");
  assert.equal(initialBillingFlow.billing.street, "", "No mutation of the shared initial state");
});
test("duplicate navigation cannot skip billing or double-advance review", () => {
  const state = atBilling();
  assert.equal(reduce(state, { type: "next", currency: "EGP" }), state);
  assert.equal(reduce(initialBillingFlow, { type: "review", currency: "EGP" }), initialBillingFlow);
  const reviewed = atReview(); assert.equal(reduce(reviewed, { type: "review", currency: "EGP" }), reviewed);
});
test("real billing markup has Arabic labels, required fields, empty country selection and no native PII serialization", () => {
  const html = renderToStaticMarkup(createElement(BillingFields, { draft: emptyBilling, errors: {}, onChange() {} }));
  for (const [field, config] of Object.entries(billingFields)) {
    assert.match(html, new RegExp(`id="billing-${field}"`)); assert.match(html, new RegExp(`for="billing-${field}"`)); assert.ok(html.includes(config.label));
  }
  assert.equal((html.match(/required=""/g) || []).length, 11);
  assert.match(html, /<option value="" selected="">/); assert.match(html, /<option value="EG">مصر/);
  assert.doesNotMatch(html, /<(?:input|select|textarea)[^>]*\bname=/);
  assert.match(html, /autoComplete="section-billing given-name"/); assert.match(html, /autoComplete="section-billing family-name"/);
});
test("real final review renders billing and donation facts with separate local edit buttons and escaped address text", () => {
  const state = atReview();
  const html = renderToStaticMarkup(createElement(DonationReview, { project: { title: "مشروع اختبار", currency: "EGP" }, guest: state.guest.review, billing: { ...state.billingReview, street: "<script>test</script>" }, onEdit() {} }));
  assert.match(html, /١٢٫٣٤/); assert.match(html, /donor@example.test/); assert.match(html, /billing@example.test/);
  assert.match(html, /تعديل المبلغ وبيانات المتبرع/); assert.match(html, /تعديل بيانات الفوترة/);
  assert.match(html, /&lt;script&gt;test&lt;\/script&gt;/); assert.doesNotMatch(html, /<script>test/);
  assert.equal((html.match(/type="button"/g) || []).length, 2);
  assert.doesNotMatch(html, /href=|type="submit"|action=|\/api\//);
});
