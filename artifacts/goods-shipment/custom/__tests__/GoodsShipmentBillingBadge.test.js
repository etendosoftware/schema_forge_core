import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'GoodsShipmentBillingBadge.jsx'), 'utf8');

describe('GoodsShipmentBillingBadge', () => {
  it('exports a default function component named GoodsShipmentBillingBadge', () => {
    assert.match(src, /export default function GoodsShipmentBillingBadge/);
  });

  it('imports useUI from @/i18n', () => {
    assert.match(src, /import\s*\{[^}]*useUI[^}]*\}\s*from\s*['"]@\/i18n['"]/);
  });

  it('imports DocumentStatusPill from @/components/contract-ui/DocumentStatusPill', () => {
    assert.match(src, /import\s+DocumentStatusPill\s+from\s*['"]@\/components\/contract-ui\/DocumentStatusPill['"]/);
  });

  describe('null guard — only renders for completed shipments', () => {
    it('checks documentStatus equals CO before rendering', () => {
      assert.match(src, /data\?\.documentStatus\s*===\s*['"]CO['"]/);
    });

    it('returns null when the shipment is not completed', () => {
      assert.match(src, /if\s*\(\s*!isCompleted\s*\)\s*return null/);
    });
  });

  describe('invoice percentage calculation', () => {
    it('reads completelyInvoiced from data as the fallback source', () => {
      assert.match(src, /data\?\.completelyInvoiced/);
    });

    it('treats boolean true as 100% invoiced', () => {
      assert.match(src, /ci\s*===\s*true/);
    });

    it('treats string "true" as 100% invoiced', () => {
      assert.match(src, /ci\s*===\s*'true'/);
    });

    it('treats string "Y" as 100% invoiced', () => {
      assert.match(src, /ci\s*===\s*'Y'/);
    });

    it('uses data.invoiceStatus as the primary numeric source', () => {
      assert.match(src, /data\?\.invoiceStatus/);
    });

    it('falls back to completelyInvoiced-derived percentage when invoiceStatus is null/undefined', () => {
      assert.match(src, /invoiceStatus\s*!=\s*null\s*\?[^:]*:\s*fallbackPct/);
    });
  });

  describe('tone mapping', () => {
    it('maps pct >= 100 to success tone', () => {
      assert.match(src, /pct\s*>=\s*100\s*\?\s*['"]success['"]/);
    });

    it('maps pct > 0 (but < 100) to warning tone', () => {
      assert.match(src, /pct\s*>\s*0\s*\?\s*['"]warning['"]/);
    });

    it('maps pct === 0 to neutral tone', () => {
      assert.match(src, /['"]neutral['"]/);
    });
  });

  describe('i18n label mapping — no hardcoded English strings', () => {
    it('maps pct >= 100 to the invoiced i18n key via ui()', () => {
      assert.match(src, /ui\(['"]invoiced['"]\)/);
    });

    it('maps pct > 0 to the partiallyInvoiced i18n key via ui()', () => {
      assert.match(src, /ui\(['"]partiallyInvoiced['"]\)/);
    });

    it('maps pct === 0 to the pending i18n key via ui()', () => {
      assert.match(src, /ui\(['"]pending['"]\)/);
    });

    it('does not hardcode "Invoiced" as a literal string', () => {
      assert.doesNotMatch(src, /['"](Invoiced|Partially Invoiced|Pending)['"]/);
    });
  });

  describe('DocumentStatusPill rendering', () => {
    it('passes tone prop to DocumentStatusPill', () => {
      assert.match(src, /<DocumentStatusPill[^/]*tone=\{tone\}/s);
    });

    it('passes label prop to DocumentStatusPill', () => {
      assert.match(src, /<DocumentStatusPill[^/]*label=\{label\}/s);
    });

    it('passes a status prop to DocumentStatusPill', () => {
      assert.match(src, /<DocumentStatusPill[^/]*status=/s);
    });
  });
});
