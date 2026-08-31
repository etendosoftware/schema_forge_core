/**
 * The `updated` value of every record this client has read (ETP-5073 / DOC-04).
 *
 * ## Why this exists
 *
 * The backend implements optimistic concurrency the way Etendo's core always has: a write must
 * carry the `updated` value of the record as the caller read it, and the server refuses the write
 * when the row has moved on since. Before ETP-5073 our layer stripped `updated` from every write,
 * so the check never evaluated for any entity — two users editing the same document both got a
 * success and the second silently erased the first.
 *
 * Making it mandatory server-side fixes the guarantee but hands the client a plumbing problem:
 * ~41 call sites issue a PATCH/PUT, and requiring each to thread `updated` through by hand means
 * every future one can forget it again — and forgetting is not a visible bug at the call site, it
 * is a 400 in whatever panel the developer was not looking at.
 *
 * So the value is remembered here, keyed by record id, at the few places that parse a record out
 * of a response, and injected by `apiFetch` on the way out. A call site does not opt in.
 *
 * ## Why keyed by record id, not by URL
 *
 * The same record is read through several URLs — the list endpoint, the detail endpoint, a
 * parent's children collection — and written through yet another. Keying by id makes a row read
 * in a grid and patched inline resolve to the same entry, which is exactly the inline-edit case.
 *
 * ## Why a stale entry is safe
 *
 * If this map holds an `updated` older than the row's current value, the write is refused as a
 * conflict — which is CORRECT: something changed the row after we read it, and that is precisely
 * what the caller must be told. The failure mode of this cache is a true conflict report, never a
 * silent overwrite. The dangerous direction (holding a NEWER value than we actually read) cannot
 * occur, because entries are only ever written from a response the client received.
 *
 * ## Why entries are never evicted by age
 *
 * A TTL would reintroduce the original defect on a slow-editing user: the entry expires, the
 * injection finds nothing, and the write either goes unchecked (if we allowed it) or fails for a
 * reason that has nothing to do with concurrency. The map is bounded by
 * {@link MAX_TRACKED_RECORDS} instead, evicting least-recently-used entries, and a dropped entry
 * degrades to "server refuses the write and the UI re-reads" — loud, not silent.
 */

/**
 * Upper bound on tracked records, so a long session browsing large grids cannot grow this map
 * without limit. Insertion order in a `Map` is the eviction order, and every read of an entry
 * re-inserts it, making this a plain LRU. Sized well above any realistic number of records a user
 * holds open at once, so eviction is effectively unreachable in normal use.
 */
const MAX_TRACKED_RECORDS = 5000;

/** @type {Map<string, string>} record id → the `updated` value as the server sent it */
const versions = new Map();

/**
 * Reads an entry, refreshing its LRU position.
 *
 * @param {string} id record id
 * @returns {string|undefined} the remembered `updated`, or undefined when never read
 */
export function getRecordVersion(id) {
  if (id == null) return undefined;
  const key = String(id);
  const value = versions.get(key);
  if (value === undefined) return undefined;
  // Re-insert so an actively-written record is the last thing eviction would consider.
  versions.delete(key);
  versions.set(key, value);
  return value;
}

/**
 * Remembers the `updated` of one record, if it carries both an id and an `updated`.
 *
 * Silently ignores anything else — a non-record, a record the backend served without `updated`
 * (a projection, an aggregate row), or a null. Callers sit on hot read paths and must not have to
 * pre-check the shape.
 *
 * @param {unknown} record a record parsed out of a response
 * @returns {unknown} `record`, unchanged, so this can be dropped into a pipeline
 */
export function rememberRecordVersion(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
  const { id, updated } = /** @type {{id?: unknown, updated?: unknown}} */ (record);
  if (id == null || typeof updated !== 'string' || updated === '') return record;
  const key = String(id);
  versions.delete(key);
  versions.set(key, updated);
  if (versions.size > MAX_TRACKED_RECORDS) {
    // Map iteration is insertion-ordered, so the first key is the least recently used.
    const oldest = versions.keys().next();
    if (!oldest.done) versions.delete(oldest.value);
  }
  return record;
}

/**
 * Remembers every record in a collection. Non-arrays are ignored.
 *
 * @param {unknown} rows rows parsed out of a list response
 * @returns {unknown} `rows`, unchanged
 */
export function rememberRecordVersions(rows) {
  if (Array.isArray(rows)) rows.forEach(rememberRecordVersion);
  return rows;
}

/**
 * Drops a record's entry. Call after a DELETE, so a later create that reuses the id (an import
 * replaying a fixed key, a test fixture) cannot inherit a version that was never read for it.
 *
 * @param {string} id record id
 */
export function forgetRecordVersion(id) {
  if (id != null) versions.delete(String(id));
}

/** Test seam: empties the map so one suite cannot leak versions into the next. */
export function resetRecordVersionsForTests() {
  versions.clear();
}
