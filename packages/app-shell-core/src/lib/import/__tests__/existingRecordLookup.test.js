import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLookupKey, buildExistingKeyCriteria, buildLookupBatches, findExistingKeys,
  LOOKUP_CRITERIA_BUDGET, LOOKUP_MAX_BATCH_SIZE, LOOKUP_FAILURE_ABORT_THRESHOLD,
} from '../existingRecordLookup.js';

/** The length the module budgets against: the criteria as it travels in the query string. */
const encodedLength = (criteria) => encodeURIComponent(JSON.stringify(criteria)).length;

const skus = (n) => Array.from({ length: n }, (_, i) => ({ searchKey: `SKU-${String(i).padStart(4, '0')}` }));

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

/**
 * ETP-5374 — batching by URL length instead of by key count.
 *
 * The old rule was a flat 200 keys per request, under a comment asserting it "keeps each
 * request comfortably inside a normal URL length". It produced a ~22.000-character query
 * string; Tomcat's default `maxHttpHeaderSize` of 8192 refused it with a 400 before the
 * servlet saw it, so duplicate detection died in silence above ~72 distinct keys and worked
 * perfectly below — which is why every small test file passed.
 */
describe('buildLookupBatches', () => {
  it('keeps every batch inside the budget, measured on the criteria it actually builds', () => {
    const tuples = skus(5000).map((r) => [r.searchKey]);
    for (const batch of buildLookupBatches(tuples, ['searchKey'])) {
      assert.ok(encodedLength(buildExistingKeyCriteria(batch, ['searchKey'])) <= LOOKUP_CRITERIA_BUDGET);
    }
  });

  // The batcher predicts a batch's length from per-term lengths plus a separator cost rather
  // than re-serializing a candidate batch per tuple. That is only sound if the prediction is
  // EXACT — an estimate that drifts low is how a length budget silently stops holding.
  it('fills each batch to the budget, so its arithmetic is exact and not an estimate', () => {
    const targets = ['searchKey'];
    const tuples = skus(2000).map((r) => [r.searchKey]);
    const batches = buildLookupBatches(tuples, targets);
    for (const batch of batches.slice(0, -1)) {
      const used = encodedLength(buildExistingKeyCriteria(batch, targets));
      const oneMore = encodedLength(buildExistingKeyCriteria([...batch, ['SKU-9999']], targets));
      assert.ok(used <= LOOKUP_CRITERIA_BUDGET, 'batch is within budget');
      assert.ok(oneMore > LOOKUP_CRITERIA_BUDGET, 'batch is full — one more term would overflow');
    }
  });

  // The point of measuring length rather than counting keys: the SAME number of keys costs
  // more with a composite key or with long values, so no fixed count can be safe for both.
  it('gives a composite key smaller batches than a single-column one, for the same keys', () => {
    const single = buildLookupBatches(skus(1000).map((r) => [r.searchKey]), ['searchKey']);
    const composite = buildLookupBatches(
      skus(1000).map((r, i) => [r.searchKey, `Producto de prueba numero ${i}`]),
      ['searchKey', 'name'],
    );
    assert.ok(composite[0].length < single[0].length);
    for (const batch of composite) {
      assert.ok(encodedLength(buildExistingKeyCriteria(batch, ['searchKey', 'name'])) <= LOOKUP_CRITERIA_BUDGET);
    }
  });

  it('still caps the term count, so short keys cannot build a disjunction no index helps', () => {
    const tuples = Array.from({ length: LOOKUP_MAX_BATCH_SIZE * 2 }, (_, i) => [String(i)]);
    const batches = buildLookupBatches(tuples, ['a'], { criteriaBudget: Number.MAX_SAFE_INTEGER });
    assert.deepEqual(batches.map((b) => b.length), [LOOKUP_MAX_BATCH_SIZE, LOOKUP_MAX_BATCH_SIZE]);
  });

  // It cannot be split further, and sending it is strictly better than dropping it: worst case
  // the server refuses that one batch, which no longer discards the others.
  it('gives a single oversized key its own batch rather than dropping it', () => {
    const batches = buildLookupBatches([['x'.repeat(9000)], ['short']], ['searchKey']);
    assert.deepEqual(batches.map((b) => b.length), [1, 1]);
  });
});

