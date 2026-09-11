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
 * ## Why the entity part is also, sometimes, TOO fine — and who fixes that
 *
 * The same key has the opposite failure in the opposite situation: one window's spec can expose
 * ONE table under SEVERAL generated entity names (Contacts renders `businessPartner`, `customer`,
 * `vendorCreditor` and `employee` over one `C_BPartner` row), which makes four buckets for a
 * single row — and a write through one refreshes only its own, so a stale exact match beats a
 * sibling holding a fresher token. This module carries the MECHANISM for that: an alias table
 * collapsing several names onto one canonical bucket, applied on every read, write and forget.
 *
 * It does NOT carry the POLICY. Which entity names happen to share a table is window-specific
 * knowledge; a window declares its own groups by calling {@link registerEntityAliases} at module
 * load. Nothing is aliased by default, and the satellite case above cannot be broken by aliasing
 * because `ad_org` and `ad_orginfo` are different TABLES, and only names over one table may be
 * registered.
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
 * alias entity name → the canonical entity name its bucket lives under.
 *
 * Empty by default and populated only by {@link registerEntityAliases}: core owns the MECHANISM,
 * the window owns the POLICY. Which generated entity names happen to address one table is
 * window-specific knowledge, and hardcoding it here would make this generic cache depend on the
 * windows that use it.
 *
 * @type {Map<string, string>}
 */
const entityAliases = new Map();

/**
 * Collapses an alias onto its canonical entity, so several names for ONE table share one bucket.
 *
 * Resolution is a single hop by design — chains are collapsed at registration time, see
 * {@link registerEntityAliases}. `null` (the no-path-context bucket) passes through untouched.
 */
function canonicalEntity(entity) {
  return entity == null ? entity : entityAliases.get(entity) || entity;
}

/**
 * Declares that several generated entity names address the SAME database row, so a read through
 * one of them arms a write through another.
 *
 * ## Why a window has to say this
 *
 * The cache key is (record id, entity) for the reason the module docstring gives: an id is only
 * unique within a table, and `ad_org` / `ad_orginfo` are two different rows under one id. That
 * key is also, unavoidably, too fine in the opposite direction: a window's spec can expose ONE
 * table under several entity names (a "Customer" tab and a "Vendor" tab over the same
 * `C_BPartner` row), and those become independent buckets for a single row. A write through one
 * alias then refreshes only its own bucket, and because {@link getRecordVersion} prefers an exact
 * entity match, a STALE exact bucket wins over a sibling holding a fresher token → a 409
 * `stale_record` the user cannot explain.
 *
 * Aliasing by table is safe against the satellite case that motivated the entity part of the key:
 * `ad_org` and `ad_orginfo` are DIFFERENT tables, so they are never aliases of each other. Only
 * names over one table may be registered here — accounting satellites, `intrastat` detail tables
 * and the like stay distinct.
 *
 * ## OPTION B, not built: derive this from the data model instead of declaring it
 *
 * `artifacts/<window>/contract.json` already carries `tableName` per entity, so the alias groups
 * are simply `groupBy(tableName)` over the spec — no hand-written list, no way for a new tab to
 * be forgotten, and the satellite constraint is satisfied by construction (different table ⇒
 * different bucket). It is not done today because the runtime app is configured from NEO
 * (`ETGO_SF_*`), not from `contract.json`, and the frontend never receives `tableName` per entity
 * at runtime. To switch: expose `ETGO_SF_ENTITY.tableName` (or equivalent) in the NEO spec
 * payload, then have the generic spec loader group entities by it and call this function itself —
 * at which point every per-window registration below can be deleted.
 *
 * ## Semantics
 *
 * Registration is ADDITIVE and IDEMPOTENT, never replacing: several windows register
 * independently at module load, and a replacing API would mean the last window loaded silently
 * disarms the others. It never throws — this is a concurrency-token optimisation, and failing a
 * window's module load over it would be wildly out of proportion. On a CONFLICT (an alias already
 * mapped to a different canonical) the FIRST registration wins and the call is ignored, which
 * keeps the outcome deterministic under hot reload and repeated test imports. Invalid input
 * (non-strings, empty strings, an alias equal to its own canonical) is skipped.
 *
 * The canonical name is itself resolved through the table on the way in, so registering B→A after
 * A→X stores B→X rather than a chain this cache would have to walk on every lookup.
 *
 * @param {string} canonical entity name whose bucket the aliases should share
 * @param {string[]} aliases other entity names for the same table
 * @returns {void}
 */
export function registerEntityAliases(canonical, aliases) {
  if (typeof canonical !== 'string' || canonical === '') return;
  if (!Array.isArray(aliases)) return;
  // Collapse a chain now so `canonicalEntity` stays a single map hit.
  const target = entityAliases.get(canonical) || canonical;
  for (const alias of aliases) {
    if (typeof alias !== 'string' || alias === '' || alias === target) continue;
    const existing = entityAliases.get(alias);
    if (existing === target) continue;
    // First registration wins; a later, different claim on the same alias is ignored.
    if (existing !== undefined) continue;
    entityAliases.set(alias, target);
  }
}

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
 * 1. an exact match on `entity` after alias canonicalisation ({@link registerEntityAliases}) —
 *    the normal case, and the only one that distinguishes the satellite tables described in the
 *    module docstring (`organization` vs `information`);
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
  const canonical = canonicalEntity(entity);
  if (byEntity.has(canonical)) return byEntity.get(canonical);
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
  byEntity.set(canonicalEntity(entity), updated);
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
  byEntity.delete(canonicalEntity(entity));
  if (byEntity.size === 0) versions.delete(key);
}

/** Test seam: empties the map so one suite cannot leak versions into the next. */
export function resetRecordVersionsForTests() {
  versions.clear();
}

/**
 * Test seam: drops every registered alias, so a suite that exercises
 * {@link registerEntityAliases} cannot leak its groups into the next one. Deliberately separate
 * from {@link resetRecordVersionsForTests}: aliases are configuration registered once at module
 * load, not per-record state, and the existing `beforeEach` callers must not lose them.
 */
export function resetEntityAliasesForTests() {
  entityAliases.clear();
}

/**
 * Resolves an entity name to the bucket its versions actually live under, applying any groups
 * registered through {@link registerEntityAliases}.
 *
 * Exported for `auth/api.js`, which serialises concurrent writes to ONE record and must key that
 * serialisation exactly the way this cache keys its buckets. If the two disagreed, two aliases of
 * one row would be treated as two records and left to race — which is the defect the alias table
 * exists to prevent, reintroduced one layer up.
 *
 * @param {string|null} entity entity name as derived from the request path
 * @returns {string|null} the canonical bucket name, or `null` passed through untouched
 */
export function canonicalEntityName(entity) {
  return canonicalEntity(entity);
}
