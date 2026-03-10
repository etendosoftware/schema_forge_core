import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLabel } from '../resolveLabel.js';

const sampleDictionary = {
  fields: {
    C_BPartner_ID: { label: 'Business Partner', description: 'A Business Partner is anyone with whom you transact.' },
    DateOrdered: { label: 'Order Date' },
    DatePromised: { label: 'Scheduled Delivery Date' },
    GrandTotal: { label: 'Total Gross Amount' },
    DocumentNo: { label: 'Document No.' },
  },
  windows: { 'Sales Order': { label: 'Sales Order' } },
};

describe('resolveLabel', () => {
  it('returns correct label for a known column', () => {
    assert.equal(resolveLabel(sampleDictionary, 'C_BPartner_ID'), 'Business Partner');
  });

  it('returns correct label for another known column', () => {
    assert.equal(resolveLabel(sampleDictionary, 'DatePromised'), 'Scheduled Delivery Date');
  });

  it('returns label with special characters', () => {
    assert.equal(resolveLabel(sampleDictionary, 'DocumentNo'), 'Document No.');
  });

  it('returns null for an unknown column', () => {
    assert.equal(resolveLabel(sampleDictionary, 'NonExistent'), null);
  });

  it('returns null for an empty dictionary', () => {
    assert.equal(resolveLabel({}, 'C_BPartner_ID'), null);
  });

  it('returns null for a dictionary with no fields key', () => {
    assert.equal(resolveLabel({ windows: {} }, 'C_BPartner_ID'), null);
  });

  it('returns null when dictionary is null', () => {
    assert.equal(resolveLabel(null, 'C_BPartner_ID'), null);
  });

  it('returns null when dictionary is undefined', () => {
    assert.equal(resolveLabel(undefined, 'C_BPartner_ID'), null);
  });
});
