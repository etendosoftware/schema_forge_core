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
 * Rows are queried in batches rather than one giant OR: `limit.maxRows` is 5000, and a
 * 5000-term disjunction is both a URL far past what any server accepts and a query plan
 * no index helps. 200 keeps each request comfortably inside a normal URL length.
 */
export const LOOKUP_BATCH_SIZE = 200;

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
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
 * @returns {Promise<Set<string>>} Normalized keys that already exist. Empty on any lookup
 *   failure — a pre-flight check that cannot reach the server must never block an import
 *   the server would have accepted; the send-time duplicate handling still applies.
 */
export async function findExistingKeys({ rows, keyTargets, fetchFn }) {
  if (!keyTargets?.length || typeof fetchFn !== 'function') return new Set();

  const tuples = new Map();
  for (const row of rows) {
    const key = buildLookupKey(row, keyTargets);
    if (key !== null && !tuples.has(key)) {
      tuples.set(key, keyTargets.map((t) => String(row[t] ?? '').trim()));
    }
  }
  if (tuples.size === 0) return new Set();

  const existing = new Set();
  for (const batch of chunk([...tuples.values()], LOOKUP_BATCH_SIZE)) {
    let records;
    try {
      records = await fetchFn(buildExistingKeyCriteria(batch, keyTargets), keyTargets);
    } catch (error) {
      console.warn('[import] existing-record lookup failed; falling back to send-time duplicate handling', error);
      return new Set();
    }
    for (const record of records ?? []) {
      const key = buildLookupKey(record, keyTargets);
      if (key !== null) existing.add(key);
    }
  }
  return existing;
}
