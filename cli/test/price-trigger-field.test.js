// Tests that window.priceTriggerField is emitted into the lineConfig prop ONLY when
// it differs from the default ('product').
//
// ETP-4708 T14-T15 / L3 in the contract-ui churn report. DetailView hardcoded four
// `field === 'product'` checks gating the price/callout chain. The trigger name now
// lives in the LINE_CONFIGS presets (app-shell-core useLineGrossAmount.js) and a
// window can override it declaratively.
//
// The control cases below are the R3 lock: the default is the NON-EMPTY STRING
// 'product', so a truthiness gate would emit the prop for every window and quietly
// rewrite every generated page. The gate must be inequality with the default.

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generatePageComponent } from '../src/generate-frontend.js';

function buildContract(windowExtra = {}) {
  return {
    frontendContract: {
      window: {
        id: '902',
        name: 'Sales Order',
        primaryEntity: 'order',
        category: 'sales',
        ...windowExtra,
      },
      entities: {
        order: {
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
        orderLine: {
          fields: [
            {
              name: 'item', column: 'M_Product_ID',
              type: 'foreignKey', tsType: 'string',
              visibility: 'editable', required: true, grid: true, form: true,
              reference: 'Product', inputMode: 'selector', label: 'Item',
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

describe('window.priceTriggerField — emitted only when it overrides the default', () => {
  it('emits nothing when the window does not declare it', () => {
    const code = generatePageComponent('order', 'orderLine', buildContract());
    assert.ok(!/priceTriggerField/.test(code), 'no priceTriggerField without a declaration');
  });

  it('emits nothing when the window declares the default explicitly (R3 control)', () => {
    // The trap: 'product' is truthy, so a `wrapIf(..., value)` gate would emit here
    // and change the generated output of every window that spelled out the default.
    const code = generatePageComponent('order', 'orderLine', buildContract({ priceTriggerField: 'product' }));
    assert.ok(!/priceTriggerField/.test(code), 'declaring the default must emit nothing');
  });

  it('emits an override spread over the ORDER preset when the trigger differs', () => {
    const code = generatePageComponent('order', 'orderLine', buildContract({ priceTriggerField: 'item' }));
    assert.match(code, /lineConfig=\{\{ \.\.\.ORDER_LINE_CONFIG, priceTriggerField: 'item' \}\}/);
  });

  it('imports the preset it spreads when the window has no lineEntityConfig', () => {
    // Without an override this window emits no lineConfig prop and no import at all,
    // so the override path has to pull the preset in or the page will not compile.
    const code = generatePageComponent('order', 'orderLine', buildContract({ priceTriggerField: 'item' }));
    assert.match(code, /import \{ ORDER_LINE_CONFIG \} from '@\/hooks\/useLineGrossAmount';/);
  });

  it('spreads the window own preset when lineEntityConfig is declared', () => {
    const code = generatePageComponent('order', 'orderLine', buildContract({
      lineEntityConfig: 'invoice',
      priceTriggerField: 'item',
    }));
    assert.match(code, /lineConfig=\{\{ \.\.\.INVOICE_LINE_CONFIG, priceTriggerField: 'item' \}\}/);
    assert.match(code, /import \{ INVOICE_LINE_CONFIG \} from '@\/hooks\/useLineGrossAmount';/);
  });

  it('leaves the plain preset emission untouched when only lineEntityConfig is declared', () => {
    // Regression guard: the override branch must not disturb the existing shape.
    const code = generatePageComponent('order', 'orderLine', buildContract({ lineEntityConfig: 'invoice' }));
    assert.match(code, /lineConfig=\{INVOICE_LINE_CONFIG\}/);
    assert.ok(!/priceTriggerField/.test(code));
  });
});
