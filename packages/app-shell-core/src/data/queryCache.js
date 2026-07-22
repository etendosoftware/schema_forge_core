import { createQueryKey, matchesQueryKey } from './queryKey.js';

/* ------------------------------------------------------------------
 * Query cache (framework-agnostic)
 *
 * An in-memory store of resolved resources with:
 *   - request deduplication (concurrent identical reads share one call)
 *   - freshness windows (fresh entries are reused without a request)
 *   - forced refresh (bypass freshness)
 *   - targeted invalidation (mark matching entries stale)
 *   - cancellation / failure safety (never store a failed or aborted read)
 *
 * Business data is held in memory only — this module never touches
 * localStorage / sessionStorage.
 * ----------------------------------------------------------------*/

const DEFAULT_STALE_TIME = 30_000; // 30s — records / lists

function normalizeKey(key) {
  if (key && typeof key === 'object' && typeof key.id === 'string' && key.descriptor) {
    return key;
  }
  return createQueryKey(key || {});
}

export function createQueryCache({ now = () => Date.now(), defaultStaleTime = DEFAULT_STALE_TIME } = {}) {
  /** id -> { descriptor, data, updatedAt, stale } */
  const entries = new Map();
  /** id -> Promise (in-flight fetch, shared by concurrent readers) */
  const inflight = new Map();

  function isFresh(entry, staleTime) {
    if (!entry || entry.stale) return false;
    return now() - entry.updatedAt < staleTime;
  }

  function getEntry(key) {
    return entries.get(normalizeKey(key).id) || null;
  }

  function getData(key) {
    return getEntry(key)?.data;
  }

  /**
   * Resolve a query. Returns cached data when fresh; otherwise runs
   * `fetcher({ signal, key })` exactly once for concurrent callers.
   */
  function fetchQuery({ key, fetcher, staleTime = defaultStaleTime, force = false, signal } = {}) {
    const { id, descriptor } = normalizeKey(key);
    const existing = entries.get(id);

    if (!force && isFresh(existing, staleTime)) {
      return Promise.resolve(existing.data);
    }

    // Deduplicate: an identical read already in flight shares its promise.
    const pending = inflight.get(id);
    if (pending) return pending;

    const promise = Promise.resolve()
      .then(() => fetcher({ signal, key: descriptor }))
      .then((data) => {
        // An abort that landed while the request was resolving must not
        // be stored as a successful entry.
        if (signal?.aborted) {
          throw new DOMException('The operation was aborted.', 'AbortError');
        }
        entries.set(id, { descriptor, data, updatedAt: now(), stale: false });
        return data;
      })
      .finally(() => {
        inflight.delete(id);
      });

    inflight.set(id, promise);
    return promise;
  }

  /**
   * Mark every entry matching `pattern` as stale so the next read
   * refetches. Returns the number of entries marked.
   */
  function invalidate(pattern = {}) {
    let count = 0;
    for (const entry of entries.values()) {
      if (matchesQueryKey(entry.descriptor, pattern)) {
        entry.stale = true;
        count += 1;
      }
    }
    return count;
  }

  /** Drop a single entry entirely. */
  function remove(key) {
    return entries.delete(normalizeKey(key).id);
  }

  /** Wipe everything — used when the session / role / org changes. */
  function clear() {
    entries.clear();
    inflight.clear();
  }

  return {
    fetchQuery,
    invalidate,
    remove,
    clear,
    getEntry,
    getData,
    isFresh: (key, staleTime = defaultStaleTime) => isFresh(entries.get(normalizeKey(key).id), staleTime),
    has: (key) => entries.has(normalizeKey(key).id),
    get size() {
      return entries.size;
    },
  };
}
