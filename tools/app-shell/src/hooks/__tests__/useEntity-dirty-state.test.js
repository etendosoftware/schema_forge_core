import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Tests for the dirty-state logic added in ETP-3662.
 *
 * Two pure functions are extracted and tested in isolation:
 *   - computeIsDirtyHeader  — mirrors the useMemo in useEntity.js
 *   - mergeHeaderTotals     — mirrors the setEditing callback in refreshHeaderTotals
 */

function computeIsDirtyHeader(editing, selected) {
  if (!selected) {
    return Object.keys(editing || {}).some(
      k => k !== 'id' && editing[k] != null && editing[k] !== '',
    );
  }
  return Object.entries(editing || {}).some(
    ([key, val]) => key !== 'id' && val !== selected[key],
  );
}

function mergeHeaderTotals(prev, serverRow, userChangedKeys) {
  if (!prev) return { ...serverRow };
  const merged = { ...prev };
  for (const [key, val] of Object.entries(serverRow)) {
    if (!userChangedKeys.has(key)) {
      merged[key] = val;
    }
  }
  return merged;
}

describe('isDirtyHeader — existing record', () => {
  it('is false when editing matches selected exactly', () => {
    const rec = { id: '1', businessPartner: 'BP1', paymentTerms: 'NET30' };
    assert.equal(computeIsDirtyHeader({ ...rec }, rec), false);
  });

  it('is true when a header field differs from selected', () => {
    const selected = { id: '1', businessPartner: 'BP1', paymentTerms: 'NET30' };
    const editing = { ...selected, paymentTerms: 'NET60' };
    assert.equal(computeIsDirtyHeader(editing, selected), true);
  });

  it('ignores the id field when comparing', () => {
    const selected = { id: '1', businessPartner: 'BP1' };
    const editing = { id: '999', businessPartner: 'BP1' };
    assert.equal(computeIsDirtyHeader(editing, selected), false);
  });

  it('is true when a field is set in editing but null in selected', () => {
    const selected = { id: '1', notes: null };
    const editing = { id: '1', notes: 'some note' };
    assert.equal(computeIsDirtyHeader(editing, selected), true);
  });

  it('is false when both editing and selected have same null value', () => {
    const selected = { id: '1', notes: null };
    const editing = { id: '1', notes: null };
    assert.equal(computeIsDirtyHeader(editing, selected), false);
  });

  it('handles empty editing gracefully', () => {
    const selected = { id: '1', businessPartner: 'BP1' };
    assert.equal(computeIsDirtyHeader({}, selected), false);
  });
});

describe('isDirtyHeader — new record (no selected)', () => {
  it('is false when editing has no non-id fields with values', () => {
    assert.equal(computeIsDirtyHeader({ id: undefined }, null), false);
  });

  it('is false when editing has only null/empty non-id fields', () => {
    assert.equal(computeIsDirtyHeader({ id: '1', businessPartner: null, notes: '' }, null), false);
  });

  it('is true when editing has at least one non-id field with a value', () => {
    assert.equal(computeIsDirtyHeader({ id: '1', businessPartner: 'BP1' }, null), true);
  });

  it('is false with undefined editing', () => {
    assert.equal(computeIsDirtyHeader(undefined, null), false);
  });
});

describe('refreshHeaderTotals — mergeHeaderTotals selective merge', () => {
  it('updates server-computed fields when not in userChangedKeys', () => {
    const prev = { id: '1', businessPartner: 'BP1', grandTotalAmount: '100.00' };
    const serverRow = { id: '1', businessPartner: 'BP1', grandTotalAmount: '150.00' };
    const result = mergeHeaderTotals(prev, serverRow, new Set());
    assert.equal(result.grandTotalAmount, '150.00');
  });

  it('preserves user-changed fields even when server returns a different value', () => {
    const prev = { id: '1', paymentTerms: 'NET60', grandTotalAmount: '100.00' };
    const serverRow = { id: '1', paymentTerms: 'NET30', grandTotalAmount: '150.00' };
    const userChangedKeys = new Set(['paymentTerms']);
    const result = mergeHeaderTotals(prev, serverRow, userChangedKeys);
    assert.equal(result.paymentTerms, 'NET60');
    assert.equal(result.grandTotalAmount, '150.00');
  });

  it('returns a full copy of serverRow when prev is null', () => {
    const serverRow = { id: '1', grandTotalAmount: '200.00' };
    const result = mergeHeaderTotals(null, serverRow, new Set());
    assert.deepEqual(result, serverRow);
    assert.notEqual(result, serverRow);
  });

  it('does not mutate the prev object', () => {
    const prev = { id: '1', grandTotalAmount: '100.00' };
    const serverRow = { id: '1', grandTotalAmount: '150.00' };
    mergeHeaderTotals(prev, serverRow, new Set());
    assert.equal(prev.grandTotalAmount, '100.00');
  });

  it('preserves multiple user-changed fields simultaneously', () => {
    const prev = { id: '1', paymentTerms: 'NET60', businessPartner: 'BP2', grandTotalAmount: '0' };
    const serverRow = { id: '1', paymentTerms: 'NET30', businessPartner: 'BP1', grandTotalAmount: '200.00' };
    const userChangedKeys = new Set(['paymentTerms', 'businessPartner']);
    const result = mergeHeaderTotals(prev, serverRow, userChangedKeys);
    assert.equal(result.paymentTerms, 'NET60');
    assert.equal(result.businessPartner, 'BP2');
    assert.equal(result.grandTotalAmount, '200.00');
  });

  it('adds new server fields that did not exist in prev', () => {
    const prev = { id: '1', businessPartner: 'BP1' };
    const serverRow = { id: '1', businessPartner: 'BP1', summedLineAmount: '300.00' };
    const result = mergeHeaderTotals(prev, serverRow, new Set());
    assert.equal(result.summedLineAmount, '300.00');
  });
});
