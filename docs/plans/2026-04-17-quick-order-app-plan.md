# Quick-Order External App — Phase C Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship a single external iframe app (`tools/quick-order-app/`) that supports both quick sales order and quick purchase order, driven by `?type=sales|purchase`. It consumes the SDK packages delivered by the extraction plan (`@etendoerp/apps-sdk` + `@etendoerp/apps-sdk-bff`) with no modifications.

**Architecture:** React + Vite UI on port `5174`, Express BFF on port `4101`. Vite proxies `/api/*` from UI to BFF (same-origin contract). Two shell menu entries both point at the same iframe URL with different `type` query params. All NEO data (header record, lines, master-data lookups) goes through `shell.fetch()` → BFF → NEO. No direct browser → Etendo calls.

**Tech Stack:** Same as the spike (Node 22 ESM, React 18, Vite 6, Express 4, `@etendoerp/apps-sdk`, `@etendoerp/apps-sdk-bff`).

**Prerequisites:**
- `docs/plans/2026-04-17-apps-sdk-extraction-plan.md` complete (packages exist and the spike consumes them).
- NEO specs `sales-order` and `purchase-order` active in `etgo_sf_spec` (already verified: both present).

**Reference spec:** `docs/proposals/etendo-apps-sdk.md` §11, §14.

---

## Type-specific configuration

Both variants share 100% of the form shell. Only these values change:

| Key | `type=sales` | `type=purchase` |
|-----|--------------|-----------------|
| NEO spec + entity | `/neo/sales-order/sales-order` | `/neo/purchase-order/purchase-order` |
| Lines entity | `/neo/sales-order/sales-order-line` | `/neo/purchase-order/purchase-order-line` |
| Title (en) | Quick Sales Order | Quick Purchase Order |
| Title (es) | Orden de venta rápida | Orden de compra rápida |
| Business partner field | `businessPartner` (customer) | `businessPartner` (vendor) |
| Business partner filter | `"isCustomer":"Y"` | `"isVendor":"Y"` |
| Price list filter | `"isSalesPriceList":"Y"` | `"isSalesPriceList":"N"` |
| Menu entry id | `quick-sales-order` | `quick-purchase-order` |

The app reads `type` once at mount time from `window.location.search`, picks a `config` object based on it, and renders the same component tree.

---

## Task 1: Scaffold the app package

**Files:**
- Create: `tools/quick-order-app/package.json`
- Create: `tools/quick-order-app/index.html`
- Create: `tools/quick-order-app/vite.config.js`
- Create: `tools/quick-order-app/src/main.jsx`
- Create: `tools/quick-order-app/src/App.jsx`
- Create: `tools/quick-order-app/src/config.js`
- Create: `tools/quick-order-app/server.js`
- Create: `tools/quick-order-app/.gitignore`

- [ ] **Step 1: Create the directory and base files**

Run: `mkdir -p tools/quick-order-app/src tools/quick-order-app/test`

- [ ] **Step 2: Write `tools/quick-order-app/package.json`**

```json
{
  "name": "@schema-forge/quick-order-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev:server": "node --watch server.js",
    "dev:ui": "vite",
    "dev": "concurrently -k -n server,ui -c blue,green \"npm:dev:server\" \"npm:dev:ui\"",
    "dev:with-shell": "concurrently -k -n shell,server,ui -c magenta,blue,green \"cd ../app-shell && npm run dev\" \"npm:dev:server\" \"npm:dev:ui\"",
    "build": "vite build",
    "start": "NODE_ENV=production node server.js",
    "test": "node --test test/*.test.js"
  },
  "dependencies": {
    "@etendoerp/apps-sdk": "workspace:*",
    "@etendoerp/apps-sdk-bff": "workspace:*",
    "express": "^4.21.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "concurrently": "^9.0.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 3: Write `tools/quick-order-app/vite.config.js`**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Quick-order gets port N=1 per the SDK port allocation convention:
//   Vite UI: 5173 + 1 = 5174
//   BFF:     4100 + 1 = 4101
// See docs/proposals/etendo-apps-sdk.md §14.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': { target: 'http://localhost:4101', changeOrigin: true },
    },
  },
});
```

- [ ] **Step 4: Write `tools/quick-order-app/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Quick Order</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write `tools/quick-order-app/src/main.jsx`**

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
```

- [ ] **Step 6: Write `tools/quick-order-app/src/config.js` (type → behavior)**

