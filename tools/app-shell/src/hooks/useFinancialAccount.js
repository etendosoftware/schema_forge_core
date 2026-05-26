import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/auth/AuthContext.jsx';

const FETCH_TIMEOUT_MS = 10000;
const ENDPOINT = '/sws/neo/financial-accounts-page';

function getApiBase() {
  const path = window.location.pathname;
  const webIdx = path.indexOf('/web/');
  if (webIdx === -1) return import.meta.env.VITE_API_BASE || '';
  return path.substring(0, webIdx);
}

async function fetchAccountsPayload(apiBase, token, signal) {
  const url = `${apiBase}${ENDPOINT}`;
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
  if (!data) {
    throw new Error('Unexpected response shape from financial-accounts-page');
  }
  return data;
}

/**
 * Fetches the detail for a single financial account by id.
 *
 * T4 shortcut: uses list endpoint + client-side filter.
 * TODO: replace with dedicated /sws/neo/financial-account/{id} endpoint
 * once FIN_Financial_Account NEO spec is live.
 *
 * @param {string} accountId
 * @returns {{ account: object|null, loading: boolean, error: Error|null, reload: () => void }}
 */
export function useFinancialAccount(accountId) {
  const { token } = useAuth();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const apiBase = useMemo(() => getApiBase(), []);

  const load = useCallback(async () => {
    if (!token) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAccountsPayload(apiBase, token, ctrl.signal);
      const accounts = Array.isArray(data.accounts) ? data.accounts : [];
      const found = accounts.find((a) => String(a.id) === String(accountId)) ?? null;
      setAccount(found);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[financial-account] failed to load:', err.message);
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

  return { account, loading, error, reload: load };
}
