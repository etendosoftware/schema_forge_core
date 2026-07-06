export class BatchTimeoutError extends Error {
  constructor(message = 'batch request timed out') {
    super(message);
    this.name = 'BatchTimeoutError';
  }
}

export const SEND_STATUS = { OK: 'ok', FAILED: 'failed', UNKNOWN: 'unknown' };

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
    return { status: SEND_STATUS.UNKNOWN, error };
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
  return { status: SEND_STATUS.FAILED, error };
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
    async (row) => {
      let operations;
      try {
        operations = await buildRowOperations(row);
      } catch (error) {
        return { status: SEND_STATUS.FAILED, error };
      }
      return sendRow(operations, { postBatch });
    },
    (result, row, index) => {
      results[index] = { row, ...result };
      completed += 1;
      onProgress?.(completed, attempted.length);
    },
  );

  return { results, truncatedCount };
}
