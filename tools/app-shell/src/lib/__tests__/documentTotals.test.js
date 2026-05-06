import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { computeDocumentTotals } from '../documentTotals.js';

const CONFIG = {
  qtyField: 'orderedQuantity',
  priceField: 'listPrice',
  discountField: 'discount',
  grossField: 'lineGrossAmount',
};

const line = (qty, price, discount, gross) => ({
  id: Math.random().toString(),
  orderedQuantity: qty,
  listPrice: price,
  discount,
  lineGrossAmount: gross,
});

describe('computeDocumentTotals', () => {
  it('returns nulls when lineConfig is absent', () => {
    const result = computeDocumentTotals([line(2, 10, 0, 20)], null, null, null);
    assert.equal(result.grossSubtotal, null);
    assert.equal(result.netSubtotal, null);
    assert.equal(result.grandTotal, null);
    assert.equal(result.discountAmt, null);
    assert.equal(result.taxAmt, null);
  });

  it('computes totals from a single line with no discount', () => {
    const result = computeDocumentTotals([line(2, 100, 0, 242)], null, null, CONFIG);
    assert.equal(result.grossSubtotal, 200);
    assert.equal(result.netSubtotal, 200);
    assert.equal(result.grandTotal, 242);
    assert.equal(result.discountAmt, 0);
    assert.equal(result.taxAmt, 42);
  });

  it('computes gross subtotal before discount and net subtotal after discount', () => {
    const result = computeDocumentTotals([line(1, 100, 10, 108.9)], null, null, CONFIG);
    assert.equal(result.grossSubtotal, 100);
    assert.equal(result.netSubtotal, 90);
    assert.equal(result.discountAmt, 10);
  });

  it('aggregates across multiple lines', () => {
    const lines = [line(2, 50, 0, 121), line(1, 100, 20, 96.8)];
    const result = computeDocumentTotals(lines, null, null, CONFIG);
    assert.equal(result.grossSubtotal, 200);       // 2*50 + 1*100
    assert.equal(result.netSubtotal, 180);          // 100 + 80
    assert.equal(result.discountAmt, 20);
    assert.equal(result.grandTotal, 217.8);
  });

  it('includes pendingLine in the aggregation', () => {
    const saved = [line(1, 100, 0, 121)];
    const pending = { orderedQuantity: 2, listPrice: 50, discount: 0, lineGrossAmount: 0 };
    const result = computeDocumentTotals(saved, pending, null, CONFIG);
    assert.equal(result.grossSubtotal, 200);
    assert.equal(result.netSubtotal, 200);
  });

  it('replaces the matching saved line with editingLine values', () => {
    const id = 'abc';
    const saved = [{ ...line(1, 100, 0, 121), id }];
    const editing = { id, orderedQuantity: 3, listPrice: 100, discount: 0, lineGrossAmount: 363 };
    const result = computeDocumentTotals(saved, null, editing, CONFIG);
    assert.equal(result.grossSubtotal, 300);
    assert.equal(result.grandTotal, 363);
  });

  it('does not replace lines whose id does not match editingLine', () => {
    const saved = [{ ...line(1, 100, 0, 121), id: 'abc' }];
    const editing = { id: 'xyz', orderedQuantity: 5, listPrice: 200, discount: 0, lineGrossAmount: 0 };
    const result = computeDocumentTotals(saved, null, editing, CONFIG);
    assert.equal(result.grossSubtotal, 100);
  });

  it('handles string numeric values from API payloads', () => {
    const strLine = { id: '1', orderedQuantity: '2', listPrice: '50.00', discount: '10', lineGrossAmount: '90.0' };
    const result = computeDocumentTotals([strLine], null, null, CONFIG);
    assert.equal(result.grossSubtotal, 100);
    assert.equal(result.netSubtotal, 90);
    assert.equal(result.discountAmt, 10);
  });

  it('treats missing or null field values as zero', () => {
    const incomplete = { id: '1' };
    const result = computeDocumentTotals([incomplete], null, null, CONFIG);
    assert.equal(result.grossSubtotal, 0);
    assert.equal(result.netSubtotal, 0);
    assert.equal(result.grandTotal, 0);
  });

  it('returns grandTotal null when grossField is absent from config', () => {
    const cfg = { qtyField: 'orderedQuantity', priceField: 'listPrice', discountField: 'discount' };
    const result = computeDocumentTotals([line(1, 100, 0, 121)], null, null, cfg);
    assert.equal(result.grossSubtotal, 100);
    assert.equal(result.grandTotal, null);
    assert.equal(result.taxAmt, null);
  });

  it('computes zero discount correctly when discountField is absent from config', () => {
    const cfg = { qtyField: 'orderedQuantity', priceField: 'listPrice', grossField: 'lineGrossAmount' };
    const result = computeDocumentTotals([line(2, 100, 50, 200)], null, null, cfg);
    assert.equal(result.grossSubtotal, 200);
    assert.equal(result.netSubtotal, 200); // no discount applied
    assert.equal(result.discountAmt, 0);
  });

  it('returns zero totals for an empty lines array', () => {
    const result = computeDocumentTotals([], null, null, CONFIG);
    assert.equal(result.grossSubtotal, 0);
    assert.equal(result.netSubtotal, 0);
    assert.equal(result.grandTotal, 0);
    assert.equal(result.discountAmt, 0);
    assert.equal(result.taxAmt, 0);
  });

  it('returns totalDiscountAmt as null when lineConfig is absent', () => {
    const result = computeDocumentTotals([line(1, 100, 0, 121)], null, null, null, 10);
    assert.equal(result.totalDiscountAmt, null);
  });

  it('returns totalDiscountAmt of zero when totalDiscountPct is 0', () => {
    const result = computeDocumentTotals([line(1, 100, 0, 121)], null, null, CONFIG, 0);
    assert.equal(result.totalDiscountAmt, 0);
    assert.equal(result.grandTotal, 121); // unchanged
  });

  it('applies totalDiscountPct to netSubtotal to compute totalDiscountAmt', () => {
    // netSubtotal = 1 × 100 × (1 − 0) = 100
    // totalDiscountAmt = 100 × 10 / 100 = 10
    const result = computeDocumentTotals([line(1, 100, 0, 121)], null, null, CONFIG, 10);
    assert.equal(result.totalDiscountAmt, 10);
  });

  it('scales grandTotal proportionally when totalDiscountPct > 0', () => {
    // baseGrandTotal = 121, pct = 10 → grandTotal = 121 × 0.9 = 108.9
    const result = computeDocumentTotals([line(1, 100, 0, 121)], null, null, CONFIG, 10);
    assert.ok(Math.abs(result.grandTotal - 108.9) < 0.001);
  });

  it('scales taxAmt proportionally when totalDiscountPct > 0', () => {
    // baseTaxAmt = 121 - 100 = 21, factor = 0.9 → taxAmt = 21 × 0.9 = 18.9
    const result = computeDocumentTotals([line(1, 100, 0, 121)], null, null, CONFIG, 10);
    assert.ok(Math.abs(result.taxAmt - 18.9) < 0.001);
  });

  it('clamps totalDiscountPct to 0–100 range', () => {
    const overMax = computeDocumentTotals([line(1, 100, 0, 121)], null, null, CONFIG, 150);
    assert.equal(overMax.totalDiscountAmt, 100); // 100% of netSubtotal
    assert.equal(overMax.grandTotal, 0);

    const underMin = computeDocumentTotals([line(1, 100, 0, 121)], null, null, CONFIG, -10);
    assert.equal(underMin.totalDiscountAmt, 0);
    assert.equal(underMin.grandTotal, 121);
  });

  it('combines per-product discount and total discount correctly', () => {
    // line: qty=1, price=100, disc=10 → netSubtotal=90, baseGrandTotal=108.9 (assuming tax)
    // totalDiscountPct=5 → totalDiscountAmt = 90 × 5/100 = 4.5
    // grandTotal = 108.9 × 0.95 = 103.455
    const result = computeDocumentTotals([line(1, 100, 10, 108.9)], null, null, CONFIG, 5);
    assert.equal(result.discountAmt, 10);       // per-product discount
    assert.ok(Math.abs(result.totalDiscountAmt - 4.5) < 0.001);
    assert.ok(Math.abs(result.grandTotal - 103.455) < 0.001);
  });
});
