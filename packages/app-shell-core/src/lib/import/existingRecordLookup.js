/**
 * Look up which of a file's rows already exist in the database, so the review queue can
 * mark them Saltada BEFORE the user confirms the import.
 *
 * Why this exists: `dedupeRows` only ever compared rows against each other inside the
 * same file (`dedupe.scope: "file"`). Re-importing a file that was already imported
 * therefore showed every row in **Correctas**; the duplicate was only discovered after
 * the send, when the unique index on `(value, ad_org_id, ad_client_id)` rejected each
 * row and `importEngine.js` reclassified the failure as a benign duplicate. The end
 * result was right (nothing was created) but the user learned it too late, and the row
 * counts they confirmed were a lie.
 *
 * Note this is a *pre-flight* check, not a lock: a record created between the check and
 * the send still collides server-side. That path is unchanged and remains the backstop —
 * this only makes the common case honest.
 *
 * The dedupe key is whatever `window.import.dedupe.key` declares, NOT the entity's unique
 * index. Those differ on purpose: Contacts dedupes on `taxID`, while the only unique index
 * on `c_bpartner` is on `value` (the searchKey, derived from the name). Checking the
 * declared key is what makes two contacts sharing a CIF/NIF under different trade names
 * detectable at all — the database alone never rejects them.
 */

/** Same normalization `dedupeRows.buildKey` uses, so in-file and in-database keys agree. */
export function normalizeKeyPart(value) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Build the composite key for one row, or `null` when any part is blank.
 *
 * A blank part yields `null` (never a match) for the same reason it does in `dedupeRows`:
 * a row that says nothing about the dedupe key cannot be claimed to be a duplicate of
 * anything. Every blank-keyed row is imported, and the server's own constraints stay the
 * backstop.
 */
export function buildLookupKey(row, keyTargets) {
  const parts = keyTargets.map((t) => normalizeKeyPart(row[t]));
  if (parts.some((p) => p === '')) return null;
  return parts.join(' ');
}

/**
 * SmartClient AdvancedCriteria matching any of `rows`' key tuples, i.e. an OR over rows
 * and an AND within each row's key parts. Same shape `useEntity` sends for list filters
 * (`criteria=<JSON>`), so it goes through the exact query path the window already uses —
 * including its org/client security filtering.
 */
export function buildExistingKeyCriteria(keyTuples, keyTargets) {
  const perTuple = keyTuples.map((tuple) => {
    const parts = keyTargets.map((target, i) => ({
      fieldName: target,
      operator: 'equals',
      value: tuple[i],
    }));
    return parts.length === 1
      ? parts[0]
      : { _constructor: 'AdvancedCriteria', operator: 'and', criteria: parts };
  });
  return { _constructor: 'AdvancedCriteria', operator: 'or', criteria: perTuple };
}

/**
 * How many characters of ENCODED criteria one request may carry (ETP-5374).
 *
 * The previous rule was a fixed 200 keys per request, under a comment claiming that "200 keeps
 * each request comfortably inside a normal URL length". It does not: 200 terms serialize to a
 * ~22.000-character query string, and Tomcat's `maxHttpHeaderSize` — 8192 by default, which
 * `Connector port="8080"` does not override — covers the request LINE plus every header. Tomcat
 * answered 400 before the request ever reached the servlet, so duplicate detection died in
 * silence above ~72 distinct keys while working perfectly below it, which is why small test
 * files never caught it.
 *
 * Counting keys cannot be made safe by lowering the number, because the cost of a key is not
 * fixed: a composite `dedupe.key` multiplies the terms per row, and a long key value lengthens
 * each one. So batches are accumulated by LENGTH instead, and the number of keys falls out of it.
 *
 * Why 4000 and not something closer to 8192: the budget covers only the criteria. The rest of
 * the 8192 has to hold the request line's path and its other query params, and above all the
 * `Authorization: Bearer <JWT>` header plus the browser's own — easily 2 KB together. Callers
 * that know their real prefix can pass `criteriaBudget` and tighten or relax this.
 */
export const LOOKUP_CRITERIA_BUDGET = 4000;

