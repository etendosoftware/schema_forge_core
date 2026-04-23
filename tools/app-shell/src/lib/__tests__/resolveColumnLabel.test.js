import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveColumnLabel } from '../resolveColumnLabel.js';

const translate = (key) => {
  const dictionary = {
    C_BPartner_ID: 'Tercero',
    DateOrdered: 'Fecha de pedido',
  };
  return dictionary[key] ?? null;
};

describe('resolveColumnLabel', () => {
  it('prefers col.labels for the active locale over everything else', () => {
    const col = {
      key: 'orderDate',
      column: 'DateOrdered',
      label: 'Order Date',
      labels: { es_ES: 'Fecha del pedido', en_US: 'Order Date (contract)' },
    };
    assert.equal(resolveColumnLabel(col, 'es_ES', translate), 'Fecha del pedido');
  });

  it('falls back to col.labels.en_US when the locale override is missing', () => {
    const col = {
      key: 'orderDate',
      column: 'DateOrdered',
      label: 'Order Date',
      labels: { en_US: 'Order Date (contract)' },
    };
    assert.equal(resolveColumnLabel(col, 'es_ES', translate), 'Order Date (contract)');
  });

  // Regression: i18n dictionary must win over the contract-embedded English label.
  // Before the fix, `col.label` was placed BEFORE `translate(col.column)` in the
  // fallback chain, so the English contract label silently overrode the Spanish
  // translation maintained in es_ES.json.
  it('prefers the i18n dictionary over col.label when col.labels is missing', () => {
    const col = {
      key: 'businessPartner',
      column: 'C_BPartner_ID',
      label: 'Business Partner',
    };
    assert.equal(resolveColumnLabel(col, 'es_ES', translate), 'Tercero');
  });

  it('falls back to col.label when the i18n dictionary has no entry', () => {
    const col = {
      key: 'unknown',
      column: 'UnknownColumn',
      label: 'Unknown Label',
    };
    assert.equal(resolveColumnLabel(col, 'es_ES', translate), 'Unknown Label');
  });

  it('falls back to col.key as last resort', () => {
    const col = { key: 'someKey', column: 'UnknownColumn' };
    assert.equal(resolveColumnLabel(col, 'es_ES', translate), 'someKey');
  });

  it('works when translate is not provided', () => {
    const col = { key: 'orderDate', column: 'DateOrdered', label: 'Order Date' };
    assert.equal(resolveColumnLabel(col, 'es_ES'), 'Order Date');
  });

  it('returns undefined for a null column', () => {
    assert.equal(resolveColumnLabel(null, 'es_ES', translate), undefined);
  });

  it('treats an empty translate result as a miss and falls back to col.label', () => {
    const emptyTranslate = () => null;
    const col = { key: 'orderDate', column: 'DateOrdered', label: 'Order Date' };
    assert.equal(resolveColumnLabel(col, 'es_ES', emptyTranslate), 'Order Date');
  });
});
