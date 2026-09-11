import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../auth/index.js';
import { createApiFetch, authHeaders } from '../auth/api.js';

/* ------------------------------------------------------------------
 * Internal helpers
 * ----------------------------------------------------------------*/

function getApiBase() {
  if (typeof window === 'undefined') return '';
  const path = window.location.pathname;
  const idx = path.indexOf('/web/');
  if (idx === -1) return import.meta.env.VITE_API_BASE || '';
  return path.substring(0, idx);
}

/* ------------------------------------------------------------------
 * Context
 * ----------------------------------------------------------------*/

const CurrencyContext = createContext(null);

/**
 * Place this provider inside <AuthProvider> at the app root so the
 * currency fetch starts as soon as the session is authenticated — before
 * any dashboard or window component mounts and needs the value.
 *
 * @example
 * <AuthProvider>
 *   <CurrencyProvider>
 *     <AppRoutes />
 *   </CurrencyProvider>
 * </AuthProvider>
 */
export function CurrencyProvider({ children, value, apiBaseUrl, fetcher = globalThis.fetch }) {
  const { isAuthenticated, token, selectedOrg, isSessionReady, authRevision, captureSession, isCurrentSession, apiSessionScope } = useAuth();
  const [resolved, setResolved] = useState(null);
  // `token` is undefined under the cookie scheme; the identity stays stable and distinct
  // anyway through org + authRevision + base URL, which is what it is keyed on.
  const identity = `${token}|${selectedOrg?.id}|${authRevision}|${apiBaseUrl}`;
  const setCurrencyCode = (code) => setResolved({ code, identity });

  useEffect(() => {
    if (value != null) {
      setCurrencyCode(value);
      return;
    }

    // ETP-4576 — `isAuthenticated`, not `!token`: under the cookie scheme the client holds
    // no token, so develop's gate would skip the currency resolution for every user and
    // leave every amount unformatted.
    if (!isAuthenticated || isSessionReady === false) {
      setCurrencyCode(null);
      return;
    }

    let cancelled = false;
    const snapshot = captureSession?.();
    const current = () => !cancelled && (!isCurrentSession || isCurrentSession(snapshot));
    setCurrencyCode(null);
    const base = apiBaseUrl || `${getApiBase()}/sws/neo`;
    const request = createApiFetch('', () => token, null, apiSessionScope);

    async function resolve() {
      try {
        // apiFetch carries the active credential itself; the injected-fetcher branch is
        // the test seam, and authHeaders() now resolves the scheme on its own.
        const res = fetcher === globalThis.fetch
          ? await request(`${base}/session`, { on401: 'ignore' })
          : await fetcher(`${base}/session`, { headers: authHeaders() });
        if (res.ok) {
          const json = await res.json();
          const code = json?.currencyCode;
          if (code && current()) setCurrencyCode(String(code));
        }
      } catch {
        // session endpoint unavailable — keep null (callers fall back to 'USD')
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [apiBaseUrl, fetcher, isAuthenticated, token, selectedOrg?.id, value, isSessionReady, authRevision, captureSession, isCurrentSession, apiSessionScope]);

  return (
    <CurrencyContext.Provider value={value ?? (isSessionReady !== false && resolved?.identity === identity ? resolved.code : null)}>
      {children}
    </CurrencyContext.Provider>
  );
}

/**
 * Returns the active ISO 4217 currency code for the current org.
 *
 * Returns `null` while the currency is being resolved on first load.
 * Use `formatCurrency(currencyCode ?? 'USD', value)` if you need a
 * guaranteed string, or render a skeleton when `currencyCode` is null.
 *
 * Designed for components without a document record (dashboards, sidebars).
 * For detail windows, read currency from `data['currency$_identifier']`.
 *
 * @returns {string|null} ISO 4217 code (e.g. 'EUR', 'USD') or null while loading.
 *
 * @example
 * const currencyCode = useCurrency();
 * // → null (loading) → 'EUR' (resolved)
 */
export function useCurrency() {
  return useContext(CurrencyContext);
}