```js
export const CONFIGS = {
  sales: {
    type: 'sales',
    title: 'Quick Sales Order',
    titleEs: 'Orden de venta rápida',
    headerPath: '/neo/sales-order/sales-order',
    linesPath: '/neo/sales-order/sales-order-line',
    bpCriteria: [{ fieldName: 'isCustomer', operator: 'equals', value: 'Y' }],
    plCriteria: [{ fieldName: 'isSalesPriceList', operator: 'equals', value: 'Y' }],
  },
  purchase: {
    type: 'purchase',
    title: 'Quick Purchase Order',
    titleEs: 'Orden de compra rápida',
    headerPath: '/neo/purchase-order/purchase-order',
    linesPath: '/neo/purchase-order/purchase-order-line',
    bpCriteria: [{ fieldName: 'isVendor', operator: 'equals', value: 'Y' }],
    plCriteria: [{ fieldName: 'isSalesPriceList', operator: 'equals', value: 'N' }],
  },
};

export function configFromLocation(search = window.location.search) {
  const type = new URLSearchParams(search).get('type') || 'sales';
  const cfg = CONFIGS[type];
  if (!cfg) throw new Error(`Unknown quick-order type: ${type}`);
  return cfg;
}
```

- [ ] **Step 7: Write the initial `tools/quick-order-app/src/App.jsx` (scaffold — form comes in Task 4)**

```jsx
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
```

- [ ] **Step 8: Write `tools/quick-order-app/server.js`**

```js
import express from 'express';
import { mountEtendoBff } from '@etendoerp/apps-sdk-bff';

const PORT = process.env.PORT || 4101;
const ETENDO_URL = process.env.ETENDO_URL || 'http://localhost:8080/etendo_sf2';
const JWKS_URL = process.env.JWKS_URL || 'http://localhost:3100/sws/apps/.well-known/jwks.json';
const APP_ID = 'quick-order';

const app = express();
mountEtendoBff(app, {
  appId: APP_ID,
  jwksUrl: JWKS_URL,
  etendoUrl: ETENDO_URL,
  serviceAuth: {
    user: process.env.ETENDO_SERVICE_USER || 'admin',
    password: process.env.ETENDO_SERVICE_PASSWORD || 'admin',
  },
});

app.use(express.static('dist'));

app.listen(PORT, () => console.log(`quick-order app listening on :${PORT}`));
```

- [ ] **Step 9: Write `tools/quick-order-app/.gitignore`**

```
node_modules/
dist/
.env.local
```

- [ ] **Step 10: Install deps**

Run: `npm install`
Expected: workspace picks up the new package; SDK symlinks into `tools/quick-order-app/node_modules/@etendoerp/*`.

- [ ] **Step 11: Smoke test — both BFF and UI start**

In one terminal: `cd tools/quick-order-app && npm run dev`
Expected: logs `quick-order app listening on :4101` and Vite ready on `http://localhost:5174`.
Stop with Ctrl-C.

- [ ] **Step 12: Commit**

```bash
git add tools/quick-order-app package.json package-lock.json
git commit -m "Feature ETP-3805: Scaffold quick-order-app (shared sales/purchase)"
```

---

## Task 2: Register the app in the shell's hardcoded registry

**Files:**
- Create: `tools/app-shell/src/apps-registry.js`
- Modify: `tools/app-shell/vite-plugins/apps-spike.js` (validate `appId` against the registry)

- [ ] **Step 1: Create the registry**

Write `tools/app-shell/src/apps-registry.js`:
```js
/**
 * Hardcoded registry of internal apps allowed to mint tokens via
 * /sws/apps/token and be embedded by the iframe host.
 *
 * v1 per docs/proposals/etendo-apps-sdk.md §9. A DB-backed registry is future
 * work — this module becomes the fallback/seed at that point.
 */
export const INTERNAL_APPS = [
  {
    appId: 'spike-hello-app',
    iframeUrl: 'http://localhost:5173',
    displayName: 'Spike Hello App',
  },
  {
    appId: 'quick-order',
    iframeUrl: 'http://localhost:5174',
    displayName: 'Quick Order',
  },
];

export function findAppById(appId) {
  return INTERNAL_APPS.find((a) => a.appId === appId) || null;
}
```

- [ ] **Step 2: Read the current `apps-spike.js` token handler**

Open `tools/app-shell/vite-plugins/apps-spike.js`. Locate `handleToken(req, res, appId)` (around line 112) — today it accepts any `appId` string.

