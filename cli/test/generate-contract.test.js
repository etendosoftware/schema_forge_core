import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  generateFrontendContract,
  generateBackendContract,
  generateTestManifest,
  generateContract,
  generateApiPrediction
} from '../src/generate-contract.js';

const minimalSchema = {
  version: '0.1.0',
  window: { id: '143', name: 'Sales Order', primaryEntity: 'order', category: 'sales' },
  entities: [{
    name: 'order',
    table: 'C_Order',
    level: 'header',
    fields: [
      { name: 'documentNo', column: 'DocumentNo', type: 'string', visibility: 'readOnly',
        required: true, searchable: true, grid: true, form: true },
      { name: 'dateOrdered', column: 'DateOrdered', type: 'date', visibility: 'editable',
        required: true, searchable: true, grid: true, form: true },
      { name: 'grandTotal', column: 'GrandTotal', type: 'amount', visibility: 'readOnly',
        required: false, searchable: false, grid: true, form: true },
      { name: 'adClientId', column: 'AD_Client_ID', type: 'id', visibility: 'system',
        systemCategory: 'internal', derivation: { type: 'fromConfig', source: 'context.client' },
        required: true, searchable: false, grid: false, form: false },
    ]
  }]
};

const sampleRules = [
  { name: 'calcTotal', type: 'callout', tier: 'auto', autoDecision: 'keep',
    effects: [{ field: 'grandTotal', action: 'setValue' }] },
  { name: 'validateDate', type: 'validation', tier: 'auto', autoDecision: 'keep' }
];

const sampleProcesses = [
  {
    name: 'completeOrder',
    entity: 'order',
    preconditions: [{ field: 'docStatus', operator: 'equals', value: 'DR' }],
    steps: [
      { order: 1, operation: 'validate', target: 'header.docStatus', rule: 'must be Draft' },
      { order: 2, operation: 'mutation', target: 'header.docStatus', value: 'CO' }
    ],
    edgeCases: [
      { name: 'alreadyCompleted', trigger: 'docStatus=CO', expected: 'error' },
      { name: 'emptyLines', trigger: 'no lines', expected: 'error' },
      { name: 'zeroAmount', trigger: 'grandTotal=0', expected: 'warning' }
    ]
  }
];

describe('generateFrontendContract', () => {
  it('excludes system fields', () => {
    const fc = generateFrontendContract(minimalSchema);
    const orderFields = fc.entities.order.fields;
    assert.ok(orderFields.find(f => f.name === 'documentNo'));
    assert.ok(orderFields.find(f => f.name === 'dateOrdered'));
    assert.ok(orderFields.find(f => f.name === 'grandTotal'));
    assert.ok(!orderFields.find(f => f.name === 'adClientId'));
  });

  it('includes searchable fields list', () => {
    const fc = generateFrontendContract(minimalSchema);
    assert.ok(fc.entities.order.searchableFields.includes('documentNo'));
    assert.ok(fc.entities.order.searchableFields.includes('dateOrdered'));
    assert.ok(!fc.entities.order.searchableFields.includes('grandTotal'));
  });

  it('maps types to TypeScript types', () => {
    const fc = generateFrontendContract(minimalSchema);
    const docNo = fc.entities.order.fields.find(f => f.name === 'documentNo');
    assert.equal(docNo.tsType, 'string');
    const date = fc.entities.order.fields.find(f => f.name === 'dateOrdered');
    assert.equal(date.tsType, 'string'); // dates as ISO strings
    const total = fc.entities.order.fields.find(f => f.name === 'grandTotal');
    assert.equal(total.tsType, 'number');
  });
});

const behavioralSchema = {
  version: '0.1.0',
  window: { id: '500', name: 'Behavioral', primaryEntity: 'order', category: 'test' },
  entities: [{
    name: 'order',
    table: 'C_Order',
    level: 'header',
    fields: [
      { name: 'businessPartner', column: 'C_BPartner_ID', type: 'foreignKey', visibility: 'editable',
        required: true, searchable: true, grid: true, form: true,
        callout: 'org.example.BPCallout' },
      { name: 'warehouse', column: 'M_Warehouse_ID', type: 'foreignKey', visibility: 'editable',
        required: true, searchable: false, grid: false, form: true,
        displayLogic: '@DocStatus@=DR' },
      { name: 'priceList', column: 'M_PriceList_ID', type: 'foreignKey', visibility: 'editable',
        required: true, searchable: false, grid: false, form: true,
        readOnlyLogic: '@Processed@=Y' },
      { name: 'plainField', column: 'PlainCol', type: 'string', visibility: 'editable',
        required: false, searchable: false, grid: true, form: true },
    ]
  }]
};

const behavioralRules = [
  { name: 'org.example.BPCallout', type: 'callout', className: 'org.example.BPCallout',
    effects: [{ field: 'partnerAddress', action: 'setValue' }, { field: 'priceList', action: 'setValue' }],
    complexity: 'medium' },
  { name: '@DocStatus@=DR', type: 'displayLogic', className: '@DocStatus@=DR',
    translated: 'record.docStatus === "DR"' },
  { name: '@Processed@=Y', type: 'readOnlyLogic', className: '@Processed@=Y',
    translated: 'record.processed === true' },
];

