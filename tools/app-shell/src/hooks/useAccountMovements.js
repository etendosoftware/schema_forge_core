import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/auth/AuthContext.jsx';

const FETCH_TIMEOUT_MS = 15000;
const ENDPOINT = '/sws/neo/financial-account-transactions';

function getApiBase() {
  const path = window.location.pathname;
  const webIdx = path.indexOf('/web/');
  if (webIdx === -1) return import.meta.env.VITE_API_BASE || '';
  return path.substring(0, webIdx);
}

async function fetchTransactionsPayload(apiBase, token, accountId, signal) {
  const url = `${apiBase}${ENDPOINT}?FIN_Financial_Account_ID=${encodeURIComponent(accountId)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const data = json?.response?.data;
  if (!data) throw new Error('Unexpected response shape from financial-account-transactions');
  return data;
}

/**
 * Fetches movements and KPI totals for a single financial account.
 *
 * Powered by FinancialAccountTransactionsHandler (ETP-4098) at:
 *   GET /sws/neo/financial-account-transactions?FIN_Financial_Account_ID={id}
 *
 * @param {string} accountId
 * @param {object} [_filters] - reserved for future server-side filtering
 * @returns {{
 *   movements: Array<object>,
 *   totals: { balance: number, inflows: number, outflows: number, currency: string },
 *   loading: boolean,
 *   error: Error|null,
 *   reload: () => void
 * }}
 */
export function useAccountMovements(accountId, _filters) {
  const { token } = useAuth();
  const [movements, setMovements] = useState([]);
  const [totals, setTotals] = useState({ balance: 0, inflows: 0, outflows: 0, currency: 'EUR' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const apiBase = useMemo(() => getApiBase(), []);

  const load = useCallback(async () => {
    if (!token || !accountId) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTransactionsPayload(apiBase, token, accountId, ctrl.signal);
      setMovements(Array.isArray(data.transactions) ? data.transactions : []);
      if (data.totals) {
        setTotals({
          balance: Number(data.totals.balance ?? 0),
          inflows: Number(data.totals.inflows ?? 0),
          outflows: Number(data.totals.outflows ?? 0),
          currency: data.totals.currency ?? 'EUR',
        });
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[useAccountMovements] failed to load:', err.message);
        setError(err);
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [apiBase, token, accountId]);

  useEffect(() => {
    load();
  }, [load]);

  return { movements, totals, loading, error, reload: load };
}
