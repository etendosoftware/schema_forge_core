import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  generateFrontendContract,
  generateBackendContract,
  generateTestManifest
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