describe('generateFrontendContract — behavioral metadata', () => {
  it('field with callout gets callout.className in frontendContract', () => {
    const fc = generateFrontendContract(behavioralSchema);
    const bp = fc.entities.order.fields.find(f => f.name === 'businessPartner');
    assert.ok(bp.callout, 'callout metadata should be present');
    assert.equal(bp.callout.className, 'org.example.BPCallout');
  });

  it('field with displayLogic gets displayLogic.raw in frontendContract', () => {
    const fc = generateFrontendContract(behavioralSchema);
    const wh = fc.entities.order.fields.find(f => f.name === 'warehouse');
    assert.ok(wh.displayLogic, 'displayLogic metadata should be present');
    assert.equal(wh.displayLogic.raw, '@DocStatus@=DR');
  });

  it('field with readOnlyLogic gets readOnlyLogic.raw in frontendContract', () => {
    const fc = generateFrontendContract(behavioralSchema);
    const pl = fc.entities.order.fields.find(f => f.name === 'priceList');
    assert.ok(pl.readOnlyLogic, 'readOnlyLogic metadata should be present');
    assert.equal(pl.readOnlyLogic.raw, '@Processed@=Y');
  });

  it('field without behavioral metadata does NOT have callout/displayLogic/readOnlyLogic keys', () => {
    const fc = generateFrontendContract(behavioralSchema);
    const plain = fc.entities.order.fields.find(f => f.name === 'plainField');
    assert.equal(plain.callout, undefined, 'plain field should not have callout');
    assert.equal(plain.displayLogic, undefined, 'plain field should not have displayLogic');
    assert.equal(plain.readOnlyLogic, undefined, 'plain field should not have readOnlyLogic');
  });

  it('callout effects are populated from rules when available', () => {
    const fc = generateFrontendContract(behavioralSchema, behavioralRules);
    const bp = fc.entities.order.fields.find(f => f.name === 'businessPartner');
    assert.ok(bp.callout.effects, 'callout effects should be present when rules match');
    assert.deepStrictEqual(bp.callout.effects, ['partnerAddress', 'priceList']);
    assert.equal(bp.callout.complexity, 'medium');
  });

  it('displayLogic.js is populated from rules translation when available', () => {
    const fc = generateFrontendContract(behavioralSchema, behavioralRules);
    const wh = fc.entities.order.fields.find(f => f.name === 'warehouse');
    assert.equal(wh.displayLogic.js, 'record.docStatus === "DR"');
  });

  it('readOnlyLogic.js is populated from rules translation when available', () => {
    const fc = generateFrontendContract(behavioralSchema, behavioralRules);
    const pl = fc.entities.order.fields.find(f => f.name === 'priceList');
    assert.equal(pl.readOnlyLogic.js, 'record.processed === true');
  });

  it('callout without matching rule has only className, no effects', () => {
    const fc = generateFrontendContract(behavioralSchema, []);
    const bp = fc.entities.order.fields.find(f => f.name === 'businessPartner');
    assert.equal(bp.callout.className, 'org.example.BPCallout');
    assert.equal(bp.callout.effects, undefined, 'no effects without matching rule');
    assert.equal(bp.callout.complexity, undefined, 'no complexity without matching rule');
  });

  it('displayLogic without matching rule has only raw, no js translation', () => {
    const fc = generateFrontendContract(behavioralSchema, []);
    const wh = fc.entities.order.fields.find(f => f.name === 'warehouse');
    assert.equal(wh.displayLogic.raw, '@DocStatus@=DR');
    assert.equal(wh.displayLogic.js, undefined, 'no js without matching rule');
  });
});

describe('generateFrontendContract — forceCalloutFields', () => {
  const schemaWithForceCallout = {
    version: '0.1.0',
    window: { id: '168', name: 'Physical Inventory', primaryEntity: 'inventory', category: 'inventory' },
    entities: [
      {
        name: 'inventory',
        table: 'M_Inventory',
        level: 'header',
        fields: [
          { name: 'warehouse', column: 'M_Warehouse_ID', type: 'foreignKey',
            reference: 'Warehouse', inputMode: 'search',
            visibility: 'editable', required: true, searchable: true, grid: true, form: true },
        ]
      },
      {
        name: 'inventoryLine',
        table: 'M_InventoryLine',
        level: 'line',
        fields: [
          { name: 'product', column: 'M_Product_ID', type: 'foreignKey',
            reference: 'Product', inputMode: 'search',
            visibility: 'editable', required: true, grid: true, form: true,
            lookup: true, forceCalloutFields: ['quantityCount', 'bookQuantity'] },
          { name: 'quantityCount', column: 'QtyCount', type: 'number',
            visibility: 'editable', required: true, grid: true, form: true },
          { name: 'bookQuantity', column: 'QtyBook', type: 'number',
            visibility: 'readOnly', required: false, grid: true, form: true },
        ]
      }
    ]
  };

  it('preserves forceCalloutFields from curated field into frontendContract', () => {
    const fc = generateFrontendContract(schemaWithForceCallout);
    const product = fc.entities.inventoryLine.fields.find(f => f.name === 'product');
    assert.deepStrictEqual(product.forceCalloutFields, ['quantityCount', 'bookQuantity']);
  });

  it('does not add forceCalloutFields when not declared on field', () => {
    const fc = generateFrontendContract(schemaWithForceCallout);
    const qty = fc.entities.inventoryLine.fields.find(f => f.name === 'quantityCount');
    assert.equal(qty.forceCalloutFields, undefined);
  });

  it('does not add forceCalloutFields to a field that has an empty array', () => {
    const schema = {
      ...schemaWithForceCallout,
      entities: schemaWithForceCallout.entities.map(e =>
        e.name === 'inventoryLine'
          ? { ...e, fields: e.fields.map(f =>
              f.name === 'product' ? { ...f, forceCalloutFields: [] } : f
            )}
          : e
      ),
    };
    const fc = generateFrontendContract(schema);
    const product = fc.entities.inventoryLine.fields.find(f => f.name === 'product');
    assert.equal(product.forceCalloutFields, undefined);
  });

  it('preserves forceCalloutFields on a non-FK (number) field', () => {
    const schema = {
      ...schemaWithForceCallout,
      entities: schemaWithForceCallout.entities.map(e =>
        e.name === 'inventoryLine'
          ? { ...e, fields: e.fields.map(f =>
              f.name === 'quantityCount'
                ? { ...f, forceCalloutFields: ['bookQuantity'] }
                : f
            )}
          : e
      ),
    };
    const fc = generateFrontendContract(schema);
    const qty = fc.entities.inventoryLine.fields.find(f => f.name === 'quantityCount');
    assert.deepStrictEqual(qty.forceCalloutFields, ['bookQuantity']);
  });
});

