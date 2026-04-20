import React, { useEffect, useState } from 'react';
import { createShellClient, TokenExpiredError } from '@etendoerp/apps-sdk';
import { configFromLocation } from './config.js';
import OrderForm from './components/OrderForm.jsx';
import LinesGrid from './components/LinesGrid.jsx';

const cfg = configFromLocation();
const token = new URLSearchParams(window.location.search).get('jwt') || '';
const shell = createShellClient({ appId: 'quick-order', token });

export default function App() {
  const [me, setMe] = useState(null);
  const [err, setErr] = useState(null);
  const [orderId, setOrderId] = useState(null);

  useEffect(() => {
    shell.me().then(setMe).catch((e) => {
      setErr(e instanceof TokenExpiredError ? 'Session expired — please reopen the app' : e.message);
    });
  }, []);

  if (err) return <div style={{ padding: 16, color: '#b91c1c' }}>{err}</div>;
  if (!me) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>{cfg.title}</h1>
      <p style={{ color: '#6b7280', marginTop: 4, marginBottom: 16 }}>
        {me.userId} · {me.tenant}
      </p>
      <OrderForm shell={shell} cfg={cfg} onSave={setOrderId} />
      <LinesGrid shell={shell} cfg={cfg} orderId={orderId} />
    </div>
  );
}
