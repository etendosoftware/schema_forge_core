// Tests that secondaryTabs.<key>.readOnlyLogic is compiled into a runtime
// `readOnlyLogic: (record) => ...` arrow function in the generated HeaderPage,
// using the same translator (convertLogicToJs) used for field-level logic.
//
// This guards the behavior added with the exchange-rates tab (ETP-4030):
// when documentStatus !== 'DR', the secondary tab still renders existing rows
// but suppresses add/edit/delete actions.

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generatePageComponent } from '../src/generate-frontend.js';
import { convertLogicToJs } from '../src/generate-contract.js';

// Minimal contract with one header entity and one secondary-tab entity.
// secondaryTabs.exchangeRates.readOnlyLogic mirrors the real Etendo expression
// for invoice documents: "@DocumentStatus@!='DR'" (read-only when not draft).
const contractWithTabReadOnly = {
  frontendContract: {
    window: {
      id: '900',
      name: 'Purchase Invoice',
      primaryEntity: 'invoice',
      category: 'purchase',
      secondaryTabs: {
        exchangeRates: {
          label: 'Exchange Rates',
          tabOrder: 1,
          readOnlyLogic: "@DocumentStatus@!='DR'",
        },
      },
    },
    entities: {
      invoice: {
        fields: [
          {
            name: 'documentNo', column: 'DocumentNo',
            type: 'string', tsType: 'string',
            visibility: 'readOnly', required: true, grid: true, form: true,
          },
          {
            name: 'documentStatus', column: 'DocumentStatus',
            type: 'string', tsType: 'string',
            visibility: 'readOnly', required: true, grid: true, form: true,
          },
        ],
        searchableFields: ['documentNo'],
        computedFields: [],
      },
      exchangeRates: {
        fields: [
          {
            name: 'currency', column: 'C_Currency_ID',
            type: 'foreignKey', tsType: 'string',
            visibility: 'editable', required: true, grid: true, form: true,
            reference: 'Currency', inputMode: 'selector',
          },
          {
            name: 'rate', column: 'Rate',
            type: 'number', tsType: 'number',
            visibility: 'editable', required: true, grid: true, form: true,
          },
        ],
        searchableFields: [],
        computedFields: [],
      },
    },
  },
  backendContract: { processEndpoints: [] },
};

describe('secondaryTabs.readOnlyLogic — compiled arrow function', () => {
  it('emits readOnlyLogic as an arrow function on the exchangeRates tab entry', () => {
    const code = generatePageComponent('invoice', null, contractWithTabReadOnly);
    // The arrow function body uses `record['documentStatus']` (camelCase
    // property from the columnMap built off the header entity).
    assert.match(
      code,
      /key:\s*'exchangeRates'[^}]*readOnlyLogic:\s*\(record\)\s*=>\s*record\['documentStatus'\]\s*!==\s*'DR'/s,
      'expected secondary-tab entry to include readOnlyLogic arrow function for documentStatus',
    );
  });

  it('does NOT emit readOnlyLogic on a secondary tab that does not declare it', () => {
    const contract = JSON.parse(JSON.stringify(contractWithTabReadOnly));
    delete contract.frontendContract.window.secondaryTabs.exchangeRates.readOnlyLogic;
    const code = generatePageComponent('invoice', null, contract);
    // The exchangeRates tab entry should still be present, but with no
    // readOnlyLogic key on it.
    const entry = code.match(/\{\s*key:\s*'exchangeRates'[^}]*\}/s);
    assert.ok(entry, 'expected exchangeRates entry to be emitted');
    assert.ok(
      !entry[0].includes('readOnlyLogic'),
      'plain tab entry must not contain readOnlyLogic',
    );
  });

  it('convertLogicToJs translates @Col@!=\'V\' into a record property check', () => {
    const columnMap = { DocumentStatus: 'documentStatus' };
    const js = convertLogicToJs("@DocumentStatus@!='DR'", columnMap, []);
    assert.equal(js, "record['documentStatus'] !== 'DR'");
  });
});