describe('generateBackendContract', () => {
  it('includes all fields including system', () => {
    const bc = generateBackendContract(minimalSchema, sampleRules, sampleProcesses);
    const orderFields = bc.entities.order.fields;
    assert.ok(orderFields.find(f => f.name === 'adClientId'));
    assert.ok(orderFields.find(f => f.name === 'documentNo'));
  });

  it('generates REST endpoints', () => {
    const bc = generateBackendContract(minimalSchema, sampleRules, sampleProcesses);
    assert.ok(bc.endpoints.length > 0);
    const getEndpoint = bc.endpoints.find(e => e.method === 'GET' && e.entity === 'order');
    assert.ok(getEndpoint);
    assert.ok(getEndpoint.supportedFilters.includes('documentNo'));
  });

  it('generates process endpoints', () => {
    const bc = generateBackendContract(minimalSchema, sampleRules, sampleProcesses);
    const processEndpoint = bc.processEndpoints.find(p => p.name === 'completeOrder');
    assert.ok(processEndpoint);
    assert.equal(processEndpoint.method, 'POST');
  });
});

describe('generateTestManifest', () => {
  it('generates field-presence tests for visible fields', () => {
    const fc = generateFrontendContract(minimalSchema);
    const bc = generateBackendContract(minimalSchema, sampleRules, sampleProcesses);
    const manifest = generateTestManifest(fc, bc, sampleRules, sampleProcesses);
    const presenceTests = manifest.tests.filter(t => t.category === 'field-presence');
    assert.equal(presenceTests.length, 3); // documentNo, dateOrdered, grandTotal (not system)
  });

  it('generates field-type tests', () => {
    const fc = generateFrontendContract(minimalSchema);
    const bc = generateBackendContract(minimalSchema, sampleRules, sampleProcesses);
    const manifest = generateTestManifest(fc, bc, sampleRules, sampleProcesses);
    const typeTests = manifest.tests.filter(t => t.category === 'field-type');
    assert.equal(typeTests.length, 3);
  });

  it('generates searchable-filter tests', () => {
    const fc = generateFrontendContract(minimalSchema);
    const bc = generateBackendContract(minimalSchema, sampleRules, sampleProcesses);
    const manifest = generateTestManifest(fc, bc, sampleRules, sampleProcesses);
    const filterTests = manifest.tests.filter(t => t.category === 'searchable-filters');
    assert.ok(filterTests.length >= 2); // documentNo + dateOrdered
  });

  it('generates process tests (happy, failure, edge)', () => {
    const fc = generateFrontendContract(minimalSchema);
    const bc = generateBackendContract(minimalSchema, sampleRules, sampleProcesses);
    const manifest = generateTestManifest(fc, bc, sampleRules, sampleProcesses);
    const processHappy = manifest.tests.filter(t => t.category === 'process-happy');
    const processEdge = manifest.tests.filter(t => t.category === 'process-edge');
    assert.ok(processHappy.length >= 1);
    assert.ok(processEdge.length >= 3); // 3 edge cases
  });

  it('generates system-field tests', () => {
    const fc = generateFrontendContract(minimalSchema);
    const bc = generateBackendContract(minimalSchema, sampleRules, sampleProcesses);
    const manifest = generateTestManifest(fc, bc, sampleRules, sampleProcesses);
    const systemTests = manifest.tests.filter(t => t.category === 'system-field');
    assert.ok(systemTests.length >= 1); // adClientId
  });

  it('generates rule tests', () => {
    const fc = generateFrontendContract(minimalSchema);
    const bc = generateBackendContract(minimalSchema, sampleRules, sampleProcesses);
    const manifest = generateTestManifest(fc, bc, sampleRules, sampleProcesses);
    const ruleTests = manifest.tests.filter(t => t.category === 'rule-declared');
    assert.equal(ruleTests.length, 2); // calcTotal + validateDate
  });

  it('includes test count summary', () => {
    const fc = generateFrontendContract(minimalSchema);
    const bc = generateBackendContract(minimalSchema, sampleRules, sampleProcesses);
    const manifest = generateTestManifest(fc, bc, sampleRules, sampleProcesses);
    assert.equal(manifest.summary.total, manifest.tests.length);
    assert.ok(manifest.summary.byCategory);
    assert.ok(manifest.summary.byRunner); // node vs junit counts
  });
});

// ─── Edge Case Tests ───────────────────────────────────────────────────────────

const emptySchema = {
  version: '0.1.0',
  window: { id: '999', name: 'Empty Window', primaryEntity: 'nothing', category: 'test' },
  entities: []
};

const allSystemFieldsSchema = {
  version: '0.1.0',
  window: { id: '200', name: 'System Only', primaryEntity: 'sysEntity', category: 'test' },
  entities: [{
    name: 'sysEntity',
    table: 'AD_System',
    level: 'header',
    fields: [
      { name: 'adClientId', column: 'AD_Client_ID', type: 'id', visibility: 'system',
        systemCategory: 'internal', derivation: { type: 'fromConfig', source: 'context.client' },
        required: true, searchable: false, grid: false, form: false },
      { name: 'adOrgId', column: 'AD_Org_ID', type: 'id', visibility: 'system',
        systemCategory: 'internal', derivation: { type: 'fromConfig', source: 'context.org' },
        required: true, searchable: false, grid: false, form: false },
      { name: 'created', column: 'Created', type: 'datetime', visibility: 'system',
        systemCategory: 'audit', derivation: { type: 'computed', source: 'now()' },
        required: true, searchable: false, grid: false, form: false },
      { name: 'createdBy', column: 'CreatedBy', type: 'id', visibility: 'system',
        systemCategory: 'audit', derivation: { type: 'fromConfig', source: 'context.user' },
        required: true, searchable: false, grid: false, form: false },
    ]
  }]
};

const discardedFieldsSchema = {
  version: '0.1.0',
  window: { id: '300', name: 'With Discarded', primaryEntity: 'item', category: 'test' },
  entities: [{
    name: 'item',
    table: 'M_Item',
    level: 'header',
    fields: [
      { name: 'name', column: 'Name', type: 'string', visibility: 'editable',
        required: true, searchable: true, grid: true, form: true },
      { name: 'obsoleteFlag', column: 'ObsoleteFlag', type: 'boolean', visibility: 'discarded',
        required: false, searchable: false, grid: false, form: false },
      { name: 'legacyCode', column: 'LegacyCode', type: 'string', visibility: 'discarded',
        required: false, searchable: false, grid: false, form: false },
      { name: 'internalId', column: 'InternalID', type: 'id', visibility: 'system',
        derivation: { type: 'sequence', source: 'auto' },
        required: true, searchable: false, grid: false, form: false },
    ]
  }]
};

