import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext.jsx';
import { getApiBase } from './useNeoResource';

const DEBOUNCE_MS = 200;

/**
 * Debounced lookup hook for picker-style inputs. Hits
 *   GET /sws/neo/financial-account-transactions?action={action}&q={query}
 * and exposes `{ results, loading, error }` derived from the JSON envelope's
 * `data.{resultKey}` field.
 *
 * @param {{ action: 'bpartner-lookup' | 'glitem-lookup', resultKey: 'bpartners' | 'glItems' }} cfg
 * @param {string} query — the current search text (live, debounced internally)
 */
function useDebouncedLookup({ action, resultKey }, query) {
  const { token } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const run = useCallback(async (q) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const url = `${getApiBase()}/sws/neo/financial-account-transactions?action=${action}&q=${encodeURIComponent(q ?? '')}`;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setResults(json?.response?.data?.[resultKey] ?? []);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err);
    } finally {
      setLoading(false);
    }
  }, [action, resultKey, token]);

  useEffect(() => {
    if (!token) return undefined;
    const id = setTimeout(() => { run(query); }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query, run, token]);

  return { results, loading, error };
}

export function useBPartnerLookup(query) {
  return useDebouncedLookup(
    { action: 'bpartner-lookup', resultKey: 'bpartners' },
    query,
  );
}

export function useGLItemLookup(query) {
  return useDebouncedLookup(
    { action: 'glitem-lookup', resultKey: 'glItems' },
    query,
  );
}
