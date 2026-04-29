import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'QuotationConfirmModal.jsx'), 'utf8');

describe('QuotationConfirmModal', () => {
  it('exports a default function component', () => {
    assert.match(src, /export default function QuotationConfirmModal/);
  });

  it('accepts quotationId, data, token, apiBaseUrl and onClose props', () => {
    assert.match(src, /quotationId/);
    assert.match(src, /apiBaseUrl/);
    assert.match(src, /onClose/);
  });

  describe('success state — created document label', () => {
    it('renders Invoice #X when an invoice was created (regression: was always Order #X)', () => {
      assert.match(
        src,
        /createdDoc\.type\s*===\s*'invoice'\s*\?\s*'invoiceDoc'\s*:\s*'orderDoc'/,
      );
    });

    it('still resolves the doc-label header from createdDoc.type', () => {
      assert.match(src, /createdDoc\.type\s*===\s*'order'\s*\?\s*ui\('sqOrderCreated'\)\s*:\s*ui\('soInvoiceCreated'\)/);
    });

    it('uses the View Invoice / View Order primary button label by createdDoc.type', () => {
      assert.match(src, /createdDoc\.type\s*===\s*'order'\s*\?\s*ui\('sqViewOrder'\)\s*:\s*ui\('soViewInvoice'\)/);
    });

    it('only renders the document-number span when documentNo is present', () => {
      assert.match(src, /createdDoc\.documentNo\s*&&\s*\(/);
    });
  });

  describe('i18n', () => {
    it('uses the useUI() hook for translations', () => {
      assert.match(src, /from\s+['"]@\/i18n['"]/);
      assert.match(src, /useUI\(\)/);
    });

    it('does not hardcode the English strings "Order #" or "Invoice #"', () => {
      assert.doesNotMatch(src, /['"`]\s*Order\s+#/);
      assert.doesNotMatch(src, /['"`]\s*Invoice\s+#/);
    });
  });
});