const multiEntitySchema = {
  version: '0.2.0',
  window: { id: '400', name: 'Multi Entity', primaryEntity: 'header', category: 'test' },
  entities: [
    {
      name: 'header',
      table: 'C_Header',
      level: 'header',
      fields: [
        { name: 'docNo', column: 'DocumentNo', type: 'string', visibility: 'readOnly',
          required: true, searchable: true, grid: true, form: true },
        { name: 'clientId', column: 'AD_Client_ID', type: 'id', visibility: 'system',
          derivation: { type: 'fromConfig', source: 'context.client' },
          required: true, searchable: false, grid: false, form: false },
      ]
    },
    {
      name: 'line',
      table: 'C_Line',
      level: 'line',
      fields: [
        { name: 'lineNo', column: 'Line', type: 'integer', visibility: 'editable',
          required: true, searchable: false, grid: true, form: true },
        { name: 'qty', column: 'QtyOrdered', type: 'number', visibility: 'editable',
          required: true, searchable: false, grid: true, form: true },
        { name: 'clientId', column: 'AD_Client_ID', type: 'id', visibility: 'system',
          derivation: { type: 'fromConfig', source: 'context.client' },
          required: true, searchable: false, grid: false, form: false },
      ]
    }
  ]
};

describe('generateFrontendContract — edge cases', () => {
  it('schema with zero entities produces empty contract', () => {
    const fc = generateFrontendContract(emptySchema);
    assert.deepStrictEqual(fc.entities, {});
    assert.equal(fc.window.name, 'Empty Window');
  });

  it('entity with ALL system fields produces empty fields array', () => {
    const fc = generateFrontendContract(allSystemFieldsSchema);
    assert.equal(fc.entities.sysEntity.fields.length, 0);
    assert.equal(fc.entities.sysEntity.searchableFields.length, 0);
    assert.equal(fc.entities.sysEntity.computedFields.length, 0);
  });

  it('discarded fields are excluded from frontend contract', () => {
    const fc = generateFrontendContract(discardedFieldsSchema);
    const fieldNames = fc.entities.item.fields.map(f => f.name);
    assert.ok(fieldNames.includes('name'));
    assert.ok(!fieldNames.includes('obsoleteFlag'), 'discarded field obsoleteFlag should be excluded');
    assert.ok(!fieldNames.includes('legacyCode'), 'discarded field legacyCode should be excluded');
    assert.ok(!fieldNames.includes('internalId'), 'system field internalId should be excluded');
    assert.equal(fc.entities.item.fields.length, 1);
  });

  it('schema with multiple entities includes all entities', () => {
    const fc = generateFrontendContract(multiEntitySchema);
    assert.ok(fc.entities.header, 'header entity should be present');
    assert.ok(fc.entities.line, 'line entity should be present');
    assert.equal(fc.entities.header.fields.length, 1); // docNo only
    assert.equal(fc.entities.line.fields.length, 2); // lineNo, qty
  });

  it('computed fields list only includes fields with derivation', () => {
    const fc = generateFrontendContract(minimalSchema);
    // Only visible fields with derivation should appear; adClientId is system so excluded
    assert.equal(fc.entities.order.computedFields.length, 0);
  });

  it('maps unknown type to string fallback', () => {
    const schemaWithUnknownType = {
      ...minimalSchema,
      entities: [{
        ...minimalSchema.entities[0],
        fields: [
          { name: 'weirdField', column: 'WeirdCol', type: 'unknownType', visibility: 'editable',
            required: false, searchable: false, grid: true, form: true },
        ]
      }]
    };
    const fc = generateFrontendContract(schemaWithUnknownType);
    const field = fc.entities.order.fields.find(f => f.name === 'weirdField');
    assert.equal(field.tsType, 'string', 'unknown types should fallback to string');
  });
});

describe('generateBackendContract — edge cases', () => {
  it('schema with zero entities produces empty endpoints', () => {
    const bc = generateBackendContract(emptySchema);
    assert.deepStrictEqual(bc.entities, {});
    assert.equal(bc.endpoints.length, 0);
    assert.equal(bc.processEndpoints.length, 0);
  });

  it('generates exactly 5 REST endpoints per entity', () => {
    const bc = generateBackendContract(multiEntitySchema);
    const headerEndpoints = bc.endpoints.filter(e => e.entity === 'header');
    const lineEndpoints = bc.endpoints.filter(e => e.entity === 'line');
    assert.equal(headerEndpoints.length, 5, 'header should have 5 REST methods');
    assert.equal(lineEndpoints.length, 5, 'line should have 5 REST methods');

    // Verify all 5 methods present
    const methods = headerEndpoints.map(e => e.method).sort();
    assert.deepStrictEqual(methods, ['DELETE', 'GET', 'GET', 'POST', 'PUT']);
  });

  it('includes discarded fields in backend contract (all fields included)', () => {
    const bc = generateBackendContract(discardedFieldsSchema);
    const fieldNames = bc.entities.item.fields.map(f => f.name);
    assert.ok(fieldNames.includes('obsoleteFlag'), 'backend should include discarded fields');
    assert.ok(fieldNames.includes('legacyCode'), 'backend should include discarded fields');
    assert.ok(fieldNames.includes('internalId'), 'backend should include system fields');
    assert.equal(bc.entities.item.fields.length, 4);
  });

  it('defaults to empty rules and processes when not provided', () => {
    const bc = generateBackendContract(minimalSchema);
    assert.equal(bc.processEndpoints.length, 0);
    assert.ok(bc.endpoints.length > 0);
  });

  it('multiple entities produce endpoints for all entities', () => {
    const bc = generateBackendContract(multiEntitySchema);
    assert.equal(bc.endpoints.length, 10); // 5 per entity * 2 entities
  });

  it('process endpoint includes step count and preconditions', () => {
    const bc = generateBackendContract(minimalSchema, sampleRules, sampleProcesses);
    const proc = bc.processEndpoints.find(p => p.name === 'completeOrder');
    assert.equal(proc.steps, 2);
    assert.equal(proc.preconditions.length, 1);
    assert.equal(proc.path, '/process/completeOrder');
  });
});

