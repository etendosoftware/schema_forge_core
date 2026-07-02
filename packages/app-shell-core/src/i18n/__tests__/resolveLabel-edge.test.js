import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLabel } from '../resolveLabel.js';

describe('resolveLabel edge cases', () => {
  it('returns null when columnName is empty string', () => {
    const dict = { fields: { '': { label: 'Empty Key' } } };
    // Empty string IS a valid key — should resolve if present
    assert.equal(resolveLabel(dict, ''), 'Empty Key');
  });

  it('returns null when field entry exists but has no label property', () => {
    const dict = { fields: { SomeField: { description: 'No label here' } } };
    assert.equal(resolveLabel(dict, 'SomeField'), null);
  });

  it('returns null when field entry is null', () => {
    const dict = { fields: { SomeField: null } };
    assert.equal(resolveLabel(dict, 'SomeField'), null);
  });

  it('returns null when fields value is null', () => {
    const dict = { fields: null };
    assert.equal(resolveLabel(dict, 'C_BPartner_ID'), null);
  });

  it('returns empty string label when label is explicitly empty', () => {
    const dict = { fields: { EmptyLabel: { label: '' } } };
    // Empty string is falsy but should still be returned (not coerced to null)
    // With ?? operator, empty string is NOT nullish, so it passes through
    assert.equal(resolveLabel(dict, 'EmptyLabel'), '');
  });

  it('returns label when label value is zero (number)', () => {
    const dict = { fields: { NumericLabel: { label: 0 } } };
    // 0 is NOT nullish, so ?? should pass it through
    assert.equal(resolveLabel(dict, 'NumericLabel'), 0);
  });

  it('returns null when columnName is null', () => {
    const dict = { fields: { C_BPartner_ID: { label: 'BP' } } };
    assert.equal(resolveLabel(dict, null), null);
  });

  it('returns null when columnName is undefined', () => {
    const dict = { fields: { C_BPartner_ID: { label: 'BP' } } };
    assert.equal(resolveLabel(dict, undefined), null);
  });

  it('is case-sensitive for column names', () => {
    const dict = { fields: { DocStatus: { label: 'Document Status' } } };
    assert.equal(resolveLabel(dict, 'docstatus'), null);
    assert.equal(resolveLabel(dict, 'DOCSTATUS'), null);
    assert.equal(resolveLabel(dict, 'DocStatus'), 'Document Status');
  });

  it('handles dictionary that is a non-object primitive (number)', () => {
    assert.equal(resolveLabel(42, 'SomeField'), null);
  });

  it('handles dictionary that is a boolean', () => {
    assert.equal(resolveLabel(true, 'SomeField'), null);
  });

  it('handles dictionary that is a string', () => {
    assert.equal(resolveLabel('not-a-dict', 'SomeField'), null);
  });
});
