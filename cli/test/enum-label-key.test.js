import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildEnumLabelKey } from '../src/enum-label-key.js';

// ETP-4685 — filter selectors for List-type fields (AD_Ref_List) showed the raw
// English AD_Ref_List.Name instead of a translated value. buildEnumLabelKey()
// derives a stable, column-scoped i18n key so the existing ui()/genericLabels
// resolution (AdvancedFilterBuilder.jsx, ListFilterBar.jsx) can translate it.
describe('buildEnumLabelKey', () => {
  it('combines column name and value name into a camelCase + PascalCase key', () => {
    assert.equal(buildEnumLabelKey('ProductType', 'Item'), 'productTypeItem');
    assert.equal(buildEnumLabelKey('ProductType', 'Service'), 'productTypeService');
  });

  it('strips punctuation and capitalizes each word of a multi-word value name', () => {
    assert.equal(buildEnumLabelKey('ProductType', 'Expense type'), 'productTypeExpenseType');
  });

  it('lowercases the first letter of the column name only', () => {
    assert.equal(buildEnumLabelKey('DocStatus', 'Draft'), 'docStatusDraft');
  });

  it('scopes the key by column name so unrelated lists sharing a value name do not collide', () => {
    const a = buildEnumLabelKey('ProductType', 'Service');
    const b = buildEnumLabelKey('DeliveryTerms', 'Service');
    assert.notEqual(a, b);
  });

  it('handles a column name that is already snake_case or has underscores', () => {
    assert.equal(buildEnumLabelKey('payment_method', 'Cash'), 'paymentMethodCash');
  });

  it('handles a value name with mixed case and extra whitespace', () => {
    assert.equal(buildEnumLabelKey('ProductType', '  EXPENSE   type  '), 'productTypeExpenseType');
  });

  it('is deterministic for the same inputs', () => {
    const first = buildEnumLabelKey('ProductType', 'Item');
    const second = buildEnumLabelKey('ProductType', 'Item');
    assert.equal(first, second);
  });

  it('handles empty or missing value name gracefully without throwing', () => {
    assert.equal(buildEnumLabelKey('ProductType', ''), 'productType');
    assert.equal(buildEnumLabelKey('ProductType', null), 'productType');
    assert.equal(buildEnumLabelKey('ProductType', undefined), 'productType');
  });

  it('handles empty or missing column name gracefully without throwing', () => {
    assert.equal(buildEnumLabelKey('', 'Item'), 'item');
    assert.equal(buildEnumLabelKey(null, 'Item'), 'item');
  });

  it('produces a key usable as a plain JS object property (no punctuation, no spaces)', () => {
    const key = buildEnumLabelKey('ProductType', 'Expense type');
    assert.match(key, /^[a-zA-Z][a-zA-Z0-9]*$/);
  });
});
