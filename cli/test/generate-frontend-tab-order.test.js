import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveSecondaryTabDefs, buildSecondaryTabPropEntry, getCustomTabItems, generatePageComponent } from '../src/generate-frontend.js';

const contract = { frontendContract: { entities: { accounting: { fields: [] } } } };

describe('secondaryTabs tabOrder passthrough (ETP-4415)', () => {
  it('resolveSecondaryTabDefs carries the declared tabOrder onto the resolved tab def', () => {
    const decl = { accounting: { tabOrder: 1000, label: 'Accounting' } };
    const defs = resolveSecondaryTabDefs(decl, contract, 'header', 'lines', {}, {});
    assert.equal(defs[0].tabOrder, 1000);
  });

  it('resolveSecondaryTabDefs leaves tabOrder undefined when not declared (runtime applies the default)', () => {
    const decl = { accounting: { label: 'Accounting' } };
    const defs = resolveSecondaryTabDefs(decl, contract, 'header', 'lines', {}, {});
    assert.equal(defs[0].tabOrder, undefined);
  });

  it('buildSecondaryTabPropEntry emits the tabOrder literal when present', () => {
    const entry = buildSecondaryTabPropEntry({
      key: 'accounting', label: 'Accounting', TableName: 'AccountingTable', FormName: 'AccountingForm',
      addLineEntries: [], tabOrder: 1000,
    });
    assert.match(entry, /tabOrder: 1000/);
  });

  it('buildSecondaryTabPropEntry omits the tabOrder literal when absent', () => {
    const entry = buildSecondaryTabPropEntry({
      key: 'accounting', label: 'Accounting', TableName: 'AccountingTable', FormName: 'AccountingForm',
      addLineEntries: [],
    });
    assert.doesNotMatch(entry, /tabOrder/);
  });

  it('buildSecondaryTabPropEntry emits tabOrder on isFormTab and isPanelTab entries too', () => {
    const formEntry = buildSecondaryTabPropEntry({ key: 'k', label: 'L', isFormTab: true, FormName: 'F', tabOrder: 5 });
    assert.match(formEntry, /tabOrder: 5/);
    const panelEntry = buildSecondaryTabPropEntry({ key: 'k', label: 'L', isPanelTab: true, PanelName: 'P', tabOrder: 5 });
    assert.match(panelEntry, /tabOrder: 5/);
  });
});

describe('custom tab tabOrder passthrough (ETP-4415)', () => {
  it('emits tabOrder on a customPanelTabs entry when declared', () => {
    const items = getCustomTabItems(
      false,
      [{ key: 'pricing', label: 'Price', component: 'ProductPriceBar', tabOrder: 1 }],
      false, {}, 'M_Product', [],
    );
    assert.match(items[0], /tabOrder: 1/);
  });

  it('omits tabOrder on a customPanelTabs entry when not declared', () => {
    const items = getCustomTabItems(
      false,
      [{ key: 'pricing', label: 'Price', component: 'ProductPriceBar' }],
      false, {}, 'M_Product', [],
    );
    assert.doesNotMatch(items[0], /tabOrder/);
  });

  it('emits tabOrder on an extraTabs entry when declared', () => {
    const items = getCustomTabItems(false, [], false, {}, 'M_Product', [
      { key: 'extra', label: 'Extra', component: 'ExtraPanel', tabOrder: 2 },
    ]);
    assert.match(items[0], /tabOrder: 2/);
  });

  it('emits tabOrder on the attachments entry when declared, and strips it from the AttachmentsTab config prop', () => {
    const items = getCustomTabItems(false, [], true, { tabOrder: 3, accept: '.pdf' }, 'M_Product', []);
    assert.match(items[0], /key: 'attachments'/);
    assert.match(items[0], /tabOrder: 3/);
    assert.doesNotMatch(items[0], /config: \{"tabOrder":3/);
  });

  it('omits tabOrder on the attachments entry when not declared', () => {
    const items = getCustomTabItems(false, [], true, { accept: '.pdf' }, 'M_Product', []);
    assert.doesNotMatch(items[0], /tabOrder/);
  });
});

const minimalPageContract = {
  frontendContract: {
    window: { id: '1', name: 'Item', primaryEntity: 'item', category: 'reference' },
    entities: {
      item: {
        fields: [
          { name: 'name', column: 'Name', type: 'string', tsType: 'string', visibility: 'editable', required: true, grid: true, form: true },
          { name: 'adClientId', column: 'AD_Client_ID', type: 'id', tsType: 'string', visibility: 'system', required: true, grid: false, form: false },
        ],
        searchableFields: ['name'],
        computedFields: [],
      },
    },
  },
  backendContract: { processEndpoints: [] },
};

describe('window.detailTabOrder prop emission (ETP-4415)', () => {
  it('emits detailTabOrder={N} when declared on the window', () => {
    const contract2 = {
      ...minimalPageContract,
      frontendContract: { ...minimalPageContract.frontendContract, window: { ...minimalPageContract.frontendContract.window, detailTabOrder: 5 } },
    };
    const code = generatePageComponent('item', null, contract2);
    assert.match(code, /detailTabOrder=\{5\}/);
  });

  it('omits the detailTabOrder prop when not declared', () => {
    const code = generatePageComponent('item', null, minimalPageContract);
    assert.doesNotMatch(code, /detailTabOrder/);
  });
});
