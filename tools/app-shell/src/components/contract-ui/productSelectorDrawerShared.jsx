/**
 * Shared primitives for product-selector drawers (GoodsMovements + InternalConsumption).
 * Exports: COLORS, getColor, Avatar, formatQty, useProductSelectorFetch.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { buildUrlWithParams } from '@/lib/buildUrlWithParams.js';

const PAGE_SIZE = 30;

export const COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
  'bg-indigo-100 text-indigo-700',
];

export function getColor(id) {
  let hash = 0;
  for (let i = 0; i < (id || '').length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function Avatar({ name, id }) {
  const initial = (name || '?')[0].toUpperCase();
  return (
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0 ${getColor(id)}`}>
      {initial}
    </div>
  );
}

export function formatQty(raw) {
  if (raw == null || raw === '' || raw === 'null') return null;
  const n = parseFloat(raw);
  if (isNaN(n)) return null;
  return n % 1 === 0 ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Encapsulates the fetch state and side-effects shared by GoodsMovementsProductSearchDrawer
 * and InternalConsumptionProductSearchDrawer.
 *
 * @param {object}   options
 * @param {boolean}  options.open            - Whether the drawer is open.
 * @param {string}   options.selectorUrl     - URL for the selector endpoint.
 * @param {string}   options.token           - Auth token.
 * @param {function} options.transform       - (rawItems: array) => array. Post-processes the raw
 *                                             data.items on every fetch (fresh + append). Each
 *                                             drawer supplies its own filter (filterStockRows /
 *                                             filterICProductRows).
 * @param {function} [options.onFreshResults] - Called with the transformed items after a
 *                                             successful non-append fetch. Lets the drawer reset
 *                                             drawer-specific state (e.g. activeIdx,
 *                                             expandedProducts) that this hook does not own.
 *
 * Returns:
 *   { query, setQuery, results, setResults, loading, loadingMore, hasMore,
 *     inputRef, listRef, activeItemRef, fetchTimer, abortRef, rawOffsetRef,
 *     doFetch, handleScroll }
 *
 * Side-effects managed here:
 *   - open-reset effect  (resets state + fires initial fetch when `open` flips true)
 *   - cleanup effect     (clears timer + aborts in-flight request on unmount)
 */
export function useProductSelectorFetch({ open, selectorUrl, token, transform, onFreshResults }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const activeItemRef = useRef(null);
  const fetchTimer = useRef(null);
  const abortRef = useRef(null);
  const rawOffsetRef = useRef(0);

  // Keep a stable ref to onFreshResults so doFetch's dep array stays stable even
  // when the caller passes an inline arrow function on every render.
  const onFreshResultsRef = useRef(onFreshResults);
  useEffect(() => { onFreshResultsRef.current = onFreshResults; }, [onFreshResults]);

  const doFetch = useCallback((q, offset = 0, append = false) => {
    if (!append) {
      clearTimeout(fetchTimer.current);
      if (abortRef.current) abortRef.current.abort();
      rawOffsetRef.current = 0;
    }
    if (!selectorUrl || !token) { setResults([]); setLoading(false); return; }
    if (append) setLoadingMore(true);
    else setLoading(true);

    const delay = q && !append ? 300 : 0;
    fetchTimer.current = setTimeout(() => {
      const controller = new AbortController();
      if (!append) abortRef.current = controller;
      const params = { limit: PAGE_SIZE, offset };
      if (q) params.q = q.trim();
      fetch(buildUrlWithParams(selectorUrl, params), {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          const raw = data?.items || [];
          rawOffsetRef.current = offset + raw.length;
          if (append) {
            setResults(prev => transform([...prev, ...raw]));
          } else {
            const fresh = transform(raw);
            setResults(fresh);
            onFreshResultsRef.current?.(fresh);
          }
          setHasMore(data?.hasMore ?? false);
          setLoading(false);
          setLoadingMore(false);
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            if (!append) setResults([]);
            setLoading(false);
            setLoadingMore(false);
          }
        });
    }, delay);
  }, [selectorUrl, token, transform]);

  // Reset all transient state and fire the initial fetch when the drawer opens.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults([]);
    setLoading(false);
    setLoadingMore(false);
    setHasMore(false);
    setTimeout(() => inputRef.current?.focus(), 50);
    doFetch('', 0);
  }, [open, doFetch]);

  // Abort any in-flight request and clear the debounce timer on unmount.
  useEffect(() => () => {
    clearTimeout(fetchTimer.current);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || loadingMore || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50) {
      doFetch(query, rawOffsetRef.current, true);
    }
  }, [loadingMore, hasMore, query, doFetch]);

  return {
    query, setQuery,
    results, setResults,
    loading, loadingMore, hasMore,
    inputRef, listRef, activeItemRef,
    fetchTimer, abortRef, rawOffsetRef,
    doFetch, handleScroll,
  };
}
