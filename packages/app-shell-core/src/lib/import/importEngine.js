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
  return { status: SEND_STATUS.FAILED, error: response.error };
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
    async (row) => sendRow(buildRowOperations(row), { postBatch }),
    (result, row, index) => {
      results[index] = { row, ...result };
      completed += 1;
      onProgress?.(completed, attempted.length);
    },
  );

  return { results, truncatedCount };
}
