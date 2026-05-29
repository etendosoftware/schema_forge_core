import { useCallback, useState } from 'react';
import { useAuth } from '@/auth/AuthContext.jsx';
import { getApiBase } from './useNeoResource';

/**
 * Hook for creating a single FIN_Finacc_Transaction (manual movement).
 *
 * POST /sws/neo/financial-account-transactions?action=create
 * body: {
 *   FIN_Financial_Account_ID, trxType, transactionDate, accountingDate,
 *   amount, currencyId, description?, bpartnerId?, glItemId?,
 *   foreignCurrencyId?, foreignAmount?
 * }
 *
 * Returns `{ createMovement, creating, error }`. On success resolves with the
 * `{ id, trxType, status }` shape returned by the backend.
 */
export function useCreateMovement() {
  const { token } = useAuth();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const createMovement = useCallback(async (payload) => {
    const url = `${getApiBase()}/sws/neo/financial-account-transactions?action=create`;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ''}`);
      }
      const json = await res.json();
      return json?.response?.data ?? {};
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setCreating(false);
    }
  }, [token]);

  return { createMovement, creating, error };
}
