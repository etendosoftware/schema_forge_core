import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createQueryKey } from './queryKey.js';
import { useDataCache } from './DataProvider.jsx';

/* ------------------------------------------------------------------
 * useQuery
 *
 * Read a cached resource. Identical keys share one cache entry and one
 * in-flight request across every consumer. The query key is built from
 * the current session scope (auth/client/role/org) plus the resource
 * coordinates, so data can never leak across contexts.
 *
 *   const { data, isLoading, error, refetch, invalidate } = useQuery({
 *     entity: 'Contact',
 *     recordId: id,
 *     fetcher: ({ signal }) => api.get(`/Contact/${id}`, { signal }),
 *   });
 *
 * `kind` selects the freshness policy: 'record' | 'list' use the record
 * stale time; 'catalog' uses the (longer) catalog stale time.
 * ----------------------------------------------------------------*/

export function useQuery({
  spec = null,
  entity = null,
  filters = null,
  parentId = null,
  recordId = null,
  apiBase,
  fetcher,
  staleTime,
  kind = 'record',
  enabled = true,
} = {}) {
  const { cache, scope, apiBase: ctxApiBase, recordStaleTime, catalogStaleTime } = useDataCache();

  const resolvedApiBase = apiBase ?? ctxApiBase;
  const resolvedStaleTime = staleTime ?? (kind === 'catalog' ? catalogStaleTime : recordStaleTime);

  const key = useMemo(
    () =>
      createQueryKey({
        ...scope,
        apiBase: resolvedApiBase,
        spec,
        entity,
        filters,
        parentId,
        recordId,
      }),
    [scope, resolvedApiBase, spec, entity, filters, parentId, recordId],
  );

  const [state, setState] = useState(() => ({
    data: cache.getData(key),
    isLoading: false,
    error: null,
  }));

  // Keep the latest fetcher without making it part of the run identity.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(
    async ({ force = false } = {}) => {
      if (!enabled || !fetcherRef.current) return undefined;
      const controller = new AbortController();
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const data = await cache.fetchQuery({
          key,
          fetcher: (args) => fetcherRef.current(args),
          staleTime: resolvedStaleTime,
          force,
          signal: controller.signal,
        });
        setState({ data, isLoading: false, error: null });
        return data;
      } catch (err) {
        if (err?.name !== 'AbortError') {
          setState((s) => ({ ...s, isLoading: false, error: err }));
        }
        return undefined;
      }
    },
    [cache, key, resolvedStaleTime, enabled],
  );

  useEffect(() => {
    let active = true;
    if (enabled) {
      // Reflect any already-cached value synchronously before refetching.
      const cached = cache.getData(key);
      if (cached !== undefined) setState((s) => ({ ...s, data: cached }));
      run().then(() => {
        if (!active) return;
      });
    }
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key.id, enabled]);

  const refetch = useCallback(() => run({ force: true }), [run]);
  const invalidate = useCallback((pattern) => cache.invalidate(pattern ?? key.descriptor), [cache, key]);

  return { data: state.data, isLoading: state.isLoading, error: state.error, refetch, invalidate, key };
}

/** Alias — reads a cached resource. */
export const useCachedResource = useQuery;
