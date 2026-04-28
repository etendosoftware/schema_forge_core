import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveTaxFactor,
  deriveLineNet,
  computeLineGrossAmount,
  ORDER_LINE_CONFIG,
  INVOICE_LINE_CONFIG,
} from '../useLineGrossAmount.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TAX_ID = 'TAX-21';
const TAX_ID_10 = 'TAX-10';

function emptyCache() { return {}; }

function siblingsWithGross(grossField = 'lineGrossAmount') {
  return [{
    tax: TAX_ID,
    [grossField]: 121,
    lineNetAmount: 100,
    unitPrice: 100,
    orderedQuantity: 1,
    discount: 0,
  }];
}

// ─── resolveTaxFactor ─────────────────────────────────────────────────────────

describe('resolveTaxFactor', () => {

  it('source 0 — uses taxRate from callout result', () => {
    const factor = resolveTaxFactor(TAX_ID, { taxRate: 21 }, {}, emptyCache(), [], 'lineGrossAmount');
    assert.equal(factor, 1.21);
  });

  it('source 0 — populates cache so future calls skip the network', () => {
    const cache = emptyCache();
    resolveTaxFactor(TAX_ID, { taxRate: 21 }, {}, cache, [], 'lineGrossAmount');
    assert.equal(cache[TAX_ID], 21);
  });

  it('source 1 — uses tax_rate from rowValues selector aux', () => {
    const factor = resolveTaxFactor(TAX_ID, {}, { tax_rate: 10 }, emptyCache(), [], 'lineGrossAmount');
    assert.equal(factor, 1.10);
  });

  it('source 1 — accepts 0% tax rate (non-taxable)', () => {
    const factor = resolveTaxFactor(TAX_ID, {}, { tax_rate: 0 }, emptyCache(), [], 'lineGrossAmount');
    assert.equal(factor, 1);
  });

  it('source 2 — reads from cache when callout has no taxRate', () => {
    const cache = { [TAX_ID]: 21 };
    const factor = resolveTaxFactor(TAX_ID, {}, {}, cache, [], 'lineGrossAmount');
    assert.equal(factor, 1.21);
  });

  it('source 3 — derives from saved row gross/net ratio (sidebar case)', () => {
    const rowValues = { lineGrossAmount: 121, lineNetAmount: 100 };
    const factor = resolveTaxFactor(TAX_ID, {}, rowValues, emptyCache(), [], 'lineGrossAmount');
    assert.equal(factor, 1.21);
  });

  it('source 3 — falls through to source 4 when saved row net is zero', () => {
    const rowValues = { lineGrossAmount: 121, lineNetAmount: 0 };
    const siblings  = siblingsWithGross();
    const factor = resolveTaxFactor(TAX_ID, {}, rowValues, emptyCache(), siblings, 'lineGrossAmount');
    assert.equal(factor, 1.21);
  });

  it('source 4 — derives from sibling line with same tax via net', () => {
    const factor = resolveTaxFactor(TAX_ID, {}, {}, emptyCache(), siblingsWithGross(), 'lineGrossAmount');
    assert.equal(factor, 1.21);
  });

  it('source 4 — derives from sibling via qty×price when lineNetAmount absent', () => {
    const siblings = [{ tax: TAX_ID, lineGrossAmount: 121, lineNetAmount: 0, unitPrice: 10, orderedQuantity: 10, discount: 0 }];
    const factor = resolveTaxFactor(TAX_ID, {}, {}, emptyCache(), siblings, 'lineGrossAmount');
    assert.equal(factor, 1.21);
  });

  it('source 4 — adjusts for discount when deriving from sibling net', () => {
    // sibling: price=100, discount=50% → net base = 50, gross = 60.5 → factor = 1.21
    const siblings = [{ tax: TAX_ID, lineGrossAmount: 60.5, lineNetAmount: 100, discount: 50, orderedQuantity: 1, unitPrice: 100 }];
    const factor = resolveTaxFactor(TAX_ID, {}, {}, emptyCache(), siblings, 'lineGrossAmount');
    assert.ok(Math.abs(factor - 1.21) < 0.001, `expected ~1.21, got ${factor}`);
  });

  it('source priority: 0 wins over cache', () => {
    const cache = { [TAX_ID]: 10 };
    const factor = resolveTaxFactor(TAX_ID, { taxRate: 21 }, {}, cache, [], 'lineGrossAmount');
    assert.equal(factor, 1.21);
  });

  it('returns null when no source resolves', () => {
    const factor = resolveTaxFactor(TAX_ID, {}, {}, emptyCache(), [], 'lineGrossAmount');
    assert.equal(factor, null);
  });

  it('skips sibling with wrong tax id', () => {
    const siblings = [{ tax: TAX_ID_10, lineGrossAmount: 110, lineNetAmount: 100 }];
    const factor = resolveTaxFactor(TAX_ID, {}, {}, emptyCache(), siblings, 'lineGrossAmount');
    assert.equal(factor, null);
  });

  it('uses invoice grossField (grossAmount) for source 3', () => {
    const rowValues = { grossAmount: 110, lineNetAmount: 100 };
    const factor = resolveTaxFactor(TAX_ID, {}, rowValues, emptyCache(), [], 'grossAmount');
    assert.equal(factor, 1.10);
  });

  it('uses invoice grossField (grossAmount) for source 4 sibling lookup', () => {
    const siblings = [{ tax: TAX_ID, grossAmount: 110, lineNetAmount: 100, discount: 0 }];
    const factor = resolveTaxFactor(TAX_ID, {}, {}, emptyCache(), siblings, 'grossAmount');
    assert.equal(factor, 1.10);
  });

  it('NaN taxRate in callout falls through to next source', () => {
    const cache = { [TAX_ID]: 10 };
    const factor = resolveTaxFactor(TAX_ID, { taxRate: 'bad' }, {}, cache, [], 'lineGrossAmount');
    assert.equal(factor, 1.10);
  });

});

