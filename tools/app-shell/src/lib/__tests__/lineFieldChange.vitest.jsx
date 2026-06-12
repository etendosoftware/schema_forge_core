import {
  buildCalloutFormState, extractAuxValues, normalizeCalloutQty,
  normalizeCalloutResponse, applyQtyZeroGuard, roundAmounts,
  shouldFireCascade, buildCascadeState, selectCascadeField,
  resolveSnapshotIdentifiers,
} from '../lineFieldChange';

describe('lineFieldChange', () => {
  describe('buildCalloutFormState', () => {
    it('merges header fields into row values without overwriting', () => {
      const row = { product: 'P1', qty: 5 };
      const header = { priceList: 'PL1', product: 'SHOULD_NOT_OVERWRITE' };
      const result = buildCalloutFormState(row, header);
      expect(result.product).toBe('P1');
      expect(result.priceList).toBe('PL1');
      expect(result.qty).toBe(5);
    });

    it('skips null/empty header values', () => {
      const result = buildCalloutFormState({}, { a: null, b: '' });
      expect(result.a).toBeUndefined();
      expect(result.b).toBeUndefined();
    });
  });

  describe('extractAuxValues', () => {
    it('extracts auxiliary fields matching pattern', () => {
      const state = { product_PSTD: '123', product_UOM: 'kg', name: 'test', qty: 1 };
      const aux = extractAuxValues(state);
      expect(aux.product_PSTD).toBe('123');
      expect(aux.product_UOM).toBe('kg');
      expect(aux.name).toBeUndefined();
    });

    it('skips null/empty values', () => {
      const aux = extractAuxValues({ field_AB: null, field_CD: '' });
      expect(Object.keys(aux)).toHaveLength(0);
    });
  });

  describe('normalizeCalloutQty', () => {
    it('sets orderedQuantity to 1 when falsy', () => {
      expect(normalizeCalloutQty({ orderedQuantity: 0 }).orderedQuantity).toBe(1);
      expect(normalizeCalloutQty({ orderedQuantity: null }).orderedQuantity).toBe(1);
    });

    it('preserves existing non-zero quantity', () => {
      expect(normalizeCalloutQty({ orderedQuantity: 5 }).orderedQuantity).toBe(5);
    });
  });

  describe('normalizeCalloutResponse', () => {
    it('flattens updates and combos', () => {
      const callout = {
        updates: { qty: { value: 10 }, name: { value: 'Widget', _identifier: 'W' } },
        combos: { tax: { selected: 'T1', _identifier: 'VAT 21%' } },
      };
      const result = normalizeCalloutResponse(callout, {});
      expect(result.qty).toBe(10);
      expect(result.name).toBe('Widget');
      expect(result['name$_identifier']).toBe('W');
      expect(result.tax).toBe('T1');
      expect(result['tax$_identifier']).toBe('VAT 21%');
    });

    it('skips empty updates when existing value is UUID', () => {
      const uuid = '95E2A8B50A254B2AAE6774B8C2F28120';
      const callout = { updates: { product: { value: '' } } };
      const result = normalizeCalloutResponse(callout, { product: uuid });
      expect(result.product).toBeUndefined();
    });

    it('allows empty updates for non-UUID values', () => {
      const callout = { updates: { name: { value: '' } } };
      const result = normalizeCalloutResponse(callout, { name: 'old' });
      expect(result.name).toBe('');
    });

    it('skips combos with empty selected', () => {
      const callout = { combos: { tax: { selected: '' } } };
      const result = normalizeCalloutResponse(callout, {});
      expect(result.tax).toBeUndefined();
    });
  });

  describe('applyQtyZeroGuard', () => {
    it('removes zero qty when user had a positive value', () => {
      const result = { orderedQuantity: 0, invoicedQuantity: 0 };
      applyQtyZeroGuard(result, { orderedQuantity: 5, invoicedQuantity: 3 });
      expect(result.orderedQuantity).toBeUndefined();
      expect(result.invoicedQuantity).toBeUndefined();
    });

    it('keeps zero when user had zero', () => {
      const result = { orderedQuantity: 0 };
      applyQtyZeroGuard(result, { orderedQuantity: 0 });
      expect(result.orderedQuantity).toBe(0);
    });
  });

  describe('roundAmounts', () => {
    it('rounds amount fields to 2 decimals', () => {
      const result = { grossAmount: 100.456, lineGrossAmount: 50.999 };
      roundAmounts(result);
      expect(result.grossAmount).toBe(100.46);
      expect(result.lineGrossAmount).toBe(51);
    });

    it('does not touch non-amount fields', () => {
      const result = { qty: 3.14159 };
      roundAmounts(result);
      expect(result.qty).toBe(3.14159);
    });
  });

  describe('shouldFireCascade', () => {
    it('returns true when price set but lineNetAmount missing', () => {
      expect(shouldFireCascade({ unitPrice: 10 })).toBe(true);
    });

    it('returns false when lineNetAmount already computed', () => {
      expect(shouldFireCascade({ unitPrice: 10, lineNetAmount: 50 })).toBe(false);
    });

    it('returns false when no price in result', () => {
      expect(shouldFireCascade({ qty: 5 })).toBe(false);
    });
  });

  describe('buildCascadeState', () => {
    it('merges primary result into form state', () => {
      const state = buildCascadeState({ unitPrice: 10, 'tax$_identifier': 'VAT' }, { qty: 5 });
      expect(state.unitPrice).toBe(10);
      expect(state.qty).toBe(5);
      expect(state['tax$_identifier']).toBeUndefined(); // excludes identifiers
    });
  });

  describe('selectCascadeField', () => {
    it('selects gross field when grossUnitPrice present', () => {
      const { field, value } = selectCascadeField({ grossUnitPrice: 12.1 }, []);
      expect(field).toBe('inpgrossUnitPrice');
      expect(value).toBe('12.1');
    });

    it('selects net field otherwise', () => {
      const { field, value } = selectCascadeField({ unitPrice: 10 }, []);
      expect(field).toBe('PriceActual');
      expect(value).toBe('10');
    });

    it('uses addLineFields column when available', () => {
      const fields = [{ key: 'unitPrice', column: 'CustomCol' }];
      const { field } = selectCascadeField({ unitPrice: 10 }, fields);
      expect(field).toBe('CustomCol');
    });
  });

  describe('resolveSnapshotIdentifiers', () => {
    it('fills missing identifier from row snapshot hints', () => {
      const result = { uOM: 'UOM_ID' };
      resolveSnapshotIdentifiers(result, 'product', { product_uOM: 'Kilogram' });
      expect(result['uOM$_identifier']).toBe('Kilogram');
    });

    it('does not overwrite existing identifier', () => {
      const result = { uOM: 'UOM_ID', 'uOM$_identifier': 'Existing' };
      resolveSnapshotIdentifiers(result, 'product', { product_uOM: 'Kilogram' });
      expect(result['uOM$_identifier']).toBe('Existing');
    });
  });
});
