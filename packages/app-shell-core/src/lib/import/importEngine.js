export class BatchTimeoutError extends Error {
  constructor(message = 'batch request timed out') {
    super(message);
    this.name = 'BatchTimeoutError';
  }
}

export const SEND_STATUS = { OK: 'ok', FAILED: 'failed', UNKNOWN: 'unknown', DUPLICATE: 'duplicate' };

/**
 * Etendo's generic AD-level uniqueness-constraint message ("X must be unique") — the same
 * wording for any entity's unique index, not something specific to BusinessPartner
 * (confirmed via a real capture: "There is already a Business Partner with the same
 * (Client, Organization, Search Key). (Client, Organization, Search Key) must be unique.").
 * A row that already exists server-side isn't a failure the user needs to act on or
 * retry — retrying would only repeat the same rejection — so it's classified and reported
 * separately from a genuine FAILED/UNKNOWN outcome.
 */
function isDuplicateKeyError(message) {
  return typeof message === 'string' && /must be unique/i.test(message);
}

/**
 * A validation-error op response (NEO status -4, e.g. a field over its AD column length)
 * carries its message under a THIRD shape, distinct from the plain-failure one above:
 * `detail.response.errors` — a map of field name to message (`checkJsonServiceResponse`'s
 * `NeoResponse.error(SC_BAD_REQUEST, responseJson)` passes the whole raw Etendo response
 * through as-is, not a single translated string). Reproduced via a real import row whose
 * commercial name exceeded `C_BPartner.Value`'s 40-char limit: `{"response":{"status":-4,
 * "errors":{"searchKey":"...Value too long..."}}}`. Joins every field's message (usually
 * just one) into a single readable line rather than picking only the first, in case a row
 * fails several field validations at once.
 */
function firstValidationMessage(errors) {
  if (!errors || typeof errors !== 'object') return null;
  const entries = Object.entries(errors);
  if (entries.length === 0) return null;
  return entries.map(([field, msg]) => `${field}: ${msg}`).join('; ');
}

/**
 * Send one row's operations through the injected postBatch and classify the
 * outcome. `/batch` has no idempotency key (verified against
 * `BatchService.java`), so any failure to get a definite response — a
 * declared timeout or any other rejection — is UNKNOWN, not FAILED: the row
 * may have already committed server-side, and blindly treating it as a safe
 * retry target risks a duplicate create.
 */
export async function sendRow(operations, { postBatch }) {
  let response;
  try {
    response = await postBatch(operations);
  } catch (error) {
    // No structured response to inspect at all — the closest thing to a "trace" is the
    // rejection's own stack, which console.error already loses once this bubbles up
    // through a Promise.all in the bounded pool.
    return { status: SEND_STATUS.UNKNOWN, error: Object.assign(error, { raw: error.raw ?? (error.stack || error.message) }) };
  }
  if (response.committed) {
    const recordId = response.operations?.[0]?.recordId;
    return { status: SEND_STATUS.OK, recordId };
  }
  // BatchService.java's documented failure shape is `{ committed: false, error: { message,
  // ... } }`, but a raw unhandled server exception (a genuine 500, not a graceful
  // transactional rollback) doesn't go through that wrapper at all — it comes back as
  // Etendo's generic error envelope, `{ message: "..." }`, with no `.error` key (verified
  // against a real capture: the exact shape `useBatch`'s runBatch returns unmodified for
  // any non-ok response that happens to parse as JSON). Reading only `response.error` for
  // that shape produced `undefined`, so the real backend exception text was silently
  // dropped and the UI showed nothing more useful than "Unknown error" — logged here so
  // the actual server message is visible in the console for diagnosis, not just discarded.
  const error = response.error ?? { message: response.message || 'Unknown error' };
  if (!response.error) {
    // eslint-disable-next-line no-console
    console.error('[import] /batch returned an unrecognized failure shape — raw response:', response);
  }
  // `error.detail` (when BatchService.java's failureBody set one) is the underlying NEO
  // response for the specific op that got rejected — the actual diagnostic content, not
  // just the generic "Operation 'x' rejected by server" wrapper text. Falls back to a
  // dump of the whole response for the unrecognized-shape case, so there is always
  // *something* to inspect beyond the bare message while this integration is still being
  // debugged (per the user's explicit ask: capture uncontrolled backend errors with their
  // full trace, one at a time, until the pipeline stabilizes).
  const raw = error.raw ?? (error.detail ? JSON.stringify(error.detail, null, 2) : JSON.stringify(response, null, 2));
  // error.message is BatchService.java's own generic wrapper ("Operation 'bp' rejected by
  // server") — always the same text regardless of cause, so isDuplicateKeyError's
  // /must be unique/i check against it can never match. The real diagnostic text (e.g.
  // Etendo's own "... must be unique." message) lives one level deeper, at
  // error.detail.error.message, whenever NeoCrudHandler attached the underlying NEO
  // response as `detail` (verified against a real capture of a duplicate-key /batch
  // failure). Prefer that nested message everywhere this result's error surfaces —
  // both for classification and for what the review queue actually shows the user —
  // falling back to the wrapper text only when there's no nested detail to read. A
  // validation-error op (NEO status -4) uses a third shape instead — detail.response.errors
  // — checked second since a plain-failure op never has both.
  const diagnosticMessage =
    error.detail?.error?.message
    || firstValidationMessage(error.detail?.response?.errors)
    || error.message;
  const status = isDuplicateKeyError(diagnosticMessage) ? SEND_STATUS.DUPLICATE : SEND_STATUS.FAILED;
  return { status, error: { ...error, message: diagnosticMessage, raw } };
}

