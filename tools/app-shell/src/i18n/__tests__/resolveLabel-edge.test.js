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

describe('resolveLabel en_US.json contract', () => {
  // Verify the actual en_US.json matches expected labels from the DB
  let enUS;

  // Load the actual locale file
  before(async () => {
    const url = new URL('../../locales/en_US.json', import.meta.url);
    const fs = await import('node:fs');
    enUS = JSON.parse(fs.readFileSync(url, 'utf8'));
  });

  it('en_US.json is valid and has fields key', () => {
    assert.ok(enUS.fields, 'en_US.json must have a fields key');
    assert.equal(typeof enUS.fields, 'object');
  });

  it('C_BPartner_ID resolves to Business Partner', () => {
    assert.equal(resolveLabel(enUS, 'C_BPartner_ID'), 'Business Partner');
  });

  it('DatePromised resolves to Scheduled Delivery Date', () => {
    assert.equal(resolveLabel(enUS, 'DatePromised'), 'Scheduled Delivery Date');
  });

  it('GrandTotal resolves to Total Gross Amount', () => {
    assert.equal(resolveLabel(enUS, 'GrandTotal'), 'Total Gross Amount');
  });

  it('DocStatus resolves to Document Status', () => {
    assert.equal(resolveLabel(enUS, 'DocStatus'), 'Document Status');
  });

  it('en_US.json has windows, tabs, and menus sections', () => {
    assert.ok(enUS.windows, 'must have windows key');
    assert.ok(enUS.tabs, 'must have tabs key');
    assert.ok(enUS.menus, 'must have menus key');
  });
});
