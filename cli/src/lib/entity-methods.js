/**
 * entity-methods.js — Single source of truth for the per-entity HTTP method
 * flags stored on `ETGO_SF_ENTITY` (`ISGET`, `ISGETBYID`, `ISPOST`, `ISPUT`,
 * `ISPATCH`, `ISDELETE`).
 *
 * NEO Headless enforces those flags on the REST path: a disabled method answers
 * `405 "<METHOD> not enabled for <entity>"`, and MCP's `neo_discover` reports the
 * remaining set as `{"methods":[...],"readOnly":true}`. Before ETP-4254 the
 * pipeline could not express them — `populateWindowSpec` took a single
 * `includeAllMethods` boolean that meant either "all Y" or "all N" (the latter
 * leaving an entity with NO read access, which is never a legitimate outcome),
 * and `neo-delta.js` hardcoded all-Y. A monitor/log window declared read-only in
 * `decisions.json` was therefore silently re-opened for writes on the next
 * `make regen PUSH_TO_NEO=1`.
 *
 * Declaration (decisions.json)
 * ----------------------------
 *   window.readOnly: true                    → every entity of the window is
 *                                              read-only (GET + GETBYID only)
 *   entities.<key>.readOnly: true            → that entity is read-only
 *   entities.<key>.readOnly: false           → opt this entity OUT of a
 *                                              read-only window (all methods)
 *   entities.<key>.methods: ["GET","PUT"]    → explicit allowlist
 *
 * Precedence: `entities.<key>.methods` > `entities.<key>.readOnly` >
 * `window.readOnly` > default (all six methods).
 *
 * Invariant: GET and GETBYID are ALWAYS granted, whatever is declared. An
 * entity with no read access is the pre-ETP-4254 `includeAllMethods=false` bug,
 * not a feature — so the invariant is enforced here, in the resolver, and not by
 * convention at the call sites.
 *
 * Where resolution happens
 * ------------------------
 * The declaration is resolved ONCE, in `resolve-curated.js` (which is the only
 * place that can reliably match a `decisions.entities` key to a curated entity —
 * see `findEntityDecision()`), and lands on the contract as
 * `apiPrediction.crud.<entity>.methods` (emitted only when restricted, so
 * unrestricted windows produce no contract churn) plus the already-existing
 * `apiPrediction.window.readOnly`.
 *
 * BOTH write paths then read the resolved value back off the contract through
 * `resolveContractEntityMethods()`:
 *   - `push-to-neo.js` → `neo-writer.populateWindowSpec()` → live DB UPDATE
 *   - `lib/neo-delta.js` → predicted `ETGO_SF_ENTITY` XML row
 * They cannot diverge, because they share this function and the same input.
 */

/** Canonical order of the NEO HTTP methods. Also the "everything enabled" set. */
export const NEO_HTTP_METHODS = Object.freeze([
  'GET', 'GETBYID', 'POST', 'PUT', 'PATCH', 'DELETE',
]);

/** Methods that are always granted — see the invariant above. */
export const NEO_READ_METHODS = Object.freeze(['GET', 'GETBYID']);

/** camelCase param names accepted by `neo-writer.upsertEntity`. */
const WRITER_FLAG_BY_METHOD = Object.freeze({
  GET: 'isGet',
  GETBYID: 'isGetbyid',
  POST: 'isPost',
  PUT: 'isPut',
  PATCH: 'isPatch',
  DELETE: 'isDelete',
});

/** ETGO_SF_ENTITY column names as they appear in exported sourcedata XML. */
const XML_COLUMN_BY_METHOD = Object.freeze({
  GET: 'ISGET',
  GETBYID: 'ISGETBYID',
  POST: 'ISPOST',
  PUT: 'ISPUT',
  PATCH: 'ISPATCH',
  DELETE: 'ISDELETE',
});

/** Boolean keys used by `apiPrediction.crud.<entity>`. */
const CRUD_KEY_BY_METHOD = Object.freeze({
  GET: 'get',
  GETBYID: 'getById',
  POST: 'post',
  PUT: 'put',
  PATCH: 'patch',
  DELETE: 'delete',
});

/**
 * Canonicalize one declared method token. Case- and separator-insensitive, so
 * `"getById"`, `"GET_BY_ID"` and `"GETBYID"` all resolve to `GETBYID`.
 *
 * @param {unknown} raw
 * @returns {string|null} canonical method name, or null when unrecognized
 */
export function canonicalizeMethod(raw) {
  if (typeof raw !== 'string') return null;
  const key = raw.toUpperCase().replace(/[\s_-]/g, '');
  return Object.hasOwn(WRITER_FLAG_BY_METHOD, key) ? key : null;
}

/**
 * Normalize a declared `methods` allowlist into a canonical, deduplicated,
 * canonically-ordered list with GET + GETBYID force-added.
 *
 * Returns `null` (not an empty list) when `value` is not an array, so callers can
 * tell "nothing declared" apart from "declared, and it resolves to read-only".
 *
 * @param {unknown} value
 * @returns {string[]|null}
 */
export function normalizeMethodList(value) {
  if (!Array.isArray(value)) return null;
  const granted = new Set(NEO_READ_METHODS);
  for (const raw of value) {
    const method = canonicalizeMethod(raw);
    if (method) granted.add(method);
  }
  return NEO_HTTP_METHODS.filter(method => granted.has(method));
}

