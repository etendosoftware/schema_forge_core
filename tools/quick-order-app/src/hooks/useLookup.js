import { useEffect, useState } from 'react';

/**
 * Minimal NEO lookup — fetches up to `pageSize` records matching `criteria`.
 * Shape matches the NEO `response.data` array. No pagination for v1.
 */
export function useLookup(shell, { path, criteria = [], pageSize = 50, enabled = true }) {
  const [state, setState] = useState({ loading: enabled, items: [], error: null });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ loading: true, items: [], error: null });
    const query = new URLSearchParams({ _pageSize: String(pageSize) });
    if (criteria.length) query.set('_criteria', JSON.stringify(criteria));
    shell.fetch(`${path}?${query}`)
      .then((body) => {
        if (cancelled) return;
        setState({ loading: false, items: body?.response?.data || [], error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ loading: false, items: [], error: err.message });
      });
    return () => { cancelled = true; };
  }, [path, JSON.stringify(criteria), pageSize, enabled]);

  return state;
}