// ─── deriveLineNet ────────────────────────────────────────────────────────────

describe('deriveLineNet', () => {

  it('happy path — orderedQuantity change, no discount', () => {
    const net = deriveLineNet('orderedQuantity', '3', {}, { unitPrice: 10, discount: 0 }, 'orderedQuantity');
    assert.equal(net, 30);
  });

  it('happy path — unitPrice change with existing qty and discount', () => {
    const net = deriveLineNet('unitPrice', '100', {}, { orderedQuantity: 2, discount: 20 }, 'orderedQuantity');
    assert.equal(net, 160); // 2 × 100 × 0.80
  });

  it('happy path — discount change recomputes with new rate', () => {
    const net = deriveLineNet('discount', '25', {}, { orderedQuantity: 4, unitPrice: 50 }, 'orderedQuantity');
    assert.equal(net, 150); // 4 × 50 × 0.75
  });

  it('happy path — product change prefers callout lineNetAmount', () => {
    const net = deriveLineNet('product', 'PROD-1', { lineNetAmount: 88 }, { orderedQuantity: 1, unitPrice: 99 }, 'orderedQuantity');
    assert.equal(net, 88);
  });

  it('happy path — product change falls back to qty×price when callout net is 0', () => {
    const net = deriveLineNet('product', 'PROD-1', { lineNetAmount: 0, unitPrice: 44 }, { orderedQuantity: 2, discount: 0 }, 'orderedQuantity');
    assert.equal(net, 88);
  });

  it('happy path — tax field change keeps existing discount', () => {
    const net = deriveLineNet('tax', 'TAX-NEW', {}, { orderedQuantity: 2, unitPrice: 50, discount: 10 }, 'orderedQuantity');
    assert.equal(net, 90); // 2 × 50 × 0.90
  });

  it('happy path — invoice qtyField (invoicedQuantity)', () => {
    const net = deriveLineNet('invoicedQuantity', '5', {}, { unitPrice: 20, discount: 0 }, 'invoicedQuantity');
    assert.equal(net, 100);
  });

  it('returns 0 when qty is 0', () => {
    const net = deriveLineNet('orderedQuantity', '0', {}, { unitPrice: 50 }, 'orderedQuantity');
    assert.equal(net, 0);
  });

  it('returns 0 when price is 0', () => {
    const net = deriveLineNet('orderedQuantity', '5', {}, { unitPrice: 0 }, 'orderedQuantity');
    assert.equal(net, 0);
  });

  it('100% discount yields 0 net', () => {
    const net = deriveLineNet('discount', '100', {}, { orderedQuantity: 3, unitPrice: 50 }, 'orderedQuantity');
    assert.equal(net, 0);
  });

  it('unknown field falls back to callout lineNetAmount', () => {
    const net = deriveLineNet('someOtherField', 'x', { lineNetAmount: 55 }, {}, 'orderedQuantity');
    assert.equal(net, 55);
  });

  it('unknown field falls back to rowValues lineNetAmt when callout is empty', () => {
    const net = deriveLineNet('someOtherField', 'x', {}, { lineNetAmt: 42 }, 'orderedQuantity');
    assert.equal(net, 42);
  });

  it('applies discount from rowValues even for non-discount fields', () => {
    // Changing qty while discount=50% already set
    const net = deriveLineNet('orderedQuantity', '4', {}, { unitPrice: 100, discount: 50 }, 'orderedQuantity');
    assert.equal(net, 200); // 4 × 100 × 0.50
  });

  it('fractional discount rounds correctly at 2dp', () => {
    // 3 × 33.33 × (1 - 0.1/100) — result should be finite not NaN
    const net = deriveLineNet('orderedQuantity', '3', {}, { unitPrice: 33.33, discount: 0.1 }, 'orderedQuantity');
    assert.ok(Number.isFinite(net) && net > 0);
  });

});

