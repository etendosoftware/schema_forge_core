// @covers cli/src/resolve-curated.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveCurated, applyMinDate } from '../src/resolve-curated.js';

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

describe('resolveCurated — window.detailTabOrder passthrough (ETP-4415)', () => {
  const schemaRaw = { window: { id: '900', name: 'Item' }, entities: [] };

  it('passes window.detailTabOrder through to the curated window object', async () => {
    const decisions = { window: { detailTabOrder: 7 } };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    assert.equal(schema.window.detailTabOrder, 7);
  });

  it('does not add detailTabOrder when not declared', async () => {
    const decisions = { window: {} };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    assert.equal(schema.window.detailTabOrder, undefined);
  });
});

describe('resolveCurated — window.showDetailFooterTotals passthrough', () => {
  const schemaRaw = { window: { id: '900', name: 'Item' }, entities: [] };

  it('passes an explicit false through to the curated window object', async () => {
    const decisions = { window: { showDetailFooterTotals: false } };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    assert.strictEqual(schema.window.showDetailFooterTotals, false);
  });

  it('does not add showDetailFooterTotals when not declared', async () => {
    const decisions = { window: {} };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    assert.equal(Object.hasOwn(schema.window, 'showDetailFooterTotals'), false);
  });
});

describe('resolveCurated — agentPrompt passthrough (ETP-4252)', () => {
  const schemaRaw = {
    window: { id: '700', name: 'Purchase Order' },
    entities: [{
      name: 'order', tableName: 'C_Order', tabId: '1', tabName: 'Header',
      fields: [
        { name: 'docStatus', columnName: 'DocStatus', label: 'Status', type: 'string', visibility: 'editable' },
        { name: 'plain', columnName: 'PlainCol', label: 'Plain', type: 'string', visibility: 'editable' },
      ],
    }],
  };
  const decisions = {
    version: 2,
    window: { name: 'Purchase Order', agentPrompt: 'Confirm before completing.' },
    entities: {
      order: {
        name: 'order',
        fields: {
          docStatus: { agentPrompt: 'Only advance status forward.' },
          plain: {},
        },
      },
    },
    rules: {},
  };

  it('copies window.agentPrompt into the curated window', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    assert.equal(schema.window.agentPrompt, 'Confirm before completing.');
  });

  it('copies field agentPrompt into the curated field', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    const docStatus = schema.entities[0].fields.find(f => f.name === 'docStatus');
    assert.equal(docStatus.agentPrompt, 'Only advance status forward.');
  });

  it('omits agentPrompt when a field does not declare one', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    const plain = schema.entities[0].fields.find(f => f.name === 'plain');
    assert.equal(plain.agentPrompt, undefined);
  });
});

describe('resolveCurated — namedFilters normalization (ETP-4601)', () => {
  const schemaRaw = {
    window: { id: '710', name: 'Sales Invoice' },
    entities: [{
      name: 'header', tableName: 'C_Invoice', tabId: '1', tabName: 'Header',
      fields: [
        { name: 'documentNo', columnName: 'DocumentNo', label: 'No', type: 'string', visibility: 'editable' },
      ],
    }],
  };

  it('copies valid named filters (trimmed) into the curated entity', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Sales Invoice' },
      entities: {
        header: {
          name: 'header',
          namedFilters: [
            { name: '  completed ', label: ' Paid ', description: ' Paid in full ', where: ' e.paymentComplete = true ' },
            { name: 'pending', where: 'e.paymentComplete = false' },
          ],
          fields: { documentNo: {} },
        },
      },
      rules: {},
    };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    assert.deepEqual(schema.entities[0].namedFilters, [
      { name: 'completed', label: 'Paid', description: 'Paid in full', where: 'e.paymentComplete = true' },
      { name: 'pending', where: 'e.paymentComplete = false' },
    ]);
  });

  it('drops entries missing a name or where, and dedupes by name (first wins)', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Sales Invoice' },
      entities: {
        header: {
          name: 'header',
          namedFilters: [
            { name: 'completed', where: 'e.paymentComplete = true' },
            { name: '', where: 'e.x = 1' },
            { name: 'nowhere' },
            { where: 'e.y = 2' },
            { name: 'completed', where: 'e.other = true' },
          ],
          fields: { documentNo: {} },
        },
      },
      rules: {},
    };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    assert.deepEqual(schema.entities[0].namedFilters, [
      { name: 'completed', where: 'e.paymentComplete = true' },
    ]);
  });

  it('omits namedFilters when none are declared or all are invalid', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Sales Invoice' },
      entities: {
        header: {
          name: 'header',
          namedFilters: [{ name: 'bad' }],
          fields: { documentNo: {} },
        },
      },
      rules: {},
    };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    assert.equal(schema.entities[0].namedFilters, undefined);
  });
});

describe('resolveCurated — excludeValueOf passthrough', () => {
  const schemaRaw = {
    window: { id: '900', name: 'Goods Movements' },
    entities: [{
      name: 'movementLine',
      tableName: 'M_MovementLine',
      tabId: '10',
      tabName: 'Lines',
      fields: [
        { name: 'storageBin', columnName: 'M_Locator_ID', label: 'Origin Bin', type: 'foreignKey',
          visibility: 'editable', reference: { type: 'Search', targetTable: 'M_Locator' } },
        { name: 'newStorageBin', columnName: 'M_LocatorTo_ID', label: 'Destination Bin', type: 'foreignKey',
          visibility: 'editable', reference: { type: 'Search', targetTable: 'M_Locator' } },
        { name: 'plain', columnName: 'PlainCol', label: 'Plain', type: 'string', visibility: 'editable' },
      ],
    }],
  };

  const decisions = {
    version: 2,
    window: { name: 'Goods Movements' },
    entities: {
      movementLine: {
        name: 'movementLine',
        fields: {
          newStorageBin: { excludeValueOf: 'storageBin' },
          plain: {},
        },
      },
    },
    rules: {},
  };

  it('copies field excludeValueOf into the curated field', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    const newBin = schema.entities[0].fields.find(f => f.name === 'newStorageBin');
    assert.equal(newBin.excludeValueOf, 'storageBin');
  });

  it('omits excludeValueOf when a field does not declare one', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    const plain = schema.entities[0].fields.find(f => f.name === 'plain');
    assert.equal(plain.excludeValueOf, undefined);
    const originBin = schema.entities[0].fields.find(f => f.name === 'storageBin');
    assert.equal(originBin.excludeValueOf, undefined);
  });
});

