import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/auth/AuthContext';

/* ------------------------------------------------------------------
 * Internal helpers
 * ----------------------------------------------------------------*/

function getApiBase() {
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
 * currency fetch starts as soon as the token is available — before
 * any dashboard or window component mounts and needs the value.
 *
 * @example
 * <AuthProvider>
 *   <CurrencyProvider>
 *     <AppRoutes />
 *   </CurrencyProvider>
 * </AuthProvider>
 */
export function CurrencyProvider({ children }) {
  const { token, selectedOrg } = useAuth();
  const [currencyCode, setCurrencyCode] = useState(null);

  useEffect(() => {
    if (!token) {
      setCurrencyCode(null);
      return;
    }

    let cancelled = false;
    const base = `${getApiBase()}/sws/neo`;
    const headers = { Authorization: `Bearer ${token}` };

    async function resolve() {
      try {
        const res = await fetch(`${base}/session`, { headers });
        if (res.ok) {
          const json = await res.json();
          const code = json?.currencyCode;
          if (code && !cancelled) setCurrencyCode(String(code));
        }
      } catch {
        // session endpoint unavailable — keep null (callers fall back to 'USD')
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [token, selectedOrg?.id]);

  return (
    <CurrencyContext.Provider value={currencyCode}>
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
