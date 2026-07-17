import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../auth/index.js';
import { createQueryCache } from './queryCache.js';

/* ------------------------------------------------------------------
 * DataProvider
 *
 * Owns the app-wide query cache and enforces session isolation:
 * whenever the authentication identity (token / client / role / org)
 * changes, previously cached business data is cleared so it can never
 * leak across a session, role or organization boundary.
 *
 * Freshness policies are differentiated: `recordStaleTime` applies to
 * records and lists; `catalogStaleTime` to relatively stable
 * catalog / selector data.
 *
 * Place inside <AuthProvider> at the app root:
 *   <AuthProvider>
 *     <DataProvider>
 *       <App />
 *     </DataProvider>
 *   </AuthProvider>
 * ----------------------------------------------------------------*/

const DataContext = createContext(null);

const DEFAULT_RECORD_STALE_TIME = 30_000; // 30s
const DEFAULT_CATALOG_STALE_TIME = 5 * 60_000; // 5min

/** Extract an id from a role/org value that may be an object or a scalar. */
export function idOf(value) {
  if (value && typeof value === 'object') return value.id ?? value.value ?? null;
  return value ?? null;
}

export function DataProvider({
  children,
  cache: providedCache,
  apiBase = null,
  recordStaleTime = DEFAULT_RECORD_STALE_TIME,
  catalogStaleTime = DEFAULT_CATALOG_STALE_TIME,
}) {
  const { token, clientId, selectedRole, selectedOrg } = useAuth();

  // The cache lives for the lifetime of the provider (survives re-renders).
  const cacheRef = useRef(null);
  if (!cacheRef.current) cacheRef.current = providedCache || createQueryCache();
  const cache = cacheRef.current;

  const scope = useMemo(
    () => ({
      auth: token ?? null,
      client: clientId ?? null,
      role: idOf(selectedRole),
      org: idOf(selectedOrg),
    }),
    [token, clientId, selectedRole, selectedOrg],
  );

  // Clear the cache when the identity changes (but not on first mount, so
  // a warm cache passed in via props is preserved).
  const identity = `${scope.auth}|${scope.client}|${scope.role}|${scope.org}`;
  const prevIdentity = useRef(identity);
  useEffect(() => {
    if (prevIdentity.current !== identity) {
      cache.clear();
      prevIdentity.current = identity;
    }
  }, [identity, cache]);

  const value = useMemo(
    () => ({ cache, scope, apiBase, recordStaleTime, catalogStaleTime }),
    [cache, scope, apiBase, recordStaleTime, catalogStaleTime],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDataCache() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useDataCache must be used within a DataProvider');
  return ctx;
}
