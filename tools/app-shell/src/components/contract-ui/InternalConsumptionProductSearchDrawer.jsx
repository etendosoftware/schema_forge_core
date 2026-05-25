import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Search, X, Loader2, Check, ChevronRight, ChevronDown, Warehouse } from 'lucide-react';
import { buildUrlWithParams } from '@/lib/buildUrlWithParams.js';
import { useUI } from '@/i18n';

const PAGE_SIZE = 30;

const COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
  'bg-indigo-100 text-indigo-700',
];

function getColor(id) {
  let hash = 0;
  for (let i = 0; i < (id || '').length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

function Avatar({ name, id }) {
  const initial = (name || '?')[0].toUpperCase();
  return (
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0 ${getColor(id)}`}>
      {initial}
    </div>
  );
}

/**
 * M_Product_Stock_V returns one "generic" row per product (locator=null, qty=0) plus one
 * row per product+locator. Drop null-locator rows for products that have concrete rows.
 */
function filterICProductRows(rows) {
  const productsWithLocator = new Set();
  for (const row of rows) {
    if (row._aux?._LOC) productsWithLocator.add(row.id);
  }
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    const locatorId = row._aux?._LOC || '';
    if (!locatorId && productsWithLocator.has(row.id)) continue;
    const key = `${row.id}::${locatorId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

function formatQty(raw) {
  if (raw == null || raw === '' || raw === 'null') return null;
  const n = parseFloat(raw);
  if (isNaN(n)) return null;
  return n % 1 === 0 ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function InternalConsumptionProductSearchDrawer({
  open,
  onClose,
  onSelect,
  selectorUrl,
  token,
  title = null,
}) {
  const ui = useUI();
  const resolvedTitle = title ?? ui('product');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [expandedProducts, setExpandedProducts] = useState(new Set());
  const [warehouseFilter, setWarehouseFilter] = useState(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const activeItemRef = useRef(null);
  const fetchTimer = useRef(null);
  const abortRef = useRef(null);
  const rawOffsetRef = useRef(0);

  const rowKey = (row) => `${row.id}::${row._aux?._LOC || ''}`;

  // All groups from raw results
  const allGroups = useMemo(() => {
    const map = new Map();
    const order = [];
    for (const row of results) {
      if (!map.has(row.id)) {
        map.set(row.id, {
          productId: row.id,
          name: row.label || row.name || row._identifier || row.id,
          code: row.searchKey || row.code || row.value || null,
          locations: [],
        });
        order.push(map.get(row.id));
      }
      map.get(row.id).locations.push(row);
    }
    return order;
  }, [results]);

  // Unique warehouse names derived from all results
  const availableWarehouses = useMemo(() => {
    const seen = new Map();
    for (const row of results) {
      const name = row.warehouse;
      if (name && !seen.has(name)) seen.set(name, name);
    }
    return [...seen.keys()];
  }, [results]);

  // Groups after warehouse filter applied
  const groups = useMemo(() => {
    if (!warehouseFilter) return allGroups;
    return allGroups
      .map(g => ({ ...g, locations: g.locations.filter(r => r.warehouse === warehouseFilter) }))
      .filter(g => g.locations.length > 0);
  }, [allGroups, warehouseFilter]);

  // Auto-expand all when a warehouse filter is active; keep current state otherwise
  useEffect(() => {
    if (warehouseFilter) {
      setExpandedProducts(new Set(groups.map(g => g.productId)));
      setActiveIdx(-1);
    }
  }, [warehouseFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flat list of visible (expanded) location rows for keyboard navigation
  const flatRows = useMemo(() =>
    groups
      .filter(g => expandedProducts.has(g.productId))
      .flatMap(g => g.locations),
    [groups, expandedProducts],
  );

  const toggleProduct = (productId) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
        setActiveIdx(-1);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

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
          const items = filterICProductRows(raw);
          rawOffsetRef.current = offset + raw.length;
          if (append) {
            setResults(prev => filterICProductRows([...prev, ...items]));
          } else {
            setResults(items);
            setActiveIdx(-1);
            setExpandedProducts(new Set());
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
  }, [selectorUrl, token]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults([]);
    setLoading(false);
    setLoadingMore(false);
    setHasMore(false);
    setSelectedKey(null);
    setActiveIdx(-1);
    setExpandedProducts(new Set());
    setWarehouseFilter(null);
    setTimeout(() => inputRef.current?.focus(), 50);
    doFetch('', 0);
  }, [open, doFetch]);

  useEffect(() => () => {
    clearTimeout(fetchTimer.current);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (activeIdx >= 0 && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIdx]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || loadingMore || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50) {
      doFetch(query, rawOffsetRef.current, true);
    }
  }, [loadingMore, hasMore, query, doFetch]);

  const handleSelect = (row) => {
    setSelectedKey(rowKey(row));
    setTimeout(() => { onSelect(row); onClose(); }, 120);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      inputRef.current?.focus();
      setActiveIdx(prev => Math.min(prev + 1, flatRows.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      inputRef.current?.focus();
      setActiveIdx(prev => Math.max(prev - 1, 0));
    }
    if (e.key === 'Enter' && activeIdx >= 0 && flatRows[activeIdx]) {
      e.preventDefault();
      handleSelect(flatRows[activeIdx]);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]" onClick={onClose}>
        <div
          className="w-full max-w-xl bg-background rounded-xl border border-border shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          style={{ maxHeight: '68vh' }}
          role="dialog"
          aria-modal="true"
        >
          {/* Search bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); doFetch(e.target.value, 0); }}
              placeholder={`${ui('searchLabelPrefix')} ${resolvedTitle}...`}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {(loading || loadingMore) && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />}
            <button onClick={onClose} className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Warehouse filter pills */}
          {availableWarehouses.length > 0 && (
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border overflow-x-auto shrink-0">
              <Warehouse className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <button
                type="button"
                onClick={() => { setWarehouseFilter(null); setActiveIdx(-1); }}
                className={`shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  warehouseFilter === null
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                All
              </button>
              {availableWarehouses.map(wh => (
                <button
                  key={wh}
                  type="button"
                  onClick={() => { setWarehouseFilter(wh === warehouseFilter ? null : wh); setActiveIdx(-1); }}
                  className={`shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    warehouseFilter === wh
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {wh}
                </button>
              ))}
            </div>
          )}

          {/* Results */}
          <div className="flex-1 overflow-y-auto" ref={listRef} onScroll={handleScroll}>
            {loading && results.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
              </div>
            )}

            {!loading && results.length === 0 && query.trim() && (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <p className="text-sm">{ui('productSearchNoResults', { query })}</p>
              </div>
            )}

            {groups.length > 0 && (
              <ul className="py-2">
                {groups.map((group, gi) => {
                  const isExpanded = expandedProducts.has(group.productId);
                  return (
                    <li key={group.productId}>
                      {gi > 0 && <div className="mx-4 my-1.5 border-t border-border" />}

                      {/* Product header — clickable to expand/collapse */}
                      <button
                        type="button"
                        onClick={() => toggleProduct(group.productId)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                      >
                        <Avatar name={group.name} id={group.productId} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{group.name}</p>
                          {group.code && <p className="text-xs text-muted-foreground">{group.code}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 mr-1">
                          {group.locations.length} {group.locations.length === 1 ? 'location' : 'locations'}
                        </span>
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        }
                      </button>

                      {/* Location sub-rows — only rendered when expanded */}
                      {isExpanded && (
                        <div className="px-4 pb-2 flex flex-col gap-1">
                          {group.locations.map((row) => {
                            const flatIdx = flatRows.indexOf(row);
                            const isActive = flatIdx === activeIdx;
                            const isSelected = selectedKey === rowKey(row);
                            const warehouseName = row.warehouse || '—';
                            const qty = formatQty(row._aux?._QTY);

                            return (
                              <button
                                key={rowKey(row)}
                                ref={isActive ? activeItemRef : null}
                                type="button"
                                onClick={() => handleSelect(row)}
                                className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                                  isSelected
                                    ? 'border-primary bg-primary/10 text-foreground'
                                    : isActive
                                    ? 'border-border bg-muted text-foreground'
                                    : 'border-border bg-muted/40 hover:bg-muted text-foreground'
                                }`}
                              >
                                <span className="flex-1 text-sm truncate">{warehouseName}</span>
                                {qty != null && (
                                  <span className="text-xs tabular-nums text-muted-foreground shrink-0">{qty} ud</span>
                                )}
                                {isSelected
                                  ? <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                }
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
                {loadingMore && (
                  <li className="flex items-center justify-center py-3">
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Footer */}
          {groups.length > 0 && (
            <div className="px-4 py-1.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>{ui('productSearchCount', { count: groups.length })}</span>
              <span className="flex items-center gap-2">
                <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">↑↓</kbd> {ui('productSearchNavigate')}
                <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">↵</kbd> {ui('productSearchSelect')}
                <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">esc</kbd> {ui('productSearchClose')}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
