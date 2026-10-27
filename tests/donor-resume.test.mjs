import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTypescript } from './load-typescript.mjs';

const { SavedPaymentReview } = await loadTypescript('../src/features/donors/saved-payment-review.tsx');
const { checkoutMessage } = await loadTypescript('../src/features/donors/contributions.ts');
const billing = { first_name: 'Synthetic', last_name: 'Owner', phone_number: '+201001234567', email: 'owner@example.test', street: 'Test Street', building: '1', floor: '2', apartment: '3', city: 'Cairo', state: 'Cairo', country: 'EG' };
const config = { enabled: true, gateway: 'synthetic', hosts: ['checkout.example.test'] };
function markup(state, canResume = false, enabled = true, reviewAllows = canResume) {
  return renderToStaticMarkup(createElement(SavedPaymentReview, { id: '123', config: { ...config, enabled }, review: { billing, can_continue: reviewAllows, stage: 'checkout' }, decision: state ? { state, can_resume: canResume, can_start_new: false } : undefined }));
}
test('resume button requires both backend decisions and enabled checkout configuration', () => {
  assert.match(markup('resumable', true), />استكمال الدفع</);
  for (const html of [markup(undefined, false, true, true), markup('requires_review'), markup('expired'), markup('processing'), markup('resumable', true, false), markup('resumable', true, true, false)]) assert.doesNotMatch(html, />استكمال الدفع</);
});
test('review and expired states have distinct truthful guidance without guessing the financial outcome', () => {
  assert.match(markup('requires_review'), /تحتاج مراجعة مالية أو تحققًا لدى بوابة الدفع/);
  assert.match(markup('processing'), /نتيجتها غير مؤكدة/);
  assert.match(markup('expired'), /انتهت صلاحية الحجز أو جلسة الدفع/);
  assert.match(markup('awaiting_confirmation'), /التحصيل لم يُؤكد بعد/);
  assert.equal(checkoutMessage({ state: 'unknown' }), checkoutMessage());
});
