import { describe, it, expect } from '@jest/globals';
import {
  buildCalloutFormState,
  extractAuxValues,
  normalizeCalloutQty,
  normalizeCalloutResponse,
  applyQtyZeroGuard,
  roundAmounts,
  shouldFireCascade,
  buildCascadeState,
  selectCascadeField,
  resolveSnapshotIdentifiers,
} from '../lineFieldChange.js';

// ─── buildCalloutFormState ────────────────────────────────────────────────────

describe('buildCalloutFormState', () => {

  it('merges header fields not present in row', () => {
    const row    = { product: 'P1', unitPrice: 10 };
    const header = { priceList: 'PL1', businessPartner: 'BP1', unitPrice: 99 };
    const result = buildCalloutFormState(row, header);
    expect(result.priceList).toBe('PL1');
    expect(result.businessPartner).toBe('BP1');
  });

  it('row values win over header when key exists in row', () => {
    const result = buildCalloutFormState({ unitPrice: 10 }, { unitPrice: 99 });
    expect(result.unitPrice).toBe(10);
  });

  it('excludes null header values', () => {
    const result = buildCalloutFormState({}, { currency: null, org: '' });
    expect('currency' in result).toBe(false);
    expect('org' in result).toBe(false);
  });

  it('does not mutate original row', () => {
    const row = { product: 'P1' };
    buildCalloutFormState(row, { extra: 'X' });
    expect('extra' in row).toBe(false);
  });

  it('handles empty header gracefully', () => {
    const result = buildCalloutFormState({ product: 'P1' }, {});
    expect(result).toEqual({ product: 'P1' });
  });

  // Corner case 1: row has false/0 — falsy row values still win over header
  it('[corner] row false value wins over header truthy value', () => {
    const result = buildCalloutFormState({ flag: false }, { flag: true });
    expect(result.flag).toBe(false);
  });

  it('[corner] row zero value wins over header non-zero value', () => {
    const result = buildCalloutFormState({ discount: 0 }, { discount: 50 });
    expect(result.discount).toBe(0);
  });

  // Corner case 2: header has undefined values — treated same as null (excluded)
  it('[corner] excludes undefined header values', () => {
    const result = buildCalloutFormState({}, { org: undefined });
    expect('org' in result).toBe(false);
  });

});

// ─── extractAuxValues ─────────────────────────────────────────────────────────

describe('extractAuxValues', () => {

  it('extracts product_PSTD, product_UOM and similar aux keys', () => {
    const formState = { product: 'P1', product_PSTD: '44.00', product_UOM: '100', unitPrice: 44 };
    const aux = extractAuxValues(formState);
    expect(aux.product_PSTD).toBe('44.00');
    expect(aux.product_UOM).toBe('100');
    expect('product' in aux).toBe(false);
    expect('unitPrice' in aux).toBe(false);
  });

  it('coerces numeric aux values to string', () => {
    const aux = extractAuxValues({ product_PSTD: 44 });
    expect(aux.product_PSTD).toBe('44');
  });

  it('excludes null and empty string aux values', () => {
    const aux = extractAuxValues({ product_PSTD: null, product_UOM: '' });
    expect(Object.keys(aux).length).toBe(0);
  });

  it('returns empty object when no aux keys present', () => {
    expect(extractAuxValues({ unitPrice: 10, tax: 'TAX-1' })).toEqual({});
  });

  // Corner case 3: 5 uppercase suffix chars — does NOT match AUX_RE (/^[a-zA-Z]+_[A-Z]{2,4}$/)
  it('[corner] key with 5-char uppercase suffix does not match', () => {
    const aux = extractAuxValues({ product_PSTDO: 'x' });
    expect('product_PSTDO' in aux).toBe(false);
  });

  // Corner case 4: 1 uppercase suffix char — does NOT match (min 2)
  it('[corner] key with 1-char uppercase suffix does not match', () => {
    const aux = extractAuxValues({ product_P: 'x' });
    expect('product_P' in aux).toBe(false);
  });

});

// ─── normalizeCalloutQty ──────────────────────────────────────────────────────

