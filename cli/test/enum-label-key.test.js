import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildEnumLabelKey } from '../src/enum-label-key.js';

// ETP-4685 — filter selectors for List-type fields (AD_Ref_List) showed the raw
// English AD_Ref_List.Name instead of a translated value. buildEnumLabelKey()
// derives a stable, column-scoped i18n key so the existing ui()/genericLabels
// resolution (AdvancedFilterBuilder.jsx, ListFilterBar.jsx) can translate it.
//
// The key is built from the AD_Ref_List.Value CODE, not the display Name —
// matching every other i18n-key convention already in this codebase (the
// `statuses` section in extract-labels.js, PaymentHeaderTableBase.jsx,
// AccountTreeView.jsx's ACCOUNT_TYPE_UI_KEYS). The Name is a mutable, human-
// edited label; the Value code is the stable identifier, so keying by name
// would silently orphan translations whenever someone rewords the label.
describe('buildEnumLabelKey', () => {
  it('combines column name and value code into a camelCase + PascalCase key', () => {
    assert.equal(buildEnumLabelKey('ProductType', 'I'), 'productTypeI');
    assert.equal(buildEnumLabelKey('ProductType', 'S'), 'productTypeS');
  });

  it('capitalizes a multi-letter value code as one word when it has no case boundary', () => {
    assert.equal(buildEnumLabelKey('Costtype', 'AVA'), 'costtypeAva');
  });

  it('lowercases the first letter of the column name only', () => {
    assert.equal(buildEnumLabelKey('DocStatus', 'DR'), 'docStatusDr');
  });

  it('scopes the key by column name so unrelated lists sharing a value code do not collide', () => {
    const a = buildEnumLabelKey('ProductType', 'S');
    const b = buildEnumLabelKey('DeliveryTerms', 'S');
    assert.notEqual(a, b);
  });

  it('handles a column name that is already snake_case or has underscores', () => {
    assert.equal(buildEnumLabelKey('payment_method', 'CASH'), 'paymentMethodCash');
  });

  it('handles a value code with mixed case and extra whitespace', () => {
    assert.equal(buildEnumLabelKey('ProductType', '  ava  '), 'productTypeAva');
  });

  it('is deterministic for the same inputs', () => {
    const first = buildEnumLabelKey('ProductType', 'I');
    const second = buildEnumLabelKey('ProductType', 'I');
    assert.equal(first, second);
  });

  it('handles empty or missing value code gracefully without throwing', () => {
    assert.equal(buildEnumLabelKey('ProductType', ''), 'productType');
    assert.equal(buildEnumLabelKey('ProductType', null), 'productType');
    assert.equal(buildEnumLabelKey('ProductType', undefined), 'productType');
  });

  it('handles empty or missing column name gracefully without throwing', () => {
    assert.equal(buildEnumLabelKey('', 'I'), 'i');
    assert.equal(buildEnumLabelKey(null, 'I'), 'i');
  });

  it('produces a key usable as a plain JS object property (no punctuation, no spaces)', () => {
    const key = buildEnumLabelKey('MovementType', 'P-');
    assert.match(key, /^[a-zA-Z][a-zA-Z0-9]*$/);
  });

  it('disambiguates value codes that differ only by a trailing +/- sign', () => {
    // Real AD_Ref_List codes in MovementType: 'P-' and 'P+' must not collapse
    // to the same key, or the two directions would share one translated label.
    const minus = buildEnumLabelKey('MovementType', 'P-');
    const plus = buildEnumLabelKey('MovementType', 'P+');
    assert.notEqual(minus, plus);
    assert.equal(minus, 'movementTypePMinus');
    assert.equal(plus, 'movementTypePPlus');
  });
});
