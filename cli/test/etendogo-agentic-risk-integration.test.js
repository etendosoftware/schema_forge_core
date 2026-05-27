import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildSelectorContext,
} from '../../tools/app-shell/src/lib/selectorContext.js';

const repoRoot = resolve(import.meta.dirname, '..', '..');

const DOCUMENT_SCENARIOS = [
  { spec: 'sales-order', category: 'sales', expectedIsSOTrx: 'Y', dateField: 'orderDate' },
  { spec: 'purchase-order', category: 'purchases', expectedIsSOTrx: 'N', dateField: 'orderDate', hasTransactionDocument: true },
  { spec: 'sales-invoice', category: 'sales', expectedIsSOTrx: 'Y', dateField: 'invoiceDate' },
  { spec: 'purchase-invoice', category: 'purchases', expectedIsSOTrx: 'N', dateField: 'invoiceDate', hasTransactionDocument: true },
];

const SHIPMENT_SCENARIOS = [
  { spec: 'goods-receipt', entity: 'goodsReceipt', category: 'purchases' },
  { spec: 'goods-shipment', entity: 'goodsShipment', category: 'sales' },
];

function readContract(spec) {
  return JSON.parse(readFileSync(resolve(repoRoot, 'artifacts', spec, 'contract.json'), 'utf8'));
}

function selectors(contract) {
  return contract.apiPrediction?.selectors ?? [];
}

function selectorFor(contract, entity, field) {
  return selectors(contract).find((selector) => selector.entity === entity && selector.field === field);
}

function frontendField(contract, entity, field) {
  return contract.frontendContract?.entities?.[entity]?.fields?.find((candidate) => candidate.name === field);
}

function assertRequiredContext(selector, expectedEntries, label) {
  const required = selector?.context?.required ?? [];
  for (const expected of expectedEntries) {
    assert.ok(
      required.some((entry) => Object.entries(expected).every(([key, value]) => entry[key] === value)),
      `${label} must include required context ${JSON.stringify(expected)}; got ${JSON.stringify(required)}`,
    );
  }
}

function attachSelectorContext(field, selector) {
  return { ...field, context: selector?.context ?? field?.context };
}

describe('Etendo GO integration risk gates for contextual selectors', () => {
  for (const scenario of DOCUMENT_SCENARIOS) {
    it(`${scenario.spec} keeps BP address, price list, tax, and document defaults context-safe`, () => {
      const contract = readContract(scenario.spec);
      assert.equal(contract.frontendContract.window.category, scenario.category);

      const partnerAddressSelector = selectorFor(contract, 'header', 'partnerAddress');
      assert.ok(partnerAddressSelector, `${scenario.spec} must expose partnerAddress selector metadata`);
      assertRequiredContext(
        partnerAddressSelector,
        [{ param: 'C_BPartner_ID', source: 'field', field: 'businessPartner' }],
        `${scenario.spec}:partnerAddress`,
      );

      const partnerAddressField = frontendField(contract, 'header', 'partnerAddress');
      assert.deepEqual(
        buildSelectorContext({
          windowCategory: scenario.category,
          entityName: 'header',
          field: attachSelectorContext(partnerAddressField, partnerAddressSelector),
          record: { businessPartner: 'BP-001' },
        }),
        { C_BPartner_ID: 'BP-001' },
        `${scenario.spec}:partnerAddress must resolve the selected BP into selector params`,
      );

      const priceListSelector = selectorFor(contract, 'header', 'priceList');
      assert.ok(priceListSelector, `${scenario.spec} must expose priceList selector metadata`);
      assertRequiredContext(
        priceListSelector,
        [{ param: 'isSOTrx', source: 'windowCategory' }],
        `${scenario.spec}:priceList`,
      );

      const priceListField = frontendField(contract, 'header', 'priceList');
      assert.deepEqual(
        buildSelectorContext({
          windowCategory: scenario.category,
          entityName: 'header',
          field: attachSelectorContext(priceListField, priceListSelector),
        }),
        { isSOTrx: scenario.expectedIsSOTrx, IsSOTrx: scenario.expectedIsSOTrx },
        `${scenario.spec}:priceList must derive the sales/purchase side from the window category`,
      );

      const taxSelector = selectorFor(contract, 'lines', 'tax');
      assert.ok(taxSelector, `${scenario.spec} must expose line tax selector metadata`);
      assertRequiredContext(
        taxSelector,
        [
          { param: 'IsSOTrx', source: 'windowCategory' },
          { param: 'DateInvoiced', source: 'parentField' },
        ],
        `${scenario.spec}:lines.tax`,
      );

      const taxField = frontendField(contract, 'lines', 'tax');
      const headerRecord = {
        [scenario.dateField]: '2026-05-12',
        priceList: 'PL-001',
        partnerAddress: 'LOC-001',
      };
      assert.deepEqual(
        buildSelectorContext({
          windowCategory: scenario.category,
          entityName: 'lines',
          field: attachSelectorContext(taxField, taxSelector),
          parentRecord: headerRecord,
          parentId: 'HDR-001',
        }),
        {
          IsSOTrx: scenario.expectedIsSOTrx,
          isSOTrx: scenario.expectedIsSOTrx,
          DateInvoiced: '12-05-2026',
          parentId: 'HDR-001',
        },
        `${scenario.spec}:lines.tax must carry the transaction side and accounting date`,
      );

      if (scenario.hasTransactionDocument) {
        const transactionDocumentSelector = selectorFor(contract, 'header', 'transactionDocument');
        assert.ok(transactionDocumentSelector, `${scenario.spec} must expose transactionDocument context`);
        assertRequiredContext(
          transactionDocumentSelector,
          [{ param: 'IsSOTrx', source: 'windowCategory' }],
          `${scenario.spec}:transactionDocument`,
        );
      }
    });
  }

  for (const scenario of SHIPMENT_SCENARIOS) {
    it(`${scenario.spec} keeps BP address context-safe in movement forms`, () => {
      const contract = readContract(scenario.spec);
      const partnerAddressSelector = selectorFor(contract, scenario.entity, 'partnerAddress');
      assert.ok(partnerAddressSelector, `${scenario.spec} must expose partnerAddress selector metadata`);
      assertRequiredContext(
        partnerAddressSelector,
        [{ param: 'C_BPartner_ID', source: 'field', field: 'businessPartner' }],
        `${scenario.spec}:partnerAddress`,
      );

      const partnerAddressField = frontendField(contract, scenario.entity, 'partnerAddress');
      assert.deepEqual(
        buildSelectorContext({
          windowCategory: scenario.category,
          entityName: scenario.entity,
          field: attachSelectorContext(partnerAddressField, partnerAddressSelector),
          record: { businessPartner: 'BP-002' },
        }),
        { C_BPartner_ID: 'BP-002' },
      );
    });
  }
});
