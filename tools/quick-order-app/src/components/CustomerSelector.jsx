import React, { useMemo, useState } from 'react';
import { useLookup } from '../hooks/useLookup.js';

const BP_LOOKUP_PATH = '/neo/bp-location/business-partner';

export default function CustomerSelector({ shell, cfg, value, onChange }) {
  const [query, setQuery] = useState('');
  const bps = useLookup(shell, { path: BP_LOOKUP_PATH, criteria: cfg.bpCriteria });

  const filtered = useMemo(() => {
    if (!query.trim()) return bps.items;
    const q = query.toLowerCase();
    return bps.items.filter((bp) => {
      const label = (bp._identifier || bp.name || '').toLowerCase();
      return label.includes(q);
    });
  }, [bps.items, query]);

  const selected = bps.items.find((bp) => bp.id === value);
  const label = cfg.type === 'sales' ? 'Customer' : 'Vendor';

  if (bps.error) return <div className="qo-error">Failed to load {label}: {bps.error}</div>;

  return (
    <div className="qo-selector">
      <label className="qo-field">
        <span>{label}</span>
        <input
          type="search"
          placeholder={bps.loading ? 'Loading…' : `Search ${label.toLowerCase()}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={bps.loading}
        />
      </label>
      {query && !bps.loading && (
        <ul className="qo-selector-results">
          {filtered.slice(0, 8).map((bp) => (
            <li key={bp.id}>
              <button
                type="button"
                className={`qo-selector-item ${bp.id === value ? 'is-selected' : ''}`}
                onClick={() => { onChange(bp.id); setQuery(''); }}
              >
                {bp._identifier || bp.name}
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="qo-muted qo-selector-empty">No matches.</li>}
        </ul>
      )}
      {selected && !query && (
        <div className="qo-selector-selected">
          <span>{selected._identifier || selected.name}</span>
          <button type="button" className="qo-link" onClick={() => onChange('')}>Change</button>
        </div>
      )}
    </div>
  );
}
