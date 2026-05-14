import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Search } from 'lucide-react';
import { useUI } from '@/i18n';

/* eslint-disable react/prop-types */

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_LIMIT = 30;

function escHql(value) {
  return String(value).replace(/'/g, "''");
}

function deriveEntityEndpoint(column = {}, apiBaseUrl) {
  const [spec, entity] = String(column.entitySpec || '').split('/');
  if (!spec || !entity) return null;
  if (!apiBaseUrl) return `/sws/neo/${spec}/${entity}`;
  return `${apiBaseUrl.replace(/\/[^/]+$/, `/${spec}`)}/${entity}`;
}

export default function EntityCell({ column, value, token, apiBaseUrl, onChange }) {
  const ui = useUI();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const endpoint = useMemo(() => deriveEntityEndpoint(column, apiBaseUrl), [column, apiBaseUrl]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handle = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  useEffect(() => {
    if (!open || !token || !endpoint) return undefined;
    let cancelled = false;
    const trimmed = query.trim();
    const timer = setTimeout(async () => {
      setLoading(true);
      const filter = column.filter || 'active = true';
      const where = trimmed
        ? `lower(name) like lower('%${escHql(trimmed)}%') and ${filter}`
        : filter;
      const url = `${endpoint}?_neoWhere=${encodeURIComponent(where)}&limit=${SEARCH_LIMIT}`;
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = await res.json();
        const data = json?.response?.data ?? json?.data ?? [];
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, token, endpoint, column.filter]);

  const chipLabel = value?.label || ui(column.emptyOptionLabel || 'ocrLinesTaxDefault');
  const chipDim = value ? '' : 'italic text-gray-500';

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setQuery(value?.label || '');
          setOpen(true);
        }}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm hover:border-gray-400"
      >
        <span className={`truncate text-left ${chipDim}`}>{chipLabel}</span>
        <ChevronDown size={14} className="shrink-0 text-gray-500" />
      </button>
    );
  }

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex items-center gap-2 rounded-md border border-gray-900 bg-white px-2 py-1.5">
        <Search size={12} className="shrink-0 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={ui(column.searchPlaceholder || 'ocrLinesTaxSearch')}
          className="flex-1 text-sm text-gray-900 placeholder-gray-500 outline-none"
        />
        {loading && <Loader2 size={12} className="animate-spin text-gray-400" />}
      </div>
      <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
          className="block w-full truncate border-b border-gray-100 px-3 py-2 text-left text-xs italic text-gray-600 hover:bg-gray-50"
        >
          {ui(column.clearLabel || 'ocrLinesTaxClear')}
        </button>
        {!loading && items.length === 0 && query.trim() && (
          <div className="px-3 py-2 text-xs text-gray-500">{ui(column.noMatchesLabel || 'ocrLinesTaxNoMatches')}</div>
        )}
        {items.map((item) => {
          const label = item.name || item._identifier || item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onChange({ id: item.id, label });
                setOpen(false);
              }}
              className={[
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50',
                value?.id === item.id ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-800',
              ].join(' ')}
            >
              <span className="w-4 shrink-0">{value?.id === item.id ? <Check size={14} /> : null}</span>
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
