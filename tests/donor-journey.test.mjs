import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypescript } from './load-typescript.mjs';
const { readDonorSession, accountReturnPath } = await loadTypescript('../src/features/donors/session-state.ts');
const { operationSnapshot, createCheckoutOperation } = await loadTypescript('../src/features/donations/data/checkout-operation.ts');
const { collectionLabel, issuedReceipts } = await loadTypescript('../src/features/donors/contributions.ts');
const project = { id: 1, reference: 'PROJECT-TEST', currency: 'EGP' };
const guest = { amount: '12.34', name: 'Contact, not account owner', email: 'different@example.test', phone: '+201001234567', is_public_anonymous: false };
const billing = { first_name: 'Synthetic', last_name: 'Payer', phone_number: '+201001234567', email: 'payer@example.test', street: 'Test Street', building: '12', floor: '2', apartment: '3', city: 'Test City', state: 'Test State', country: 'EG' };
const config = { enabled: true, gateway: 'synthetic', hosts: ['checkout.example.test'], authenticated: true };
const now = Date.parse('2026-10-27T10:00:00Z'), expires = '2026-10-27T10:10:00Z';
const responses = [
  { data: { id: 12, reference: 'DON-SYNTHETIC', amount_minor: 1234, currency: 'EGP', status: 'initiated', reservation_state: 'none', is_public_anonymous: false, created_at: '2026-10-27T10:00:00Z', project: { reference: 'PROJECT-TEST', title: 'Test' }, is_general: false } },
  { data: { reference: 'DON-SYNTHETIC', status: 'initiated', reservation: { applicable: true, state: 'active', expires_at: expires }, next_step: 'payment_not_initiated' } },
  { data: { donation_reference: 'DON-SYNTHETIC' }, idempotent_replay: false },
  { data: { checkout_url: 'https://checkout.example.test/synthetic', expires_at: expires } },
];
test('session is validated through the existing profile API after refresh, with no token exposure', async () => {
  const session = await readDonorSession(async (url, options) => {
    assert.equal(url, '/api/donor/profile'); assert.equal(options.credentials, 'same-origin'); assert.equal(options.cache, 'no-store');
    return Response.json({ data: { id: 7, name: 'Synthetic donor', email: 'user@example.test', token: 'must-not-propagate' } });
  });
  assert.equal(session.status, 'authenticated'); assert.equal(session.profile.token, undefined);
  assert.equal((await readDonorSession(async () => Response.json({}, { status: 401 }))).status, 'guest');
  assert.equal((await readDonorSession(async () => Response.json({}, { status: 401 }), true)).status, 'expired');
  assert.equal((await readDonorSession(async () => { throw Error('outage'); })).status, 'unavailable');
});
test('account return destinations cannot redirect outside account routes', () => {
  for (const path of ['/account', '/account/receipts', '/account/contributions', '/account/contributions/12', '/account/donate/1']) assert.equal(accountReturnPath(path), path);
  for (const path of ['https://evil.test', '//evil.test', '/donate/1', '/account?next=//evil.test', '/account/donate/1/../../evil', '/account/donate/0']) assert.equal(accountReturnPath(path), '/account');
});
test('registered checkout sends only owned APIs and cannot use contact fields to establish ownership', async () => {
  const requests = [], navigate = [];
  const op = createCheckoutOperation(operationSnapshot(project, guest, billing, config), { now: () => now, navigate: url => navigate.push(url), fetch: async (path, options) => {
    requests.push({ path, ...options }); return Response.json(responses[requests.length - 1], { status: requests.length === 1 || requests.length === 3 ? 201 : 200 });
  } });
  await Promise.all([op.run(), op.run()]);
  assert.deepEqual(requests.map(r => r.path), ['/api/donor/donations', '/api/donor/donations/12/reserve', '/api/donor/donations/12/payment', '/api/donor/donations/12/checkout']);
  assert.deepEqual(JSON.parse(requests[0].body), { amount: '12.34', donation_project_id: 1, is_public_anonymous: false });
  assert.equal(navigate.length, 1); assert.notEqual(requests[0].headers['Idempotency-Key'], requests[2].headers['Idempotency-Key']);
});
for (let failureStage = 0; failureStage < 4; failureStage++) test(`session expiry at owned stage ${failureStage} never falls back to guest or repeats a payment`, async () => {
  const paths = [];
  const op = createCheckoutOperation(operationSnapshot(project, guest, billing, config), { now: () => now, navigate: () => assert.fail('Must not navigate'), fetch: async path => {
    const index = paths.length; paths.push(path);
    return index === failureStage ? Response.json({ message: 'Unauthenticated.' }, { status: 401 }) : Response.json(responses[index], { status: index === 0 || index === 2 ? 201 : 200 });
  } });
  await op.run(); await op.run();
  assert.equal(paths.length, failureStage + 1); assert(paths.every(p => p.startsWith('/api/donor/')));
  assert.equal(op.getState().status, 'attention'); assert.match(op.getState().message, /انتهت جلسة/);
});
test('collection is independent of payment success, and only issued confirmed-donation receipts appear', () => {
  const receipt = { uuid: 'synthetic', issued_at: '2026-10-27T10:00:00Z', generation_status: 'pending' };
  const pending = { status: 'initiated', payment_status: 'paid', receipts: [receipt] };
  assert.equal(collectionLabel(pending), 'لم يُؤكد التحصيل'); assert.deepEqual(issuedReceipts(pending), []);
  assert.equal(collectionLabel({ ...pending, status: 'confirmed' }), 'تم التحصيل');
  assert.equal(issuedReceipts({ ...pending, status: 'confirmed', receipts: [receipt, { ...receipt, issued_at: null }] }).length, 1);
});
