import React, { useMemo, useRef, useState } from 'react';

function EditablePrice({ price, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  function startEdit() {
    setDraft(price.toFixed(2));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commit() {
    const val = parseFloat(draft);
    if (!isNaN(val) && val >= 0) onChange(val);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        step="0.01"
        min="0"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="qo-price-input"
        autoFocus
      />
    );
  }

  return (
    <button type="button" className="qo-price-btn" onClick={startEdit} title="Click to edit price">
      {price.toFixed(2)}
    </button>
  );
}

export default function CartPanel({ lines, dispatch, onSave, saving, saveError, savedId }) {
  const { subtotal } = useMemo(() => {
    const s = lines.reduce((acc, l) => acc + l.qty * l.unitPrice, 0);
    return { subtotal: s };
  }, [lines]);

  const itemCount = lines.reduce((acc, l) => acc + l.qty, 0);

  if (lines.length === 0) {
    return (
      <div className="qo-cart qo-cart-empty">
        <h2>Cart</h2>
        <p className="qo-muted">No items yet. Click a product on the left to add it.</p>
      </div>
    );
  }

  return (
    <div className="qo-cart">
      <div className="qo-cart-header">
        <h2>Cart <span className="qo-muted">({itemCount})</span></h2>
        <button type="button" className="qo-link" onClick={() => dispatch({ type: 'CLEAR_CART' })}>
          Clear
        </button>
      </div>
      <ul className="qo-cart-lines">
        {lines.map((line) => (
          <li key={line.id} className="qo-cart-line">
            <div className="qo-cart-line-main">
              <span className="qo-cart-line-name" title={line.name}>{line.name}</span>
              <EditablePrice
                price={line.unitPrice}
                onChange={(price) => dispatch({ type: 'UPDATE_PRICE', id: line.id, price })}
              />
            </div>
            <div className="qo-qty">
              <button
                type="button"
                onClick={() => dispatch({ type: 'UPDATE_QTY', id: line.id, qty: line.qty - 1 })}
                aria-label="Decrease"
              >−</button>
              <span className="qo-qty-value">{line.qty}</span>
              <button
                type="button"
                onClick={() => dispatch({ type: 'UPDATE_QTY', id: line.id, qty: line.qty + 1 })}
                aria-label="Increase"
              >+</button>
            </div>
            <span className="qo-cart-line-total">
              {(line.qty * line.unitPrice).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <button
              type="button"
              className="qo-icon-btn"
              onClick={() => dispatch({ type: 'REMOVE_ITEM', id: line.id })}
              aria-label="Remove"
              title="Remove"
            >×</button>
          </li>
        ))}
      </ul>
      <div className="qo-cart-footer">
        <div className="qo-cart-total">
          <span>Total</span>
          <span className="qo-cart-total-value">
            {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        {saveError && <div className="qo-error">{saveError}</div>}
        {savedId && <div className="qo-success">Draft saved · {savedId}</div>}
        <button type="button" onClick={onSave} disabled={saving || lines.length === 0}>
          {saving ? 'Saving…' : 'Save draft'}
        </button>
      </div>
    </div>
  );
}
