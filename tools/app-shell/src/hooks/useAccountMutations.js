import { useCallback } from 'react';
import { useAuth } from '@/auth/AuthContext.jsx';
import { getApiBase } from '@/hooks/useNeoResource.js';

/**
 * Write operations against the `financial-account` NEO spec (ETP-4096):
 *   - createAccount(payload)     → POST /sws/neo/financial-account
 *   - updateAccount(id, payload) → POST /sws/neo/financial-account?action=update&id=...
 *   - archiveAccount(id)         → POST /sws/neo/financial-account?action=archive&id=...
 *   - fetchDefaults()            → GET  /sws/neo/financial-account?action=defaults
 *
 * `useNeoResource` only handles GETs, so these mutations use `fetch` directly
 * with the same bearer-token auth. Errors throw with the backend message and an
 * attached `status` so callers can branch (e.g. 409 duplicate name → inline error).
 */

const BASE_PATH = '/sws/neo/financial-account';

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function readErrorMessage(res) {
  try {
    const json = await res.json();
    return json?.error?.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function throwHttpError(res) {
  const message = await readErrorMessage(res);
  const error = new Error(message);
  error.status = res.status;
  throw error;
}

export function useAccountMutations() {
  const { token } = useAuth();

  const createAccount = useCallback(async (payload) => {
    const res = await fetch(`${getApiBase()}${BASE_PATH}`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) await throwHttpError(res);
    const json = await res.json();
    return json?.response?.data ?? null;
  }, [token]);

  const updateAccount = useCallback(async (accountId, payload) => {
    const url = `${getApiBase()}${BASE_PATH}?action=update&id=${encodeURIComponent(accountId)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) await throwHttpError(res);
    const json = await res.json();
    return json?.response?.data ?? null;
  }, [token]);

  const archiveAccount = useCallback(async (accountId) => {
    const url = `${getApiBase()}${BASE_PATH}?action=archive&id=${encodeURIComponent(accountId)}`;
    const res = await fetch(url, { method: 'POST', headers: authHeaders(token) });
    if (!res.ok) await throwHttpError(res);
    return true;
  }, [token]);

  const fetchDefaults = useCallback(async () => {
    const url = `${getApiBase()}${BASE_PATH}?action=defaults`;
    const res = await fetch(url, { headers: authHeaders(token) });
    if (!res.ok) await throwHttpError(res);
    const json = await res.json();
    return json?.response?.data ?? { currencies: [] };
  }, [token]);

  return { createAccount, updateAccount, archiveAccount, fetchDefaults };
}