// ETP-4749 — fixed, non-editable chip rendered before a text input (e.g. "https://"
// for a website field whose stored value is only the part after the scheme).
describe('resolveCurated — inputPrefix passthrough', () => {
  const schemaRaw = {
    window: { id: '123', name: 'Contacts' },
    entities: [{
      name: 'businessPartner',
      tableName: 'C_BPartner',
      tabId: '10',
      tabName: 'Business Partner',
      fields: [
        { name: 'etgoWeb', columnName: 'EM_Etgo_Web', label: 'Web', type: 'string', visibility: 'editable' },
        { name: 'plain', columnName: 'PlainCol', label: 'Plain', type: 'string', visibility: 'editable' },
      ],
    }],
  };

  const decisions = {
    version: 2,
    window: { name: 'Contacts' },
    entities: {
      businessPartner: {
        name: 'businessPartner',
        fields: {
          etgoWeb: { inputPrefix: 'https://' },
          plain: {},
        },
      },
    },
    rules: {},
  };

  it('copies field inputPrefix into the curated field', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    const web = schema.entities[0].fields.find(f => f.name === 'etgoWeb');
    assert.equal(web.inputPrefix, 'https://');
  });

  it('omits inputPrefix when a field does not declare one', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    const plain = schema.entities[0].fields.find(f => f.name === 'plain');
    assert.equal(plain.inputPrefix, undefined);
  });
});

// ─── virtualFields — appendVirtualFields exercised via resolveCurated ───
describe('resolveCurated — virtualFields', () => {
  const baseSchema = {
    window: { id: '200', name: 'Return Receipt' },
    entities: [{
      name: 'returnMaterialReceipt',
      tableName: 'M_InOut',
      tabId: '20',
      tabName: 'Header',
      fields: [
        { name: 'documentNo', columnName: 'DocumentNo', label: 'Document No', type: 'string', visibility: 'readOnly' },
      ],
    }],
  };

  it('virtual field appears in curated fields with virtual: true', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Return Receipt' },
      entities: {
        returnMaterialReceipt: {
          name: 'returnReceipt',
          virtualFields: [{ name: 'totalReturned', label: 'Total Returned', type: 'decimal' }],
          fields: {},
        },
      },
      rules: {},
    };

    const { schema } = await resolveCurated(baseSchema, { rules: [] }, decisions);
    const vf = schema.entities[0].fields.find(f => f.name === 'totalReturned');
    assert.ok(vf, 'virtual field should be present');
    assert.equal(vf.virtual, true);
    assert.equal(vf.type, 'decimal');
    assert.equal(vf.label, 'Total Returned');
  });

  it('applies defaults when optional properties are omitted', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Return Receipt' },
      entities: {
        returnMaterialReceipt: {
          name: 'returnReceipt',
          virtualFields: [{ name: 'minimalField' }],
          fields: {},
        },
      },
      rules: {},
    };

    const { schema } = await resolveCurated(baseSchema, { rules: [] }, decisions);
    const vf = schema.entities[0].fields.find(f => f.name === 'minimalField');
    assert.ok(vf, 'minimal virtual field should be present');
    assert.equal(vf.virtual, true);
    assert.equal(vf.column, 'minimalField');
    assert.equal(vf.label, 'minimalField');
    assert.equal(vf.type, 'string');
    assert.equal(vf.visibility, 'readOnly');
    assert.equal(vf.required, false);
    assert.equal(vf.form, true);
    assert.equal(vf.grid, true);
    assert.equal(vf.section, 'other');
    assert.equal(vf.gridOrder, undefined);
  });

  it('column falls back to name when not specified', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Return Receipt' },
      entities: {
        returnMaterialReceipt: {
          name: 'returnReceipt',
          virtualFields: [{ name: 'computedStatus' }],
          fields: {},
        },
      },
      rules: {},
    };

    const { schema } = await resolveCurated(baseSchema, { rules: [] }, decisions);
    const vf = schema.entities[0].fields.find(f => f.name === 'computedStatus');
    assert.equal(vf.column, 'computedStatus');
  });

  it('explicit column overrides name fallback', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Return Receipt' },
      entities: {
        returnMaterialReceipt: {
          name: 'returnReceipt',
          virtualFields: [{ name: 'myField', column: 'customColumnKey' }],
          fields: {},
        },
      },
      rules: {},
    };

    const { schema } = await resolveCurated(baseSchema, { rules: [] }, decisions);
    const vf = schema.entities[0].fields.find(f => f.name === 'myField');
    assert.equal(vf.column, 'customColumnKey');
  });

  it('empty virtualFields array adds no virtual fields', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Return Receipt' },
      entities: {
        returnMaterialReceipt: {
          name: 'returnReceipt',
          virtualFields: [],
          fields: {},
        },
      },
      rules: {},
    };

    const { schema } = await resolveCurated(baseSchema, { rules: [] }, decisions);
    const virtualFields = schema.entities[0].fields.filter(f => f.virtual === true);
    assert.equal(virtualFields.length, 0);
  });
});

// ─── gridReadOnly — FIELD_DECISION_COPY_PROPS passthrough ───────────────────
describe('resolveCurated — gridReadOnly passthrough', () => {
  const schemaRaw = {
    window: { id: '901', name: 'Return To Vendor Shipment' },
    entities: [{
      name: 'rtvShipment',
      tableName: 'M_InOut',
      tabId: '50',
      tabName: 'Header',
      fields: [
        { name: 'quantity', columnName: 'Qty', label: 'Quantity',
          type: 'number', visibility: 'editable', mandatory: false },
        { name: 'product', columnName: 'M_Product_ID', label: 'Product',
          type: 'foreignKey', visibility: 'editable', mandatory: false },
      ],
    }],
  };

  const decisionsWithGridReadOnly = {
    version: 2,
    window: { name: 'Return To Vendor Shipment' },
    entities: {
      rtvShipment: {
        name: 'returnToVendorShipment',
        fields: {
          quantity: { gridReadOnly: true },
          product: {},
        },
      },
    },
    rules: {},
  };

  it('copies gridReadOnly: true from decisions to the curated field', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisionsWithGridReadOnly);
    const qty = schema.entities[0].fields.find(f => f.name === 'quantity');
    assert.equal(qty.gridReadOnly, true);
  });

  it('does NOT set gridReadOnly on a field that lacks it in decisions', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisionsWithGridReadOnly);
    const product = schema.entities[0].fields.find(f => f.name === 'product');
    assert.equal(product.gridReadOnly, undefined);
  });

  it('does NOT set gridReadOnly when decisions field entry is absent', async () => {
    const decisionsNoGridReadOnly = {
      version: 2,
      window: { name: 'Return To Vendor Shipment' },
      entities: {
        rtvShipment: {
          name: 'returnToVendorShipment',
          fields: {
            quantity: {},
            product: {},
          },
        },
      },
      rules: {},
    };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisionsNoGridReadOnly);
    const qty = schema.entities[0].fields.find(f => f.name === 'quantity');
    assert.equal(qty.gridReadOnly, undefined);
  });
});

