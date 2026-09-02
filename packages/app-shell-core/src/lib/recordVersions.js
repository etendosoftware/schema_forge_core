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
 * So the value is remembered here, keyed by the record, at the few places that parse a record out
 * of a response, and injected by `apiFetch` on the way out. A call site does not opt in.
 *
 * ## Why the key is (record id, entity) and not the id alone
 *
 * The same record is read through several URLs — the list endpoint, the detail endpoint, a
 * parent's children collection — and written through yet another, so the key cannot be the URL:
 * a row read in a grid and patched inline has to resolve to the same entry, which is exactly the
 * inline-edit case.
 *
 * The id alone is not enough either, because an id is only unique WITHIN a table. Etendo has
 * one-to-one satellite tables that share their parent's primary key: `ad_org` and `ad_orginfo`
 * both key on `ad_org_id`, so for a given organization both rows carry the SAME `id` — with
 * DIFFERENT `updated` values. The Organization window reads `/organization/{orgId}` and
 * `/information/{orgId}` and writes both. Under an id-only key the second GET would overwrite the
 * first one's token and one of the two writes would go out with the other row's version, which
 * the server correctly rejects as a 409 stale_record the user cannot explain or resolve.
 *
 * So the entry for an id is itself a map from entity (the collection segment of the path the
 * record was read through) to `updated`. `null` is a legitimate entity: it is what a reader that
 * has no path context — `useEntity`, which is handed a record, not a URL — records under. See
 * {@link getRecordVersion} for how a lookup resolves across the two.
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
 * Upper bound on tracked record ids, so a long session browsing large grids cannot grow this map
 * without limit. Insertion order in a `Map` is the eviction order, and every read of an entry
 * re-inserts it, making this a plain LRU over the OUTER map (one slot per record id, whatever
 * number of entities that id was read under).
 *
 * Raised from 5000 to 20000 by ETP-5112. The old value came with a docstring calling eviction
 * "effectively unreachable", which was true while `useEntity` was the only writer: it remembered
 * one record at a time. ETP-5112 harvests EVERY row of EVERY list GET that passes through
 * `apiFetch`, and this app's grids ask for `_endRow=200`/`_endRow=500`/`_limit=100` — so 15-25
 * grid reads in a session filled 5000 slots and started evicting rows the user still had on
 * screen. An evicted entry produces exactly the 400 `missing_updated` this ticket removes, except
 * intermittently and only in long sessions, which is far worse to diagnose than the original bug.
 */
const MAX_TRACKED_RECORDS = 20000;

/**
 * record id → (entity | null) → the `updated` value as the server sent it.
 *
 * @type {Map<string, Map<string|null, string>>}
 */
const versions = new Map();

/**
 * Development-only notice that an LRU eviction dropped a tracked record.
 *
 * Gated exactly like `warnUnversionedUpdate` in `auth/api.js`: on `DEV` being explicitly true
 * rather than on `PROD` being false, because outside Vite (a plain `node --test` run)
 * `import.meta.env` is undefined and a `!PROD` check would treat that as development. `MODE` is
 * checked too because Vitest sets `DEV: true, MODE: 'test'`, so the DEV gate alone would print
 * this throughout the vitest suite and force every test that spies on `console.warn` to tolerate
 * it.
 *
 * Silent in production: the user cannot act on it. In development it is the only warning that the
 * cache — not the panel — is the reason a later write comes back 400 `missing_updated`.
 */
function warnEviction(id) {
  const env = import.meta.env;
  if (env?.DEV !== true || env?.MODE === 'test') return;
  // eslint-disable-next-line no-console
  console.warn(
    `[ETP-5112] Record version cache is full (${MAX_TRACKED_RECORDS} ids); evicted the least `
    + `recently used entry (id ${id}). A write to that record will now be refused with 400 `
    + 'missing_updated until it is read again. If this fires in normal use, raise '
    + 'MAX_TRACKED_RECORDS in lib/recordVersions.js.',
  );
}

