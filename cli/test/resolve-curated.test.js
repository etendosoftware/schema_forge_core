import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveCurated } from '../src/resolve-curated.js';

describe('resolveCurated', () => {
  it('applies entity, field, window, draft mode, and explicit rule decisions', async () => {
    const schemaRaw = {
      window: { id: '100', name: 'Sales Order' },
      entities: [{
        name: 'cOrder',
        tableName: 'C_Order',
        tabId: '10',
        tabName: 'Header',
        fields: [{
          name: 'businessPartner',
          columnName: 'C_BPartner_ID',
          label: 'Business Partner',
          type: 'foreignKey',
          visibility: 'editable',
          mandatory: true,
          reference: { type: 'Search', targetTable: 'C_BPartner' },
          readOnlyLogic: '@Processed@=Y',
          displayLogic: '@IsSOTrx@=Y',
          callout: 'SL_Order_BPartner',
          validationRule: '@AD_Org_ID@',
        }, {
          name: 'internalFlag',
          columnName: 'EM_Internal_Flag',
          label: 'Internal Flag',
          type: 'boolean',
          visibility: 'editable',
        }, {
          name: 'documentAction',
          columnName: 'DocAction',
          label: 'Document Action',
          type: 'button',
          visibility: 'editable',
          processId: '111',
          processType: 'classic',
        }],
      }],
    };

    const decisions = {
      version: 2,
      discardPatterns: ['EM_*'],
      window: {
        name: 'Order Entry',
        layoutType: 'document',
        hidePrint: true,
        hideMoreMenu: true,
        hideSaveStatuses: ['CO'],
        contentBg: null,
        breadcrumb: false,
        summaryFields: ['grandTotal'],
        detailTabIndex: 0,
        detailEntity: null,
        salesTheme: false,
        noHeaderBorder: true,
        draftMode: {
          enabled: true,
          processField: 'documentAction',
          processValue: 'CO',
          label: 'Complete',
          completedStatuses: ['CO', 'CL'],
        },
      },
      entities: {
        cOrder: {
          name: 'order',
          formCols: 3,
          javaQualifier: 'sales-order',
          fields: {
            businessPartner: {
              label: 'Customer',
              grid: true,
              searchable: true,
              inputMode: null,
              reference: null,
              displayLogic: null,
              readOnlyLogic: null,
              displayLogicJs: 'isSales',
              forceCalloutFields: ['priceList'],
              order: 2,
            },
            internalFlag: {
              visibility: 'editable',
              badge: true,
              order: 1,
            },
          },
        },
      },
      rules: {
        SL_Order_BPartner_C_BPartner_ID: {
          type: 'callout',
          entity: 'order',
          decision: 'Keep',
          description: 'Default order values from the selected customer.',
          impactIfOmitted: 'Customer defaults would not be applied.',
          translated: { expression: 'customerChanged' },
        },
      },
    };

    const { schema, rules } = await resolveCurated(schemaRaw, { rules: [] }, decisions);

    assert.deepEqual(schema.window, {
      id: '100',
      name: 'Order Entry',
      primaryEntity: 'order',
      category: 'sales',
      layoutType: 'document',
      hidePrint: true,
      hideSaveStatuses: ['CO'],
      hideMoreMenu: true,
      contentBg: null,
      breadcrumb: false,
      detailTabIndex: 0,
      detailEntity: null,
      summaryFields: ['grandTotal'],
      salesTheme: false,
      noHeaderBorder: true,
      // ETP-3914 — rowQuickActions intentionally absent: feature is ON by default,
      // contract only carries the block when the user overrides defaults.
    });

    assert.equal(schema.entities.length, 1);
    assert.deepEqual(schema.entities[0].draftMode, {
      enabled: true,
      processField: 'documentAction',
      processValue: 'CO',
      label: 'Complete',
      completedStatuses: ['CO', 'CL'],
    });
    assert.equal(schema.entities[0].javaQualifier, 'sales-order');
    assert.equal(schema.entities[0].formCols, 3);

    const [internalFlag, businessPartner, documentAction] = schema.entities[0].fields;
    assert.equal(internalFlag.name, 'internalFlag');
    assert.equal(internalFlag.visibility, 'editable');
    assert.equal(internalFlag.badge, true);

    assert.equal(businessPartner.name, 'businessPartner');
    assert.equal(businessPartner.label, 'Customer');
    assert.equal(businessPartner.sourceRequired, true);
    assert.equal(businessPartner.grid, true);
    assert.equal(businessPartner.form, true);
    assert.equal(businessPartner.searchable, true);
    assert.equal(businessPartner.reference, undefined);
    assert.equal(businessPartner.inputMode, undefined);
    assert.equal(businessPartner.readOnlyLogic, '@Processed@=Y');
    assert.equal(businessPartner.displayLogic, undefined);
    assert.equal(businessPartner.displayLogicJs, 'isSales');
    assert.deepEqual(businessPartner.forceCalloutFields, ['priceList']);
    assert.equal(businessPartner.callout, 'SL_Order_BPartner');
    assert.equal(businessPartner.validationRule, '@AD_Org_ID@');

    assert.equal(documentAction.processId, '111');
    assert.equal(documentAction.processType, 'classic');

    assert.deepEqual(rules, [{
      name: 'SL_Order_BPartner_C_BPartner_ID',
      type: 'callout',
      entity: 'order',
      decision: 'Keep',
      description: 'Default order values from the selected customer.',
      impactIfOmitted: 'Customer defaults would not be applied.',
      translated: { expression: 'customerChanged' },
    }]);
  });
});

