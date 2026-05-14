import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import { useUI } from '@/i18n';

/* eslint-disable react/prop-types */

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_LIMIT = 20;

function escHql(value) {
  return String(value).replace(/'/g, "''");
}

function deriveEntityEndpoint(field = {}, contactsBase, apiBaseUrl) {
  const [spec, entity] = String(field.entitySpec || '').split('/');
  if (!spec || !entity) return null;
  if (spec === 'contacts') {
    return contactsBase ? `${contactsBase}/${entity}` : null;
  }
  if (!apiBaseUrl) return `/sws/neo/${spec}/${entity}`;
  return `${apiBaseUrl.replace(/\/[^/]+$/, `/${spec}`)}/${entity}`;
}

export default function EntityField({
  field,
  value,
  token,
  contactsBase,
  apiBaseUrl,
  createComponent: CreateComponent,
  onChange,
}) {
  const ui = useUI();
  // When pre-resolution didn't pick a vendor, seed the search box with the
  // OCR-extracted hint (e.g. vendor_name) so the dropdown shows candidates
  // on first focus instead of forcing the user to retype the name.
  const initialHint = useMemo(() => {
    if (value?.id) return '';
    const extracted = field?.extracted || {};
    const keys = Array.isArray(field?.extractFrom) ? field.extractFrom : [field?.extractFrom];
    for (const key of keys) {
      const candidate = key ? extracted?.[key] : null;
      if (candidate && String(candidate).trim()) return String(candidate).trim();
    }
    return '';
  }, [field, value]);
  const [query, setQuery] = useState(initialHint);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(Boolean(initialHint));
  const [showCreate, setShowCreate] = useState(false);
  const wrapRef = useRef(null);
  const endpoint = useMemo(() => deriveEntityEndpoint(field, contactsBase, apiBaseUrl), [field, contactsBase, apiBaseUrl]);

  useEffect(() => {
    if (!open) return undefined;
    const handle = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  useEffect(() => {
    if (!open || !endpoint || !token) return undefined;
    let cancelled = false;
    const trimmed = query.trim();
    const timer = setTimeout(async () => {
      setLoading(true);
      const filter = field.filter || 'active = true';
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
  }, [open, endpoint, field.filter, query, token]);

  const handleCreateSubmit = (decision) => {
    const record = decision?.created;
    if (!record?.id) {
      setShowCreate(false);
      return;
    }
    const label = record.name || ui('ocrReviewVendorCreate');
    onChange({
      id: record.id,
      label,
      bpId: record.id,
      bpCreate: null,
      locationCreate: null,
    });
    setShowCreate(false);
  };

  const createPrefilled = Object.fromEntries(
    Object.entries(field.createPrefilledFrom || {}).map(([target, source]) => [target, field.extracted?.[source] || '']),
  );
  if (!createPrefilled.name && query.trim()) createPrefilled.name = query.trim();

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 focus-within:border-gray-900">
        <Search size={14} className="shrink-0 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={value?.label || ui(field.searchPlaceholder || 'ocrReviewVendorSearch')}
          className="flex-1 text-sm text-gray-900 placeholder-gray-500 outline-none"
        />
        {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
      </div>
      {open && (CreateComponent || query.trim() || items.length > 0) && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {CreateComponent && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setOpen(false); setShowCreate(true); }}
              className="flex w-full items-center gap-1.5 border-b border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-800 hover:bg-blue-50"
            >
              <Plus size={14} />
              {ui(field.createLabel || 'ocrReviewVendorCreate')}
            </button>
          )}
          {!loading && items.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500">{ui(field.noMatchesLabel || 'ocrReviewVendorNoMatches')}</div>
          )}
          {items.map((item) => {
            const label = item.name || item._identifier || item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange({ id: item.id, label, bpId: item.id, bpCreate: null, locationCreate: null });
                  setQuery('');
                  setOpen(false);
                }}
                className="block w-full truncate px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      {showCreate && CreateComponent ? (
        <CreateComponent
          item={{ kind: 'createContact', payload: { prefilled: createPrefilled, documentType: field.createDocumentType || null } }}
          apiBaseUrl={apiBaseUrl}
          token={token}
          onCancel={() => setShowCreate(false)}
          onSubmit={handleCreateSubmit}
        />
      ) : null}
    </div>
  );
}
