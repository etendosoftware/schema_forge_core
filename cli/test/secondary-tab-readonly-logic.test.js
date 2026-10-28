// @covers cli/src/generate-contract.js
// @covers cli/src/generate-frontend.js
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

describe('convertLogicToJs — contextVars option (visibleWhenLogic)', () => {
  const columnMap = { C_Currency_ID: 'currency', DocumentStatus: 'documentStatus', Posted: 'posted' };
  const on = { contextVars: true };

  it('resolves token-vs-token with a # operand to ctx and keeps && composition', () => {
    const js = convertLogicToJs("@C_Currency_ID@!'' & @C_Currency_ID@!@#OrgCurrencyId@", columnMap, [], on);
    assert.equal(
      js,
      "(record['currency'] != null && record['currency'] !== '') && record['currency'] !== ctx['OrgCurrencyId']",
    );
  });

  it('maps = to === and ! / != to !==', () => {
    assert.equal(convertLogicToJs('@C_Currency_ID@=@#Org@', columnMap, [], on), "record['currency'] === ctx['Org']");
    assert.equal(convertLogicToJs('@C_Currency_ID@!=@#Org@', columnMap, [], on), "record['currency'] !== ctx['Org']");
    assert.equal(convertLogicToJs('@C_Currency_ID@!@#Org@', columnMap, [], on), "record['currency'] !== ctx['Org']");
  });

  it('supports two record columns and a ctx variable on the left', () => {
    assert.equal(convertLogicToJs('@DocumentStatus@=@Posted@', columnMap, [], on), "record['documentStatus'] === record['posted']");
    assert.equal(convertLogicToJs('@#Org@!@C_Currency_ID@', columnMap, [], on), "ctx['Org'] !== record['currency']");
  });

  it('resolves a bare @#Name@ against a literal to ctx', () => {
    assert.equal(convertLogicToJs("@#IsSOTrx@='Y'", columnMap, [], on), "ctx['IsSOTrx'] === 'Y'");
    assert.equal(convertLogicToJs("@#IsSOTrx@!'Y'", columnMap, [], on), "ctx['IsSOTrx'] !== 'Y'");
  });

  it('tolerates whitespace around the comparison operator', () => {
    assert.equal(convertLogicToJs('@C_Currency_ID@  !  @#Org@', columnMap, [], on), "record['currency'] !== ctx['Org']");
  });

  it('flag OFF: output is byte-identical to the pre-contextVars converter for every existing form', () => {
    // Expected strings captured from the converter as of HEAD before the option existed.
    const cases = [
      ["@DocumentStatus@!='DR'", "record['documentStatus'] !== 'DR'"],
      ["@DocumentStatus@='DR' | @Posted@='Y'", "record['documentStatus'] === 'DR' || (record['posted'] === true || record['posted'] === 'Y')"],
      ["@C_Currency_ID@!'' & @DocumentStatus@='CO'", "(record['currency'] != null && record['currency'] !== '') && record['documentStatus'] === 'CO'"],
      ["@C_Currency_ID@=''", "(record['currency'] == null || record['currency'] === '')"],
      ['@Posted@!null', "record['posted'] != null"],
      ['@Posted@>0', "Number(record['posted']) > 0"],
      // Token-vs-token / ctx vars stay unresolved (unsupported) without the flag.
      ['@C_Currency_ID@!@#OrgCurrencyId@', '@C_Currency_ID@!@#OrgCurrencyId@'],
    ];
    for (const [expr, expected] of cases) {
      assert.equal(convertLogicToJs(expr, columnMap, ['posted']), expected, expr);
      assert.equal(convertLogicToJs(expr, columnMap, ['posted'], {}), expected, expr);
      assert.equal(convertLogicToJs(expr, columnMap, ['posted'], { contextVars: false }), expected, expr);
    }
  });

  it('flag ON does not change field-only expressions', () => {
    const e = "@DocumentStatus@='DR' | @Posted@='Y' & @C_Currency_ID@!''";
    assert.equal(convertLogicToJs(e, columnMap, ['posted'], on), convertLogicToJs(e, columnMap, ['posted']));
  });
});
