import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateFrontendContract } from '../src/generate-contract.js';
import { generateFormComponent } from '../src/generate-frontend.js';

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

// ETP-5684 — the form line carries the gate too, so EntityForm can hide the field.
describe('generateFormComponent — visibleWhenCapability', () => {
  function contractWith(fieldExtras = {}) {
    return {
      frontendContract: {
        window: { id: '1', name: 'Goods Shipment', primaryEntity: 'header', category: 'test' },
        entities: {
          header: {
            fields: [{
              name: 'etblkpAccountingstatus', column: 'EM_Etblkp_Accountingstatus', type: 'string',
              tsType: 'string', visibility: 'readOnly', form: true, ...fieldExtras,
            }],
            searchableFields: [],
            computedFields: [],
          },
        },
      },
      backendContract: { processEndpoints: [] },
    };
  }

  it('emits visibleWhenCapability on the form field when set', () => {
    const code = generateFormComponent('header',
      contractWith({ visibleWhenCapability: 'showAccountingFields' }));
    assert.match(code, /key: 'etblkpAccountingstatus'[^}]*visibleWhenCapability: 'showAccountingFields' \}/);
  });

  it('leaves the form field unchanged when not set', () => {
    const code = generateFormComponent('header', contractWith());
    assert.doesNotMatch(code, /visibleWhenCapability/);
  });
});