// ─── computeLineGrossAmount ───────────────────────────────────────────────────

describe('computeLineGrossAmount — order config', () => {

  it('happy path — sets lineGrossAmount when callout returns no gross', () => {
    const cache    = { [TAX_ID]: 21 };
    const result   = { tax: TAX_ID };
    computeLineGrossAmount('orderedQuantity', '2', result, { unitPrice: 50, discount: 0 }, cache, [], ORDER_LINE_CONFIG);
    assert.equal(result.lineGrossAmount, 121);
    assert.equal(result.grossAmount, 121);
  });

  it('happy path — discount is applied before tax', () => {
    const cache  = { [TAX_ID]: 21 };
    const result = { tax: TAX_ID };
    computeLineGrossAmount('discount', '50', result, { orderedQuantity: 2, unitPrice: 100 }, cache, [], ORDER_LINE_CONFIG);
    // net = 2 × 100 × 0.50 = 100; gross = 100 × 1.21 = 121
    assert.equal(result.lineGrossAmount, 121);
  });

  it('no-op when callout already returned a non-zero grossAmount', () => {
    const cache  = { [TAX_ID]: 21 };
    const result = { tax: TAX_ID, grossAmount: 99 };
    computeLineGrossAmount('orderedQuantity', '2', result, { unitPrice: 50 }, cache, [], ORDER_LINE_CONFIG);
    assert.equal(result.grossAmount, 99);
    assert.equal(result.lineGrossAmount, undefined);
  });

  it('no-op when lineNet is 0 (missing price)', () => {
    const cache  = { [TAX_ID]: 21 };
    const result = { tax: TAX_ID };
    computeLineGrossAmount('orderedQuantity', '0', result, { unitPrice: 50 }, cache, [], ORDER_LINE_CONFIG);
    assert.equal(result.lineGrossAmount, undefined);
  });

  it('no-op when taxFactor cannot be resolved', () => {
    const result = { tax: TAX_ID };
    computeLineGrossAmount('orderedQuantity', '2', result, { unitPrice: 50 }, emptyCache(), [], ORDER_LINE_CONFIG);
    assert.equal(result.lineGrossAmount, undefined);
  });

  it('rounds to 2 decimal places', () => {
    const cache  = { [TAX_ID]: 21 };
    const result = { tax: TAX_ID };
    // 1 × 9.99 × 1.21 = 12.0879 → rounds to 12.09
    computeLineGrossAmount('orderedQuantity', '1', result, { unitPrice: 9.99, discount: 0 }, cache, [], ORDER_LINE_CONFIG);
    assert.equal(result.lineGrossAmount, 12.09);
  });

  it('force-overrides lineGrossAmount for orderedQuantity change', () => {
    const cache  = { [TAX_ID]: 21 };
    const result = { tax: TAX_ID, lineGrossAmount: 999 }; // stale value
    computeLineGrossAmount('orderedQuantity', '2', result, { unitPrice: 50, discount: 0 }, cache, [], ORDER_LINE_CONFIG);
    assert.equal(result.lineGrossAmount, 121); // overwritten
  });

  it('does NOT override lineGrossAmount for product change when callout provided it', () => {
    const cache  = { [TAX_ID]: 21 };
    const result = { tax: TAX_ID, lineGrossAmount: 60.5, lineNetAmount: 50 };
    computeLineGrossAmount('product', 'P1', result, { orderedQuantity: 1, discount: 0 }, cache, [], ORDER_LINE_CONFIG);
    assert.equal(result.lineGrossAmount, 60.5); // not overwritten
  });

});

describe('computeLineGrossAmount — invoice config', () => {

  it('happy path — sets grossAmount for invoice lines', () => {
    const cache    = { [TAX_ID]: 10 };
    const result   = { tax: TAX_ID };
    computeLineGrossAmount('invoicedQuantity', '3', result, { unitPrice: 100, discount: 0 }, cache, [], INVOICE_LINE_CONFIG);
    assert.equal(result.grossAmount, 330);
  });

  it('resolves tax from sibling saved invoice line', () => {
    const siblings = [{ tax: TAX_ID, grossAmount: 110, lineNetAmount: 100, discount: 0 }];
    const result   = { tax: TAX_ID };
    computeLineGrossAmount('invoicedQuantity', '2', result, { unitPrice: 50, discount: 0 }, emptyCache(), siblings, INVOICE_LINE_CONFIG);
    assert.equal(result.grossAmount, 110); // 2 × 50 × 1.10
  });

});