describe('generateTestManifest — edge cases', () => {
  it('empty schema produces minimal manifest with zero tests', () => {
    const fc = generateFrontendContract(emptySchema);
    const bc = generateBackendContract(emptySchema);
    const manifest = generateTestManifest(fc, bc);
    assert.equal(manifest.tests.length, 0);
    assert.equal(manifest.summary.total, 0);
    assert.equal(manifest.summary.byRunner.node, 0);
    assert.equal(manifest.summary.byRunner.junit, 0);
  });

  it('process without edge cases generates no process-edge tests', () => {
    const processNoEdge = [{
      name: 'simpleProcess',
      entity: 'order',
      preconditions: [{ field: 'status', operator: 'equals', value: 'DR' }],
      steps: [{ order: 1, operation: 'validate', target: 'header.status' }],
      transactional: true
      // edgeCases intentionally omitted
    }];
    const fc = generateFrontendContract(minimalSchema);
    const bc = generateBackendContract(minimalSchema);
    const manifest = generateTestManifest(fc, bc, [], processNoEdge);
    const edgeTests = manifest.tests.filter(t => t.category === 'process-edge');
    assert.equal(edgeTests.length, 0, 'no edge case tests when edgeCases is absent');
    // Should still have happy, failure, rollback
    const happyTests = manifest.tests.filter(t => t.category === 'process-happy');
    const failureTests = manifest.tests.filter(t => t.category === 'process-failure');
    const rollbackTests = manifest.tests.filter(t => t.category === 'process-rollback');
    assert.equal(happyTests.length, 1);
    assert.equal(failureTests.length, 1);
    assert.equal(rollbackTests.length, 1);
  });

  it('non-transactional process omits rollback test', () => {
    const nonTxProcess = [{
      name: 'reportProcess',
      entity: 'order',
      preconditions: [],
      steps: [{ order: 1, operation: 'validate', target: 'header.status' }],
      transactional: false,
      edgeCases: [
        { name: 'e1', trigger: 't1', expected: 'ok' },
        { name: 'e2', trigger: 't2', expected: 'ok' },
        { name: 'e3', trigger: 't3', expected: 'ok' },
      ]
    }];
    const fc = generateFrontendContract(minimalSchema);
    const bc = generateBackendContract(minimalSchema);
    const manifest = generateTestManifest(fc, bc, [], nonTxProcess);
    const rollbackTests = manifest.tests.filter(t => t.category === 'process-rollback');
    assert.equal(rollbackTests.length, 0, 'non-transactional process should not have rollback test');
  });

  it('rules with tier=human and decision=omit still appear in rule-declared tests (no filtering)', () => {
    const rulesWithOmit = [
      { name: 'keptRule', type: 'callout', tier: 'auto', autoDecision: 'keep' },
      { name: 'omittedRule', type: 'validation', tier: 'human', humanDecision: 'omit' },
    ];
    const fc = generateFrontendContract(minimalSchema);
    const bc = generateBackendContract(minimalSchema);
    const manifest = generateTestManifest(fc, bc, rulesWithOmit, []);
    const ruleTests = manifest.tests.filter(t => t.category === 'rule-declared');
    // Current implementation does NOT filter omitted rules
    assert.equal(ruleTests.length, 2, 'all rules passed in generate rule-declared tests, including omitted');
    const omittedTest = ruleTests.find(t => t.rule === 'omittedRule');
    assert.ok(omittedTest, 'omitted rule is included in test manifest (potential bug: no filtering)');
  });

  it('summary.byRunner counts match actual tests by runner', () => {
    const fc = generateFrontendContract(minimalSchema);
    const bc = generateBackendContract(minimalSchema, sampleRules, sampleProcesses);
    const manifest = generateTestManifest(fc, bc, sampleRules, sampleProcesses);
    const actualNodeCount = manifest.tests.filter(t => t.runner === 'node').length;
    const actualJunitCount = manifest.tests.filter(t => t.runner === 'junit').length;
    assert.equal(manifest.summary.byRunner.node, actualNodeCount,
      'byRunner.node should match actual node test count');
    assert.equal(manifest.summary.byRunner.junit, actualJunitCount,
      'byRunner.junit should match actual junit test count');
    assert.equal(actualNodeCount + actualJunitCount, manifest.summary.total,
      'node + junit counts should equal total');
  });

  it('summary.byCategory counts match actual tests by category', () => {
    const fc = generateFrontendContract(minimalSchema);
    const bc = generateBackendContract(minimalSchema, sampleRules, sampleProcesses);
    const manifest = generateTestManifest(fc, bc, sampleRules, sampleProcesses);
    for (const [category, count] of Object.entries(manifest.summary.byCategory)) {
      const actual = manifest.tests.filter(t => t.category === category).length;
      assert.equal(count, actual, `byCategory.${category} should match actual count`);
    }
  });

  it('all test IDs are unique', () => {
    const fc = generateFrontendContract(minimalSchema);
    const bc = generateBackendContract(minimalSchema, sampleRules, sampleProcesses);
    const manifest = generateTestManifest(fc, bc, sampleRules, sampleProcesses);
    const ids = manifest.tests.map(t => t.id);
    const uniqueIds = new Set(ids);
    assert.equal(ids.length, uniqueIds.size, 'all test IDs should be unique');
  });

  it('all-system-fields entity produces only system-field tests and a visibility test', () => {
    const fc = generateFrontendContract(allSystemFieldsSchema);
    const bc = generateBackendContract(allSystemFieldsSchema);
    const manifest = generateTestManifest(fc, bc);
    // No visible fields means 0 field-presence, 0 field-type, 0 searchable tests
    assert.equal(manifest.tests.filter(t => t.category === 'field-presence').length, 0);
    assert.equal(manifest.tests.filter(t => t.category === 'field-type').length, 0);
    assert.equal(manifest.tests.filter(t => t.category === 'searchable-filters').length, 0);
    // All 4 fields should be system-field tests
    assert.equal(manifest.tests.filter(t => t.category === 'system-field').length, 4);
    // One visibility test per entity
    assert.equal(manifest.tests.filter(t => t.category === 'visibility').length, 1);
  });
});

