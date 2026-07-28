/* ------------------------------------------------------------------
 * Query keys
 *
 * A query key is the identity of a cached resource. Two reads that
 * resolve to the same key share the same cache entry (and the same
 * in-flight request); two reads that differ in ANY isolating dimension
 * must never collide.
 *
 * Isolating dimensions (per SEC T-01):
 *   auth     — authentication context (token / derived auth id)
 *   client   — client id
 *   role     — selected role id
 *   org      — selected organization id
 *   apiBase  — API base URL
 *   spec     — headless spec / datasource
 *   entity   — entity name
 *   filters  — query filters (order-independent)
 *   parentId — parent record id (child collections)
 *   recordId — single record id
 *
 * The `id` is a deterministic string built from a canonical
 * serialization, so object key order and filter order never change it.
 * ----------------------------------------------------------------*/

const KEY_FIELDS = [
  'auth',
  'client',
  'role',
  'org',
  'apiBase',
  'spec',
  'entity',
  'filters',
  'parentId',
  'recordId',
];

/** Canonical, order-independent serialization used for cache identity. */
export function stableStringify(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function normalizeField(value) {
  if (value === undefined) return null;
  return value;
}

/**
 * Build a query key from the isolating dimensions.
 * @returns {{ id: string, descriptor: object }}
 */
export function createQueryKey(input = {}) {
  const descriptor = {};
  for (const field of KEY_FIELDS) {
    descriptor[field] = normalizeField(input[field]);
  }
  return { id: stableStringify(descriptor), descriptor };
}

/**
 * Partial match used for targeted invalidation. Every field present in
 * `pattern` must equal the descriptor's field; absent fields are wildcards.
 *
 * Examples:
 *   { entity: 'Contact' }               → every Contact list/record/child
 *   { entity: 'Contact', recordId: '1' }→ only that record
 *   { parentId: 'ord-9' }               → only children of that parent
 */
export function matchesQueryKey(descriptor, pattern = {}) {
  if (!descriptor) return false;
  return Object.keys(pattern).every((field) => {
    if (pattern[field] === undefined) return true;
    return stableStringify(normalizeField(descriptor[field])) === stableStringify(normalizeField(pattern[field]));
  });
}
