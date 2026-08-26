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

// ---------------------------------------------------------------------------
// Verifactu mode (ETP-4912)
//
// Invoice printables mark their header with `qr_mode: 'verifactu'` and carry the
// AEAT validation URL precomputed by classic in `verifactu_qr_url`. The QR must
// encode that URL verbatim, and must not be rendered at all when it is absent.
// ---------------------------------------------------------------------------

const AEAT_URL =
  'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR' +
  '?nif=A39200019&numserie=10000014&fecha=16-04-2026&importe=1355.20';

describe('buildDocumentQrText — Verifactu mode', () => {
  it('returns the AEAT URL verbatim, with query params untouched', () => {
    const text = buildDocumentQrText({ qr_mode: 'verifactu', verifactu_qr_url: AEAT_URL });
    assert.equal(text, AEAT_URL);
    // The URL must survive character for character: unescaped '&', all four params,
    // no truncation. A mangled URL yields a QR the AEAT validator rejects.
    assert.equal(text.split('&').length, 4);
    assert.ok(text.includes('nif=A39200019'));
    assert.ok(text.includes('numserie=10000014'));
    assert.ok(text.includes('fecha=16-04-2026'));
    assert.ok(text.includes('importe=1355.20'));
  });

  it('ignores the document fields entirely when the AEAT URL is present', () => {
    // A real invoice header carries both; the internal fields must not leak in.
    const text = buildDocumentQrText({
      qr_mode: 'verifactu',
      verifactu_qr_url: AEAT_URL,
      documentno: 'INV-1001',
      grandtotal: '1210.00',
      status: 'CO',
    });
    assert.equal(text, AEAT_URL);
  });

  it('returns empty (no QR) when the AEAT URL has not been issued yet', () => {
    // Classic writes the URL when the Registro de Facturacion is generated, so a
    // completed-but-unregistered invoice has none. It must print NO QR rather than
    // fall back to the internal string — a non-AEAT QR on a Verifactu invoice is wrong.
    for (const value of [null, undefined, '', '   ', '\t\n']) {
      assert.equal(buildDocumentQrText({ qr_mode: 'verifactu', verifactu_qr_url: value }), '');
    }
    assert.equal(buildDocumentQrText({ qr_mode: 'verifactu' }), '');
  });

  it('trims surrounding whitespace from the stored URL', () => {
    assert.equal(
      buildDocumentQrText({ qr_mode: 'verifactu', verifactu_qr_url: `  ${AEAT_URL}\n` }),
      AEAT_URL
    );
  });

  it('leaves every other printable on the internal pipe-string (regression guard)', () => {
    // The other seven print-* reports share this helper. Without qr_mode they must
    // behave exactly as before, whatever else the header happens to carry.
    assert.equal(
      buildDocumentQrText({ documentno: 'SO-5', currency: 'EUR', verifactu_qr_url: AEAT_URL }),
      'N:SO-5|C:EUR'
    );
    assert.equal(buildDocumentQrText({ qr_mode: 'internal', documentno: 'SO-6' }), 'N:SO-6');
  });
});

describe('computeDocumentQrDataUrl — Verifactu mode', () => {
  it('encodes the AEAT URL at AEAT-compliant options (40mm, level M)', async () => {
    const calls = [];
    const fakeQrcode = {
      toDataURL: async (text, options) => {
        calls.push({ text, options });
        return 'data:image/png;base64,FAKE';
      },
    };
    await computeDocumentQrDataUrl(
      { qr_mode: 'verifactu', verifactu_qr_url: AEAT_URL },
      { qrcode: fakeQrcode }
    );
    assert.equal(calls[0].text, AEAT_URL);
    assert.equal(calls[0].options.errorCorrectionLevel, 'M', 'AEAT spec art. 21.1 mandates level M');
    assert.equal(calls[0].options.width, 400);
  });

  it('keeps enough pixels per module to scan when printed at 40mm', async () => {
    // AEAT spec section 3: the QR is printed at 30-40mm. The URL is a version-7
    // symbol at level M (45x45 modules), so the inherited width of 120 would leave
    // 2.55px per module — too coarse for raster print. Guard the real ratio.
    const QRCode = (await import('qrcode')).default;
    const symbol = QRCode.create(AEAT_URL, { errorCorrectionLevel: 'M' });
    const modules = symbol.modules.size;
    const pxPerModule = 400 / (modules + 2); // +2 for the 1-module quiet zone each side
    assert.ok(
      pxPerModule >= 8,
      `expected >=8px per module for print, got ${pxPerModule.toFixed(2)} (${modules} modules)`
    );
  });

  it('returns no data URL at all when there is nothing to encode', async () => {
    // Never `<img src="">`: the templates guard on a falsy qrDataUrl.
    assert.equal(await computeDocumentQrDataUrl({ qr_mode: 'verifactu' }), '');
    assert.equal(
      await computeDocumentQrDataUrl({ qr_mode: 'verifactu', verifactu_qr_url: '  ' }),
      ''
    );
  });

  it('does not call the qrcode module when there is nothing to encode', async () => {
    let called = false;
    const fakeQrcode = { toDataURL: async () => { called = true; return 'x'; } };
    await computeDocumentQrDataUrl({ qr_mode: 'verifactu' }, { qrcode: fakeQrcode });
    assert.equal(called, false);
  });

  it('leaves non-Verifactu options untouched across repeated calls', async () => {
    // QRCode.toDataURL mutates the options object it receives, so a shared constant
    // would leak `color: {}` (and friends) into every later render.
    const calls = [];
    const fakeQrcode = {
      toDataURL: async (text, options) => {
        calls.push({ ...options }); // snapshot BEFORE mutating, or we assert on our own mutation
        options.color = { dark: '#000' }; // simulate the real module's mutation
        return 'data:image/png;base64,FAKE';
      },
    };
    await computeDocumentQrDataUrl({ documentno: 'A' }, { qrcode: fakeQrcode });
    await computeDocumentQrDataUrl({ documentno: 'B' }, { qrcode: fakeQrcode });
    assert.deepEqual(calls[1], { width: 120, margin: 1 });
  });
});
