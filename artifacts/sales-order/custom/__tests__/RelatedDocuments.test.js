import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'RelatedDocuments.jsx'), 'utf8');

describe('sales-order RelatedDocuments', () => {
  it('exports a default function component', () => {
    assert.match(src, /export default function RelatedDocuments/);
  });

  it('imports useUI from @/i18n', () => {
    assert.match(src, /from\s+['"]@\/i18n['"]/);
    assert.match(src, /useUI/);
  });

  describe('quotation chip (regression: was hardcoded CO/Completed)', () => {
    it('sets the linked-quotation status to CA (Closed - Order Created)', () => {
      assert.match(src, /qStatus\s*=\s*'CA'/);
    });

    it('does not hardcode CO as the quotation status', () => {
      assert.doesNotMatch(src, /qStatus\s*=\s*'CO'/);
    });

    it('renders the quotation title via i18n key quotationDoc', () => {
      assert.match(src, /ui\(\s*'quotationDoc'\s*,\s*\{\s*number:/);
    });

    it('falls back to ui("quotation") when no identifier is available', () => {
      assert.match(src, /qTitle\s*=\s*ui\(\s*'quotation'\s*\)/);
    });
  });

  describe('STATUS_LABEL_KEYS map', () => {
    const expected = {
      CO:   'statusComplete',
      DR:   'statusDraft',
      VO:   'statusVoid',
      CL:   'statusClosed',
      CA:   'statusOrderCreated',
      RPPC: 'statusPaymentCleared',
      RPR:  'statusPaymentReceived',
      PWNC: 'statusWithdrawnNotCleared',
      RDNC: 'statusDepositedNotCleared',
    };

    for (const [code, key] of Object.entries(expected)) {
      it(`maps ${code} → '${key}'`, () => {
        const re = new RegExp(`${code}\\s*:\\s*['"]${key}['"]`);
        assert.match(src, re);
      });
    }
  });

  describe('i18n compliance', () => {
    it('does not hardcode English status labels', () => {
      assert.doesNotMatch(src, /['"`](Completed|Draft|Voided|Closed|Received|Pending|Deposited)['"`]/);
    });

    it('does not hardcode the document title prefixes', () => {
      assert.doesNotMatch(src, /['"`](Shipment|Invoice|Payment|Quotation) #/);
    });

    it('renders shipment titles via the shipmentDoc key', () => {
      assert.match(src, /titleKey:\s*'shipmentDoc'/);
    });

    it('renders invoice titles via the invoiceDoc key', () => {
      assert.match(src, /titleKey:\s*'invoiceDoc'/);
    });

    it('renders payment titles via the paymentDoc key', () => {
      assert.match(src, /ui\(\s*'paymentDoc'\s*,\s*\{\s*number:/);
    });

    it('resolves the chip status label via STATUS_LABEL_KEYS + ui()', () => {
      assert.match(src, /resolveStatusLabel\s*\(\s*[a-zA-Z.$]+\s*,\s*ui\s*\)/);
    });
  });
});