// ─── publicApi curation passthrough (ETP-5345) ───────────────────────────────
describe('resolveCurated — publicApi passthrough', () => {
  const schemaRaw = {
    window: { id: '902', name: 'Product' },
    entities: [{
      name: 'product',
      tableName: 'M_Product',
      tabId: '51',
      tabName: 'Header',
      fields: [
        { name: 'name', columnName: 'Name', label: 'Name',
          type: 'string', visibility: 'editable', mandatory: false },
        { name: 'internalCostBasis', columnName: 'InternalCostBasis', label: 'Internal Cost Basis',
          type: 'amount', visibility: 'editable', mandatory: false },
      ],
    }],
  };

  const decisionsWithPublicApi = {
    version: 2,
    window: { name: 'Product' },
    entities: {
      product: {
        name: 'product',
        fields: {
          name: { publicApi: { exposed: true, name: 'name' } },
          internalCostBasis: {},
        },
      },
    },
    rules: {},
  };

  it('copies publicApi from decisions to the curated field', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisionsWithPublicApi);
    const name = schema.entities[0].fields.find(f => f.name === 'name');
    assert.deepEqual(name.publicApi, { exposed: true, name: 'name' });
  });

  it('does NOT set publicApi on a field that lacks it in decisions', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisionsWithPublicApi);
    const internalCostBasis = schema.entities[0].fields.find(f => f.name === 'internalCostBasis');
    assert.equal(internalCostBasis.publicApi, undefined);
  });
});

// ─── businessCritical per-field flag (ETP-4233) ──────────────────────────────

describe('resolveCurated — businessCritical per-field flag (ETP-4233)', () => {
  const baseSchema = {
    window: { id: '200', name: 'Sales Order' },
    entities: [{
      name: 'cOrder',
      tableName: 'C_Order',
      tabId: '10',
      tabName: 'Header',
      fields: [
        { name: 'documentNo', columnName: 'DocumentNo', label: 'Document No',
          type: 'string', visibility: 'readOnly' },
        { name: 'description', columnName: 'Description', label: 'Description',
          type: 'string', visibility: 'editable' },
      ],
    }],
  };

  it('decision businessCritical:true propagates to curated field', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Sales Order' },
      entities: {
        cOrder: {
          name: 'order',
          fields: {
            documentNo: { businessCritical: true },
          },
        },
      },
      rules: {},
    };
    const { schema } = await resolveCurated(baseSchema, { rules: [] }, decisions);
    const field = schema.entities[0].fields.find(f => f.name === 'documentNo');
    assert.equal(field.businessCritical, true);
  });

  it('decision without businessCritical leaves field without the property', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Sales Order' },
      entities: {
        cOrder: {
          name: 'order',
          fields: {
            description: {},
          },
        },
      },
      rules: {},
    };
    const { schema } = await resolveCurated(baseSchema, { rules: [] }, decisions);
    const field = schema.entities[0].fields.find(f => f.name === 'description');
    assert.equal(field.businessCritical, undefined,
      'businessCritical should be absent when not declared in decisions');
  });
});

// ─── ETP-4277 — max constraint propagation ───────────────────────────────────
describe('resolveCurated — max field constraint (ETP-4277)', () => {
  const schemaRaw = {
    window: { id: '800', name: 'Sales Order' },
    entities: [{
      name: 'cOrderLine',
      tableName: 'C_OrderLine',
      tabId: '20',
      tabName: 'Lines',
      fields: [
        { name: 'discount', columnName: 'Discount', label: 'Discount', type: 'number', visibility: 'editable' },
        { name: 'quantity', columnName: 'QtyOrdered', label: 'Quantity', type: 'number', visibility: 'editable' },
      ],
    }],
  };

  it('propagates max from field decision to curated field', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Sales Order' },
      entities: {
        cOrderLine: {
          name: 'orderLine',
          fields: {
            discount: { max: 100 },
            quantity: {},
          },
        },
      },
      rules: {},
    };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    const discount = schema.entities[0].fields.find(f => f.name === 'discount');
    assert.equal(discount.max, 100);
  });

  it('does not add max property when not declared in field decision', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Sales Order' },
      entities: {
        cOrderLine: {
          name: 'orderLine',
          fields: {
            discount: { max: 100 },
            quantity: {},
          },
        },
      },
      rules: {},
    };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    const quantity = schema.entities[0].fields.find(f => f.name === 'quantity');
    assert.equal(quantity.max, undefined);
  });

  it('propagates max: 0 (zero is a valid constraint)', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Sales Order' },
      entities: {
        cOrderLine: {
          name: 'orderLine',
          fields: {
            discount: { max: 0 },
          },
        },
      },
      rules: {},
    };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    const discount = schema.entities[0].fields.find(f => f.name === 'discount');
    assert.equal(discount.max, 0);
  });

  it('propagates both min and max when both are declared', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Sales Order' },
      entities: {
        cOrderLine: {
          name: 'orderLine',
          fields: {
            discount: { min: 0, max: 100 },
          },
        },
      },
      rules: {},
    };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    const discount = schema.entities[0].fields.find(f => f.name === 'discount');
    assert.equal(discount.min, 0);
    assert.equal(discount.max, 100);
  });

  it('propagates integer:true and min together (e.g. usableLifeMonths)', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Sales Order' },
      entities: {
        cOrderLine: {
          name: 'orderLine',
          fields: {
            discount: { min: 1, integer: true },
          },
        },
      },
      rules: {},
    };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    const discount = schema.entities[0].fields.find(f => f.name === 'discount');
    assert.equal(discount.min, 1);
    assert.equal(discount.integer, true);
  });

  it('does NOT set integer when the decision omits it', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Sales Order' },
      entities: {
        cOrderLine: {
          name: 'orderLine',
          fields: {
            discount: { min: 0 },
          },
        },
      },
      rules: {},
    };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    const discount = schema.entities[0].fields.find(f => f.name === 'discount');
    assert.equal(discount.integer, undefined);
  });

  // ETP-4542 + ETP-4556 — integer follows the same `false` disable sentinel as min/max.
  it('does NOT emit flat integer when decision integer is false (disable sentinel)', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Sales Order' },
      entities: {
        cOrderLine: {
          name: 'orderLine',
          fields: {
            discount: { integer: false },
          },
        },
      },
      rules: {},
    };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    const discount = schema.entities[0].fields.find(f => f.name === 'discount');
    assert.equal(discount.integer, undefined);
  });

  // ETP-4556 — `false` disables the flat ETP-4277 min/max emission too, so the
  // disable sentinel is consistent with the nested `validation` object (which
  // already omits the bound on `false`). Without this guard `min: false` would
  // leak into the flat contract key and feed the on-blur autocorrect a garbage
  // bound.
  it('does NOT emit flat min when decision min is false (disable sentinel)', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Sales Order' },
      entities: {
        cOrderLine: {
          name: 'orderLine',
          fields: {
            discount: { min: false, max: 100 },
          },
        },
      },
      rules: {},
    };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    const discount = schema.entities[0].fields.find(f => f.name === 'discount');
    assert.equal(discount.min, undefined);
    assert.equal(discount.max, 100);
  });

  it('does NOT emit flat max when decision max is false (disable sentinel)', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Sales Order' },
      entities: {
        cOrderLine: {
          name: 'orderLine',
          fields: {
            discount: { min: 0, max: false },
          },
        },
      },
      rules: {},
    };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    const discount = schema.entities[0].fields.find(f => f.name === 'discount');
    assert.equal(discount.min, 0);
    assert.equal(discount.max, undefined);
  });
});

