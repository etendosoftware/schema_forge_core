import React, { useState } from 'react';
import { useLookup } from '../hooks/useLookup.js';

const PRODUCT_LOOKUP_PATH = '/neo/product/product';

export default function LinesGrid({ shell, cfg, orderId }) {
  const [lines, setLines] = useState([]);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState('0');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  const products = useLookup(shell, { path: PRODUCT_LOOKUP_PATH, enabled: !!orderId });

  if (!orderId) return <p className="qo-muted">Save the header first to add lines.</p>;

  async function addLine() {
    if (Number(qty) < 1) { setError('Quantity must be at least 1'); return; }
    setAdding(true); setError(null);
    try {
      const body = {
        data: {
          salesOrder: cfg.type === 'sales' ? orderId : undefined,
          purchaseOrder: cfg.type === 'purchase' ? orderId : undefined,
          product: productId,
          orderedQuantity: Number(qty),
          unitPrice: Number(price),
        },
      };
      const result = await shell.fetch(cfg.linesPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const newLine = result.response?.data?.[0];
      if (newLine) setLines((prev) => [...prev, newLine]);
      setProductId(''); setQty(1); setPrice('0');
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="qo-lines">
      <h2>Lines</h2>
      <div className="qo-lines-row">
        <select value={productId} onChange={(e) => setProductId(e.target.value)} disabled={products.loading}>
          <option value="">— product —</option>
          {products.items.map((p) => (
            <option key={p.id} value={p.id}>{p._identifier || p.name}</option>
          ))}
        </select>
        <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        <button type="button" disabled={!productId || adding} onClick={addLine}>
          {adding ? 'Adding…' : 'Add'}
        </button>
      </div>
      {error && <div className="qo-error">{error}</div>}
      {lines.length > 0 && (
        <ul className="qo-line-list">
          {lines.map((l) => (
            <li key={l.id}>{l._identifier || l.id} — qty {l.orderedQuantity} @ {l.unitPrice}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