describe('normalizeCalloutQty', () => {

  it('substitutes orderedQuantity=1 when qty is 0', () => {
    expect(normalizeCalloutQty({ orderedQuantity: 0, unitPrice: 10 }).orderedQuantity).toBe(1);
  });

  it('substitutes when orderedQuantity is missing', () => {
    expect(normalizeCalloutQty({ unitPrice: 10 }).orderedQuantity).toBe(1);
  });

  it('keeps existing positive quantity', () => {
    expect(normalizeCalloutQty({ orderedQuantity: 3 }).orderedQuantity).toBe(3);
  });

  it('does not mutate original object', () => {
    const original = { orderedQuantity: 0 };
    normalizeCalloutQty(original);
    expect(original.orderedQuantity).toBe(0);
  });

  // Corner case 5: orderedQuantity is string '0' — Number('0') is falsy → substituted
  it('[corner] string "0" is substituted', () => {
    expect(normalizeCalloutQty({ orderedQuantity: '0' }).orderedQuantity).toBe(1);
  });

  // Corner case 6: orderedQuantity is null — substituted
  it('[corner] null is substituted', () => {
    expect(normalizeCalloutQty({ orderedQuantity: null }).orderedQuantity).toBe(1);
  });

});

// ─── normalizeCalloutResponse ─────────────────────────────────────────────────

describe('normalizeCalloutResponse', () => {

  it('happy path — maps updates to flat result', () => {
    const calloutData = {
      updates: {
        unitPrice: { value: 44 },
        tax: { value: 'TAX-21', _identifier: 'IVA Normal' },
      },
    };
    const result = normalizeCalloutResponse(calloutData, {});
    expect(result.unitPrice).toBe(44);
    expect(result.tax).toBe('TAX-21');
    expect(result['tax$_identifier']).toBe('IVA Normal');
  });

  it('maps combo selected values', () => {
    const calloutData = { combos: { uOM: { selected: '100', _identifier: 'Unit' } } };
    const result = normalizeCalloutResponse(calloutData, {});
    expect(result.uOM).toBe('100');
    expect(result['uOM$_identifier']).toBe('Unit');
  });

  it('UUID guard: skips empty-string update when existing is 32-char hex UUID', () => {
    const calloutData = { updates: { tax: { value: '' } } };
    const result = normalizeCalloutResponse(calloutData, { tax: 'A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4' });
    expect('tax' in result).toBe(false);
  });

  it('UUID guard: applies empty-string update for non-UUID fields', () => {
    const result = normalizeCalloutResponse({ updates: { discount: { value: '' } } }, { discount: 10 });
    expect(result.discount).toBe('');
  });

  it('UUID guard: applies empty update when existing value is not UUID-shaped', () => {
    const result = normalizeCalloutResponse({ updates: { description: { value: '' } } }, { description: 'old text' });
    expect(result.description).toBe('');
  });

  it('combo guard: skips empty selected (no-change signal)', () => {
    const result = normalizeCalloutResponse({ combos: { tax: { selected: '' } } }, {});
    expect('tax' in result).toBe(false);
  });

  it('combo guard: skips null selected', () => {
    const result = normalizeCalloutResponse({ combos: { tax: { selected: null } } }, {});
    expect('tax' in result).toBe(false);
  });

  it('handles missing updates and combos gracefully', () => {
    expect(normalizeCalloutResponse({}, {})).toEqual({});
  });

  it('accepts standard UUID format with dashes', () => {
    const calloutData = { updates: { tax: { value: '' } } };
    const result = normalizeCalloutResponse(calloutData, { tax: '867FFFAC-82CC-4406-9FE6-497E4C5C6348' });
    expect('tax' in result).toBe(false);
  });

  // Corner case 7: entry.value is numeric 0 (not empty string) — should be applied
  it('[corner] numeric 0 value is applied (not guarded)', () => {
    const result = normalizeCalloutResponse({ updates: { discount: { value: 0 } } }, { discount: 17 });
    expect(result.discount).toBe(0);
  });

  // Corner case 8: all-zeros UUID triggers guard
  it('[corner] all-zeros 32-char hex UUID triggers guard', () => {
    const calloutData = { updates: { tax: { value: '' } } };
    const result = normalizeCalloutResponse(calloutData, { tax: '00000000000000000000000000000000' });
    expect('tax' in result).toBe(false);
  });

  // Corner case 9: updates and combos have same key — combo wins (processed last)
  it('[corner] combo value overwrites update value for same key', () => {
    const calloutData = {
      updates: { tax: { value: 'FROM-UPDATE' } },
      combos:  { tax: { selected: 'FROM-COMBO' } },
    };
    const result = normalizeCalloutResponse(calloutData, {});
    expect(result.tax).toBe('FROM-COMBO');
  });

  // Corner case 10: UUID guard triggers → value not added, _identifier not added either
  it('[corner] UUID guard also suppresses _identifier', () => {
    const calloutData = { updates: { tax: { value: '', _identifier: 'Should not appear' } } };
    const result = normalizeCalloutResponse(calloutData, { tax: 'A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4' });
    expect('tax' in result).toBe(false);
    expect('tax$_identifier' in result).toBe(false);
  });

});

