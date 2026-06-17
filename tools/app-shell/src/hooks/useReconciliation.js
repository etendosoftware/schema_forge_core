import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/auth/AuthContext.jsx';
import { useNeoResource, getApiBase } from './useNeoResource';

const BASE_PATH = '/sws/neo/bank-reconciliation';

/**
 * Builds a query string from a flat params object, skipping null/undefined/empty
 * values and URL-encoding the rest. Returns '' when there is nothing to append.
 */
function buildQuery(params) {
  const parts = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

/**
 * Lists the pending statement lines for a financial account (left panel).
 *
 * GET /sws/neo/bank-reconciliation?action=pendingLines&accountId={id}
 *   optional filters: status, dateFrom, dateTo, q
 *
 * Response: { response: { data: { lines: [...], total } } }
 * Each line: { id, date(ISO), description, status:'pending', amount(signed) }
 *
 * @param {string|null} accountId
 * @param {{ status?: string, dateFrom?: string, dateTo?: string, q?: string }} [filters]
 * @returns {{ lines: Array<object>, total: number, loading: boolean, error: Error|null, reload: () => void }}
 */
export function usePendingStatementLines(accountId, filters = {}) {
  const { status, dateFrom, dateTo, q } = filters;

  const path = accountId
    ? `${BASE_PATH}${buildQuery({ action: 'pendingLines', accountId, status, dateFrom, dateTo, q })}`
    : null;

  const mapPayload = useMemo(
    () => (raw) => ({
      lines: Array.isArray(raw.lines) ? raw.lines : [],
      total: Number(raw.total ?? 0),
    }),
    [],
  );

  const { data, loading, error, reload } = useNeoResource({
    path,
    deps: [accountId, status, dateFrom, dateTo, q],
    mapPayload,
    label: 'usePendingStatementLines',
  });

  return {
    lines: data?.lines ?? [],
    total: data?.total ?? 0,
    loading,
    error,
    reload,
  };
}

/**
 * Lists the candidate operations to reconcile against the selected line (right
 * panel). Does NOT fetch while `lineId` is null — the path stays null so the
 * underlying resource hook stays idle.
 *
 * GET /sws/neo/bank-reconciliation?action=candidates&accountId={id}&lineId={lineId}
 *   optional filter: docType
 *
 * Response: { response: { data: { candidates: [...] } } }
 * Each candidate: { id, date(ISO), documentNo, partnerName, amount(signed),
 *                   pendingBalance, status:'pending', suggested(bool) }
 *
 * @param {string|null} accountId
 * @param {string|null} lineId
 * @param {string|null} [docType]
 * @returns {{ candidates: Array<object>, loading: boolean, error: Error|null }}
 */
export function useCandidateOperations(accountId, lineId, docType = null) {
  const path = accountId && lineId
    ? `${BASE_PATH}${buildQuery({ action: 'candidates', accountId, lineId, docType })}`
    : null;

  const mapPayload = useMemo(
    () => (raw) => ({
      candidates: Array.isArray(raw.candidates) ? raw.candidates : [],
    }),
    [],
  );

  const { data, loading, error } = useNeoResource({
    path,
    deps: [accountId, lineId, docType],
    mapPayload,
    label: 'useCandidateOperations',
  });

  return {
    candidates: data?.candidates ?? [],
    loading,
    error,
  };
}

/**
 * Reconciles a statement line against a group of operations (POST).
 *
 * POST /sws/neo/bank-reconciliation?action=reconcileGroup
 *   body: { financialAccountId, statementLineId, operationIds: [...] }
 *
 * Success (201): { response: { data: { reconciliationId, lineIds: [...], updatedBalance } } }
 * Error (400/409): { error: { message, status } } — the message is surfaced on
 * the thrown Error so the caller can show it in a toast.
 *
 * @returns {{ reconcile: (payload: object) => Promise<object>, loading: boolean, error: Error|null }}
 */
export function useReconcileGroup() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reconcile = useCallback(async (payload) => {
    setLoading(true);
    setError(null);
    try {
      const url = `${getApiBase()}${BASE_PATH}?action=reconcileGroup`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      let json = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (!res.ok) {
        const message = json?.error?.message || `HTTP ${res.status}`;
        const err = new Error(message);
        err.status = json?.error?.status ?? res.status;
        throw err;
      }

      return json?.response?.data ?? {};
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  return { reconcile, loading, error };
}