describe('findExistingKeys', () => {
  it('returns the normalized keys the server already has', async () => {
    const { existing } = await findExistingKeys({
      rows: [{ searchKey: 'SKU-1' }, { searchKey: 'SKU-2' }],
      keyTargets: ['searchKey'],
      fetchFn: async () => [{ searchKey: 'SKU-2' }],
    });
    assert.deepEqual([...existing], ['sku-2']);
  });

  it('matches case-insensitively against what the server returns', async () => {
    const { existing } = await findExistingKeys({
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
    const { existing, complete } = await findExistingKeys({
      rows: [{ taxID: '' }, { taxID: '   ' }],
      keyTargets: ['taxID'],
      fetchFn: async () => { called = true; return []; },
    });
    assert.equal(called, false);
    assert.equal(existing.size, 0);
    assert.equal(complete, true, 'nothing to check is not the same as a failed check');
  });

  // The regression itself, at the measured threshold: 72 distinct keys used to travel as one
  // request Tomcat answered 400 to. Nothing is dropped and no request is oversized.
  it('sends the 72 keys that used to overflow the URL as several legal requests', async () => {
    const sent = [];
    const { existing, complete } = await findExistingKeys({
      rows: skus(72),
      keyTargets: ['searchKey'],
      fetchFn: async (criteria) => {
        sent.push(criteria);
        return criteria.criteria.map((term) => ({ searchKey: term.value }));
      },
    });
    assert.ok(sent.length > 1, 'must not be one giant request any more');
    for (const criteria of sent) {
      assert.ok(encodedLength(criteria) <= LOOKUP_CRITERIA_BUDGET);
    }
    assert.equal(existing.size, 72, 'every key is still queried exactly once');
    assert.equal(complete, true);
  });

  it('runs several batches at a time without exceeding the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    await findExistingKeys({
      rows: skus(400),
      keyTargets: ['searchKey'],
      concurrency: 3,
      fetchFn: async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => { setTimeout(resolve, 1); });
        inFlight -= 1;
        return [];
      },
    });
    assert.equal(peak, 3);
  });

  // The second half of the bug, and the one that survives any batch size: a single failure
  // among many used to `return new Set()`, throwing away every batch that had answered.
  it('keeps the batches that answered when one of them fails', async () => {
    let call = 0;
    const { existing, complete, failedBatches, totalBatches } = await findExistingKeys({
      rows: skus(200),
      keyTargets: ['searchKey'],
      concurrency: 1,
      fetchFn: async (criteria) => {
        call += 1;
        if (call === 2) throw new Error('network blip');
        return criteria.criteria.map((term) => ({ searchKey: term.value }));
      },
    });
    assert.ok(totalBatches > 2, 'the fixture must produce more batches than the one that fails');
    assert.equal(failedBatches, 1);
    assert.equal(complete, false);
    assert.ok(existing.size > 0, 'the successful batches must survive the failed one');
  });

  it('reports an incomplete check rather than an empty one when every batch fails', async () => {
    // Still no throw and still no blocking: a pre-flight check is a courtesy, not a gate, and
    // the import must go through and let the server's own constraints decide. What changed is
    // that the caller can now tell this apart from "checked, and found no duplicates".
    const { existing, complete, failedBatches, totalBatches } = await findExistingKeys({
      rows: [{ searchKey: 'SKU-1' }],
      keyTargets: ['searchKey'],
      fetchFn: async () => { throw new Error('network down'); },
    });
    assert.equal(existing.size, 0);
    assert.equal(complete, false);
    assert.equal(failedBatches, 1);
    assert.equal(totalBatches, 1);
  });

  // Batching by length turned ~25 requests into ~136. When the endpoint is simply broken — the
  // wrong base URL, a dead session, a server that is down — every one of them fails, and firing
  // all 136 to be refused one by one is cost with no information in it.
  it('gives up early when nothing is answering, instead of firing every remaining batch', async () => {
    let calls = 0;
    const { complete, totalBatches } = await findExistingKeys({
      rows: skus(2000),
      keyTargets: ['searchKey'],
      concurrency: 1,
      fetchFn: async () => { calls += 1; throw new Error('endpoint down'); },
    });
    assert.ok(totalBatches > 20, 'the fixture must plan far more batches than the threshold');
    assert.equal(calls, LOOKUP_FAILURE_ABORT_THRESHOLD);
    assert.equal(complete, false);
  });

  // The abort must never undo the per-batch isolation it sits next to: a run that has answered
  // even once is talking to a working endpoint, so every remaining batch still gets its attempt.
  it('keeps trying every batch once any of them has answered', async () => {
    let calls = 0;
    const { complete, totalBatches } = await findExistingKeys({
      rows: skus(600),
      keyTargets: ['searchKey'],
      concurrency: 1,
      // The first batch answers; everything after it fails. Far more failures than the
      // threshold, and not one of them may be skipped.
      fetchFn: async () => {
        calls += 1;
        if (calls === 1) return [];
        throw new Error('flaky');
      },
    });
    assert.ok(totalBatches > LOOKUP_FAILURE_ABORT_THRESHOLD + 2);
    assert.equal(calls, totalBatches, 'every planned batch must still be attempted');
    assert.equal(complete, false);
  });

  it('reports a complete check when no key or no fetcher is configured', async () => {
    for (const params of [
      { rows: [{ a: 1 }], keyTargets: [], fetchFn: async () => [] },
      { rows: [{ a: 1 }], keyTargets: ['a'] },
    ]) {
      const { existing, complete } = await findExistingKeys(params);
      assert.equal(existing.size, 0);
      assert.equal(complete, true, 'a check that was never asked for did not fail');
    }
  });
});
