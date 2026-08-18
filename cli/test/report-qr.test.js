import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDocumentQrText,
  computeDocumentQrDataUrl,
} from '../../templates/reports/helpers/report-html-helpers.js';

describe('buildDocumentQrText', () => {
  const fullHeader = {
    doc_type: 'AR Invoice',
    documentno: 'INV-1001',
    dateinvoiced: '2026-08-10T00:00:00.000Z',
    bp_name: 'ACME Corp',
    grandtotal: '1210.00',
    currency: 'EUR',
    org_taxid: 'B12345678',
    status: 'CO',
  };

  it('joins all known fields with pipes, prefixed, in canonical order', () => {
    assert.equal(
      buildDocumentQrText(fullHeader),
      'T:AR Invoice|N:INV-1001|D:2026-08-10|BP:ACME Corp|$:1210.00|C:EUR|TID:B12345678|S:CO'
    );
  });

  it('truncates dateinvoiced to the first 10 chars (date-only)', () => {
    const text = buildDocumentQrText({ dateinvoiced: '2026-08-10T15:30:00Z' });
    assert.equal(text, 'D:2026-08-10');
  });

  it('skips missing fields without leaving empty segments', () => {
    const text = buildDocumentQrText({ documentno: 'INV-2', status: 'DR' });
    assert.equal(text, 'N:INV-2|S:DR');
  });

  it('ignores unknown header fields', () => {
    assert.equal(buildDocumentQrText({ foo: 'bar', documentno: 'X' }), 'N:X');
  });

  it('returns "empty" for a header object with no known fields', () => {
    assert.equal(buildDocumentQrText({}), 'empty');
  });

  it('returns "no data" when there is no header', () => {
    assert.equal(buildDocumentQrText(null), 'no data');
    assert.equal(buildDocumentQrText(undefined), 'no data');
    assert.equal(buildDocumentQrText('not-an-object'), 'no data');
  });

  // Date fallback chain — each document type historically used its own field.
  it('uses dateordered for orders/quotations (D: prefix, truncated)', () => {
    assert.equal(
      buildDocumentQrText({ documentno: 'SO-1', dateordered: '2026-08-01T09:00:00Z' }),
      'N:SO-1|D:2026-08-01'
    );
  });

  it('uses movementdate for shipments/receipts (no amount/currency fields)', () => {
    assert.equal(
      buildDocumentQrText({ doc_type: 'Shipment', documentno: 'SH-1', movementdate: '2026-08-02T00:00:00Z', bp_name: 'ACME', status: 'CO' }),
      'T:Shipment|N:SH-1|D:2026-08-02|BP:ACME|S:CO'
    );
  });

  it('uses paymentdate and amount for payments', () => {
    assert.equal(
      buildDocumentQrText({ documentno: 'PAY-1', paymentdate: '2026-08-03T12:00:00Z', amount: '500.00', currency: 'EUR' }),
      'N:PAY-1|D:2026-08-03|$:500.00|C:EUR'
    );
  });

  it('prefers dateinvoiced and grandtotal when multiple candidates exist', () => {
    assert.equal(
      buildDocumentQrText({ dateinvoiced: '2026-08-10', dateordered: '2026-08-01', grandtotal: '100', amount: '99' }),
      'D:2026-08-10|$:100'
    );
  });

  it('skips falsy field values (empty string, 0, null)', () => {
    assert.equal(
      buildDocumentQrText({ documentno: '', grandtotal: 0, currency: null, status: 'CO' }),
      'S:CO'
    );
  });
});

describe('computeDocumentQrDataUrl', () => {
  it('returns a PNG data URL for a full header', async () => {
    const url = await computeDocumentQrDataUrl({ documentno: 'INV-1001', status: 'CO' });
    assert.ok(url.startsWith('data:image/png;base64,'), `unexpected prefix: ${url.slice(0, 30)}`);
  });

  it('still returns a QR ("no data") when header is missing', async () => {
    const url = await computeDocumentQrDataUrl(null);
    assert.ok(url.startsWith('data:image/png;base64,'));
  });

  it('encodes the exact text and options via an injected qrcode module', async () => {
    const calls = [];
    const fakeQrcode = {
      toDataURL: async (text, options) => {
        calls.push({ text, options });
        return 'data:image/png;base64,FAKE';
      },
    };
    const url = await computeDocumentQrDataUrl(
      { documentno: 'INV-7', currency: 'USD' },
      { qrcode: fakeQrcode }
    );
    assert.equal(url, 'data:image/png;base64,FAKE');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].text, 'N:INV-7|C:USD');
    assert.deepEqual(calls[0].options, { width: 120, margin: 1 });
  });

  it('produces identical output for identical headers (deterministic)', async () => {
    const header = { documentno: 'INV-9' };
    const [a, b] = await Promise.all([
      computeDocumentQrDataUrl(header),
      computeDocumentQrDataUrl(header),
    ]);
    assert.equal(a, b);
  });
});
