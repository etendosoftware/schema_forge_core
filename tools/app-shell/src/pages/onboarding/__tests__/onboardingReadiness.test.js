import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkSalesInvoiceReadiness, READINESS_ENDPOINTS } from '../onboardingReadiness.js';

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function createFetchByUrl(responses) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const entry = responses.find(response => url.includes(response.includes));
    if (!entry) throw new Error(`Unexpected URL: ${url}`);
    return jsonResponse(entry.status, entry.body);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

const readyResponses = [
  { includes: READINESS_ENDPOINTS.session, status: 200, body: { user: 'qa' } },
  { includes: READINESS_ENDPOINTS.defaults, status: 200, body: { documentType: 'DOC_TYPE_1' } },
  { includes: READINESS_ENDPOINTS.paymentTerms, status: 200, body: { items: [{ id: 'TERM_1', label: 'Immediate' }] } },
  { includes: READINESS_ENDPOINTS.customers, status: 200, body: { items: [{ id: 'BP_1', label: 'QA Customer' }] } },
];

describe('checkSalesInvoiceReadiness', () => {
  it('passes when session, defaults, payment terms, customers, and document type are usable', async () => {
    const fetchImpl = createFetchByUrl(readyResponses);

    const result = await checkSalesInvoiceReadiness(fetchImpl, '', 'env-token');

    assert.equal(result.ready, true);
    assert.deepEqual(result.failures, []);
    assert.equal(fetchImpl.calls.length, 4);
    assert.equal(fetchImpl.calls[0].options.headers.Authorization, 'Bearer env-token');
  });

  it('fails when the session endpoint is unauthorized', async () => {
    const fetchImpl = createFetchByUrl([
      { includes: READINESS_ENDPOINTS.session, status: 401, body: {} },
      ...readyResponses.slice(1),
    ]);

    const result = await checkSalesInvoiceReadiness(fetchImpl, '', 'env-token');

    assert.equal(result.ready, false);
    assert.match(result.failures.join('\n'), /session/i);
  });

  it('fails when payment terms are missing', async () => {
    const fetchImpl = createFetchByUrl([
      readyResponses[0],
      readyResponses[1],
      { includes: READINESS_ENDPOINTS.paymentTerms, status: 200, body: { items: [] } },
      readyResponses[3],
    ]);

    const result = await checkSalesInvoiceReadiness(fetchImpl, '', 'env-token');

    assert.equal(result.ready, false);
    assert.match(result.failures.join('\n'), /payment term/i);
  });

  it('fails when customer selector is empty', async () => {
    const fetchImpl = createFetchByUrl([
      readyResponses[0],
      readyResponses[1],
      readyResponses[2],
      { includes: READINESS_ENDPOINTS.customers, status: 200, body: { items: [] } },
    ]);

    const result = await checkSalesInvoiceReadiness(fetchImpl, '', 'env-token');

    assert.equal(result.ready, false);
    assert.match(result.failures.join('\n'), /customer/i);
  });

  it('fails when document type is zero', async () => {
    const fetchImpl = createFetchByUrl([
      readyResponses[0],
      { includes: READINESS_ENDPOINTS.defaults, status: 200, body: { documentType: '0' } },
      readyResponses[2],
      readyResponses[3],
    ]);

    const result = await checkSalesInvoiceReadiness(fetchImpl, '', 'env-token');

    assert.equal(result.ready, false);
    assert.match(result.failures.join('\n'), /document type/i);
  });
});