/**
 * Resolve the enabled method list for one entity from the declared intent.
 *
 * @param {object} [intent]
 * @param {boolean} [intent.windowReadOnly=false] - decisions `window.readOnly`
 * @param {boolean} [intent.entityReadOnly] - decisions `entities.<key>.readOnly`
 *   (`undefined` = undeclared, `false` = explicit opt-out of the window default)
 * @param {unknown} [intent.entityMethods] - decisions `entities.<key>.methods`
 * @returns {string[]} canonically ordered, always containing GET + GETBYID
 */
export function resolveEntityMethods(intent = {}) {
  const { windowReadOnly = false, entityReadOnly, entityMethods } = intent;

  const declared = normalizeMethodList(entityMethods);
  if (declared) return declared;

  // A per-entity declaration always wins over the window-level one, in BOTH
  // directions: `true` restricts an entity of an otherwise-writable window,
  // `false` re-opens one entity of an otherwise read-only window.
  if (entityReadOnly === true) return [...NEO_READ_METHODS];
  if (entityReadOnly === false) return [...NEO_HTTP_METHODS];

  if (windowReadOnly === true) return [...NEO_READ_METHODS];

  // Nothing declared → every method stays enabled. This is what keeps the
  // existing AD_Tab-backed entities untouched by ETP-4254.
  return [...NEO_HTTP_METHODS];
}

/**
 * Compare two canonically-ordered method lists.
 *
 * @param {string[]} a
 * @param {string[]} b
 */
export function sameMethods(a, b) {
  return a.length === b.length && a.every((method, i) => method === b[i]);
}

/**
 * The method set an entity gets when the contract carries NO explicit
 * `crud.<entity>.methods` array — the fallback half of
 * `resolveContractEntityMethods`. Also the emission threshold: the generator
 * writes `methods` exactly when the resolved set differs from this, which keeps
 * unrestricted windows free of contract churn while still pinning the one entity
 * that opts OUT of an otherwise read-only window.
 *
 * @param {boolean} windowReadOnly
 * @returns {string[]}
 */
export function contractFallbackMethods(windowReadOnly) {
  return windowReadOnly === true ? [...NEO_READ_METHODS] : [...NEO_HTTP_METHODS];
}

/**
 * Project a method list onto the camelCase `Y`/`N` params `upsertEntity` takes.
 *
 * @param {string[]} methods
 * @returns {{isGet: string, isGetbyid: string, isPost: string, isPut: string, isPatch: string, isDelete: string}}
 */
export function methodsToWriterFlags(methods) {
  const flags = {};
  for (const method of NEO_HTTP_METHODS) {
    flags[WRITER_FLAG_BY_METHOD[method]] = methods.includes(method) ? 'Y' : 'N';
  }
  return flags;
}

/**
 * Project a method list onto the uppercase ETGO_SF_ENTITY XML columns.
 *
 * @param {string[]} methods
 * @returns {Record<string, string>}
 */
export function methodsToXmlFlags(methods) {
  const flags = {};
  for (const method of NEO_HTTP_METHODS) {
    flags[XML_COLUMN_BY_METHOD[method]] = methods.includes(method) ? 'Y' : 'N';
  }
  return flags;
}

/**
 * Turn OFF the `apiPrediction.crud` booleans for every method that `methods`
 * does not grant, and record the restricted list as `crud.methods`.
 *
 * Only ever disables — never re-enables. That keeps the pre-existing UI-level
 * opt-outs (`window.hideDelete`, `entities.<key>.hideDelete` → `crud.delete =
 * false`) intact: those express "hide the affordance", which is a strictly
 * narrower claim than "the HTTP method is disabled", and must not be undone
 * here.
 *
 * `crud.methods` is emitted ONLY when the resolved set differs from
 * `contractFallbackMethods(windowReadOnly)`, so regenerating a window that
 * declares nothing produces no contract diff, a plain `window.readOnly` window
 * needs no per-entity key either, and the one entity that opts OUT of a read-only
 * window is pinned explicitly.
 *
 * @param {object} crud - a `buildCrudPrediction()` result, mutated in place
 * @param {string[]} methods
 * @param {object} [opts]
 * @param {boolean} [opts.windowReadOnly=false]
 * @returns {object} the same `crud` object
 */
export function applyMethodsToCrudPrediction(crud, methods, opts = {}) {
  for (const method of NEO_HTTP_METHODS) {
    if (!methods.includes(method)) crud[CRUD_KEY_BY_METHOD[method]] = false;
  }
  if (!sameMethods(methods, contractFallbackMethods(opts.windowReadOnly === true))) {
    crud.methods = [...methods];
  }
  return crud;
}

/**
 * Read the resolved method list for an entity back off a generated contract.
 * This is the ONLY function the two write paths (`push-to-neo.js` and
 * `lib/neo-delta.js`) should use, so they cannot disagree.
 *
 * Fallback chain:
 *   1. `apiPrediction.crud.<entityName>.methods` — the resolved allowlist
 *   2. `apiPrediction.window.readOnly` — window-level default, which also covers
 *      AD tabs that have no contract entity at all (excluded entities still get
 *      an ETGO_SF_ENTITY row from `populateWindowSpec`)
 *   3. all six methods — pre-ETP-4254 behaviour, unchanged
 *
 * @param {object|null|undefined} contract - parsed contract.json
 * @param {string} entityName - contract/curated entity name written to NAME
 * @returns {string[]}
 */
export function resolveContractEntityMethods(contract, entityName) {
  const api = contract?.apiPrediction;
  const declared = normalizeMethodList(api?.crud?.[entityName]?.methods);
  if (declared) return declared;
  return contractFallbackMethods(api?.window?.readOnly === true);
}