// ─── F3 refactor — lookupDrawer / lookupTitle / onSelectMappings / displayFromCatalog ───
describe('resolveCurated — field-level drawer + display passthroughs (F3)', () => {
  const schemaRaw = {
    window: { id: '600', name: 'Internal Consumption' },
    entities: [{
      name: 'mInternalConsumptionLine',
      tableName: 'M_InternalConsumptionLine',
      tabId: '10',
      tabName: 'Lines',
      fields: [
        { name: 'product', columnName: 'M_Product_ID', label: 'Product', type: 'foreignKey',
          visibility: 'editable', reference: { type: 'Search', targetTable: 'M_Product' } },
        { name: 'displayedProduct', columnName: 'DisplayedProduct_ID', label: 'Displayed Product',
          type: 'foreignKey', visibility: 'editable',
          reference: { type: 'Search', targetTable: 'M_Product' } },
        { name: 'plain', columnName: 'PlainCol', label: 'Plain', type: 'string', visibility: 'editable' },
      ],
    }],
  };

  const decisions = {
    version: 2,
    window: { name: 'Internal Consumption' },
    entities: {
      mInternalConsumptionLine: {
        name: 'internalConsumptionLine',
        fields: {
          product: {
            lookupDrawer: 'internal-consumption-product',
            lookupTitle: 'Product + Warehouse',
            onSelectMappings: [
              { from: 'M_Locator_ID', to: 'storageBin' },
              { from: 'M_Product_ID', to: 'product' },
            ],
          },
          displayedProduct: { displayFromCatalog: true },
          plain: {},
        },
      },
    },
    rules: {},
  };

  it('passes lookupDrawer + lookupTitle from decisions to curated field', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    const product = schema.entities[0].fields.find(f => f.name === 'product');
    assert.equal(product.lookupDrawer, 'internal-consumption-product');
    assert.equal(product.lookupTitle, 'Product + Warehouse');
  });

  it('passes onSelectMappings array from decisions to curated field', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    const product = schema.entities[0].fields.find(f => f.name === 'product');
    assert.deepEqual(product.onSelectMappings, [
      { from: 'M_Locator_ID', to: 'storageBin' },
      { from: 'M_Product_ID', to: 'product' },
    ]);
  });

  it('passes displayFromCatalog from decisions to curated field', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    const dp = schema.entities[0].fields.find(f => f.name === 'displayedProduct');
    assert.equal(dp.displayFromCatalog, true);
  });

  it('does NOT add any of the four properties when not declared', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    const plain = schema.entities[0].fields.find(f => f.name === 'plain');
    assert.equal(plain.lookupDrawer, undefined);
    assert.equal(plain.lookupTitle, undefined);
    assert.equal(plain.onSelectMappings, undefined);
    assert.equal(plain.displayFromCatalog, undefined);
  });

  it('ignores empty onSelectMappings array (does not set property)', async () => {
    const emptyDecisions = JSON.parse(JSON.stringify(decisions));
    emptyDecisions.entities.mInternalConsumptionLine.fields.product.onSelectMappings = [];
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, emptyDecisions);
    const product = schema.entities[0].fields.find(f => f.name === 'product');
    assert.equal(product.onSelectMappings, undefined);
  });
});