- [ ] **Step 3: Validate `appId` against the registry inside `handleToken`**

At the top of `handleToken`, after the Bearer header check, add a lookup against the registry. Change the implementation to reject unknown apps with 404 `unknown_app`.

Edit the handler. Near the top of the file, add:
```js
import { INTERNAL_APPS } from '../src/apps-registry.js';
```

Inside `handleToken`, right after the `if (!authHeader || !authHeader.startsWith('Bearer '))` block, add:
```js
    const registered = INTERNAL_APPS.find((a) => a.appId === appId);
    if (!registered) {
      writeError(res, 404, `unknown_app: ${appId}`);
      return;
    }
```

Also bump the minted JWT TTL to 1 hour per the proposal decision §16 #4. In the `appsSpikePlugin` options defaults (top of the file), change:
```js
    ttlSeconds = 300,
```
to:
```js
    ttlSeconds = 3600,
```

- [ ] **Step 4: Smoke test the validation**

Start the shell: `cd tools/app-shell && npm run dev`.

In another terminal, mint an Etendo token (same as Plan 1 Task 8):
```bash
ETENDO_TOKEN=$(curl -sS -X POST http://localhost:8080/etendo_sf2/sws/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}' | jq -r .token)

# Happy path — quick-order is registered
curl -sS -X POST "http://localhost:3100/sws/apps/token?appId=quick-order" \
  -H "Authorization: Bearer $ETENDO_TOKEN" | jq

# Rejection — unknown app
curl -sS -o /dev/null -w '%{http_code}\n' -X POST \
  "http://localhost:3100/sws/apps/token?appId=not-a-real-app" \
  -H "Authorization: Bearer $ETENDO_TOKEN"
```

Expected: first call returns a JWT; second prints `404`.

- [ ] **Step 5: Commit**

```bash
git add tools/app-shell/src/apps-registry.js tools/app-shell/vite-plugins/apps-spike.js
git commit -m "Feature ETP-3805: Hardcoded internal apps registry + 1h token TTL"
```

---

## Task 3: Generalize the iframe host to accept any registered app

**Files:**
- Modify: `tools/app-shell/src/windows/spike-apps-host/AppIframeHost.jsx`
- Modify: `tools/app-shell/src/windows/spike-apps-host/index.jsx`
- Create: `tools/app-shell/src/windows/quick-order/index.jsx`

Rationale: today the iframe host is hardcoded to `spike-hello-app`. Refactor so quick-order (and future apps) reuses the same `AppIframeHost` component with different props.

- [ ] **Step 1: Read the current spike host**

Read `tools/app-shell/src/windows/spike-apps-host/index.jsx` and `.../AppIframeHost.jsx`. Understand how it currently passes `appId`, `appUrl`, `token`.

- [ ] **Step 2: Create the quick-order host window**

Write `tools/app-shell/src/windows/quick-order/index.jsx`:
```jsx
import React from 'react';
import AppIframeHost from '../spike-apps-host/AppIframeHost.jsx';
import { findAppById } from '../../apps-registry.js';

const APP = findAppById('quick-order');

export default function QuickOrderWindow({ token }) {
  // `type` comes from the menu entry via the window's query params (wired in
  // Task 5). Default to 'sales' if the menu entry forgot to set it.
  const type = new URLSearchParams(window.location.search).get('type') || 'sales';
  const iframeUrl = `${APP.iframeUrl}?type=${encodeURIComponent(type)}`;
  return <AppIframeHost appUrl={iframeUrl} appId={APP.appId} token={token} />;
}
```

- [ ] **Step 3: Verify the host component still forwards `token` into the iframe URL**

Open `tools/app-shell/src/windows/spike-apps-host/AppIframeHost.jsx`. Confirm it either appends `?jwt=<token>` to the iframe URL or posts it via message. For v1, the contract used by the spike is URL query param — the quick-order UI reads `jwt` from the URL the same way.

If the host currently appends `?jwt=<token>` unconditionally, no change needed — it will append on top of the existing `?type=…` so the final URL is e.g. `http://localhost:5174?type=sales&jwt=…`. If it overwrites the querystring, adjust it to merge rather than replace. Read the current implementation before editing.

- [ ] **Step 4: Smoke test — the host still loads the spike**

`cd tools/app-shell && npm run dev` — navigate to the spike iframe window as before. Expected: unchanged behavior, no regression.