describe('generateContract — orchestrator', () => {
  it('returns version from schema', () => {
    const contract = generateContract(minimalSchema, sampleRules, sampleProcesses);
    assert.equal(contract.version, '0.1.0');
  });

  it('defaults version to 0.1.0 when schema has no version', () => {
    const noVersionSchema = { ...minimalSchema, version: undefined };
    const contract = generateContract(noVersionSchema);
    assert.equal(contract.version, '0.1.0');
  });

  it('includes generatedAt as ISO timestamp', () => {
    const contract = generateContract(minimalSchema);
    assert.ok(contract.generatedAt, 'generatedAt should be present');
    // Verify it parses as a valid date
    const parsed = new Date(contract.generatedAt);
    assert.ok(!isNaN(parsed.getTime()), 'generatedAt should be a valid ISO date');
  });

  it('includes checksum as 16-char hex string', () => {
    const contract = generateContract(minimalSchema);
    assert.ok(contract.checksum, 'checksum should be present');
    assert.equal(contract.checksum.length, 16, 'checksum should be 16 chars');
    assert.ok(/^[0-9a-f]{16}$/.test(contract.checksum), 'checksum should be hex');
  });

  it('checksum changes when schema content changes', () => {
    const contract1 = generateContract(minimalSchema);
    const contract2 = generateContract(multiEntitySchema);
    assert.notEqual(contract1.checksum, contract2.checksum,
      'different schemas should produce different checksums');
  });

  it('includes frontendContract, backendContract, and testManifest', () => {
    const contract = generateContract(minimalSchema, sampleRules, sampleProcesses);
    assert.ok(contract.frontendContract, 'should include frontendContract');
    assert.ok(contract.backendContract, 'should include backendContract');
    assert.ok(contract.testManifest, 'should include testManifest');
    assert.ok(contract.testManifest.tests.length > 0, 'testManifest should have tests');
    assert.ok(contract.testManifest.summary, 'testManifest should have summary');
  });

  it('empty schema produces valid contract structure', () => {
    const contract = generateContract(emptySchema);
    assert.equal(contract.version, '0.1.0');
    assert.ok(contract.generatedAt);
    assert.ok(contract.checksum);
    assert.deepStrictEqual(contract.frontendContract.entities, {});
    assert.deepStrictEqual(contract.backendContract.entities, {});
    assert.equal(contract.testManifest.tests.length, 0);
  });

  it('includes apiPrediction in output', () => {
    const contract = generateContract(minimalSchema, sampleRules, sampleProcesses);
    assert.ok(contract.apiPrediction, 'should include apiPrediction');
    assert.ok(contract.apiPrediction.specName);
    assert.ok(contract.apiPrediction.baseUrl);
    assert.ok(contract.apiPrediction.crud);
    assert.ok(contract.apiPrediction.queryParams);
  });
});

// ─── Schema with FK fields for apiPrediction tests ────────────────────────────

const fkSchema = {
  version: '0.1.0',
  window: { id: '143', name: 'Sales Order', primaryEntity: 'order', category: 'sales' },
  entities: [
    {
      name: 'order',
      table: 'C_Order',
      level: 'header',
      fields: [
        { name: 'businessPartner', column: 'C_BPartner_ID', type: 'foreignKey',
          reference: 'BusinessPartner', inputMode: 'search',
          visibility: 'editable', required: true, searchable: true, grid: true, form: true },
        { name: 'warehouse', column: 'M_Warehouse_ID', type: 'foreignKey',
          reference: 'Warehouse', inputMode: 'selector',
          visibility: 'editable', required: true, searchable: false, grid: false, form: true },
        { name: 'currency', column: 'C_Currency_ID', type: 'foreignKey',
          reference: 'Currency',
          visibility: 'readOnly', required: true, searchable: false, grid: true, form: true },
        { name: 'documentNo', column: 'DocumentNo', type: 'string',
          visibility: 'readOnly', required: true, searchable: true, grid: true, form: true },
        { name: 'orderDate', column: 'DateOrdered', type: 'date',
          visibility: 'editable', required: true, searchable: true, grid: true, form: true },
        { name: 'transactionDoc', column: 'C_DocTypeTarget_ID', type: 'foreignKey',
          visibility: 'system', required: true, searchable: false, grid: false, form: false,
          derivation: { type: 'fromConfig', source: 'doctype.salesOrder' } },
      ]
    },
    {
      name: 'orderLine',
      table: 'C_OrderLine',
      level: 'line',
      fields: [
        { name: 'product', column: 'M_Product_ID', type: 'foreignKey',
          reference: 'Product', inputMode: 'search',
          visibility: 'editable', required: true, searchable: true, grid: true, form: true },
        { name: 'qty', column: 'QtyOrdered', type: 'number',
          visibility: 'editable', required: true, searchable: false, grid: true, form: true },
        { name: 'salesOrder', column: 'C_Order_ID', type: 'foreignKey',
          visibility: 'system', required: true, searchable: false, grid: false, form: false,
          derivation: { type: 'fromParent', source: 'order.id' } },
      ]
    }
  ]
};

const buttonSchema = {
  version: '0.1.0',
  window: { id: '500', name: 'Purchase Invoice', primaryEntity: 'invoice', category: 'purchasing' },
  entities: [{
    name: 'invoice',
    table: 'C_Invoice',
    level: 'header',
    fields: [
      { name: 'documentNo', column: 'DocumentNo', type: 'string',
        visibility: 'readOnly', required: true, searchable: true, grid: true, form: true },
      { name: 'docAction', column: 'DocAction', type: 'button',
        visibility: 'editable', required: false, searchable: false, grid: false, form: true },
    ]
  }]
};

