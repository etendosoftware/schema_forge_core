import test from 'node:test';
import assert from 'node:assert/strict';
import { createCheckoutSession, getCheckoutStatus } from '../src/checkout/index.js';

test('hosted checkout request is authenticated and contains no card data', async () => {
  let request;
  const result = await createCheckoutSession(async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ requestId: 'req-1', checkoutUrl: 'https://sandbox.example/checkout' }) };
  }, 'https://api.example/', 'session-token', { clientName: 'Acme' });
  assert.equal(result.requestId, 'req-1');
  assert.equal(request.url, 'https://api.example/sws/go/checkout/sessions');
  assert.equal(request.options.headers.Authorization, 'Bearer session-token');
  assert.doesNotMatch(request.options.body, /card|cvc|number/i);
});

test('checkout status and server errors are surfaced', async () => {
  const status = await getCheckoutStatus(async () => ({ ok: true, json: async () => ({ status: 'paid' }) }), 'https://api', 't', 'req/1');
  assert.equal(status.status, 'paid');
  await assert.rejects(() => createCheckoutSession(async () => ({ ok: false, json: async () => ({ code: 'MISSING_CONFIG' }) }), 'https://api', 't'), /MISSING_CONFIG/);
});
