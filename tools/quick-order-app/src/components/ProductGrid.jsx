import React, { useMemo, useState } from 'react';
import { useLookup } from '../hooks/useLookup.js';

const PRODUCT_LOOKUP_PATH = '/neo/product/product';

export default function ProductGrid({ shell, onAdd }) {
  const [query, setQuery] = useState('');
  const products = useLookup(shell, { path: PRODUCT_LOOKUP_PATH, pageSize: 100 });

  const filtered = useMemo(() => {
    if (!query.trim()) return products.items;
    const q = query.toLowerCase();
    return products.items.filter((p) => {
      const label = (p._identifier || p.name || '').toLowerCase();
      const key = (p.searchKey || '').toLowerCase();
      return label.includes(q) || key.includes(q);
    });
  }, [products.items, query]);

  return (
    <div className="qo-products">
      <div className="qo-products-header">
        <input
          type="search"
          placeholder="Search product…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={products.loading}
        />
        <span className="qo-muted qo-products-count">
          {products.loading ? 'Loading…' : `${filtered.length} products`}
        </span>
      </div>
      {products.error && <div className="qo-error">Failed to load products: {products.error}</div>}
      <div className="qo-products-grid">
        {filtered.map((p) => (
          <button
            key={p.id}
            type="button"
            className="qo-product-card"
            onClick={() => onAdd(p)}
          >
            <span className="qo-product-name">{p._identifier || p.name || p.id}</span>
            {p.standardPrice != null && (
              <span className="qo-product-price">
                {Number(p.standardPrice).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            )}
          </button>
        ))}
        {!products.loading && filtered.length === 0 && (
          <div className="qo-muted qo-products-empty">No products match.</div>
        )}
      </div>
    </div>
  );
}