- [ ] **Step 5: Commit**

```bash
git add tools/app-shell/src/windows/quick-order tools/app-shell/src/windows/spike-apps-host
git commit -m "Feature ETP-3805: Add quick-order host window reusing AppIframeHost"
```

---

## Task 4: Build the quick-order form (shared between sales and purchase)

**Files:**
- Modify: `tools/quick-order-app/src/App.jsx`
- Create: `tools/quick-order-app/src/components/OrderForm.jsx`
- Create: `tools/quick-order-app/src/components/LinesGrid.jsx`
- Create: `tools/quick-order-app/src/hooks/useLookup.js`
- Create: `tools/quick-order-app/test/config.test.js`

**Scope:** minimum viable quick-order — pick a business partner, add one or more product lines with quantity + price, save. Callout for price-from-pricelist is out of scope (the NEO upstream computes it). Full doc lifecycle (complete, post) is out of scope — save as Draft only.

- [ ] **Step 1: Test the config helper**

Write `tools/quick-order-app/test/config.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configFromLocation } from '../src/config.js';

test('defaults to sales when type missing', () => {
  const cfg = configFromLocation('');
  assert.equal(cfg.type, 'sales');
  assert.equal(cfg.headerPath, '/neo/sales-order/sales-order');
});

test('picks purchase config when type=purchase', () => {
  const cfg = configFromLocation('?type=purchase');
  assert.equal(cfg.type, 'purchase');
  assert.equal(cfg.linesPath, '/neo/purchase-order/purchase-order-line');
});

test('throws on unknown type', () => {
  assert.throws(() => configFromLocation('?type=rental'), /Unknown quick-order type: rental/);
});
```

Run: `npm test --workspace=@schema-forge/quick-order-app`
Expected: 3/3 pass.

- [ ] **Step 2: Build the lookup hook**

Write `tools/quick-order-app/src/hooks/useLookup.js`:
```js
import { useEffect, useState } from 'react';

/**
 * Minimal NEO lookup — fetches up to `pageSize` records matching `criteria`.
 * Shape matches the NEO `response.data` array. No pagination for v1.
 */
export function useLookup(shell, { path, criteria = [], pageSize = 50, enabled = true }) {
  const [state, setState] = useState({ loading: enabled, items: [], error: null });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ loading: true, items: [], error: null });
    const query = new URLSearchParams({ _pageSize: String(pageSize) });
    if (criteria.length) query.set('_criteria', JSON.stringify(criteria));
    shell.fetch(`${path}?${query}`)
      .then((body) => {
        if (cancelled) return;
        setState({ loading: false, items: body?.response?.data || [], error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ loading: false, items: [], error: err.message });
      });
    return () => { cancelled = true; };
  }, [path, JSON.stringify(criteria), pageSize, enabled]);

  return state;
}
```

- [ ] **Step 3: Build `OrderForm.jsx` (header)**