/**
 * Hard cap on terms per request, applied on top of the length budget.
 *
 * The length rule alone is what keeps the URL legal; this one survives from the original code
 * for the other half of its rationale, which was never wrong: a disjunction of thousands of
 * terms is a query plan no index helps, however short the keys happen to be.
 */
export const LOOKUP_MAX_BATCH_SIZE = 200;

/**
 * How many lookup requests may be in flight at once.
 *
 * Batching by length rather than by count raises the REQUEST count sharply — 5000 product keys
 * go from 25 requests of 200 to ~136 of ~37, and a composite key to ~455 — so running them one
 * after another would trade a silent failure for a review step that visibly stalls, on exactly
 * the large files this ticket is about. Four is what `window.import.limit.concurrency` already
 * declares for the send itself, and these are cheap indexed reads.
 */
export const LOOKUP_CONCURRENCY = 4;

/**
 * Give up after this many failed batches WITH NONE having succeeded.
 *
 * Batching by length raised the request count from ~25 to ~136 for a full file, and the old
 * code's early `return` on the first failure hid that: when the endpoint is simply broken —
 * a wrong base URL, an expired session, a server that is down — the batches do not fail
 * "sometimes", they all fail, and firing 136 doomed requests is pure cost. It is also not
 * harmless: each one is a chance to trip rate limiting or a 401 handler.
 *
 * The condition is deliberately "failures AND no successes", not "N failures": a run that has
 * answered even once is talking to a working endpoint, so the rest deserve their attempt — which
 * is the whole point of ETP-5374's per-batch isolation and must not be undone here.
 */
export const LOOKUP_FAILURE_ABORT_THRESHOLD = 4;

/** `encodeURIComponent(',')` — what one extra term costs on top of its own encoded length. */
const ENCODED_SEPARATOR_LENGTH = 3;

function encodedLength(value) {
  return encodeURIComponent(JSON.stringify(value)).length;
}

/**
 * Split key tuples into batches whose serialized criteria stays inside the URL budget.
 *
 * The arithmetic is exact rather than an estimate: a disjunction's encoded length is the
 * encoded length of the empty envelope, plus each term's own encoded length, plus three
 * characters per separating comma. Terms encode independently of their position, so nothing
 * here approximates — `buildLookupBatches` and `buildExistingKeyCriteria` cannot disagree, and
 * a test asserts exactly that.
 *
 * A single tuple whose own term already exceeds the budget still gets a batch of its own: it
 * cannot be split further, and sending it is strictly better than dropping it — worst case the
 * server refuses that one batch, which since ETP-5374 no longer discards the others.
 *
 * @param {Array<string[]>} tuples One key tuple per distinct row key.
 * @param {string[]} keyTargets `window.import.dedupe.key`.
 * @returns {Array<Array<string[]>>} The tuples, grouped.
 */
