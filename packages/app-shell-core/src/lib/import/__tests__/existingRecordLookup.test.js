import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLookupKey, buildExistingKeyCriteria, findExistingKeys, LOOKUP_BATCH_SIZE,
} from '../existingRecordLookup.js';

describe('buildLookupKey', () => {
  it('normalizes case and surrounding whitespace, matching dedupeRows', () => {
    assert.equal(buildLookupKey({ taxID: '  B12345678 ' }, ['taxID']), 'b12345678');
  });

  it('joins a composite key in the declared target order', () => {
    assert.equal(buildLookupKey({ a: 'X', b: 'Y' }, ['a', 'b']), 'x y');
  });

  it('returns null when any part is blank, so a keyless row is never called a duplicate', () => {
    assert.equal(buildLookupKey({ taxID: '' }, ['taxID']), null);
    assert.equal(buildLookupKey({ a: 'X', b: '  ' }, ['a', 'b']), null);
  });
});

describe('buildExistingKeyCriteria', () => {
  it('builds a flat OR of equals for a single-target key', () => {
    const criteria = buildExistingKeyCriteria([['B1'], ['B2']], ['taxID']);
    assert.deepEqual(criteria, {
      _constructor: 'AdvancedCriteria',
      operator: 'or',
      criteria: [
        { fieldName: 'taxID', operator: 'equals', value: 'B1' },
        { fieldName: 'taxID', operator: 'equals', value: 'B2' },
      ],
    });
  });

  it('nests an AND per tuple for a composite key', () => {
    const criteria = buildExistingKeyCriteria([['X', 'Y']], ['a', 'b']);
    assert.equal(criteria.operator, 'or');
    assert.deepEqual(criteria.criteria[0], {
      _constructor: 'AdvancedCriteria',
      operator: 'and',
      criteria: [
        { fieldName: 'a', operator: 'equals', value: 'X' },
        { fieldName: 'b', operator: 'equals', value: 'Y' },
      ],
    });
  });
});

describe('findExistingKeys', () => {
  it('returns the normalized keys the server already has', async () => {
    const existing = await findExistingKeys({
      rows: [{ searchKey: 'SKU-1' }, { searchKey: 'SKU-2' }],
      keyTargets: ['searchKey'],
      fetchFn: async () => [{ searchKey: 'SKU-2' }],
    });
    assert.deepEqual([...existing], ['sku-2']);
  });

  it('matches case-insensitively against what the server returns', async () => {
    const existing = await findExistingKeys({
      rows: [{ searchKey: 'sku-1' }],
      keyTargets: ['searchKey'],
      fetchFn: async () => [{ searchKey: 'SKU-1' }],
    });
    assert.ok(existing.has('sku-1'));
  });

  it('queries each distinct key once, not once per row', async () => {
    const queried = [];
    await findExistingKeys({
      rows: [{ taxID: 'B1' }, { taxID: 'B1' }, { taxID: 'B2' }],
      keyTargets: ['taxID'],
      fetchFn: async (criteria) => { queried.push(criteria.criteria.length); return []; },
    });
    assert.deepEqual(queried, [2]);
  });

  it('skips blank-keyed rows entirely', async () => {
    let called = false;
    const existing = await findExistingKeys({
      rows: [{ taxID: '' }, { taxID: '   ' }],
      keyTargets: ['taxID'],
      fetchFn: async () => { called = true; return []; },
    });
    assert.equal(called, false);
    assert.equal(existing.size, 0);
  });

  it(`batches keys ${LOOKUP_BATCH_SIZE} at a time rather than one giant disjunction`, async () => {
    const batchSizes = [];
    const rows = Array.from({ length: LOOKUP_BATCH_SIZE + 5 }, (_, i) => ({ searchKey: `SKU-${i}` }));
    await findExistingKeys({
      rows,
      keyTargets: ['searchKey'],
      fetchFn: async (criteria) => { batchSizes.push(criteria.criteria.length); return []; },
    });
    assert.deepEqual(batchSizes, [LOOKUP_BATCH_SIZE, 5]);
  });

  it('falls back to an empty set when the lookup throws, never blocking the import', async () => {
    // A pre-flight check is a courtesy, not a gate: if it cannot reach the server the
    // import must still go through and let the server's own constraints decide.
    const existing = await findExistingKeys({
      rows: [{ searchKey: 'SKU-1' }],
      keyTargets: ['searchKey'],
      fetchFn: async () => { throw new Error('network down'); },
    });
    assert.equal(existing.size, 0);
  });

  it('returns an empty set when no key or no fetcher is configured', async () => {
    assert.equal((await findExistingKeys({ rows: [{ a: 1 }], keyTargets: [], fetchFn: async () => [] })).size, 0);
    assert.equal((await findExistingKeys({ rows: [{ a: 1 }], keyTargets: ['a'] })).size, 0);
  });
});