/**
 * Run a bounded-concurrency pool of async `worker(item)` calls over `items`,
 * calling `onSettle(result, item, index)` as each one finishes. No external
 * dependency — a manual cursor-based worker pool.
 */
async function runBoundedPool(items, concurrency, worker, onSettle) {
  let cursor = 0;
  async function runNext() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const result = await worker(items[index], index);
      onSettle(result, items[index], index);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, runNext);
  await Promise.all(workers);
}

/**
 * Send every row (up to `maxRows`) through `sendRow`, `concurrency` at a
 * time. Rows beyond `maxRows` are never attempted and never appear in
 * `results` — the caller reports `truncatedCount` explicitly rather than
 * silently dropping them.
 */
export async function runImport(rows, { buildRowOperations, postBatch, concurrency = 4, maxRows = 5000, onProgress }) {
  const attempted = rows.slice(0, maxRows);
  const truncatedCount = rows.length - attempted.length;
  const results = new Array(attempted.length);
  let completed = 0;

  await runBoundedPool(
    attempted,
    concurrency,
    // buildRowOperations may itself be async (a composite descriptor awaiting FK
    // resolution) and, unlike postBatch, has no built-in isolation — a descriptor is free
    // to throw (e.g. "country could not be resolved") for a single bad row. Without this
    // try/catch that throw propagates out of runBoundedPool's Promise.all, aborting every
    // other row's send mid-flight (even ones on a different worker slot that were about
    // to succeed) and leaving the caller's await on runImport() rejected with nothing to
    // show the user — reproduced via a real browser run that hung at "Importing... 0%"
    // forever. One row's build failure must show up as that row's own FAILED result,
    // exactly like a postBatch rejection already does in sendRow, never take the whole
    // batch down.
    // `operations` is threaded into every result (success or failure) — not just used
    // internally — so a caller building a diagnostic report (which row, what request was
    // actually sent) has it without needing to recompute buildRowOperations itself.
    async (row) => {
      let operations;
      try {
        operations = await buildRowOperations(row);
      } catch (error) {
        return { status: SEND_STATUS.FAILED, error, operations: null };
      }
      const result = await sendRow(operations, { postBatch });
      return { ...result, operations };
    },
    (result, row, index) => {
      results[index] = { row, ...result };
      completed += 1;
      onProgress?.(completed, attempted.length);
    },
  );

  return { results, truncatedCount };
}
