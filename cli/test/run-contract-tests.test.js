import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { runContractTests, generateTestAssertions } from '../src/run-contract-tests.js';

const minimalContract = {
  version: '0.1.0',
  frontendContract: {
    entities: {
      order: {
        fields: [
          { name: 'documentNo', tsType: 'string', visibility: 'readOnly' },
          { name: 'dateOrdered', tsType: 'string', visibility: 'editable' },
          { name: 'grandTotal', tsType: 'number', visibility: 'readOnly' },
        ],
        searchableFields: ['documentNo', 'dateOrdered'],
      }
    }
  },
  backendContract: {
    entities: {
      order: {
        fields: [
          { name: 'documentNo', type: 'string', visibility: 'readOnly' },
          { name: 'dateOrdered', type: 'date', visibility: 'editable' },
          { name: 'grandTotal', type: 'amount', visibility: 'readOnly' },
          { name: 'adClientId', type: 'id', visibility: 'system' },
        ]
      }
    },
    endpoints: [
      { entity: 'order', method: 'GET', path: '/orders', supportedFilters: ['documentNo', 'dateOrdered'] }
    ],
    processEndpoints: []
  },
  testManifest: {
    tests: [
      { id: 'fp-1', category: 'field-presence', entity: 'order', field: 'documentNo', runner: 'node', description: 'documentNo exists in frontend contract' },
      { id: 'fp-2', category: 'field-presence', entity: 'order', field: 'dateOrdered', runner: 'node', description: 'dateOrdered exists in frontend contract' },
      { id: 'fp-3', category: 'field-presence', entity: 'order', field: 'grandTotal', runner: 'node', description: 'grandTotal exists in frontend contract' },
      { id: 'ft-1', category: 'field-type', entity: 'order', field: 'documentNo', runner: 'node', description: 'documentNo has type string' },
      { id: 'sf-1', category: 'system-field', entity: 'order', field: 'adClientId', runner: 'node', description: 'adClientId is system field in backend' },
      { id: 'sf-filter-1', category: 'searchable-filters', entity: 'order', field: 'documentNo', runner: 'node', description: 'documentNo is searchable' },
      { id: 'proc-1', category: 'process-happy', process: 'completeOrder', runner: 'junit', description: 'completeOrder happy path' },
    ],
    summary: { total: 7, byRunner: { node: 6, junit: 1 } }
  }
};

describe('generateTestAssertions', () => {
  it('generates assertions for field-presence tests', () => {
    const assertions = generateTestAssertions(minimalContract);
    const fpTests = assertions.filter(a => a.category === 'field-presence');
    assert.equal(fpTests.length, 3);
    assert.ok(fpTests.every(t => t.passed === true));
  });

  it('generates assertions for field-type tests', () => {
    const assertions = generateTestAssertions(minimalContract);
    const ftTests = assertions.filter(a => a.category === 'field-type');
    assert.ok(ftTests.length >= 1);
    assert.ok(ftTests.every(t => t.passed === true));
  });

  it('generates assertions for system-field tests', () => {
    const assertions = generateTestAssertions(minimalContract);
    const sfTests = assertions.filter(a => a.category === 'system-field');
    assert.ok(sfTests.length >= 1);
    assert.ok(sfTests.every(t => t.passed === true));
  });

  it('generates assertions for searchable-filters tests', () => {
    const assertions = generateTestAssertions(minimalContract);
    const filterTests = assertions.filter(a => a.category === 'searchable-filters');
    assert.ok(filterTests.length >= 1);
    assert.ok(filterTests.every(t => t.passed === true));
  });

  it('skips junit tests (not runnable in Node)', () => {
    const assertions = generateTestAssertions(minimalContract);
    const junitTests = assertions.filter(a => a.runner === 'junit');
    assert.equal(junitTests.length, 0); // junit tests are skipped
  });

  it('detects missing field as failure', () => {
    const badContract = JSON.parse(JSON.stringify(minimalContract));
    // Add a test for a field that doesn't exist
    badContract.testManifest.tests.push({
      id: 'fp-bad', category: 'field-presence', entity: 'order',
      field: 'nonexistent', runner: 'node', description: 'nonexistent field'
    });
    const assertions = generateTestAssertions(badContract);
    const badTest = assertions.find(a => a.id === 'fp-bad');
    assert.ok(badTest);
    assert.equal(badTest.passed, false);
  });
});

describe('runContractTests', () => {
  it('returns summary with pass/fail counts', () => {
    const result = runContractTests(minimalContract);
    assert.ok(result.total > 0);
    assert.equal(result.failed, 0);
    assert.equal(result.passed, result.total);
    assert.ok(result.skipped >= 0); // junit tests skipped
  });

  it('reports failure for bad contract', () => {
    const badContract = JSON.parse(JSON.stringify(minimalContract));
    badContract.testManifest.tests.push({
      id: 'fp-bad', category: 'field-presence', entity: 'order',
      field: 'nonexistent', runner: 'node', description: 'nonexistent field'
    });
    const result = runContractTests(badContract);
    assert.ok(result.failed > 0);
  });
});
