import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLookupQuery } from '../src/hooks/useLookup.js';

test('buildLookupQuery emits NEO criteria parameter', () => {
  const query = buildLookupQuery({
    pageSize: 25,
    criteria: [{ fieldName: 'isCustomer', operator: 'equals', value: 'Y' }],
  });
  const params = new URLSearchParams(query);

  assert.equal(params.get('_pageSize'), '25');
  assert.equal(params.has('_criteria'), false);
  assert.deepEqual(JSON.parse(params.get('criteria')), {
    fieldName: 'isCustomer',
    operator: 'equals',
    value: 'Y',
  });
});

test('buildLookupQuery combines base criteria and remote search as AdvancedCriteria', () => {
  const query = buildLookupQuery({
    criteria: [{ fieldName: 'isVendor', operator: 'equals', value: 'Y' }],
    query: 'acme',
    searchFields: ['_identifier', 'name'],
  });
  const criteria = JSON.parse(new URLSearchParams(query).get('criteria'));

  assert.equal(criteria._constructor, 'AdvancedCriteria');
  assert.equal(criteria.operator, 'and');
  assert.equal(criteria.criteria[1].operator, 'or');
  assert.deepEqual(criteria.criteria[1].criteria, [
    { fieldName: '_identifier', operator: 'iContains', value: 'acme' },
    { fieldName: 'name', operator: 'iContains', value: 'acme' },
  ]);
});
