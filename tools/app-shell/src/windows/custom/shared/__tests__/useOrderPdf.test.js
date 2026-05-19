import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'useOrderPdf.js'), 'utf8');

describe('useOrderPdf', () => {

  // ── Exports ──────────────────────────────────────────────────────────────

  it('exports useOrderPdf as a named export', () => {
    assert.match(src, /export function useOrderPdf/);
  });

  it('accepts orderId, apiBaseUrl and token parameters', () => {
    assert.match(src, /useOrderPdf\(orderId,\s*apiBaseUrl,\s*token\)/);
  });

  it('returns pdfUrl, pdfBlob, loading and error', () => {
    assert.match(src, /return \{ pdfUrl, pdfBlob, loading, error \}/);
  });

  // ── API endpoints ─────────────────────────────────────────────────────────

  it('fetches header from the sales-order header endpoint', () => {
    assert.match(src, /sales-order\/header\/\$\{orderId\}/);
  });

  it('fetches lines from the sales-order lines endpoint with parentId', () => {
    assert.match(src, /sales-order\/lines\?parentId=\$\{orderId\}/);
  });

  it('fetches header and lines in parallel via Promise.all', () => {
    assert.match(src, /Promise\.all/);
  });

  it('optionally fetches session to resolve the company document image', () => {
    assert.match(src, /\/session/);
    assert.match(src, /yourCompanyDocumentImageId/);
  });

  it('derives the base URL by stripping the spec segment from apiBaseUrl', () => {
    assert.match(src, /apiBaseUrl\.replace/);
  });

  // ── Field mappings ────────────────────────────────────────────────────────

  it('maps quantity using orderedQuantity with qtyOrdered as fallback', () => {
    assert.match(src, /l\.orderedQuantity \?\? l\.qtyOrdered \?\? 0/);
  });

  it('does NOT include a validUntil field in the returned data object', () => {
    assert.doesNotMatch(src, /validUntil:/);
  });

  it('renders company identity block with name, address and tax ID', () => {
    assert.match(src, /companyName/);
    assert.match(src, /companyAddress1/);
    assert.match(src, /companyTaxId/);
  });

  it('pulls the issuer organization from the session endpoint', () => {
    assert.match(src, /session\?\.organization/);
  });

  it('sorts lines by lineNo before mapping', () => {
    assert.match(src, /linesSorted.*sort|sort.*lineNo/s);
  });

  it('calculates taxAmount as grandTotal minus netAmount', () => {
    assert.match(src, /grandTotal - netAmount/);
  });

  // ── Memory management ─────────────────────────────────────────────────────

  it('revokes the previous blob URL on cleanup to avoid memory leaks', () => {
    assert.match(src, /URL\.revokeObjectURL/);
    assert.match(src, /prevUrlRef\.current/);
  });

  // ── Cancellation ─────────────────────────────────────────────────────────

  it('uses a cancellation flag to prevent setState after unmount', () => {
    assert.match(src, /let cancelled = false/);
    assert.match(src, /cancelled = true/);
    assert.match(src, /if \(cancelled\)/);
  });

  it('early-returns from useEffect when orderId is null', () => {
    assert.match(src, /if \(!orderId \|\|/);
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it('propagates error messages to the error state', () => {
    assert.match(src, /setError\(err\.message\)/);
  });

  // ── i18n ─────────────────────────────────────────────────────────────────

  it('uses orderPdfTitle i18n key for the document title label', () => {
    assert.match(src, /orderPdfTitle/);
  });

  it('uses orderPdfDate i18n key for the date label', () => {
    assert.match(src, /orderPdfDate/);
  });

  it('uses orderPdfColQty i18n key for the quantity column label', () => {
    assert.match(src, /orderPdfColQty/);
  });

  // ── Discount breakdown ────────────────────────────────────────────────────

  describe('discount breakdown', () => {
    it('computes grossAmount from raw lines using getGrossLine helper', () => {
      assert.match(src, /getGrossLine/);
      assert.match(src, /linesRaw\.reduce/);
    });

    it('uses listPrice when available to compute the gross line amount', () => {
      assert.match(src, /l\.listPrice != null/);
    });

    it('falls back to lineNetAmount derivation when listPrice is null', () => {
      assert.match(src, /lineNet \/ \(1 - disc \/ 100\)/);
    });

    it('computes discountPerProduct as Math.max(0, grossAmount - productNetAmount)', () => {
      assert.match(src, /Math\.max\(0, grossAmount - productNetAmount\)/);
    });

    it('reads etgoTotalDiscount from header', () => {
      assert.match(src, /header\.etgoTotalDiscount/);
    });

    it('computes totalDiscountAmt only when etgoTotalDiscount > 0', () => {
      assert.match(src, /etgoTotalDiscount > 0 \? productNetAmount \* etgoTotalDiscount/);
    });

    it('passes null for grossAmount when discountPerProduct is 0', () => {
      assert.match(src, /discountPerProduct > 0 \? grossAmount : null/);
    });

    it('passes null for totalDiscountAmt when no total discount applies', () => {
      assert.match(src, /totalDiscountAmt > 0 \? totalDiscountAmt : null/);
    });

    it('includes subtotalWithoutDiscount label key in labels object', () => {
      assert.match(src, /subtotalWithoutDiscount/);
    });

    it('includes discountPerProduct label key in labels object', () => {
      assert.match(src, /discountPerProduct/);
    });

    it('includes totalDiscount label key in labels object', () => {
      assert.match(src, /totalDiscount/);
    });
  });
});