// ─── ETP-4555 — declarative validation constraint propagation ─────────────────
describe('resolveCurated — minDate on date fields', () => {
  const schemaRaw = {
    window: { id: '810', name: 'Remittance' },
    entities: [{
      name: 'header',
      tableName: 'REM_Remittance',
      tabId: '30',
      tabName: 'Header',
      fields: [
        { name: 'dueDate', columnName: 'Duedate', label: 'Due Date', type: 'date', visibility: 'editable' },
        { name: 'dateTrx', columnName: 'DateTrx', label: 'Date', type: 'date', visibility: 'editable' },
      ],
    }],
  };
  const decide = (dueDate) => ({
    version: 2,
    window: { name: 'Remittance' },
    entities: { header: { name: 'header', fields: { dueDate, dateTrx: {} } } },
    rules: {},
  });
  const resolve = async (dueDate) => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decide(dueDate));
    return schema.entities[0].fields;
  };

  it('carries minDate "today" to the curated field', async () => {
    const fields = await resolve({ minDate: 'today' });
    assert.equal(fields.find(f => f.name === 'dueDate').minDate, 'today');
  });

  it('carries a fixed YYYY-MM-DD minDate to the curated field', async () => {
    const fields = await resolve({ minDate: '2026-12-01' });
    assert.equal(fields.find(f => f.name === 'dueDate').minDate, '2026-12-01');
  });

  it('leaves minDate unset on a field that does not declare it', async () => {
    const fields = await resolve({ minDate: 'today' });
    assert.equal('minDate' in fields.find(f => f.name === 'dateTrx'), false);
  });

  for (const absent of [undefined, null, false]) {
    it(`treats minDate ${String(absent)} as "no bound" (no key, no throw)`, async () => {
      const fields = await resolve({ minDate: absent });
      assert.equal('minDate' in fields.find(f => f.name === 'dueDate'), false);
    });
  }

  for (const bad of ['tomorrow', 'TODAY', '2026/12/01', '01-12-2026', '2026-12-01T00:00:00Z', '', 20261201, true, {}]) {
    it(`throws, naming the field, on minDate ${JSON.stringify(bad)}`, async () => {
      await assert.rejects(resolve({ minDate: bad }), (err) => {
        assert.match(err.message, /field "dueDate"/);
        assert.match(err.message, /minDate/);
        assert.match(err.message, /"today" or "YYYY-MM-DD"/);
        return true;
      });
    });
  }

  it('applyMinDate: sets a valid value and throws on an invalid one with the field name', () => {
    const field = { name: 'startDate' };
    applyMinDate(field, { minDate: 'today' });
    assert.equal(field.minDate, 'today');
    assert.throws(() => applyMinDate({ name: 'startDate' }, { minDate: 'next week' }), /field "startDate" has minDate "next week"/);
  });
});