// ─── applyQtyZeroGuard ────────────────────────────────────────────────────────

describe('applyQtyZeroGuard', () => {

  it('deletes orderedQuantity=0 when row already has a positive value', () => {
    const result    = { orderedQuantity: 0 };
    const rowValues = { orderedQuantity: 3 };
    applyQtyZeroGuard(result, rowValues);
    expect('orderedQuantity' in result).toBe(false);
  });

  it('deletes invoicedQuantity=0 when row has positive value', () => {
    const result    = { invoicedQuantity: 0 };
    const rowValues = { invoicedQuantity: 5 };
    applyQtyZeroGuard(result, rowValues);
    expect('invoicedQuantity' in result).toBe(false);
  });

  it('keeps orderedQuantity=0 when row has no prior positive quantity', () => {
    const result    = { orderedQuantity: 0 };
    const rowValues = { orderedQuantity: 0 };
    applyQtyZeroGuard(result, rowValues);
    expect(result.orderedQuantity).toBe(0);
  });

  it('does not touch non-qty fields', () => {
    const result    = { unitPrice: 0, discount: 0 };
    const rowValues = { unitPrice: 10, discount: 20 };
    applyQtyZeroGuard(result, rowValues);
    expect(result.unitPrice).toBe(0);
    expect(result.discount).toBe(0);
  });

  it('handles missing qty fields in result without throwing', () => {
    expect(() => applyQtyZeroGuard({}, { orderedQuantity: 3 })).not.toThrow();
  });

  // Corner case 11: result[qtyKey] is string '0' — guard checks `=== 0` (strict), so string does NOT trigger it
  it('[corner] string "0" in result does NOT trigger guard (strict equality)', () => {
    const result    = { orderedQuantity: '0' };
    const rowValues = { orderedQuantity: 3 };
    applyQtyZeroGuard(result, rowValues);
    expect('orderedQuantity' in result).toBe(true);
  });

  // Corner case 12: rowValues[qtyKey] is string '3' — Number('3') > 0 → guard triggers
  it('[corner] string row quantity triggers guard', () => {
    const result    = { orderedQuantity: 0 };
    const rowValues = { orderedQuantity: '3' };
    applyQtyZeroGuard(result, rowValues);
    expect('orderedQuantity' in result).toBe(false);
  });

  // Corner case 13: movementQuantity specifically
  it('[corner] movementQuantity is guarded', () => {
    const result    = { movementQuantity: 0 };
    const rowValues = { movementQuantity: 2 };
    applyQtyZeroGuard(result, rowValues);
    expect('movementQuantity' in result).toBe(false);
  });

});

// ─── roundAmounts ─────────────────────────────────────────────────────────────

