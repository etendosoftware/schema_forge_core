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

  it('returns FAILED on a committed:false response, surfacing a friendly message with the raw text preserved on error.raw', async () => {
    // ETP-4669: an unrecognized backend message is no longer shown to the user verbatim —
    // it is classified to a friendly generic fallback, while the raw text stays on error.raw
    // for the console/telemetry and the system-error dialog's report.
    const postBatch = async () => ({ committed: false, failedAt: { index: 0 }, error: { message: 'Rejected' } });
    const result = await sendRow([{ id: 'row' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.FAILED);
    assert.notEqual(result.error.message, 'Rejected');
    assert.match(result.error.message, /could not be imported/i);
    assert.ok(result.error.raw.includes('Rejected'), `expected raw to preserve the backend text, got: ${result.error.raw}`);
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
    // ETP-4669: the user sees a friendly duplicate message, not the raw AD text (which
    // names technical field groups). The raw text is preserved on error.raw.
    assert.match(result.error.message, /already exists/i);
    assert.ok(!result.error.message.includes('Business Partner'), `expected no raw AD text leak, got: ${result.error.message}`);
    assert.ok(result.error.raw.includes('must be unique'), `expected raw to preserve the backend text, got: ${result.error.raw}`);
  });

  it('regression: a real /batch failure with a non-duplicate nested message stays FAILED and preserves the raw text on error.raw', async () => {
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
    // ETP-4669: unrecognized backend text is not shown verbatim — a friendly generic
    // message is shown, with the real text kept on error.raw for the report.
    assert.match(result.error.message, /could not be imported/i);
    assert.ok(result.error.raw.includes('Could not find Sequence for: EM_Etgo_Identifier'), `expected raw to preserve the backend text, got: ${result.error.raw}`);
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

  // ETP-5350 / QA point 11 — the rejection path never reached classifyImportError, so the
  // thrown Error's own message WAS the user-facing text. Every throw that can land here is
  // English, hardcoded at its throw site: `Batch failed (500)` (useBatch.js), `Unauthorized`
  // (apiFetch's 401 branch), the browser's `Failed to fetch`. That text went straight into the
  // review-queue row and into the blocking ImportSystemErrorDialog's red line, in a session
  // that was Spanish everywhere else — the exact leak the committed-failure branch already
  // guards against, on the one path that skipped the guard.
  describe('rejection path — classified and localized like any other outcome (ETP-5350)', () => {
    const translations = {
      importErrorServerFailure: 'El servidor rechazó la petición (error {status}).',
      importErrorSessionExpired: 'Tu sesión ha caducado.',
      importErrorConnection: 'No se pudo conectar con el servidor.',
      importErrorTimeout: 'El servidor tardó demasiado en responder.',
      importErrorUnknown: 'Error desconocido.',
    };
    const translate = (key, params = {}) => {
      const text = translations[key];
      if (!text) return key;
      return Object.keys(params).reduce((acc, p) => acc.replace(`{${p}}`, params[p]), text);
    };

    it('localizes a non-JSON HTTP failure and keeps the English throw text out of the message', async () => {
      // The real useBatch.js shape: a non-ok response whose body is not JSON at all (a raw
      // servlet-container error page), thrown as `Batch failed (<status>)` with the page text
      // preserved on `.raw`.
      const postBatch = async () => {
        const err = new Error('Batch failed (500)');
        err.raw = '<html>Internal Server Error</html>';
        throw err;
      };
      const result = await sendRow([{ id: 'row' }], { postBatch, translate });
      assert.equal(result.status, SEND_STATUS.UNKNOWN);
      assert.equal(result.error.message, 'El servidor rechazó la petición (error 500).');
      assert.ok(!/Batch failed/.test(result.error.message), `expected no English leak, got: ${result.error.message}`);
    });

    it('prefers a messageKey the thrower attached over parsing its English text', async () => {
      // Same contract parseDelimited/parseXlsx already use: the throw site declares the key
      // and its params, so the message never has to be re-derived from prose.
      const postBatch = async () => {
        const err = new Error('Batch failed (503)');
        err.messageKey = 'importErrorServerFailure';
        err.params = { status: 503 };
        throw err;
      };
      const result = await sendRow([{ id: 'row' }], { postBatch, translate });
      assert.equal(result.error.message, 'El servidor rechazó la petición (error 503).');
    });

    it('localizes an expired session (apiFetch throws a bare `Unauthorized`)', async () => {
      const postBatch = async () => { throw new Error('Unauthorized'); };
      const result = await sendRow([{ id: 'row' }], { postBatch, translate });
      assert.equal(result.error.message, 'Tu sesión ha caducado.');
    });

    it('localizes a dropped connection (the browser throws its own TypeError)', async () => {
      const postBatch = async () => { throw new TypeError('Failed to fetch'); };
      const result = await sendRow([{ id: 'row' }], { postBatch, translate });
      assert.equal(result.error.message, 'No se pudo conectar con el servidor.');
    });

    it('localizes a timeout by the error name, not only by its prose', async () => {
      const postBatch = async () => { throw new BatchTimeoutError(); };
      const result = await sendRow([{ id: 'row' }], { postBatch, translate });
      assert.equal(result.error.message, 'El servidor tardó demasiado en responder.');
    });

    it('preserves the original English text on error.raw — nothing diagnostic is lost', async () => {
      const postBatch = async () => {
        const err = new Error('Batch failed (500)');
        err.raw = '<html>Internal Server Error</html>';
        throw err;
      };
      const result = await sendRow([{ id: 'row' }], { postBatch, translate });
      assert.ok(result.error.raw.includes('Batch failed (500)'), `expected raw to keep the throw text, got: ${result.error.raw}`);
      assert.ok(result.error.raw.includes('Internal Server Error'), `expected raw to keep the server body, got: ${result.error.raw}`);
    });

    it('falls back to the English default when no translate is injected — never to the raw throw text', async () => {
      const postBatch = async () => { throw new Error('Batch failed (500)'); };
      const result = await sendRow([{ id: 'row' }], { postBatch });
      assert.notEqual(result.error.message, 'Batch failed (500)');
      assert.match(result.error.message, /server/i);
    });

    it('an unrecognizable rejection gets the generic unknown message, not its own prose', async () => {
      const postBatch = async () => { throw new Error('kaboom'); };
      const result = await sendRow([{ id: 'row' }], { postBatch, translate });
      assert.equal(result.error.message, 'Error desconocido.');
    });
  });

  it('regression (ETP-4669): an uncontrolled backend leak ({ message } shape) never reaches the user as-is — friendly message, raw kept on error.raw', async () => {
    // Confirmed via a live capture: an unhandled server-side exception (a genuine 500, not
    // a graceful BatchService.java transactional rollback) comes back as Etendo's generic
    // envelope, `{ message: "..." }`, with no `.error` key. The exception text here is an
    // unserialized Redis CachedSet reference (the sibling ETP-4668 backend bug) — exactly
    // the kind of raw, meaningless-to-the-user leak that must NOT be shown in the bubble.
    // It is classified to a friendly generic message; the raw text stays on error.raw for
    // the system-error dialog's report and the console.
    const postBatch = async () => ({ message: 'Invalid value for OBTIKTaxIDKey: some.CachedSet@1a2b3c' });
    const result = await sendRow([{ id: 'row' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.FAILED);
    assert.ok(!result.error.message.includes('CachedSet'), `expected the raw leak to be hidden from the user, got: ${result.error.message}`);
    assert.match(result.error.message, /could not be imported/i);
    assert.ok(result.error.raw.includes('CachedSet'), `expected raw to preserve the backend text, got: ${result.error.raw}`);
  });

  it('regression: falls back to a friendly generic message when the response has neither shape', async () => {
    const postBatch = async () => ({});
    const result = await sendRow([{ id: 'row' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.FAILED);
    assert.match(result.error.message, /could not be imported/i);
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
    assert.ok(result.error.raw.includes('Gateway error: upstream connection reset'), `expected the captured body to survive, got: ${result.error.raw}`);
    assert.ok(!result.error.raw.includes('at '), `expected the body, not the stack, got: ${result.error.raw}`);
    // ETP-5350: the throw's own text joins it rather than replacing it. It stopped being the
    // user-facing message, so the report is now the only place `Batch failed (502)` survives —
    // and that line is what tells support which HTTP status the browser actually saw.
    assert.ok(result.error.raw.includes('Batch failed (502)'), `expected the throw text to be kept too, got: ${result.error.raw}`);
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
    // ETP-4669: a "value too long" validation is classified to a friendly message; the raw
    // field-level text (which leaks the technical field name searchKey) is kept on error.raw.
    assert.match(result.error.message, /too long/i);
    assert.ok(!result.error.message.includes('searchKey'), `expected no technical field-name leak, got: ${result.error.message}`);
    assert.ok(!result.error.message.includes("rejected by server"), `expected the generic wrapper text to be replaced, got: ${result.error.message}`);
    assert.ok(result.error.raw.includes('Value too long'), `expected raw to preserve the validation text, got: ${result.error.raw}`);
  });

  it('regression: joins multiple field validation messages from error.detail.response.errors into the raw trace', async () => {
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
    // ETP-4669: the user sees one friendly message; the joined field-level detail (both the
    // searchKey and email messages) is preserved on error.raw for the report.
    assert.match(result.error.message, /too long|could not be imported/i);
    assert.ok(!result.error.message.includes('searchKey'), `expected no technical field-name leak, got: ${result.error.message}`);
    assert.ok(result.error.raw.includes('searchKey') && result.error.raw.includes('Value too long'), `expected raw to include the searchKey detail, got: ${result.error.raw}`);
    assert.ok(result.error.raw.includes('email') && result.error.raw.includes('Invalid email format'), `expected raw to include the email detail, got: ${result.error.raw}`);
  });

  it('regression: prefers error.detail.error.message over error.detail.response.errors when both are present (classification priority)', async () => {
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
    // The nested duplicate message (detail.error.message) wins over the value-too-long
    // validation shape, so the outcome is DUPLICATE and the raw duplicate text is preserved.
    assert.equal(result.status, SEND_STATUS.DUPLICATE);
    assert.match(result.error.message, /already exists/i);
    assert.ok(result.error.raw.includes('must be unique'), `expected raw to preserve the duplicate text, got: ${result.error.raw}`);
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