describe('resolveCurated — validation constraint object (ETP-4555)', () => {
  function rawSchema(fieldExtra = {}, textFieldExtra = {}) {
    return {
      window: { id: '900', name: 'Contacts' },
      entities: [{
        name: 'cBpartner',
        tableName: 'C_BPartner',
        tabId: '30',
        tabName: 'Header',
        fields: [
          // Numeric field carrying raw DB value constraints (strings, as extracted).
          { name: 'creditLimit', columnName: 'SO_CreditLimit', label: 'Credit Limit',
            type: 'number', visibility: 'editable', valueMin: '0', valueMax: '1000000', ...fieldExtra },
          // Text field carrying a raw fieldlength (string).
          { name: 'name', columnName: 'Name', label: 'Name', type: 'string',
            visibility: 'editable', maxLength: '60', ...textFieldExtra },
        ],
      }],
    };
  }

  function baseDecisions(fields = { creditLimit: {}, name: {} }) {
    return {
      version: 2,
      window: { name: 'Contacts' },
      entities: { cBpartner: { name: 'businessPartner', fields } },
      rules: {},
    };
  }

  async function resolveField(rawExtra, textExtra, fields) {
    const { schema } = await resolveCurated(rawSchema(rawExtra, textExtra), { rules: [] }, baseDecisions(fields));
    const byName = {};
    for (const f of schema.entities[0].fields) byName[f.name] = f;
    return byName;
  }

  it('coerces raw maxLength (fieldlength string) into validation.maxLength as a Number', async () => {
    const fields = await resolveField();
    assert.deepEqual(fields.name.validation, { maxLength: 60 });
    assert.equal(typeof fields.name.validation.maxLength, 'number');
  });

  it('coerces raw valueMin/valueMax into validation.minimum/maximum as Numbers', async () => {
    const fields = await resolveField();
    assert.equal(fields.creditLimit.validation.minimum, 0);
    assert.equal(fields.creditLimit.validation.maximum, 1000000);
    assert.equal(typeof fields.creditLimit.validation.minimum, 'number');
  });

  it('keeps minimum: 0 (zero must not be dropped as falsy)', async () => {
    const fields = await resolveField();
    assert.ok(Object.prototype.hasOwnProperty.call(fields.creditLimit.validation, 'minimum'));
    assert.equal(fields.creditLimit.validation.minimum, 0);
  });

  it('lets an explicit decision min override raw valueMin (precedence)', async () => {
    const fields = await resolveField({}, {}, {
      creditLimit: { min: 500 },
      name: {},
    });
    assert.equal(fields.creditLimit.validation.minimum, 500);
  });

  it('lets an explicit decision maxLength override raw fieldlength (precedence)', async () => {
    const fields = await resolveField({}, {}, {
      creditLimit: {},
      name: { maxLength: 40 },
    });
    assert.equal(fields.name.validation.maxLength, 40);
  });

  it('emits decision-only constraints (minLength, format, enum, allowedSchemes)', async () => {
    const fields = await resolveField({}, {}, {
      creditLimit: {},
      name: { minLength: 1, format: 'email', enum: ['A', 'B'], allowedSchemes: ['https'] },
    });
    assert.equal(fields.name.validation.minLength, 1);
    assert.equal(fields.name.validation.format, 'email');
    assert.deepEqual(fields.name.validation.enum, ['A', 'B']);
    assert.deepEqual(fields.name.validation.allowedSchemes, ['https']);
  });

  it('mirrors required into validation.required only when true', async () => {
    const fields = await resolveField({}, {}, {
      creditLimit: {},
      name: { required: true },
    });
    assert.equal(fields.name.validation.required, true);
  });

  it('omits the validation key entirely when no raw or decision constraint exists', async () => {
    const raw = {
      window: { id: '900', name: 'Contacts' },
      entities: [{
        name: 'cBpartner', tableName: 'C_BPartner', tabId: '30', tabName: 'Header',
        fields: [{ name: 'note', columnName: 'Note', label: 'Note', type: 'string', visibility: 'editable' }],
      }],
    };
    const { schema } = await resolveCurated(raw, { rules: [] }, baseDecisions({ note: {} }));
    const note = schema.entities[0].fields.find(f => f.name === 'note');
    assert.equal(note.validation, undefined);
  });

  it('emits validation keys in canonical order', async () => {
    const fields = await resolveField({}, {}, {
      creditLimit: {},
      name: { required: true, minLength: 1, maxLength: 60, min: 0, max: 100, format: 'email', enum: ['A'], allowedSchemes: ['https'] },
    });
    assert.deepEqual(Object.keys(fields.name.validation),
      ['required', 'minLength', 'maxLength', 'minimum', 'maximum', 'format', 'enum', 'allowedSchemes']);
  });
});

// ─── ETP-4566 — explicit order marker for the field-order stability lock ─────

describe('resolveCurated — __explicitOrder marker (ETP-4566)', () => {
  const baseSchema = {
    window: { id: '200', name: 'Sales Order' },
    entities: [{
      name: 'cOrder',
      tableName: 'C_Order',
      tabId: '10',
      tabName: 'Header',
      fields: [
        { name: 'documentNo', columnName: 'DocumentNo', label: 'Document No',
          type: 'string', visibility: 'readOnly' },
        { name: 'description', columnName: 'Description', label: 'Description',
          type: 'string', visibility: 'editable' },
      ],
    }],
  };

  it('field with an explicit decisions.json order is tagged with __explicitOrder', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Sales Order' },
      entities: {
        cOrder: {
          name: 'order',
          fields: {
            documentNo: { order: 3 },
          },
        },
      },
      rules: {},
    };
    const { schema } = await resolveCurated(baseSchema, { rules: [] }, decisions);
    const field = schema.entities[0].fields.find(f => f.name === 'documentNo');
    assert.equal(field.__explicitOrder, 3);
  });

  it('field with no explicit order in decisions.json is NOT tagged', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Sales Order' },
      entities: {
        cOrder: {
          name: 'order',
          fields: {
            documentNo: { order: 3 },
            description: {},
          },
        },
      },
      rules: {},
    };
    const { schema } = await resolveCurated(baseSchema, { rules: [] }, decisions);
    const field = schema.entities[0].fields.find(f => f.name === 'description');
    assert.equal(field.__explicitOrder, undefined,
      '__explicitOrder must be absent when no explicit order is declared in decisions');
  });
});