describe('roundAmounts', () => {

  it('rounds grossAmount to 2 decimal places', () => {
    const result = { grossAmount: 12.0879 };
    roundAmounts(result);
    expect(result.grossAmount).toBe(12.09);
  });

  it('rounds lineGrossAmount', () => {
    const result = { lineGrossAmount: 23.1049 };
    roundAmounts(result);
    expect(result.lineGrossAmount).toBe(23.10);
  });

  it('rounds lineNetAmount', () => {
    const result = { lineNetAmount: 19.085 };
    roundAmounts(result);
    expect(result.lineNetAmount).toBe(19.09);
  });

  it('skips null/undefined amount fields', () => {
    const result = { grossAmount: null };
    roundAmounts(result);
    expect(result.grossAmount).toBeNull();
  });

  it('does not affect unrelated fields', () => {
    const result = { unitPrice: 44.999, grossAmount: 54.4499 };
    roundAmounts(result);
    expect(result.unitPrice).toBe(44.999);
    expect(result.grossAmount).toBe(54.45);
  });

  // Corner case 14: string number input — coerced and rounded
  it('[corner] string amount is coerced and rounded', () => {
    const result = { grossAmount: '12.0879' };
    roundAmounts(result);
    expect(result.grossAmount).toBe(12.09);
  });

  // Corner case 15: NaN input — stays NaN (parseFloat(NaN.toFixed(2)) = NaN)
  it('[corner] NaN amount stays NaN', () => {
    const result = { grossAmount: NaN };
    roundAmounts(result);
    expect(Number.isNaN(result.grossAmount)).toBe(true);
  });

});

// ─── shouldFireCascade ────────────────────────────────────────────────────────

describe('shouldFireCascade', () => {

  it('returns true when unitPrice present and lineNetAmount absent', () => {
    expect(shouldFireCascade({ unitPrice: 44 })).toBe(true);
  });

  it('returns true when grossUnitPrice present and lineNetAmount absent', () => {
    expect(shouldFireCascade({ grossUnitPrice: 53.24 })).toBe(true);
  });

  it('returns false when lineNetAmount is already set', () => {
    expect(shouldFireCascade({ unitPrice: 44, lineNetAmount: 44 })).toBe(false);
  });

  it('returns false when lineNetAmt (OBDal variant) is set', () => {
    expect(shouldFireCascade({ unitPrice: 44, lineNetAmt: 44 })).toBe(false);
  });

  it('returns false when no price field was updated', () => {
    expect(shouldFireCascade({ tax: 'TAX-21', discount: 0 })).toBe(false);
  });

  it('returns true when lineNetAmount is 0 (not computed)', () => {
    expect(shouldFireCascade({ unitPrice: 44, lineNetAmount: 0 })).toBe(true);
  });

  // Corner case 16: lineNetAmt is string '0' — Number('0') === 0 → cascade fires
  it('[corner] lineNetAmt string "0" still fires cascade', () => {
    expect(shouldFireCascade({ unitPrice: 44, lineNetAmt: '0' })).toBe(true);
  });

  // Corner case 17: lineNetAmount explicitly null — treated as absent → cascade fires
  it('[corner] lineNetAmount null fires cascade', () => {
    expect(shouldFireCascade({ unitPrice: 44, lineNetAmount: null })).toBe(true);
  });

});

// ─── buildCascadeState ────────────────────────────────────────────────────────

describe('buildCascadeState', () => {

  it('merges primary result fields into form state', () => {
    const state = buildCascadeState(
      { tax: 'TAX-21', unitPrice: 44 },
      { orderedQuantity: 2, priceList: 'PL1' },
    );
    expect(state.tax).toBe('TAX-21');
    expect(state.unitPrice).toBe(44);
    expect(state.orderedQuantity).toBe(2);
    expect(state.priceList).toBe('PL1');
  });

  it('excludes $_identifier fields from cascade state', () => {
    const state = buildCascadeState({ 'tax$_identifier': 'IVA Normal', tax: 'TAX-21' }, {});
    expect('tax$_identifier' in state).toBe(false);
    expect(state.tax).toBe('TAX-21');
  });

  it('primary result overrides form state values', () => {
    const state = buildCascadeState({ unitPrice: 44 }, { unitPrice: 0 });
    expect(state.unitPrice).toBe(44);
  });

  it('does not mutate the original formState', () => {
    const formState = { orderedQuantity: 2 };
    buildCascadeState({ tax: 'TAX-21' }, formState);
    expect('tax' in formState).toBe(false);
  });

  // Corner case 20: primaryResult is empty {} — returns copy of formState unchanged
  it('[corner] empty primaryResult returns copy of formState', () => {
    const formState = { unitPrice: 44, orderedQuantity: 2 };
    const state = buildCascadeState({}, formState);
    expect(state).toEqual(formState);
    expect(state).not.toBe(formState);
  });

});

