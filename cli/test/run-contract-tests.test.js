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

describe('edge cases', () => {
  it('empty testManifest produces zero counts', () => {
    const emptyContract = { testManifest: { tests: [] } };
    const result = runContractTests(emptyContract);
    assert.equal(result.total, 0);
    assert.equal(result.passed, 0);
    assert.equal(result.failed, 0);
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.results, []);
  });

  it('missing testManifest produces zero counts', () => {
    const result = runContractTests({});
    assert.equal(result.total, 0);
    assert.equal(result.passed, 0);
    assert.equal(result.failed, 0);
    assert.equal(result.skipped, 0);
  });

  it('all junit tests result in all skipped, zero passed', () => {
    const junitOnly = {
      testManifest: {
        tests: [
          { id: 'j-1', category: 'process-happy', runner: 'junit', description: 'junit test 1' },
          { id: 'j-2', category: 'process-happy', runner: 'junit', description: 'junit test 2' },
          { id: 'j-3', category: 'process-sad', runner: 'junit', description: 'junit test 3' },
        ]
      }
    };
    const result = runContractTests(junitOnly);
    assert.equal(result.total, 0);
    assert.equal(result.passed, 0);
    assert.equal(result.failed, 0);
    assert.equal(result.skipped, 3);
    assert.deepEqual(result.results, []);
  });

  it('multiple entities have tests across entities work', () => {
    const multiEntity = {
      frontendContract: {
        entities: {
          order: {
            fields: [{ name: 'documentNo', tsType: 'string', visibility: 'readOnly' }],
            searchableFields: ['documentNo'],
          },
          invoice: {
            fields: [{ name: 'invoiceNo', tsType: 'string', visibility: 'readOnly' }],
            searchableFields: ['invoiceNo'],
          }
        }
      },
      backendContract: { entities: {}, endpoints: [] },
      testManifest: {
        tests: [
          { id: 'fp-o1', category: 'field-presence', entity: 'order', field: 'documentNo', runner: 'node', description: 'order documentNo' },
          { id: 'fp-i1', category: 'field-presence', entity: 'invoice', field: 'invoiceNo', runner: 'node', description: 'invoice invoiceNo' },
        ]
      }
    };
    const result = runContractTests(multiEntity);
    assert.equal(result.total, 2);
    assert.equal(result.passed, 2);
    assert.equal(result.failed, 0);
    const ids = result.results.map(r => r.id);
    assert.ok(ids.includes('fp-o1'));
    assert.ok(ids.includes('fp-i1'));
  });

  it('searchable filter for non-existent endpoint fails gracefully', () => {
    const noEndpoint = {
      frontendContract: {
        entities: {
          product: {
            fields: [{ name: 'name', tsType: 'string' }],
            searchableFields: ['name'],
          }
        }
      },
      backendContract: { entities: {}, endpoints: [] },
      testManifest: {
        tests: [
          { id: 'sf-p1', category: 'searchable-filters', entity: 'product', field: 'name', runner: 'node', description: 'product name searchable' },
        ]
      }
    };
    const result = runContractTests(noEndpoint);
    assert.equal(result.failed, 1);
    assert.equal(result.passed, 0);
    const failedTest = result.results[0];
    assert.equal(failedTest.passed, false);
    assert.ok(failedTest.reason.includes('No endpoint found'));
  });

  it('contract with no frontendContract handles gracefully', () => {
    const noFrontend = {
      backendContract: { entities: {}, endpoints: [] },
      testManifest: {
        tests: [
          { id: 'fp-x1', category: 'field-presence', entity: 'order', field: 'name', runner: 'node', description: 'field in missing frontend' },
          { id: 'ft-x1', category: 'field-type', entity: 'order', field: 'name', runner: 'node', description: 'type in missing frontend' },
          { id: 'vis-x1', category: 'visibility', entity: 'order', field: 'name', runner: 'node', description: 'visibility in missing frontend' },
        ]
      }
    };
    const result = runContractTests(noFrontend);
    assert.equal(result.total, 3);
    assert.equal(result.failed, 3);
    assert.equal(result.passed, 0);
    assert.ok(result.results.every(r => r.reason.includes('not found in frontendContract')));
  });

  it('unknown test category reports failure with descriptive reason', () => {
    const unknownCat = {
      testManifest: {
        tests: [
          { id: 'unk-1', category: 'nonexistent-category', entity: 'order', field: 'x', runner: 'node', description: 'unknown cat' },
        ]
      }
    };
    const assertions = generateTestAssertions(unknownCat);
    assert.equal(assertions.length, 1);
    assert.equal(assertions[0].passed, false);
    assert.ok(assertions[0].reason.includes('Unknown test category'));
  });
});