// ETP-4839 — draftMode.keepSaveWhenCompletedFields: keeps the footer "Save" button
// visible (never "Confirm" — that stays hidden unconditionally, see saveActions.jsx's
// onlySaveButton) once a document completes, enabled only while every dirty header
// field is named in this array. Renamed from the earlier boolean `keepSaveWhenCompleted`
// (never published) once the human asked for a per-field allowlist instead of an
// all-or-nothing flag. buildDraftMode is the single source of truth for this key and
// feeds BOTH call sites:
//   - applyWindowDraftModeToPrimaryEntity (decisions.window.draftMode) — the
//     real-world shape used by artifacts/purchase-invoice/decisions.json.
//   - applyEntityDecisions (decisions.entities.<key>.draftMode) — used by
//     windows that declare draftMode per-entity instead of at window level.
// Non-invasive by design: the key must be added ONLY when a non-empty array, and
// NEVER appear at all otherwise — so every other draftMode window's contract.json
// (goods-receipt, sales-quotation, etc., none of which declare this key) stays
// byte-identical.
describe('resolveCurated — draftMode.keepSaveWhenCompletedFields (ETP-4839)', () => {
  const schemaRaw = {
    window: { id: '700', name: 'Purchase Invoice' },
    entities: [{
      name: 'cInvoice',
      tableName: 'C_Invoice',
      tabId: '10',
      tabName: 'Header',
      fields: [
        { name: 'documentNo', columnName: 'DocumentNo', label: 'Document No',
          type: 'string', visibility: 'readOnly' },
      ],
    }],
  };

  function windowDraftMode(extra = {}) {
    return {
      enabled: true,
      processField: 'documentAction',
      processValue: 'CO',
      label: 'Complete',
      ...extra,
    };
  }

  it('window-level draftMode: keepSaveWhenCompletedFields propagates verbatim to the primary entity (real purchase-invoice shape)', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Purchase Invoice', draftMode: windowDraftMode({ keepSaveWhenCompletedFields: ['orderReference'] }) },
      entities: { cInvoice: { name: 'purchaseInvoice' } },
      rules: {},
    };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    assert.deepEqual(schema.entities[0].draftMode, {
      enabled: true,
      processField: 'documentAction',
      processValue: 'CO',
      label: 'Complete',
      keepSaveWhenCompletedFields: ['orderReference'],
    });
  });

  it('window-level draftMode: an empty array is NEVER emitted (not even as [])', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Purchase Invoice', draftMode: windowDraftMode({ keepSaveWhenCompletedFields: [] }) },
      entities: { cInvoice: { name: 'purchaseInvoice' } },
      rules: {},
    };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    assert.deepEqual(schema.entities[0].draftMode, {
      enabled: true,
      processField: 'documentAction',
      processValue: 'CO',
      label: 'Complete',
    });
    assert.ok(!('keepSaveWhenCompletedFields' in schema.entities[0].draftMode));
  });

  it('window-level draftMode: a non-array value (e.g. the retired boolean shape) is NEVER emitted', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Purchase Invoice', draftMode: windowDraftMode({ keepSaveWhenCompletedFields: true }) },
      entities: { cInvoice: { name: 'purchaseInvoice' } },
      rules: {},
    };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    assert.ok(!('keepSaveWhenCompletedFields' in schema.entities[0].draftMode));
  });

  it('window-level draftMode: key absent in decisions.json → key absent in contract (byte-identical regression pin, e.g. goods-receipt / sales-quotation)', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Purchase Invoice', draftMode: windowDraftMode() },
      entities: { cInvoice: { name: 'purchaseInvoice' } },
      rules: {},
    };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    assert.deepEqual(schema.entities[0].draftMode, {
      enabled: true,
      processField: 'documentAction',
      processValue: 'CO',
      label: 'Complete',
    });
  });

  it('entity-level draftMode (decisions.entities.<key>.draftMode): keepSaveWhenCompletedFields also propagates', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Purchase Invoice' },
      entities: {
        cInvoice: {
          name: 'purchaseInvoice',
          draftMode: windowDraftMode({ keepSaveWhenCompletedFields: ['orderReference'] }),
        },
      },
      rules: {},
    };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    assert.deepEqual(schema.entities[0].draftMode.keepSaveWhenCompletedFields, ['orderReference']);
  });

  it('entity-level draftMode: key absent in decisions.json → key absent in contract', async () => {
    const decisions = {
      version: 2,
      window: { name: 'Purchase Invoice' },
      entities: {
        cInvoice: {
          name: 'purchaseInvoice',
          draftMode: windowDraftMode(),
        },
      },
      rules: {},
    };
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    assert.ok(!('keepSaveWhenCompletedFields' in schema.entities[0].draftMode));
  });
});

// ETP-5692 — draftMode.editableLineFieldsWhenCompleted: line field keys that stay editable
// and savable (one-field PATCH) on a completed document, each still subject to its own
// readOnlyLogic. Same additive pass-through rule as keepSaveWhenCompletedFields: emitted only
// as a non-empty array, absent otherwise, so every other draftMode contract stays byte-identical.
describe('resolveCurated — draftMode.editableLineFieldsWhenCompleted (ETP-5692)', () => {
  const schemaRaw = {
    window: { id: '700', name: 'Purchase Invoice' },
    entities: [{
      name: 'cInvoice',
      tableName: 'C_Invoice',
      tabId: '10',
      tabName: 'Header',
      fields: [
        { name: 'documentNo', columnName: 'DocumentNo', label: 'Document No',
          type: 'string', visibility: 'readOnly' },
      ],
    }],
  };
  const draftMode = (extra = {}) => ({
    enabled: true, processField: 'documentAction', processValue: 'CO', label: 'Complete', ...extra,
  });
  const resolveWith = (dm) => resolveCurated(schemaRaw, { rules: [] }, {
    version: 2,
    window: { name: 'Purchase Invoice', draftMode: dm },
    entities: { cInvoice: { name: 'purchaseInvoice' } },
    rules: {},
  });

  it('propagates a non-empty array verbatim to the primary entity draftMode', async () => {
    const { schema } = await resolveWith(draftMode({ editableLineFieldsWhenCompleted: ['project', 'costcenter'] }));
    assert.deepEqual(schema.entities[0].draftMode.editableLineFieldsWhenCompleted, ['project', 'costcenter']);
  });

  it('never emits the key for an empty array or a non-array value', async () => {
    for (const value of [[], true, 'project']) {
      const { schema } = await resolveWith(draftMode({ editableLineFieldsWhenCompleted: value }));
      assert.ok(!('editableLineFieldsWhenCompleted' in schema.entities[0].draftMode));
    }
  });
});

// ─── stepper — FIELD_DECISION_COPY_PROPS passthrough ─────────────────────────
// An integer field rendered as NumberStepperInput opts in with `stepper: true` in
// decisions.json; its bounds are the field's ordinary min / max.
describe('resolveCurated — stepper passthrough', () => {
  const schemaRaw = {
    window: { id: '903', name: 'Payment Term' },
    entities: [{
      name: 'paymentTerm',
      tableName: 'C_PaymentTerm',
      fields: [
        { name: 'overduePaymentDaysRule', columnName: 'NetDays', label: 'Overdue Payment Days Rule',
          type: 'number', visibility: 'editable', mandatory: true },
        { name: 'name', columnName: 'Name', label: 'Name', type: 'string', visibility: 'editable', mandatory: true },
      ],
    }],
  };

  function decisions(fields) {
    return { version: 2, window: { name: 'Payment Term' }, entities: { paymentTerm: { fields } }, rules: {} };
  }

  it('copies stepper: true from decisions to the curated field, together with its bounds', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions({
      overduePaymentDaysRule: { stepper: true, min: 0, max: 365, integer: true },
    }));
    const f = schema.entities[0].fields.find(x => x.name === 'overduePaymentDaysRule');
    assert.equal(f.stepper, true);
    assert.equal(f.min, 0);
    assert.equal(f.max, 365);
    assert.equal(f.integer, true);
  });

  it('does not set stepper on a sibling field', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions({
      overduePaymentDaysRule: { stepper: true },
      name: {},
    }));
    assert.equal(schema.entities[0].fields.find(x => x.name === 'name').stepper, undefined);
  });

  it('copies stepperRejectedKey from decisions, and leaves it absent otherwise', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions({
      overduePaymentDaysRule: { stepper: true, stepperRejectedKey: 'paymentTermDaysNotInteger' },
      name: {},
    }));
    const fields = schema.entities[0].fields;
    assert.equal(fields.find(x => x.name === 'overduePaymentDaysRule').stepperRejectedKey, 'paymentTermDaysNotInteger');
    assert.equal(fields.find(x => x.name === 'name').stepperRejectedKey, undefined);
  });

  it('does not set stepper when decisions do not declare it', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions({ overduePaymentDaysRule: {} }));
    assert.equal(schema.entities[0].fields.find(x => x.name === 'overduePaymentDaysRule').stepper, undefined);
  });
});

