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
});