Write `tools/quick-order-app/src/components/OrderForm.jsx`:
```jsx
import React, { useState } from 'react';
import { useLookup } from '../hooks/useLookup.js';

const BP_LOOKUP_PATH = '/neo/bp-location/business-partner';

export default function OrderForm({ shell, cfg, onSave }) {
  const [bpId, setBpId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const bps = useLookup(shell, { path: BP_LOOKUP_PATH, criteria: cfg.bpCriteria });

  async function handleSave(e) {
    e.preventDefault();
    if (!bpId) { setError('Select a business partner'); return; }
    setSaving(true); setError(null);
    try {
      const body = {
        data: {
          businessPartner: bpId,
          orderDate,
          documentStatus: 'DR', // Draft
        },
      };
      const result = await shell.fetch(cfg.headerPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onSave?.(result.response?.data?.[0]?.id || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
      <label style={{ display: 'grid', gap: 4 }}>
        <span>Business partner</span>
        <select value={bpId} onChange={(e) => setBpId(e.target.value)} disabled={bps.loading}>
          <option value="">— select —</option>
          {bps.items.map((bp) => (
            <option key={bp.id} value={bp.id}>{bp._identifier || bp.name}</option>
          ))}
        </select>
      </label>
      <label style={{ display: 'grid', gap: 4 }}>
        <span>Order date</span>
        <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
      </label>
      {error && <div style={{ color: '#b91c1c' }}>{error}</div>}
      <button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save draft'}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Build `LinesGrid.jsx`**

Write `tools/quick-order-app/src/components/LinesGrid.jsx`:
```jsx
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

  if (!orderId) return <p style={{ color: '#6b7280' }}>Save the header first to add lines.</p>;

  async function addLine() {
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
      setLines((prev) => [...prev, result.response?.data?.[0]]);
      setProductId(''); setQty(1); setPrice('0');
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600 }}>Lines</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8 }}>
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
      {error && <div style={{ color: '#b91c1c' }}>{error}</div>}
      {lines.length > 0 && (
        <ul style={{ marginTop: 8 }}>
          {lines.map((l) => (
            <li key={l.id}>{l._identifier || l.id} — qty {l.orderedQuantity} @ {l.unitPrice}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Wire them into `App.jsx`**

Replace `tools/quick-order-app/src/App.jsx` with:
```jsx
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
```

- [ ] **Step 6: Commit**

```bash
git add tools/quick-order-app/src tools/quick-order-app/test
git commit -m "Feature ETP-3805: Build quick-order form + lines grid (shared sales/purchase)"
```

---

## Task 5: Add the two menu entries in the shell

**Files:**
- Modify: the shell's menu / routing config (exact location depends on how the app-shell registers windows — inspect first)

- [ ] **Step 1: Locate the shell's menu registration**

Run: `grep -rn "spike-hello-app\|spike-apps-host" tools/app-shell/src --include="*.js" --include="*.jsx" --include="*.json"`

Read the file(s) that register the spike window. They are the template for adding two new menu entries.

- [ ] **Step 2: Register both menu entries**

Following the same pattern the spike uses, register two menu entries that both point to the `QuickOrderWindow` from Task 3 but with different `type` query params:

| id | Label (en) | Label (es) | Route |
|----|-----------|-----------|-------|
| `quick-sales-order` | Quick Sales Order | Orden de venta rápida | `/app/quick-order?type=sales` |
| `quick-purchase-order` | Quick Purchase Order | Orden de compra rápida | `/app/quick-order?type=purchase` |

(Exact JSX/JSON syntax depends on how the menu is wired — follow the spike's pattern. If you find that the menu stores routes and the window reads `type` from the URL, the two entries just differ in the stored route.)

- [ ] **Step 3: Smoke test the menu**

`cd tools/app-shell && npm run dev`. Navigate to Quick Sales Order — expect the iframe to load `http://localhost:5174?type=sales&jwt=…`. Navigate to Quick Purchase Order — expect `?type=purchase&jwt=…`.

- [ ] **Step 4: Commit**

```bash
git add tools/app-shell
git commit -m "Feature ETP-3805: Menu entries for Quick Sales/Purchase Order"
```

---

## Task 6: End-to-end manual verification

No code changes in this task — it is a gated checkpoint before PR.

- [ ] **Step 1: Start all three processes**

```bash
cd tools/quick-order-app && npm run dev:with-shell
```
Wait for `shell` (3100), `server` (4101), `ui` (5174).

- [ ] **Step 2: Log in and open Quick Sales Order**

- Open `http://localhost:3100`, log in as the Etendo admin.
- Click the "Quick Sales Order" menu entry.
- Expect: iframe renders with "Quick Sales Order" title, user + tenant line, business-partner dropdown populated with customers.

- [ ] **Step 3: Create a sales order**

- Pick a BP, keep today's date.
- Click "Save draft" → expect no error, form moves to Lines section.
- Add a product, qty 1, price 100 → expect the line to appear in the list.

- [ ] **Step 4: Verify the record landed in Etendo**

Either through the classic Etendo UI (Sales Order window) or via curl against NEO:
```bash
ETENDO_TOKEN=$(curl -sS -X POST http://localhost:8080/etendo_sf2/sws/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}' | jq -r .token)
APP_TOKEN=$(curl -sS -X POST "http://localhost:3100/sws/apps/token?appId=quick-order" \
  -H "Authorization: Bearer $ETENDO_TOKEN" | jq -r .token)
curl -sS "http://localhost:4101/api/etendo/neo/sales-order/sales-order?_sortBy=-creationDate&_pageSize=1" \
  -H "Authorization: Bearer $APP_TOKEN" | jq '.response.data[0] | {id, documentNo, documentStatus}'
```
Expect the most recent row to match the order you just created, with `documentStatus: "DR"`.

- [ ] **Step 5: Repeat for Quick Purchase Order**

Same flow, pick "Quick Purchase Order" from the menu. Confirm:
- BP dropdown shows vendors (not customers).
- Saved order lands in `purchase-order` spec, not `sales-order`.

- [ ] **Step 6: Regression — the spike still works**

Open the spike menu entry. Confirm the hello-world flow (`/api/me` + NEO `product`) still renders.

- [ ] **Step 7: Run the full test suite**

Run: `npm test --workspaces --if-present`
Expected: all tests green across SDK packages, spike, quick-order, cli.

- [ ] **Step 8: Commit any adjustments made during manual testing**

If any bugs surfaced and were fixed, commit them with descriptive messages. If the manual flow is clean, no commit in this step.

---

## Task 7: Update documentation

**Files:**
- Modify: `docs/proposals/etendo-apps-sdk.md` — bump port allocation table and mark Phase C done
- Modify: `docs/proposals/INDEX.md` — no change unless status shifts
- Create: `tools/quick-order-app/INDEX.md` (per AGENTS.md, every versioned folder needs one)

- [ ] **Step 1: Write `tools/quick-order-app/INDEX.md`**

```md
# tools/quick-order-app

Unified external app for Quick Sales Order and Quick Purchase Order, driven by the `type` query param (`sales` | `purchase`).

Consumes the SDK packages:
- `@etendoerp/apps-sdk` (browser) — shell client, fetches data via the BFF.
- `@etendoerp/apps-sdk-bff` (Node) — mounts `/health`, `/api/me`, `/api/etendo/*`.

## Ports (dev)

- Vite UI: `5174`
- BFF: `4101`

## Layout

- `src/App.jsx` — root, picks config from `?type`, renders header + lines.
- `src/config.js` — per-variant configuration (paths, criteria, titles).
- `src/components/OrderForm.jsx` — header form.
- `src/components/LinesGrid.jsx` — lines grid.
- `src/hooks/useLookup.js` — minimal NEO criteria-based fetch.
- `server.js` — Express BFF wired through `mountEtendoBff`.

## Scripts

- `npm run dev` — Vite + BFF.
- `npm run dev:with-shell` — Vite + BFF + app-shell together.
- `npm run build` — production UI build.
- `npm start` — production BFF (serves `dist/`).
- `npm test` — unit tests.

## Reference docs

- Proposal: `docs/proposals/etendo-apps-sdk.md`
- Plan: `docs/plans/2026-04-17-quick-order-app-plan.md`
```

- [ ] **Step 2: Update the proposal's status**

Open `docs/proposals/etendo-apps-sdk.md`. Update the implementation-status line added in Plan 1 Task 9 to:
```
> **Implementation status (2026-04-17):** Phase A+B+C complete. SDK packages live, spike and quick-order consume them. First real consumer (`quick-order`) ships with two menu entries (sales/purchase).
```

- [ ] **Step 3: Commit**

```bash
git add docs/proposals/etendo-apps-sdk.md tools/quick-order-app/INDEX.md
git commit -m "Feature ETP-3805: Document quick-order app + mark Phase C complete"
```

---

## Task 8: PR

- [ ] **Step 1: Delegate to Clerk**

Clerk handles the PR from `feature/ETP-3805` to `main` with a body that references all three phases (A, B, C) and links the proposal + both plans. Do not run `gh pr create` directly — Clerk's template includes the required checklist.

---

## Definition of done

- `tools/quick-order-app/` runs on dev and serves both `type=sales` and `type=purchase` flows.
- A new sales order and a new purchase order can be created end-to-end, each landing in their own NEO spec.
- The spike still works (regression passed).
- `npm test --workspaces --if-present` green.
- Proposal status updated, INDEX.md present.
- PR opened by Clerk, awaiting REVIEW + QA + DOCS phases.

## Scope boundaries (not in this plan)

- **No pricelist callout / price auto-fill.** The user types the unit price manually in v1.
- **No document complete / post.** v1 only saves as Draft.
- **No edit of existing orders.** v1 creates new orders only.
- **No product search beyond basic dropdown.** Typeahead / filter deferred.
- **No i18n beyond hardcoded ES/EN titles in config.** Proper `useUI()` / `useLabel()` integration is an app-shell concern (quick-order runs in an iframe — it does not have access to the shell's locale hook in v1).
- **No Etendo-side records cleanup on failure.** If the header saves but the line fails, the draft header stays. User can delete it from the classic UI.