// ─── columnMaxWidth — FIELD_DECISION_COPY_PROPS passthrough ──────────────────
describe('resolveCurated — columnMaxWidth passthrough', () => {
  const schemaRaw = {
    window: { id: '903', name: 'Payment Term' },
    entities: [{
      name: 'paymentTerm', tableName: 'C_PaymentTerm',
      fields: [
        { name: 'name', columnName: 'Name', label: 'Name', type: 'string', visibility: 'editable', mandatory: true },
        { name: 'netDays', columnName: 'NetDays', label: 'Days', type: 'number', visibility: 'editable', mandatory: true },
      ],
    }],
  };
  const decisions = (fields) => ({ version: 2, window: { name: 'Payment Term' }, entities: { paymentTerm: { fields } }, rules: {} });

  it('copies columnMaxWidth from decisions to the curated field', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions({ name: { columnWidth: 164, columnMaxWidth: 240 } }));
    const f = schema.entities[0].fields.find(x => x.name === 'name');
    assert.equal(f.columnMaxWidth, 240);
    assert.equal(f.columnWidth, 164);
  });

  it('leaves columnMaxWidth absent when not declared, and on siblings', async () => {
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions({ name: { columnMaxWidth: 240 }, netDays: {} }));
    assert.equal(schema.entities[0].fields.find(x => x.name === 'netDays').columnMaxWidth, undefined);
  });
});