// ─── selectCascadeField ───────────────────────────────────────────────────────

describe('selectCascadeField', () => {

  it('uses grossUnitPrice column for tax-inclusive price lists', () => {
    const { field, value } = selectCascadeField(
      { grossUnitPrice: 53.24 },
      [{ key: 'grossUnitPrice', column: 'inpgrossUnitPrice' }],
    );
    expect(field).toBe('inpgrossUnitPrice');
    expect(value).toBe('53.24');
  });

  it('falls back to default gross column name when not in addLineFields', () => {
    const { field } = selectCascadeField({ grossUnitPrice: 53.24 }, []);
    expect(field).toBe('inpgrossUnitPrice');
  });

  it('uses unitPrice column for net price lists', () => {
    const { field, value } = selectCascadeField(
      { unitPrice: 44, netUnitPrice: 44 },
      [{ key: 'unitPrice', column: 'PriceActual' }],
    );
    expect(field).toBe('PriceActual');
    expect(value).toBe('44');
  });

  it('prefers netUnitPrice over unitPrice as cascade value', () => {
    const { value } = selectCascadeField({ unitPrice: 53.24, netUnitPrice: 44 }, []);
    expect(value).toBe('44');
  });

  it('falls back to default unitPrice column name when not in addLineFields', () => {
    const { field } = selectCascadeField({ unitPrice: 44 }, []);
    expect(field).toBe('PriceActual');
  });

  // Corner case 18: addLineFields is null — uses default column names
  it('[corner] null addLineFields falls back to defaults', () => {
    const { field: gField } = selectCascadeField({ grossUnitPrice: 10 }, null);
    expect(gField).toBe('inpgrossUnitPrice');
    const { field: nField } = selectCascadeField({ unitPrice: 10 }, null);
    expect(nField).toBe('PriceActual');
  });

  // Corner case 19: grossUnitPrice = 0 — check is `!= null` (not truthiness), so GROSS path is taken
  it('[corner] grossUnitPrice=0 takes GROSS path because check is != null, not truthy', () => {
    const { field } = selectCascadeField({ grossUnitPrice: 0, unitPrice: 44 }, []);
    expect(field).toBe('inpgrossUnitPrice');
  });

});

// ─── resolveSnapshotIdentifiers ───────────────────────────────────────────────

describe('resolveSnapshotIdentifiers', () => {

  it('fills missing $_identifier from snapshot hint', () => {
    const result    = { uOM: '100' };
    const rowValues = { product_uOM: 'Unit' };
    resolveSnapshotIdentifiers(result, 'product', rowValues);
    expect(result['uOM$_identifier']).toBe('Unit');
  });

  it('does not overwrite an existing $_identifier', () => {
    const result    = { uOM: '100', 'uOM$_identifier': 'Box' };
    const rowValues = { product_uOM: 'Unit' };
    resolveSnapshotIdentifiers(result, 'product', rowValues);
    expect(result['uOM$_identifier']).toBe('Box');
  });

  it('skips $_identifier keys in the result object', () => {
    const result    = { 'tax$_identifier': 'IVA Normal' };
    const rowValues = { 'product_tax$_identifier': 'Other' };
    resolveSnapshotIdentifiers(result, 'product', rowValues);
    expect('tax$_identifier$_identifier' in result).toBe(false);
  });

  it('ignores missing hint gracefully', () => {
    const result = { uOM: '100' };
    resolveSnapshotIdentifiers(result, 'product', {});
    expect('uOM$_identifier' in result).toBe(false);
  });

  it('ignores non-string hints', () => {
    const result    = { uOM: '100' };
    const rowValues = { product_uOM: 42 };
    resolveSnapshotIdentifiers(result, 'product', rowValues);
    expect('uOM$_identifier' in result).toBe(false);
  });

});
