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

  it('regression: classifies a unique-constraint rejection as DUPLICATE, not FAILED — nothing for the user to fix or retry', async () => {
    // Reproduced via a real import run: re-sending a row whose BusinessPartner already
    // exists (Client, Org, SearchKey unique index) rejects with Etendo's generic AD-level
    // uniqueness message — the same wording for any entity's unique index, not something
    // specific to BusinessPartner. Retrying would only repeat the identical rejection, so
    // this must not be surfaced as an actionable failure.
    const postBatch = async () => ({
      committed: false,
      failedAt: { id: 'bp' },
      error: { message: 'There is already a Business Partner with the same (Client, Organization, Search Key). (Client, Organization, Search Key) must be unique.', status: 500 },
    });
    const result = await sendRow([{ id: 'bp' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.DUPLICATE);
  });

  it('regression: a real /batch failure nests the duplicate-key message under error.detail.error.message, not error.message — must still classify as DUPLICATE and surface the real message', async () => {
    // BatchService.java's real shape: the top-level error.message is ALWAYS the generic
    // "Operation 'x' rejected by server" wrapper — never the actual diagnostic text. The
    // real message (Etendo's own duplicate-key text) lives one level deeper, at
    // error.detail.error.message, for this specific write-rejection failure path.
    const postBatch = async () => ({
      committed: false,
      failedAt: { index: 0, id: 'bp' },
      error: {
        status: 500,
        message: "Operation 'bp' rejected by server",
        detail: {
          error: {
            message: 'There is already a Business Partner with the same (Client, Organization, Search Key). (Client, Organization, Search Key) must be unique. You must change the values entered.',
            status: 500,
          },
        },
      },
    });
    const result = await sendRow([{ id: 'bp' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.DUPLICATE);
    assert.equal(
      result.error.message,
      'There is already a Business Partner with the same (Client, Organization, Search Key). (Client, Organization, Search Key) must be unique. You must change the values entered.',
    );
  });

  it('regression: a real /batch failure with a non-duplicate nested message surfaces that message and stays FAILED', async () => {
    const postBatch = async () => ({
      committed: false,
      failedAt: { index: 0, id: 'bp' },
      error: {
        status: 500,
        message: "Operation 'bp' rejected by server",
        detail: { error: { message: 'Could not find Sequence for: EM_Etgo_Identifier', status: 500 } },
      },
    });
    const result = await sendRow([{ id: 'bp' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.FAILED);
    assert.equal(result.error.message, 'Could not find Sequence for: EM_Etgo_Identifier');
  });

  it('regression: a genuinely different failure message is still classified as FAILED, not DUPLICATE', async () => {
    const postBatch = async () => ({ committed: false, failedAt: { index: 0 }, error: { message: 'Could not find Sequence for: EM_Etgo_Identifier' } });
    const result = await sendRow([{ id: 'row' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.FAILED);
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

  it('regression: surfaces the real message from a raw exception response ({ message } shape, not the documented { error } wrapper)', async () => {
    // Confirmed via a live capture: an unhandled server-side exception (a genuine 500,
    // not a graceful BatchService.java transactional rollback) never goes through the
    // documented `{ committed: false, error: { message, ... } }` shape at all — it comes
    // back as Etendo's generic error envelope, `{ message: "..." }`, with no `.error` key
    // (useBatch's runBatch returns this unmodified whenever the non-ok body happens to
    // parse as JSON). Reading only `response.error` for that shape silently produced
    // `error: undefined`, so the actual backend exception text never reached the UI —
    // the user saw nothing more useful than a generic "Unknown error" bubble.
    const postBatch = async () => ({ message: 'Invalid value for OBTIKTaxIDKey: some.CachedSet@1a2b3c' });
    const result = await sendRow([{ id: 'row' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.FAILED);
    assert.equal(result.error.message, 'Invalid value for OBTIKTaxIDKey: some.CachedSet@1a2b3c');
  });

  it('regression: falls back to a generic message only when the response has neither shape', async () => {
    const postBatch = async () => ({});
    const result = await sendRow([{ id: 'row' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.FAILED);
    assert.equal(result.error.message, 'Unknown error');
  });

  it('regression: carries error.detail through as a readable raw trace (the underlying NEO error, not just the generic wrapper message)', async () => {
    // BatchService.java's failureBody() attaches the per-op NEO response as error.detail
    // when one is available — the actual diagnostic content behind a generic wrapper
    // message like "Operation 'bp' rejected by server". Without surfacing this, the user
    // has no way to see what actually failed short of digging through the Network tab.
    const detail = { response: { error: { message: 'Invalid value for OBTIKTaxIDKey' } } };
    const postBatch = async () => ({ committed: false, failedAt: { id: 'bp' }, error: { status: 500, message: "Operation 'bp' rejected by server", detail } });
    const result = await sendRow([{ id: 'row' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.FAILED);
    assert.ok(result.error.raw.includes('Invalid value for OBTIKTaxIDKey'), `expected raw trace to include the detail, got: ${result.error.raw}`);
  });

  it('regression: falls back to dumping the whole response as raw when there is no error.detail to read', async () => {
    const postBatch = async () => ({ message: 'Invalid value for OBTIKTaxIDKey' });
    const result = await sendRow([{ id: 'row' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.FAILED);
    assert.ok(result.error.raw.includes('Invalid value for OBTIKTaxIDKey'), `expected raw dump to include the message, got: ${result.error.raw}`);
  });

  it('regression: an UNKNOWN result (postBatch throw) carries the error\'s own stack as raw', async () => {
    const postBatch = async () => { throw new Error('network dropped'); };
    const result = await sendRow([{ id: 'row' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.UNKNOWN);
    assert.ok(result.error.raw, 'expected a raw trace to be present');
  });

  it('regression: preserves an explicitly-set error.raw (e.g. from useBatch\'s non-JSON-body case) instead of overwriting it with the stack', async () => {
    const postBatch = async () => { const e = new Error('Batch failed (502)'); e.raw = 'Gateway error: upstream connection reset'; throw e; };
    const result = await sendRow([{ id: 'row' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.UNKNOWN);
    assert.equal(result.error.raw, 'Gateway error: upstream connection reset');
  });

  it('regression: a validation-error op (NEO status -4) nests its message under error.detail.response.errors — must surface the joined field message, not the generic wrapper', async () => {
    // Reproduced via a real import row whose commercial name exceeded C_BPartner.Value's
    // 40-char limit — this is a THIRD shape, distinct from both error.detail.error.message
    // (plain failure) and the flat error.message wrapper: a map of field name -> message
    // under error.detail.response.errors.
    const postBatch = async () => ({
      committed: false,
      failedAt: { index: 0, id: 'bp' },
      error: {
        status: 400,
        message: "Operation 'bp' rejected by server",
        detail: { response: { status: -4, errors: { searchKey: 'BusinessPartner.searchKey: Value too long. Length 48, maximum allowed 40 [Guajardo Dávila, Lugo Paz y Muro Serna Asociados]' } } },
      },
    });
    const result = await sendRow([{ id: 'bp' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.FAILED);
    assert.ok(result.error.message.includes('searchKey'), `expected message to include the field name, got: ${result.error.message}`);
    assert.ok(result.error.message.includes('Value too long'), `expected message to include the validation text, got: ${result.error.message}`);
    assert.ok(!result.error.message.includes("rejected by server"), `expected the generic wrapper text to be replaced, got: ${result.error.message}`);
  });

  it('regression: joins multiple field validation messages from error.detail.response.errors into one readable string', async () => {
    const postBatch = async () => ({
      committed: false,
      failedAt: { index: 0, id: 'bp' },
      error: {
        status: 400,
        message: "Operation 'bp' rejected by server",
        detail: {
          response: {
            status: -4,
            errors: {
              searchKey: 'BusinessPartner.searchKey: Value too long. Length 48, maximum allowed 40',
              email: 'Invalid email format',
            },
          },
        },
      },
    });
    const result = await sendRow([{ id: 'bp' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.FAILED);
    assert.ok(result.error.message.includes('searchKey'), `expected message to include searchKey, got: ${result.error.message}`);
    assert.ok(result.error.message.includes('Value too long'), `expected message to include the searchKey text, got: ${result.error.message}`);
    assert.ok(result.error.message.includes('email'), `expected message to include email, got: ${result.error.message}`);
    assert.ok(result.error.message.includes('Invalid email format'), `expected message to include the email text, got: ${result.error.message}`);
  });

  it('regression: prefers error.detail.error.message over error.detail.response.errors when both happen to be present (documented priority order)', async () => {
    const postBatch = async () => ({
      committed: false,
      failedAt: { index: 0, id: 'bp' },
      error: {
        status: 500,
        message: "Operation 'bp' rejected by server",
        detail: {
          error: { message: 'There is already a Business Partner with the same (Client, Organization, Search Key). (Client, Organization, Search Key) must be unique.', status: 500 },
          response: { status: -4, errors: { searchKey: 'Value too long. Length 48, maximum allowed 40' } },
        },
      },
    });
    const result = await sendRow([{ id: 'bp' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.DUPLICATE);
    assert.equal(
      result.error.message,
      'There is already a Business Partner with the same (Client, Organization, Search Key). (Client, Organization, Search Key) must be unique.',
    );
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

  it('regression: threads the actual built operations through on every result (success or failure), so a caller can report exactly what was sent', async () => {
    const rows = [{ name: 'good' }, { name: 'bad' }];
    const postBatch = async (ops) => (ops[0].body.name === 'bad'
      ? { committed: false, failedAt: { index: 0 }, error: { message: 'rejected' } }
      : { committed: true, operations: [{ id: 'row', ok: true, recordId: 'REC-good' }] });
    const buildRowOperations = (row) => [{ id: 'row', spec: 's', entity: 'e', body: row }];
    const { results } = await runImport(rows, { buildRowOperations, postBatch });
    const good = results.find((r) => r.row.name === 'good');
    const bad = results.find((r) => r.row.name === 'bad');
    assert.deepEqual(good.operations, [{ id: 'row', spec: 's', entity: 'e', body: { name: 'good' } }]);
    assert.deepEqual(bad.operations, [{ id: 'row', spec: 's', entity: 'e', body: { name: 'bad' } }]);
  });

  it('regression: a buildRowOperations throw still reports operations: null (there was nothing to send)', async () => {
    const rows = [{ name: 'bad' }];
    const postBatch = async () => ({ committed: true, operations: [{ id: 'row', ok: true, recordId: 'X' }] });
    const buildRowOperations = () => { throw new Error('country could not be resolved'); };
    const { results } = await runImport(rows, { buildRowOperations, postBatch });
    assert.equal(results[0].operations, null);
  });
});
