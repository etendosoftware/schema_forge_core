import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * ETP-3894: tests for the client-side required-field validation introduced in
 * useEntity.handleSave.
 *
 * The pure logic is reproduced here in isolation so it can be exercised without
 * a React renderer.
 */

/**
 * Mirrors the pre-POST validation block in useEntity.handleSave: collect
 * required+editable fields whose values are empty in the editing payload.
 */
function findMissingRequired(editing, fields) {
  const isReadOnly = (f) => {
    if (f.readOnly === true) return true;
    try {
      return typeof f.readOnlyLogic === 'function'
        ? Boolean(f.readOnlyLogic(editing))
        : false;
    } catch {
      return false;
    }
  };
  return fields
    .filter(f => f.required && !isReadOnly(f) && f.type !== 'checkbox' && f.section !== 'summary')
    .filter(f => {
      const v = editing?.[f.key];
      return v == null || v === '' || (typeof v === 'string' && v.trim() === '');
    })
    .map(f => f.key);
}

const SALES_ORDER_FIELDS = [
  { key: 'businessPartner', required: true, type: 'search' },
  { key: 'documentNo', required: true, readOnly: true, type: 'text' },
  { key: 'orderDate', required: true, type: 'date' },
  { key: 'partnerAddress', required: true, type: 'dependent' },
  { key: 'priceList', required: true, type: 'selector' },
  { key: 'paymentTerms', required: true, type: 'selector' },
  { key: 'paymentMethod', type: 'selector' }, // not required
  { key: 'grandTotalAmount', required: true, readOnly: true, type: 'number', section: 'summary' },
];

describe('handleSave required-field validation (ETP-3894)', () => {
  it('flags every empty required+editable field on a brand-new sales order', () => {
    const missing = findMissingRequired({}, SALES_ORDER_FIELDS);
    assert.deepEqual(missing.sort(), [
      'businessPartner',
      'orderDate',
      'partnerAddress',
      'paymentTerms',
      'priceList',
    ].sort());
  });

  it('ignores readOnly required fields (documentNo, totals)', () => {
    const missing = findMissingRequired({}, SALES_ORDER_FIELDS);
    assert.equal(missing.includes('documentNo'), false);
    assert.equal(missing.includes('grandTotalAmount'), false);
  });

  it('ignores summary-section required fields', () => {
    const fields = [{ key: 'totalNet', required: true, type: 'number', section: 'summary' }];
    assert.deepEqual(findMissingRequired({}, fields), []);
  });

  it('does not flag fields that have been filled in', () => {
    const editing = {
      businessPartner: 'bp1',
      orderDate: '2026-05-04',
      partnerAddress: 'addr1',
      priceList: 'pl1',
      paymentTerms: 'pt30',
    };
    assert.deepEqual(findMissingRequired(editing, SALES_ORDER_FIELDS), []);
  });

  it('treats whitespace-only strings as empty', () => {
    const editing = { businessPartner: '   ' };
    const missing = findMissingRequired(editing, SALES_ORDER_FIELDS);
    assert.equal(missing.includes('businessPartner'), true);
  });

  it('respects readOnlyLogic for completed documents', () => {
    const fields = [{
      key: 'paymentTerms',
      required: true,
      type: 'selector',
      readOnlyLogic: (record) => record.processed === true,
    }];
    const editingCompleted = { processed: true };
    // Once the doc is processed, the field is read-only and the validator must skip it.
    assert.deepEqual(findMissingRequired(editingCompleted, fields), []);
  });
});

