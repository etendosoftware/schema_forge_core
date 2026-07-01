// Tests that secondaryTabs.<key>.addLineFieldExclusions is compiled into an
// `excludeValueOf: '<siblingKey>'` property on the matching add-line entry in
// the generated HeaderPage.
//
// This guards the exchange-rates "To Currency" feature (ETP-4030): the
// toCurrency add-line selector must exclude the live value of the sibling
// `currency` field, so the document currency is never offered as a target.
//
// Runtime consumption of the emitted `excludeValueOf` (DataTable -> excludeId ->
// InlineSearchCombo filtering) is covered by the app-shell vitest suite
// (InlineSearchCombo.excludeId.vitest.jsx). Here we only assert the generator
// emission and its control case.

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generatePageComponent } from '../src/generate-frontend.js';

// Minimal contract: one header entity + one secondary-tab entity (exchangeRates)
// whose add-row exposes a `toCurrency` FK selector and a sibling `currency` FK.
// `addLineFieldExclusions: { toCurrency: 'currency' }` declares that the
// toCurrency selector drops the live value of the currency field.
function buildContract() {
  return {
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
            addLineFields: ['toCurrency', 'rate'],
            addLineFieldExclusions: { toCurrency: 'currency' },
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
          ],
          searchableFields: ['documentNo'],
          computedFields: [],
        },
        exchangeRates: {
          fields: [
            // The excluded sibling — the read-only document currency.
            {
              name: 'currency', column: 'C_Currency_ID',
              type: 'foreignKey', tsType: 'string',
              visibility: 'editable', required: true, grid: true, form: true,
              reference: 'Currency', inputMode: 'selector', label: 'Currency',
            },
            // The add-line selector that must exclude the currency value.
            // foreignKey + inputMode 'search' -> mapFormFieldType => 'search'.
            {
              name: 'toCurrency', column: 'C_Currency_Id_To',
              type: 'foreignKey', tsType: 'string',
              visibility: 'editable', required: true, grid: true, form: true,
              reference: 'Currency', inputMode: 'search', label: 'To Currency',
            },
            {
              name: 'rate', column: 'Rate',
              type: 'number', tsType: 'number',
              visibility: 'editable', required: false, grid: true, form: true,
              label: 'Rate',
            },
          ],
          searchableFields: [],
          computedFields: [],
        },
      },
    },
    backendContract: { processEndpoints: [] },
  };
}

describe('secondaryTabs.addLineFieldExclusions — compiled excludeValueOf', () => {
  it('emits excludeValueOf on the declared add-line entry', () => {
    const code = generatePageComponent('invoice', null, buildContract());
    // The toCurrency entry must carry excludeValueOf: 'currency'.
    assert.match(
      code,
      /key:\s*'toCurrency'[^}]*excludeValueOf:\s*'currency'/s,
      "expected toCurrency add-line entry to include excludeValueOf: 'currency'",
    );
  });

  it('does NOT emit excludeValueOf on a sibling entry that is not declared', () => {
    const code = generatePageComponent('invoice', null, buildContract());
    // `rate` has no exclusion declared, so its entry must not carry the key.
    const rateEntry = code.match(/\{\s*key:\s*'rate'[^}]*\}/s);
    assert.ok(rateEntry, 'expected rate add-line entry to be emitted');
    assert.ok(
      !rateEntry[0].includes('excludeValueOf'),
      'rate entry must not contain excludeValueOf (no exclusion declared)',
    );
  });

  it('does NOT emit excludeValueOf when no addLineFieldExclusions are declared (control)', () => {
    const contract = buildContract();
    delete contract.frontendContract.window.secondaryTabs.exchangeRates.addLineFieldExclusions;
    const code = generatePageComponent('invoice', null, contract);
    // The toCurrency entry must still be present, but with no excludeValueOf.
    const entry = code.match(/\{\s*key:\s*'toCurrency'[^}]*\}/s);
    assert.ok(entry, 'expected toCurrency entry to be emitted');
    assert.ok(
      !entry[0].includes('excludeValueOf'),
      'toCurrency entry must not contain excludeValueOf when no exclusion is declared',
    );
    // And the broader code must contain no excludeValueOf at all for this tab.
    assert.ok(
      !/excludeValueOf/.test(code),
      'no excludeValueOf should be emitted anywhere without the declaration',
    );
  });

  it('excludeValueOf names the sibling key verbatim (not its column)', () => {
    const code = generatePageComponent('invoice', null, buildContract());
    // Guards against accidentally emitting the column (C_Currency_ID) instead of
    // the field key (currency), which is what DataTable indexes `values` by.
    assert.match(code, /excludeValueOf:\s*'currency'/);
    assert.doesNotMatch(code, /excludeValueOf:\s*'C_Currency_ID'/);
  });
});
