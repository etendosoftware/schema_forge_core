import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'GoodsReceiptBottomPanel.jsx'), 'utf8');

describe('GoodsReceiptBottomPanel', () => {
  describe('ReceiptLinesEmptyState', () => {
    it('imports LinesEmptyState from contract-ui instead of duplicating it', () => {
      assert.match(src, /LinesEmptyState.*from.*@\/components\/contract-ui/);
    });

    it('uses LinesEmptyState as the base component', () => {
      assert.match(src, /<LinesEmptyState/);
    });

    it('passes description prop with addLinesManuallyOrImportFromPurchaseOrder i18n key', () => {
      assert.match(src, /description=\{ui\('addLinesManuallyOrImportFromPurchaseOrder'\)\}/);
    });

    it('passes secondaryAction prop to LinesEmptyState', () => {
      assert.match(src, /secondaryAction=\{importButton\}/);
    });

    it('derives importButton from businessPartner field', () => {
      assert.match(src, /bpId\s*=\s*data\?\.businessPartner/);
    });

    it('renders importButton only when bpId exists', () => {
      assert.match(src, /bpId\s*\?/);
      assert.match(src, /:\s*null/);
    });

    it('renders the import SVG icon with upload arrow shape', () => {
      // Upload arrow: vertical line from 3 to 15, polyline 17-8-12-3-7-8
      assert.match(src, /M21 15v4/);
      assert.match(src, /17 8 12 3 7 8/);
      assert.match(src, /x1="12".*y1="3".*x2="12".*y2="15"/);
    });

    it('uses importFromPurchaseOrder i18n key for the import button label', () => {
      assert.match(src, /ui\('importFromPurchaseOrder'\)/);
    });

    it('opens the import modal when import button is clicked', () => {
      assert.match(src, /setShowImportModal\(true\)/);
    });

    it('passes data and onAddLine through to LinesEmptyState', () => {
      assert.match(src, /data=\{data\}/);
      assert.match(src, /onAddLine=\{onAddLine\}/);
    });
  });

  describe('GoodsReceiptBottomPanel static slots', () => {
    it('assigns ReceiptLinesEmptyState to linesEmptyState slot', () => {
      assert.match(src, /GoodsReceiptBottomPanel\.linesEmptyState\s*=\s*ReceiptLinesEmptyState/);
    });

    it('assigns ReceiptLineActions to detailExtraActions slot', () => {
      assert.match(src, /GoodsReceiptBottomPanel\.detailExtraActions\s*=\s*ReceiptLineActions/);
    });

    it('sets showLineTotals to false', () => {
      assert.match(src, /GoodsReceiptBottomPanel\.showLineTotals\s*=\s*false/);
    });
  });
});
