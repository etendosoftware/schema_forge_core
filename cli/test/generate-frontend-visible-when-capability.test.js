import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateTableComponent, generatePageComponent } from '../src/generate-frontend.js';

// ETP-4520 — `visibleWhenCapability` emission. The generator only emits the
// DATA annotation onto column/statusPill entries here; the actual runtime
// omission (calling useHasCapability and skipping the render) happens inside
// DataTable.jsx / DetailView.jsx, which live in the functional repo's
// tools/app-shell/src/components/contract-ui — NOT in this repo. See the
// delivery report for the companion change those components still need.
describe('generateTableComponent — visibleWhenCapability', () => {
  function buildContract(fieldExtras = {}) {
    return {
      frontendContract: {
        entities: {
          header: {
            fields: [
              { name: 'documentNo', column: 'DocumentNo', label: 'Document No', type: 'string', visibility: 'editable', grid: true, form: true },
              { name: 'accountingDate', column: 'AccountingDate', label: 'Accounting Date', type: 'date', visibility: 'editable', grid: true, form: true, ...fieldExtras },
            ],
          },
        },
      },
    };
  }

  it('emits visibleWhenCapability on the grid column when the field declares it', () => {
    const src = generateTableComponent('header', buildContract({ visibleWhenCapability: 'showAccountingFields' }));
    assert.match(src, /key: 'accountingDate'.*visibleWhenCapability: 'showAccountingFields'/);
  });

  it('omits visibleWhenCapability from the grid column when not declared', () => {
    const src = generateTableComponent('header', buildContract());
    assert.doesNotMatch(src, /visibleWhenCapability/);
  });
});

describe('generatePageComponent — statusPills visibleWhenCapability (ETP-4520)', () => {
  function buildContract(windowExtras = {}, fieldExtras = {}) {
    return {
      frontendContract: {
        window: {
          name: 'Purchase Order',
          category: 'purchases',
          statusPills: [
            { field: 'isTaxIncluded', trueKey: 'taxIncluded', falseKey: 'taxExcluded' },
          ],
          ...windowExtras,
        },
        entities: {
          header: {
            tableName: 'C_Order',
            fields: [
              { name: 'documentNo', column: 'DocumentNo', label: 'Document No', type: 'string', visibility: 'editable', form: true, grid: true },
              { name: 'isTaxIncluded', column: 'IsTaxIncluded', label: 'Tax Included', type: 'boolean', visibility: 'readOnly', form: true, ...fieldExtras },
            ],
          },
        },
      },
      backendContract: { processEndpoints: [] },
    };
  }

  it("looks up the pill's referenced field by name and emits its visibleWhenCapability onto the pill entry", () => {
    const src = generatePageComponent('header', undefined, buildContract({}, { visibleWhenCapability: 'showAccountingFields' }));
    assert.match(src, /key: 'isTaxIncluded', type: 'statusPill', trueKey: 'taxIncluded', falseKey: 'taxExcluded', visibleWhenCapability: 'showAccountingFields'/);
  });

  it('omits visibleWhenCapability from the pill entry when the referenced field does not declare it', () => {
    const src = generatePageComponent('header', undefined, buildContract());
    assert.match(src, /key: 'isTaxIncluded', type: 'statusPill', trueKey: 'taxIncluded', falseKey: 'taxExcluded' },/);
  });

  it('does not duplicate visibleWhenCapability as a property on the statusPills decision entry itself', () => {
    // Decisions entry only ever carries field/trueKey/falseKey — the capability
    // key is resolved from the field, never declared redundantly on the pill.
    const src = generatePageComponent('header', undefined, buildContract({}, { visibleWhenCapability: 'showAccountingFields' }));
    const extraBadgesBlock = src.slice(src.indexOf('const extraBadges'), src.indexOf('const processes'));
    assert.equal((extraBadgesBlock.match(/visibleWhenCapability/g) || []).length, 1);
  });
});
