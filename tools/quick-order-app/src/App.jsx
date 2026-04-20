import React, { useEffect, useState } from 'react';
import { createShellClient } from '@etendoerp/apps-sdk';
import { configFromLocation } from './config.js';

const cfg = configFromLocation();
const token = new URLSearchParams(window.location.search).get('jwt') || '';
const shell = createShellClient({ appId: 'quick-order', token });

export default function App() {
  const [me, setMe] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    shell.me().then(setMe).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div style={{ padding: 16, color: '#b91c1c' }}>Error: {err}</div>;
  if (!me) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>{cfg.title}</h1>
      <p style={{ marginTop: 8 }}>
        Hello <b>{me.userId}</b> — tenant <b>{me.tenant}</b>
      </p>
      <p style={{ marginTop: 8, color: '#6b7280' }}>
        Variant: <code>{cfg.type}</code> · header: <code>{cfg.headerPath}</code>
      </p>
    </div>
  );
}
