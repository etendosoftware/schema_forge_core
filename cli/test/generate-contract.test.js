import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  generateFrontendContract,
  generateBackendContract,
  generateTestManifest,
  generateContract
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
});