describe('generateApiPrediction', () => {
  it('specName is correct kebab-case from window name', () => {
    const fc = generateFrontendContract(fkSchema);
    const bc = generateBackendContract(fkSchema);
    const prediction = generateApiPrediction(fkSchema, fc, bc);
    assert.equal(prediction.specName, 'sales-order');
  });

  it('baseUrl follows NEO Headless pattern', () => {
    const fc = generateFrontendContract(fkSchema);
    const bc = generateBackendContract(fkSchema);
    const prediction = generateApiPrediction(fkSchema, fc, bc);
    assert.equal(prediction.baseUrl, '/sws/neo/sales-order');
  });

  it('CRUD entries exist for each entity', () => {
    const fc = generateFrontendContract(fkSchema);
    const bc = generateBackendContract(fkSchema);
    const prediction = generateApiPrediction(fkSchema, fc, bc);
    assert.ok(prediction.crud.order, 'order entity should have CRUD');
    assert.ok(prediction.crud.orderLine, 'orderLine entity should have CRUD');
    assert.equal(prediction.crud.order.get, true);
    assert.equal(prediction.crud.order.getById, true);
    assert.equal(prediction.crud.order.post, true);
    assert.equal(prediction.crud.order.put, true);
    assert.equal(prediction.crud.order.patch, true);
    assert.equal(prediction.crud.order.delete, true);
  });

  it('CRUD URLs follow correct pattern', () => {
    const fc = generateFrontendContract(fkSchema);
    const bc = generateBackendContract(fkSchema);
    const prediction = generateApiPrediction(fkSchema, fc, bc);
    assert.equal(prediction.crud.order.listUrl, '/sws/neo/sales-order/order');
    assert.equal(prediction.crud.order.detailUrl, '/sws/neo/sales-order/order/{id}');
    assert.equal(prediction.crud.orderLine.listUrl, '/sws/neo/sales-order/orderLine');
    assert.equal(prediction.crud.orderLine.detailUrl, '/sws/neo/sales-order/orderLine/{id}');
  });

  it('supportedFilters match searchableFields from frontendContract', () => {
    const fc = generateFrontendContract(fkSchema);
    const bc = generateBackendContract(fkSchema);
    const prediction = generateApiPrediction(fkSchema, fc, bc);
    assert.deepStrictEqual(prediction.crud.order.supportedFilters,
      fc.entities.order.searchableFields);
    assert.deepStrictEqual(prediction.crud.orderLine.supportedFilters,
      fc.entities.orderLine.searchableFields);
  });

  it('selector entries match visible FK fields from frontendContract', () => {
    const fc = generateFrontendContract(fkSchema);
    const bc = generateBackendContract(fkSchema);
    const prediction = generateApiPrediction(fkSchema, fc, bc);

    // order has 3 visible FK fields: businessPartner, warehouse, currency
    // transactionDoc is system so excluded
    const orderSelectors = prediction.selectors.filter(s => s.entity === 'order');
    assert.equal(orderSelectors.length, 3);

    const bpSelector = orderSelectors.find(s => s.field === 'businessPartner');
    assert.ok(bpSelector);
    assert.equal(bpSelector.column, 'C_BPartner_ID');
    assert.equal(bpSelector.reference, 'BusinessPartner');
    assert.equal(bpSelector.url, '/sws/neo/sales-order/order/selectors/businessPartner');

    // orderLine has 1 visible FK: product (salesOrder is system)
    const lineSelectors = prediction.selectors.filter(s => s.entity === 'orderLine');
    assert.equal(lineSelectors.length, 1);
    assert.equal(lineSelectors[0].field, 'product');
  });

  it('selector URLs follow correct pattern', () => {
    const fc = generateFrontendContract(fkSchema);
    const bc = generateBackendContract(fkSchema);
    const prediction = generateApiPrediction(fkSchema, fc, bc);
    for (const sel of prediction.selectors) {
      const expected = `/sws/neo/sales-order/${sel.entity}/selectors/${sel.field}`;
      assert.equal(sel.url, expected,
        `selector URL for ${sel.entity}.${sel.field} should match pattern`);
    }
  });

  it('actions include button-type fields', () => {
    const fc = generateFrontendContract(buttonSchema);
    const bc = generateBackendContract(buttonSchema);
    const prediction = generateApiPrediction(buttonSchema, fc, bc);
    assert.equal(prediction.actions.length, 1);
    assert.equal(prediction.actions[0].field, 'docAction');
    assert.equal(prediction.actions[0].column, 'DocAction');
    assert.equal(prediction.actions[0].url,
      '/sws/neo/purchase-invoice/invoice/{id}/action/docAction');
  });

  it('actions is empty array when no button fields exist', () => {
    const fc = generateFrontendContract(fkSchema);
    const bc = generateBackendContract(fkSchema);
    const prediction = generateApiPrediction(fkSchema, fc, bc);
    assert.equal(prediction.actions.length, 0);
  });

  it('queryParams structure exists with required keys', () => {
    const fc = generateFrontendContract(fkSchema);
    const bc = generateBackendContract(fkSchema);
    const prediction = generateApiPrediction(fkSchema, fc, bc);
    assert.ok(prediction.queryParams.pagination);
    assert.equal(prediction.queryParams.pagination.startRow, '_startRow');
    assert.equal(prediction.queryParams.pagination.endRow, '_endRow');
    assert.ok(prediction.queryParams.sorting);
    assert.equal(prediction.queryParams.sorting.param, '_sortBy');
    assert.ok(prediction.queryParams.filtering);
    assert.ok(prediction.queryParams.parentFilter);
  });

  it('empty schema produces empty CRUD, selectors, and actions', () => {
    const fc = generateFrontendContract(emptySchema);
    const bc = generateBackendContract(emptySchema);
    const prediction = generateApiPrediction(emptySchema, fc, bc);
    assert.equal(prediction.specName, 'empty-window');
    assert.deepStrictEqual(prediction.crud, {});
    assert.deepStrictEqual(prediction.selectors, []);
    assert.deepStrictEqual(prediction.actions, []);
  });

  it('specName handles multi-word names correctly', () => {
    const schema = {
      ...fkSchema,
      window: { ...fkSchema.window, name: 'Business Partner Category' }
    };
    const fc = generateFrontendContract(schema);
    const bc = generateBackendContract(schema);
    const prediction = generateApiPrediction(schema, fc, bc);
    assert.equal(prediction.specName, 'business-partner-category');
  });
});

// ─── v2 Test Manifest Entries ─────────────────────────────────────────────────

