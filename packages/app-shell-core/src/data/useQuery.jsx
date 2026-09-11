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
  const { cache, scope, apiBase: ctxApiBase, recordStaleTime, catalogStaleTime,
    isSessionReady, captureSession, isCurrentSession } = useDataCache();
  const canRun = enabled && isSessionReady !== false;
  const requestRef = useRef(0);

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
    key: key.id,
    data: cache.getData(key),
    isLoading: false,
    error: null,
  }));

  // Keep the latest fetcher without making it part of the run identity.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(
    async ({ force = false } = {}) => {
      if (!canRun || !fetcherRef.current) return undefined;
      const requestId = ++requestRef.current;
      const sessionSnapshot = captureSession?.();
      const current = () => requestId === requestRef.current
        && (!isCurrentSession || isCurrentSession(sessionSnapshot));
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
        if (!current()) return undefined;
        setState({ key: key.id, data, isLoading: false, error: null });
        return data;
      } catch (err) {
        if (current() && err?.name !== 'AbortError') {
          setState((s) => ({ ...s, isLoading: false, error: err }));
        }
        return undefined;
      }
    },
    [cache, key, resolvedStaleTime, canRun, captureSession, isCurrentSession],
  );

  useEffect(() => {
    if (canRun) {
      // Reflect any already-cached value synchronously before refetching.
      const cached = cache.getData(key);
      setState({ key: key.id, data: cached, isLoading: true, error: null });
      run();
    }
    return () => {
      requestRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key.id, canRun]);

  const refetch = useCallback(() => run({ force: true }), [run]);
  const invalidate = useCallback((pattern) => cache.invalidate(pattern ?? key.descriptor), [cache, key]);

  const visible = canRun && state.key === key.id;
  return { data: visible ? state.data : undefined, isLoading: canRun && (!visible || state.isLoading),
    error: visible ? state.error : null, refetch, invalidate, key };
}

/** Alias — reads a cached resource. */
export const useCachedResource = useQuery;
