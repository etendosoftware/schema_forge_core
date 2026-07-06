import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BatchTimeoutError, SEND_STATUS, sendRow, runImport } from '../importEngine.js';

describe('sendRow', () => {
  it('returns OK with the recordId on a committed response', async () => {
    const postBatch = async () => ({ committed: true, operations: [{ id: 'row', ok: true, recordId: 'REC-1' }] });
    const result = await sendRow([{ id: 'row' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.OK);
    assert.equal(result.recordId, 'REC-1');
  });

  it('returns FAILED with the server error on a committed:false response', async () => {
    const postBatch = async () => ({ committed: false, failedAt: { index: 0 }, error: { message: 'Rejected' } });
    const result = await sendRow([{ id: 'row' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.FAILED);
    assert.equal(result.error.message, 'Rejected');
  });

  it('returns UNKNOWN when postBatch throws a BatchTimeoutError', async () => {
    const postBatch = async () => { throw new BatchTimeoutError('timed out'); };
    const result = await sendRow([{ id: 'row' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.UNKNOWN);
  });

  it('returns UNKNOWN (not FAILED) for any other network-level rejection — ambiguous, not a confirmed failure', async () => {
    const postBatch = async () => { throw new Error('network dropped'); };
    const result = await sendRow([{ id: 'row' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.UNKNOWN);
  });
});

describe('runImport', () => {
  it('sends every row and collects per-row results', async () => {
    const rows = [{ name: 'A' }, { name: 'B' }];
    const postBatch = async (ops) => ({ committed: true, operations: [{ id: 'row', ok: true, recordId: `REC-${ops[0].body.name}` }] });
    const { results, truncatedCount } = await runImport(rows, {
      buildRowOperations: (row) => [{ id: 'row', spec: 's', entity: 'e', body: row }],
      postBatch,
    });
    assert.equal(results.length, 2);
    assert.equal(truncatedCount, 0);
    assert.equal(results[0].status, SEND_STATUS.OK);
    assert.equal(results[0].recordId, 'REC-A');
    assert.equal(results[1].recordId, 'REC-B');
  });

  it('truncates rows beyond maxRows without attempting them', async () => {
    const rows = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
    const postBatch = async () => ({ committed: true, operations: [{ id: 'row', ok: true, recordId: 'X' }] });
    const { results, truncatedCount } = await runImport(rows, {
      buildRowOperations: (row) => [{ id: 'row', spec: 's', entity: 'e', body: row }],
      postBatch,
      maxRows: 2,
    });
    assert.equal(results.length, 2);
    assert.equal(truncatedCount, 1);
  });

  it('respects a bounded concurrency (never more than `concurrency` in flight)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const rows = Array.from({ length: 6 }, (_, i) => ({ name: `R${i}` }));
    const postBatch = async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return { committed: true, operations: [{ id: 'row', ok: true, recordId: 'X' }] };
    };
    await runImport(rows, {
      buildRowOperations: (row) => [{ id: 'row', spec: 's', entity: 'e', body: row }],
      postBatch,
      concurrency: 2,
    });
    assert.ok(maxInFlight <= 2, `expected at most 2 concurrent sends, saw ${maxInFlight}`);
  });

  it('calls onProgress once per settled row with a running completed count', async () => {
    const progressCalls = [];
    const rows = [{ name: 'A' }, { name: 'B' }];
    const postBatch = async () => ({ committed: true, operations: [{ id: 'row', ok: true, recordId: 'X' }] });
    await runImport(rows, {
      buildRowOperations: (row) => [{ id: 'row', spec: 's', entity: 'e', body: row }],
      postBatch,
      onProgress: (completed, total) => progressCalls.push([completed, total]),
    });
    assert.equal(progressCalls.length, 2);
    assert.deepEqual(progressCalls[progressCalls.length - 1], [2, 2]);
  });

  it('keeps the row reference in each result so the caller can build a review queue', async () => {
    const rows = [{ name: 'A' }];
    const postBatch = async () => ({ committed: false, failedAt: { index: 0 }, error: { message: 'nope' } });
    const { results } = await runImport(rows, {
      buildRowOperations: (row) => [{ id: 'row', spec: 's', entity: 'e', body: row }],
      postBatch,
    });
    assert.equal(results[0].row, rows[0]);
    assert.equal(results[0].status, SEND_STATUS.FAILED);
  });

  it('regression: a buildRowOperations throw for one row surfaces as that row\'s own FAILED result, without aborting the other rows in flight', async () => {
    // Reproduces a real hang: a composite descriptor (e.g. Contacts resolving an
    // unmatched country) throwing during operation-building used to escape
    // runBoundedPool's Promise.all uncaught, aborting every other row's send mid-flight
    // and leaving the caller's await on runImport() rejected with nothing to show.
    const rows = [{ name: 'good-1' }, { name: 'bad' }, { name: 'good-2' }];
    const postBatch = async (ops) => ({ committed: true, operations: [{ id: 'row', ok: true, recordId: `REC-${ops[0].body.name}` }] });
    const buildRowOperations = (row) => {
      if (row.name === 'bad') throw new Error('country could not be resolved');
      return [{ id: 'row', spec: 's', entity: 'e', body: row }];
    };
    const { results } = await runImport(rows, { buildRowOperations, postBatch, concurrency: 3 });
    assert.equal(results.length, 3);
    const good1 = results.find((r) => r.row.name === 'good-1');
    const bad = results.find((r) => r.row.name === 'bad');
    const good2 = results.find((r) => r.row.name === 'good-2');
    assert.equal(good1.status, SEND_STATUS.OK);
    assert.equal(good2.status, SEND_STATUS.OK);
    assert.equal(bad.status, SEND_STATUS.FAILED);
    assert.equal(bad.error.message, 'country could not be resolved');
  });

  it('regression: an async buildRowOperations rejection is isolated the same way as a synchronous throw', async () => {
    const rows = [{ name: 'good' }, { name: 'bad' }];
    const postBatch = async (ops) => ({ committed: true, operations: [{ id: 'row', ok: true, recordId: `REC-${ops[0].body.name}` }] });
    const buildRowOperations = async (row) => {
      if (row.name === 'bad') throw new Error('async build failure');
      return [{ id: 'row', spec: 's', entity: 'e', body: row }];
    };
    const { results } = await runImport(rows, { buildRowOperations, postBatch });
    const good = results.find((r) => r.row.name === 'good');
    const bad = results.find((r) => r.row.name === 'bad');
    assert.equal(good.status, SEND_STATUS.OK);
    assert.equal(bad.status, SEND_STATUS.FAILED);
    assert.equal(bad.error.message, 'async build failure');
  });
});