describe('generateTestManifest — v2 entries (displayLogic, readOnlyLogic, defaultValue)', () => {
  it('emits displaylogic-valid tests for fields with displayLogic', () => {
    const fc = generateFrontendContract(behavioralSchema, behavioralRules);
    const bc = generateBackendContract(behavioralSchema);
    const manifest = generateTestManifest(fc, bc);
    const dlTests = manifest.tests.filter(t => t.category === 'displaylogic-valid');
    assert.equal(dlTests.length, 1);
    assert.equal(dlTests[0].field, 'warehouse');
    assert.equal(dlTests[0].runner, 'node');
  });

  it('emits readonlylogic-valid tests for fields with readOnlyLogic', () => {
    const fc = generateFrontendContract(behavioralSchema, behavioralRules);
    const bc = generateBackendContract(behavioralSchema);
    const manifest = generateTestManifest(fc, bc);
    const roTests = manifest.tests.filter(t => t.category === 'readonlylogic-valid');
    assert.equal(roTests.length, 1);
    assert.equal(roTests[0].field, 'priceList');
    assert.equal(roTests[0].runner, 'node');
  });

  it('emits default-value-type tests for fields with defaultValue', () => {
    const fc = generateFrontendContract(uiHintsSchema);
    const bc = generateBackendContract(uiHintsSchema);
    const manifest = generateTestManifest(fc, bc);
    const dvTests = manifest.tests.filter(t => t.category === 'default-value-type');
    assert.equal(dvTests.length, 1);
    assert.equal(dvTests[0].field, 'grandTotal');
    assert.equal(dvTests[0].runner, 'node');
  });

  it('does not emit displaylogic-valid tests when no fields have displayLogic', () => {
    const fc = generateFrontendContract(minimalSchema);
    const bc = generateBackendContract(minimalSchema);
    const manifest = generateTestManifest(fc, bc);
    const dlTests = manifest.tests.filter(t => t.category === 'displaylogic-valid');
    assert.equal(dlTests.length, 0);
  });
});

describe('generateContract — v2 apiPrediction tests in testManifest', () => {
  it('emits crud-flags tests for each entity', () => {
    const contract = generateContract(fkSchema);
    const crudTests = contract.testManifest.tests.filter(t => t.category === 'crud-flags');
    assert.equal(crudTests.length, 2); // order + orderLine
    const entities = crudTests.map(t => t.entity);
    assert.ok(entities.includes('order'));
    assert.ok(entities.includes('orderLine'));
  });

  it('emits selector-endpoint tests for FK fields', () => {
    const contract = generateContract(fkSchema);
    const selTests = contract.testManifest.tests.filter(t => t.category === 'selector-endpoint');
    // order has 3 visible FK fields, orderLine has 1 visible FK field
    assert.equal(selTests.length, 4);
    const bpTest = selTests.find(t => t.field === 'businessPartner');
    assert.ok(bpTest);
    assert.equal(bpTest.entity, 'order');
  });

  it('emits action-endpoint tests for button fields', () => {
    const contract = generateContract(buttonSchema);
    const actionTests = contract.testManifest.tests.filter(t => t.category === 'action-endpoint');
    assert.equal(actionTests.length, 1);
    assert.equal(actionTests[0].field, 'docAction');
    assert.equal(actionTests[0].entity, 'invoice');
  });

  it('summary counts include v2 test categories', () => {
    const contract = generateContract(fkSchema);
    assert.ok(contract.testManifest.summary.byCategory['crud-flags'] >= 1);
    assert.ok(contract.testManifest.summary.byCategory['selector-endpoint'] >= 1);
    assert.equal(contract.testManifest.summary.total, contract.testManifest.tests.length);
  });

  it('all test IDs remain unique after v2 additions', () => {
    const contract = generateContract(fkSchema);
    const ids = contract.testManifest.tests.map(t => t.id);
    const uniqueIds = new Set(ids);
    assert.equal(ids.length, uniqueIds.size, 'all test IDs should be unique');
  });
});

// ─── UI Hints in Frontend Contract ────────────────────────────────────────────

const uiHintsSchema = {
  version: '0.1.0',
  window: { id: '600', name: 'UI Hints Test', primaryEntity: 'order', category: 'test' },
  entities: [{
    name: 'order',
    table: 'C_Order',
    level: 'header',
    fields: [
      { name: 'grandTotal', column: 'GrandTotal', type: 'amount', visibility: 'editable',
        required: true, searchable: false, grid: true, form: true,
        defaultValue: '0', isIdentifier: true, help: 'Total amount including tax',
        fieldGroup: 'Amounts', isSelectionColumn: true, isFilterable: true,
        precision: 2, isTranslated: true },
      { name: 'plainField', column: 'PlainCol', type: 'string', visibility: 'editable',
        required: false, searchable: false, grid: true, form: true },
    ]
  }]
};

describe('generateFrontendContract — UI hints', () => {
  it('field with defaultValue appears in contract', () => {
    const fc = generateFrontendContract(uiHintsSchema);
    const gt = fc.entities.order.fields.find(f => f.name === 'grandTotal');
    assert.equal(gt.defaultValue, '0');
  });

  it('field with help text appears in contract', () => {
    const fc = generateFrontendContract(uiHintsSchema);
    const gt = fc.entities.order.fields.find(f => f.name === 'grandTotal');
    assert.equal(gt.help, 'Total amount including tax');
  });

  it('field with fieldGroup appears in contract', () => {
    const fc = generateFrontendContract(uiHintsSchema);
    const gt = fc.entities.order.fields.find(f => f.name === 'grandTotal');
    assert.equal(gt.fieldGroup, 'Amounts');
  });

  it('field with precision appears in contract', () => {
    const fc = generateFrontendContract(uiHintsSchema);
    const gt = fc.entities.order.fields.find(f => f.name === 'grandTotal');
    assert.equal(gt.precision, 2);
  });

  it('field with isIdentifier appears in contract', () => {
    const fc = generateFrontendContract(uiHintsSchema);
    const gt = fc.entities.order.fields.find(f => f.name === 'grandTotal');
    assert.equal(gt.isIdentifier, true);
  });

  it('field without hints has no hint keys present', () => {
    const fc = generateFrontendContract(uiHintsSchema);
    const plain = fc.entities.order.fields.find(f => f.name === 'plainField');
    assert.equal(plain.defaultValue, undefined);
    assert.equal(plain.isIdentifier, undefined);
    assert.equal(plain.help, undefined);
    assert.equal(plain.fieldGroup, undefined);
    assert.equal(plain.isSelectionColumn, undefined);
    assert.equal(plain.isFilterable, undefined);
    assert.equal(plain.precision, undefined);
    assert.equal(plain.isTranslated, undefined);
  });
});
