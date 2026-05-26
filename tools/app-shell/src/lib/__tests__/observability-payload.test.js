import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEventPayload,
  extractWindowName,
  normalizeRoute,
  sanitizeEventProperties,
} from '../observability/payload.js';

describe('observability payload normalization', () => {
  it('strips query strings, hashes, and raw URLs from routes', () => {
    assert.equal(
      normalizeRoute('/authorize?code=abc&state=oauth-state#token'),
      '/authorize'
    );
    assert.equal(
      normalizeRoute('https://go.etendo.cloud/sales-order/ABC123?token=secret#frag'),
      '/sales-order/:recordId'
    );
  });

  it('normalizes record-detail routes without leaking record ids', () => {
    assert.equal(normalizeRoute('/sales-order/ABC123'), '/sales-order/:recordId');
    assert.equal(
      normalizeRoute('/purchase-invoice/12345678901234567890'),
      '/purchase-invoice/:recordId'
    );
  });

  it('normalizes dynamic nested segments and keeps safe route names', () => {
    assert.equal(
      normalizeRoute('/reports/run/550e8400-e29b-41d4-a716-446655440000'),
      '/reports/run/:id'
    );
    assert.equal(normalizeRoute('/artifacts/sales-order'), '/artifacts/sales-order');
  });

  it('extracts only the safe top-level route as windowName', () => {
    assert.equal(extractWindowName('/sales-order/:recordId'), 'sales-order');
    assert.equal(extractWindowName('/'), undefined);
  });

  it('allowlists event properties and removes sensitive fields', () => {
    assert.deepEqual(
      sanitizeEventProperties({
        action: 'open',
        component: 'menu',
        documentId: 'secret-doc-id',
        label: 'Customer Name',
        rawUrl: '/sales-order/ABC123?token=secret',
        token: 'secret',
        url: 'https://example.test',
      }),
      {
        action: 'open',
        component: 'menu',
      }
    );
  });

  it('builds a safe event envelope with common metadata', () => {
    const payload = buildEventPayload({
      route: '/sales-order/ABC123?code=secret&state=secret#hash',
      metadata: {
        app: 'app-shell',
        environment: 'staging',
        hostname: 'go.staging.etendo.cloud',
        mockMode: false,
      },
      properties: {
        action: 'view',
        documentNo: 'SO-001',
        status: 'opened',
      },
      timestamp: '2026-05-19T00:00:00.000Z',
    });

    assert.deepEqual(payload, {
      app: 'app-shell',
      environment: 'staging',
      hostname: 'go.staging.etendo.cloud',
      mockMode: false,
      action: 'view',
      status: 'opened',
      timestamp: '2026-05-19T00:00:00.000Z',
      route: '/sales-order/:recordId',
      routePattern: '/sales-order/:recordId',
      windowName: 'sales-order',
    });
  });
});
