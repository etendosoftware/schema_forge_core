import React, { useEffect, useState } from 'react';
import { createShellClient, TokenExpiredError } from '@etendoerp/apps-sdk';
import { configFromLocation } from './config.js';
import { useCart } from './hooks/useCart.js';
import CustomerSelector from './components/CustomerSelector.jsx';
import ProductGrid from './components/ProductGrid.jsx';
import CartPanel from './components/CartPanel.jsx';

const cfg = configFromLocation();
const token = new URLSearchParams(window.location.search).get('jwt') || '';
const shell = createShellClient({ appId: 'quick-order', token });

export default function App() {
  const [me, setMe] = useState(null);
  const [err, setErr] = useState(null);
  const [bpId, setBpId] = useState('');
  const [orderDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, dispatch] = useCart();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedId, setSavedId] = useState(null);

  useEffect(() => {
    shell.me().then(setMe).catch((e) => {
      setErr(e instanceof TokenExpiredError ? 'Session expired — please reopen the app' : e.message);
    });
  }, []);

  async function saveDraft() {
    if (!bpId) { setSaveError(`Select a ${cfg.type === 'sales' ? 'customer' : 'vendor'}.`); return; }
    if (lines.length === 0) { setSaveError('Cart is empty.'); return; }
    setSaving(true); setSaveError(null); setSavedId(null);
    try {
      const headerBody = { data: { businessPartner: bpId, orderDate, documentStatus: 'DR' } };
      const headerResp = await shell.fetch(cfg.headerPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(headerBody),
      });
      const orderId = headerResp.response?.data?.[0]?.id;
      if (!orderId) throw new Error('Header saved but no id returned');

      for (const line of lines) {
        const lineBody = {
          data: {
            salesOrder: cfg.type === 'sales' ? orderId : undefined,
            purchaseOrder: cfg.type === 'purchase' ? orderId : undefined,
            product: line.productId,
            orderedQuantity: Number(line.qty),
            unitPrice: Number(line.unitPrice),
          },
        };
        await shell.fetch(cfg.linesPath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lineBody),
        });
      }

      setSavedId(orderId);
      dispatch({ type: 'CLEAR_CART' });
      setBpId('');
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (err) return <div className="qo-app qo-error">{err}</div>;
  if (!me) return <div className="qo-app qo-muted">Loading…</div>;

  return (
    <div className="qo-app">
      <header className="qo-topbar">
        <div>
          <h1>{cfg.title}</h1>
          <p className="qo-meta">{me.userId} · {me.tenant}</p>
        </div>
      </header>
      <div className="qo-layout">
        <section className="qo-col qo-col-main">
          <CustomerSelector shell={shell} cfg={cfg} value={bpId} onChange={setBpId} />
          <ProductGrid shell={shell} onAdd={(p) => dispatch({ type: 'ADD_ITEM', product: p })} />
        </section>
        <aside className="qo-col qo-col-side">
          <CartPanel
            lines={lines}
            dispatch={dispatch}
            onSave={saveDraft}
            saving={saving}
            saveError={saveError}
            savedId={savedId}
          />
        </aside>
      </div>
    </div>
  );
}