// ─── propertyPath — per-field opt-in path fields (Classic AD_Field.Property + decisions-only) ───
describe('resolveCurated — propertyPath fields', () => {
  const INVOICE_PATH = 'paymentScheduleDetail.invoicePaymentSchedule.invoice';
  const DOCNO_PATH = 'paymentScheduleDetail.invoicePaymentSchedule.invoice.documentNo';

  // Shape of extract-fields.js output for an AD_Field with Property set: the legacy field (key and
  // classification from the target column) plus the AD path recorded as `adPropertyPath`.
  const schemaRaw = {
    window: { id: '700', name: 'Remittance' },
    entities: [{
      name: 'lines',
      tableName: 'REM_Line',
      tabId: 'T2',
      fields: [
        { name: 'amount', columnName: 'Amount', label: 'Amount', type: 'amount', visibility: 'editable', mandatory: true },
        { name: 'invoice', apiKey: 'invoice', columnName: 'C_Invoice_ID', label: 'Invoice', type: 'foreignKey',
          visibility: 'editable', mandatory: true, adPropertyPath: INVOICE_PATH },
      ],
    }],
  };
  const withoutAdPath = () => {
    const raw = structuredClone(schemaRaw);
    delete raw.entities[0].fields[1].adPropertyPath;
    return raw;
  };
  const decisions = (fields) => ({ version: 2, window: { name: 'Remittance' }, entities: { lines: { fields } }, rules: {} });
  const fieldNamed = (schema, name) => schema.entities[0].fields.find(x => x.name === name);

  describe('Classic path field without the opt-in (no decision propertyPath)', () => {
    for (const [label, fields] of [
      ['no decision', {}],
      ['a decision without propertyPath', { invoice: { visibility: 'readOnly', label: 'Factura', grid: true } }],
      ['an editable decision', { invoice: { visibility: 'editable' } }],
    ]) {
      it(`keeps the legacy treatment exactly with ${label}`, async () => {
        const withPath = await resolveCurated(structuredClone(schemaRaw), { rules: [] }, decisions(fields));
        const legacy = await resolveCurated(withoutAdPath(), { rules: [] }, decisions(fields));
        assert.deepEqual(withPath, legacy);
        assert.equal(Object.hasOwn(fieldNamed(withPath.schema, 'invoice'), 'propertyPath'), false);
      });
    }

    it('keeps the legacy key, visibility and required', async () => {
      const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions({}));
      const f = fieldNamed(schema, 'invoice');
      assert.equal(f.visibility, 'editable');
      assert.equal(f.required, true);
      assert.equal(Object.hasOwn(f, 'adPropertyPath'), false, 'the AD path is never copied to the curated field');
    });
  });

  describe('Classic path field opted in (decision declares propertyPath)', () => {
    it('becomes a read-only path field', async () => {
      const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions({
        invoice: { propertyPath: INVOICE_PATH, visibility: 'readOnly' },
      }));
      const f = fieldNamed(schema, 'invoice');
      assert.equal(f.visibility, 'readOnly');
      assert.equal(f.propertyPath, INVOICE_PATH);
      assert.equal(f.column, 'C_Invoice_ID');
      assert.equal(f.type, 'foreignKey');
      assert.equal(f.required, false);
    });

    it('collapses an explicit editable decision to readOnly', async () => {
      const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions({
        invoice: { propertyPath: INVOICE_PATH, visibility: 'editable' },
      }));
      assert.equal(fieldNamed(schema, 'invoice').visibility, 'readOnly');
    });

    it('collapses an editable raw classification to readOnly when the decision gives no visibility', async () => {
      const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions({ invoice: { propertyPath: INVOICE_PATH } }));
      assert.equal(fieldNamed(schema, 'invoice').visibility, 'readOnly');
    });

    it('honours an explicit discarded decision', async () => {
      const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions({
        invoice: { propertyPath: INVOICE_PATH, visibility: 'discarded' },
      }));
      assert.equal(fieldNamed(schema, 'invoice').visibility, 'discarded');
    });

    it('keeps the decision key when the decision renames it', async () => {
      const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions({
        invoice: { propertyPath: INVOICE_PATH, visibility: 'readOnly', name: 'sourceInvoice' },
      }));
      assert.equal(fieldNamed(schema, 'invoice'), undefined);
      const f = fieldNamed(schema, 'sourceInvoice');
      assert.equal(f.propertyPath, INVOICE_PATH);
      assert.equal(f.visibility, 'readOnly');
    });

    it('throws on a malformed decision path instead of dropping it', async () => {
      await assert.rejects(
        resolveCurated(schemaRaw, { rules: [] }, decisions({ invoice: { propertyPath: 'invoice' } })),
        /field "invoice" has propertyPath/,
      );
    });

    it('leaves a plain field without a decision untouched', async () => {
      const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions({ invoice: { propertyPath: INVOICE_PATH } }));
      const f = fieldNamed(schema, 'amount');
      assert.equal(f.visibility, 'editable');
      assert.equal(Object.hasOwn(f, 'propertyPath'), false);
    });
  });

  describe('write semantics stripped from path fields', () => {
    // payment.status: the raw anchor column is NOT NULL with an RPAP default and a computed
    // derivation. A path field is never written, so none of that may survive.
    const writeSchemaRaw = {
      window: { id: '700', name: 'Remittance' },
      entities: [{
        name: 'lines', tableName: 'REM_Line', tabId: 'T2',
        fields: [
          { name: 'status', apiKey: 'status', columnName: 'Status', label: 'Status', type: 'enum',
            visibility: 'readOnly', mandatory: true, defaultValue: 'RPAP',
            derivation: { type: 'computed', expression: 'RPAP' }, adPropertyPath: 'payment.status' },
          { name: 'lineStatus', columnName: 'Status', label: 'Status', type: 'enum',
            visibility: 'editable', mandatory: true, defaultValue: 'RPAP',
            derivation: { type: 'computed', expression: 'RPAP' } },
        ],
      }],
    };
    const writeFields = (fields) => resolveCurated(writeSchemaRaw, { rules: [] }, decisions(fields))
      .then(({ schema }) => schema.entities[0].fields);
    const assertNoWriteSemantics = (f) => {
      assert.equal(f.required, false);
      assert.equal(Object.hasOwn(f, 'sourceRequired'), false, 'sourceRequired');
      assert.equal(Object.hasOwn(f, 'defaultValue'), false, 'defaultValue');
      assert.equal(Object.hasOwn(f, 'derivation'), false, 'derivation');
      assert.notEqual(f.validation?.required, true, 'validation.required');
    };
    const assertWriteSemantics = (f) => {
      assert.equal(f.required, true);
      assert.equal(f.sourceRequired, true);
      assert.equal(f.defaultValue, 'RPAP');
      assert.deepEqual(f.derivation, { type: 'computed', expression: 'RPAP' });
    };

    it('strips required, sourceRequired, defaultValue and derivation from an opted-in Classic path field', async () => {
      const fields = await writeFields({ status: { propertyPath: 'payment.status', visibility: 'readOnly' } });
      const f = fields.find(x => x.name === 'status');
      assert.equal(f.visibility, 'readOnly');
      assertNoWriteSemantics(f);
    });

    it('overrides an explicit required: true decision on a path field', async () => {
      const fields = await writeFields({ status: { propertyPath: 'payment.status', visibility: 'readOnly', required: true } });
      assertNoWriteSemantics(fields.find(x => x.name === 'status'));
    });

    it('strips a decision-declared defaultValue and derivation from a decisions-only path field', async () => {
      const fields = await writeFields({
        paymentStatus: { propertyPath: 'payment.status', type: 'enum', column: 'Status', required: true,
          defaultValue: 'RPAP', derivation: { type: 'computed', expression: 'RPAP' } },
      });
      assertNoWriteSemantics(fields.find(x => x.name === 'paymentStatus'));
    });

    it('keeps the write semantics of a Classic path field that does not opt in', async () => {
      const fields = await writeFields({ status: { visibility: 'readOnly' } });
      assertWriteSemantics(fields.find(x => x.name === 'status'));
    });

    it('keeps the write semantics of a plain field with the same raw metadata', async () => {
      const fields = await writeFields({ status: { propertyPath: 'payment.status', visibility: 'readOnly' } });
      assertWriteSemantics(fields.find(x => x.name === 'lineStatus'));
    });
  });

  describe('decisions-only path field', () => {
    it('is synthesized and included read-only by default', async () => {
      const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions({
        invoiceDocumentNo: { propertyPath: DOCNO_PATH, column: 'DocumentNo', label: 'Invoice' },
      }));
      const f = fieldNamed(schema, 'invoiceDocumentNo');
      assert.ok(f, 'the decisions-only field is part of the curated entity');
      assert.equal(f.visibility, 'readOnly');
      assert.equal(f.propertyPath, DOCNO_PATH);
      assert.equal(f.column, 'DocumentNo');
      assert.equal(f.label, 'Invoice');
      assert.equal(f.type, 'string', 'type defaults to string');
      assert.equal(f.required, false);
    });

    it('keeps the declared type and collapses editable to readOnly', async () => {
      const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions({
        businessPartner: { propertyPath: 'paymentScheduleDetail.businessPartner', type: 'foreignKey',
          column: 'C_BPartner_ID', visibility: 'editable' },
      }));
      const f = fieldNamed(schema, 'businessPartner');
      assert.equal(f.type, 'foreignKey');
      assert.equal(f.visibility, 'readOnly');
    });

    it('falls back to the field key for column and label when the decision omits them', async () => {
      const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions({
        paymentStatus: { propertyPath: 'payment.status' },
      }));
      const f = fieldNamed(schema, 'paymentStatus');
      assert.equal(f.column, 'paymentStatus');
      assert.equal(f.label, 'paymentStatus');
    });

    it('honours an explicit discarded visibility', async () => {
      const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions({
        paymentStatus: { propertyPath: 'payment.status', visibility: 'discarded' },
      }));
      assert.equal(fieldNamed(schema, 'paymentStatus').visibility, 'discarded');
    });

    it('does not duplicate a raw field whose decision also declares propertyPath', async () => {
      const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions({
        invoice: { propertyPath: INVOICE_PATH, visibility: 'readOnly' },
      }));
      assert.equal(schema.entities[0].fields.filter(x => x.name === 'invoice').length, 1);
    });

    it('throws on a malformed path instead of dropping it', async () => {
      for (const propertyPath of ['status', 'a..b', 'a.b c']) {
        await assert.rejects(
          resolveCurated(schemaRaw, { rules: [] }, decisions({ broken: { propertyPath } })),
          /field "broken" has propertyPath/,
          `expected a rejection for ${JSON.stringify(propertyPath)}`,
        );
      }
    });
  });
});
