import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateFrontendContract } from '../src/generate-contract.js';

// ETP-4520 — `visibleWhenCapability` field hint: straight passthrough onto the
// contract field, same shape as the existing `badge`/`cellType` hints.
describe('generateFrontendContract — visibleWhenCapability', () => {
  function buildSchema(fieldExtras = {}) {
    return {
      version: '0.1.0',
      window: { id: '181', name: 'Purchase Order', primaryEntity: 'order', category: 'purchases' },
      entities: [{
        name: 'order',
        table: 'C_Order',
        level: 'header',
        fields: [
          { name: 'documentNo', column: 'DocumentNo', type: 'string', visibility: 'editable', required: false, searchable: false, grid: true, form: true },
          { name: 'accountingDate', column: 'AccountingDate', type: 'date', visibility: 'editable', required: false, searchable: false, grid: true, form: true, ...fieldExtras },
        ],
      }],
    };
  }

  it('copies visibleWhenCapability onto the contract field', () => {
    const fc = generateFrontendContract(buildSchema({ visibleWhenCapability: 'showAccountingFields' }));
    const field = fc.entities.order.fields.find(f => f.name === 'accountingDate');
    assert.equal(field.visibleWhenCapability, 'showAccountingFields');
  });

  it('omits visibleWhenCapability from the contract field when not set', () => {
    const fc = generateFrontendContract(buildSchema());
    const field = fc.entities.order.fields.find(f => f.name === 'accountingDate');
    assert.equal(field.visibleWhenCapability, undefined);
  });
});