export function buildLookupBatches(tuples, keyTargets, {
  criteriaBudget = LOOKUP_CRITERIA_BUDGET,
  maxBatchSize = LOOKUP_MAX_BATCH_SIZE,
} = {}) {
  const envelope = encodedLength(buildExistingKeyCriteria([], keyTargets));
  const batches = [];
  let current = [];
  let currentLength = envelope;

  for (const tuple of tuples) {
    const termLength = encodedLength(buildExistingKeyCriteria([tuple], keyTargets)) - envelope;
    const cost = current.length === 0 ? termLength : termLength + ENCODED_SEPARATOR_LENGTH;
    const full = current.length >= maxBatchSize || currentLength + cost > criteriaBudget;
    if (current.length > 0 && full) {
      batches.push(current);
      current = [tuple];
      currentLength = envelope + termLength;
    } else {
      current.push(tuple);
      currentLength += cost;
    }
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/**
 * Resolve which dedupe keys already exist server-side.
 *
 * @param {object} params
 * @param {Array<object>} params.rows Mapped rows (target-keyed).
 * @param {string[]} params.keyTargets `window.import.dedupe.key`.
 * @param {(criteria: object, keyTargets: string[]) => Promise<Array<object>>} params.fetchFn
 *   Runs one query and returns the matching records. Injected so this module stays free of
 *   any transport concern and is trivially testable; the app wires the NEO-backed one.
 * @param {number} [params.criteriaBudget] Override for {@link LOOKUP_CRITERIA_BUDGET}.
 * @param {number} [params.maxBatchSize] Override for {@link LOOKUP_MAX_BATCH_SIZE}.
 * @param {number} [params.concurrency] Override for {@link LOOKUP_CONCURRENCY}.
 * @returns {Promise<{existing: Set<string>, complete: boolean, failedBatches: number, totalBatches: number}>}
 *   `existing` holds the normalized keys that already exist. `complete` is false when any batch
 *   failed. NOTHING READS IT YET — surfacing "this check did not finish" in the review screen
 *   was deliberately left out of ETP-5374 — but it is what makes the per-batch isolation below
 *   observable, and it is the hook that change will need. `failedBatches` counts batches that
 *   were ATTEMPTED and failed, so after an abort (see {@link LOOKUP_FAILURE_ABORT_THRESHOLD})
 *   it is smaller than the number left unanswered; `complete` is false either way.
 *
 * ETP-5374 changed this from returning a bare `Set`, for two reasons that are really one:
 *
 * 1. A failing batch used to `return new Set()`, throwing away the batches that had already
 *    answered correctly. One transient network error among twenty-five requests erased all
 *    twenty-five results. Each batch is now isolated, so a failure costs only its own keys.
 * 2. Losing the results was invisible. Every row came back unmatched, which the review queue
 *    renders identically to "checked, and not a duplicate" — the UI asserts something nobody
 *    verified. `complete` is what would let it stop doing that; wiring it up is a separate
 *    change, so for now the flag is reported and not consumed.
 *
 * The fallback itself is unchanged and still correct: a pre-flight check that cannot reach the
 * server must never block an import the server would have accepted, so a failed lookup still
 * imports, and send-time duplicate handling remains the backstop.
 */
export async function findExistingKeys({
  rows, keyTargets, fetchFn, criteriaBudget, maxBatchSize, concurrency = LOOKUP_CONCURRENCY,
}) {
  const nothingToDo = { existing: new Set(), complete: true, failedBatches: 0, totalBatches: 0 };
  if (!keyTargets?.length || typeof fetchFn !== 'function') return nothingToDo;

  const tuples = new Map();
  for (const row of rows) {
    const key = buildLookupKey(row, keyTargets);
    if (key !== null && !tuples.has(key)) {
      tuples.set(key, keyTargets.map((t) => String(row[t] ?? '').trim()));
    }
  }
  if (tuples.size === 0) return nothingToDo;

  const batches = buildLookupBatches([...tuples.values()], keyTargets, { criteriaBudget, maxBatchSize });
  const existing = new Set();
  let failedBatches = 0;
  let succeededBatches = 0;
  let next = 0;

  // A fixed pool of workers pulling from one cursor, rather than `Promise.all` over chunks of
  // `concurrency`: chunked waves idle on the slowest request in each wave, and there are enough
  // batches here for that to add up. Results merge into a Set, so completion order is irrelevant.
  const worker = async () => {
    for (let i = next++; i < batches.length; i = next++) {
      // Nothing has worked so far and enough has been tried to call it: the endpoint is broken,
      // not flaky. Stop rather than finish the remaining requests to be refused one by one.
      if (succeededBatches === 0 && failedBatches >= LOOKUP_FAILURE_ABORT_THRESHOLD) return;
      let records;
      try {
        records = await fetchFn(buildExistingKeyCriteria(batches[i], keyTargets), keyTargets);
      } catch (error) {
        // Keep going. The other batches' answers are still true, and the caller is told how
        // many were lost so it can report a partial check rather than a clean one.
        failedBatches += 1;
        console.warn('[import] existing-record lookup batch failed; its keys are unverified', error);
        continue;
      }
      succeededBatches += 1;
      for (const record of records ?? []) {
        const key = buildLookupKey(record, keyTargets);
        if (key !== null) existing.add(key);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, batches.length)) }, worker),
  );

  return {
    existing,
    complete: failedBatches === 0,
    failedBatches,
    totalBatches: batches.length,
  };
}