/**
 * Reads an entry, refreshing its LRU position.
 *
 * Resolution order, most specific first:
 *
 * 1. an exact match on `entity` — the normal case, and the only one that distinguishes the
 *    satellite tables described in the module docstring (`organization` vs `information`);
 * 2. the `null` bucket — what a reader with no path context left behind. `useEntity` receives a
 *    record and does not know which URL produced it, and panels such as `ContactsTable` and
 *    `ContactsFinancialPanel` never read at all: they get `data` through props from `useEntity`
 *    and then PATCH `/businessPartner/{id}`. This step is what keeps those working;
 * 3. the single entry, when the inner map holds exactly one — the id was only ever seen under one
 *    entity, so there is nothing to confuse it with. This covers a write whose path shape did not
 *    yield the same entity string as the read;
 * 4. otherwise `undefined`. Several entities share this id and none of them is the one asked for,
 *    so any answer would be a guess. Returning nothing produces a loud 400 `missing_updated`,
 *    which is strictly better than injecting another row's token and producing a 409
 *    `stale_record` the user cannot explain.
 *
 * @param {string} id record id
 * @param {string|null} [entity] collection the record is being written through
 * @returns {string|undefined} the remembered `updated`, or undefined when never read
 */
export function getRecordVersion(id, entity = null) {
  if (id == null) return undefined;
  const key = String(id);
  const byEntity = versions.get(key);
  if (!byEntity || byEntity.size === 0) return undefined;
  // Re-insert so an actively-written record is the last thing eviction would consider.
  versions.delete(key);
  versions.set(key, byEntity);
  if (byEntity.has(entity)) return byEntity.get(entity);
  if (entity !== null && byEntity.has(null)) return byEntity.get(null);
  if (byEntity.size === 1) return byEntity.values().next().value;
  return undefined;
}

/**
 * Remembers the `updated` of one record, if it carries both an id and an `updated`.
 *
 * Silently ignores anything else — a non-record, a record the backend served without `updated`
 * (a projection, an aggregate row), or a null. Callers sit on hot read paths and must not have to
 * pre-check the shape.
 *
 * Only the bucket named by `entity` is written. In particular a write harvested under a real
 * entity does NOT also refresh that id's `null` bucket, even though the `null` bucket may now be
 * stale: an id can name two different rows (`ad_org` / `ad_orginfo`), and updating one of them
 * says nothing about the other's `updated`. A stale bucket costs at worst a true-looking 409 that
 * a re-read clears; a cross-row refresh would hand out a token for a row nobody read.
 *
 * @param {unknown} record a record parsed out of a response
 * @param {string|null} [entity] collection the record was read through; `null` when the caller
 *   has no path context (see {@link getRecordVersion} step 2)
 * @returns {unknown} `record`, unchanged, so this can be dropped into a pipeline
 */
export function rememberRecordVersion(record, entity = null) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
  const { id, updated } = /** @type {{id?: unknown, updated?: unknown}} */ (record);
  if (id == null || typeof updated !== 'string' || updated === '') return record;
  const key = String(id);
  const byEntity = versions.get(key) || new Map();
  byEntity.set(entity, updated);
  versions.delete(key);
  versions.set(key, byEntity);
  if (versions.size > MAX_TRACKED_RECORDS) {
    // Map iteration is insertion-ordered, so the first key is the least recently used.
    const oldest = versions.keys().next();
    if (!oldest.done) {
      versions.delete(oldest.value);
      warnEviction(oldest.value);
    }
  }
  return record;
}

/**
 * Remembers every record in a collection. Non-arrays are ignored.
 *
 * @param {unknown} rows rows parsed out of a list response
 * @param {string|null} [entity] collection the rows were read through
 * @returns {unknown} `rows`, unchanged
 */
export function rememberRecordVersions(rows, entity = null) {
  if (Array.isArray(rows)) rows.forEach((row) => rememberRecordVersion(row, entity));
  return rows;
}

/**
 * Drops a record's entry. Call after a DELETE, so a later create that reuses the id (an import
 * replaying a fixed key, a test fixture) cannot inherit a version that was never read for it.
 *
 * Without `entity` the whole id is dropped, every entity bucket included. That is deliberate and
 * is what the `useEntity` DELETE path wants: the row is gone, so no bucket for it can still be
 * valid. Pass `entity` only to drop one bucket — e.g. a satellite row deleted on its own while
 * its parent, which shares the id, is still on screen.
 *
 * @param {string} id record id
 * @param {string|null} [entity] when given, drops only this entity's bucket
 */
export function forgetRecordVersion(id, entity = null) {
  if (id == null) return;
  const key = String(id);
  if (entity === null) {
    versions.delete(key);
    return;
  }
  const byEntity = versions.get(key);
  if (!byEntity) return;
  byEntity.delete(entity);
  if (byEntity.size === 0) versions.delete(key);
}

/** Test seam: empties the map so one suite cannot leak versions into the next. */
export function resetRecordVersionsForTests() {
  versions.clear();
}
