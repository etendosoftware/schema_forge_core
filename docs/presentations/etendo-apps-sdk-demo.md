---
marp: true
theme: default
paginate: true
size: 16:9
header: "Etendo Apps SDK"
footer: "ETP-3805 · 2026-04-20"
style: |
  section {
    font-family: 'Inter', -apple-system, sans-serif;
    font-size: 26px;
    padding: 60px 80px;
    line-height: 1.5;
  }
  section.lead {
    text-align: center;
    justify-content: center;
  }
  h1 {
    color: #1f3a5f;
    font-size: 44px;
    margin-bottom: 24px;
  }
  h2 {
    color: #2563eb;
    font-size: 36px;
    margin-bottom: 32px;
  }
  h3 {
    color: #475569;
    font-size: 24px;
    font-weight: 500;
  }
  p, li { margin-bottom: 12px; }
  ul, ol { margin-left: 8px; }
  code {
    background: #f1f5f9;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 22px;
  }
  pre {
    background: #0f172a;
    color: #e2e8f0;
    border-radius: 8px;
    padding: 20px 24px;
    font-size: 20px;
    line-height: 1.5;
  }
  table {
    font-size: 22px;
    margin-top: 16px;
  }
  th, td { padding: 10px 14px; }
  .muted { color: #64748b; }
  .big { font-size: 32px; }
  .tiny { font-size: 18px; color: #94a3b8; }
  blockquote {
    border-left: 4px solid #2563eb;
    padding: 4px 16px;
    color: #475569;
    font-style: italic;
  }
---

<!-- _class: lead -->

# Etendo Apps SDK

## <span class="muted">External apps that feel native to the shell</span>

<br/>

<span class="tiny">ETP-3805 · PR #352 · 2026-04-20</span>

---

<!-- _class: lead -->

## The problem

<br/>

<span class="big">Every UI feature today<br/>means editing the shell.</span>

---

## Today's pain

<br/>

- New route → edit `tools/app-shell/src/pages/...`

- New state → edit shell reducers

- New API call → shared session, shared deploy

<br/>

> **One bundle. One deploy lane. Everyone waits.**

---

<!-- _class: lead -->

## What if apps were independent?

<br/>

<span class="muted">Own repo. Own deploy. Still part of the shell.</span>

---

## The shape of the answer

```
┌────────────────────┐   iframe    ┌────────────────────┐
│   Etendo shell     │   + JWT     │  External app      │
│                    │──────────▶  │  (Vite / React)    │
│   AppIframeHost    │             │                    │
└────────────────────┘             │    uses the SDK    │
                                   │                    │
                                   └─────────┬──────────┘
                                             │
                                   ┌─────────▼──────────┐
                                   │ Node BFF (Express) │
                                   │  mountEtendoBff()  │
                                   └─────────┬──────────┘
                                             ▼
                                         Etendo / NEO
```

---

<!-- _class: lead -->

## Two packages

---

## `@etendoerp/apps-sdk`

### <span class="muted">Browser · talks to the BFF · inherits shell look</span>

```js
import { createShellClient } from '@etendoerp/apps-sdk';
import '@etendoerp/apps-sdk/styles.css';

const shell = createShellClient({
  appId: 'quick-order',
  token: new URLSearchParams(location.search).get('jwt'),
});
```

---

## `@etendoerp/apps-sdk-bff`

### <span class="muted">Node · verifies JWT · swaps for service token</span>

```js
import express from 'express';
import { mountEtendoBff } from '@etendoerp/apps-sdk-bff';

const app = express();

mountEtendoBff(app);
// → /health · /api/me · /api/etendo/*
```

---

<!-- _class: lead -->

## JWT bridge

<br/>

<span class="muted">Apps never see the Etendo service token.</span>

---

## How auth flows

<br/>

1. Shell mints a **short-lived JWT** for the app.

2. App receives it via `?jwt=...` on iframe load.

3. SDK sends it as `Authorization: Bearer` on every call.

4. BFF verifies the JWT (JWKS).

5. BFF swaps it for a **service-account token** → NEO.

---

## Why it matters

<br/>

- Apps are **sandboxed** — revocable per `appId`.

- Rate-limits per app, not per session.

- The service-account secret **never leaves the BFF**.

<br/>

> Security surface is small and auditable.

---

<!-- _class: lead -->

## Shared look

<br/>

<span class="big">One import.</span>

---

## `@etendoerp/apps-sdk/styles.css`

<br/>

Ships the **same tokens the shell uses**:

```
--background   --foreground   --primary
--border       --radius       --muted
```

Plus minimal defaults for `body`, `h1..h6`, `button`, `input`, `table`.

<br/>

<span class="tiny">Proposal: <code>docs/proposals/apps-sdk-styling.md</code></span>

---

<!-- _class: lead -->

# Demo

## Quick Order

---

## One app, two menu entries

<br/>

| Menu entry                     | `?type`     |
|--------------------------------|-------------|
| Quick Order — Sales (SDK)      | `sales`     |
| Quick Order — Purchase (SDK)   | `purchase`  |

<br/>

Config in `src/config.js` drives:

- NEO paths (`/neo/sales-order/...` vs `/neo/purchase-order/...`)
- BP criteria (`isCustomer=Y` vs `isVendor=Y`)

---

## The UI

<br/>

- **Left:** customer selector · product grid.

- **Right:** cart — qty `−/+`, editable price, remove, total.

- **Action:** `Save draft` → POST header, loop POST each line.

<br/>

9 reducer tests + 3 config tests. All green.

---

## Data flow on save

```
        Click "Save draft"
               │
               ▼
   shell.fetch(header POST)  ─→  orderId
               │
               ▼
     for each line in cart:
       shell.fetch(line POST, { salesOrder: orderId, ... })
               │
               ▼
         JWT → BFF → service token → NEO
```

<br/>

<span class="muted">Every call goes through the SDK. No direct fetch to Etendo.</span>

---

<!-- _class: lead -->

## Before vs after

---

## Inline page (ETP-3677)

<br/>

- Lives in `tools/app-shell/src/pages/`

- Deploys with the shell

- Shares shell state directly

- Changes require shell PRs

---

## SDK-hosted app (ETP-3805)

<br/>

- Lives in `tools/quick-order-app/`

- Own BFF, own build

- Sandboxed JWT → service token

- Ships on its own cadence

<br/>

> Same design language, independent delivery.

---

<!-- _class: lead -->

## Trade-offs

---

## What iframes cost us

<br/>

- Separate JS context — no direct shell state/router.

- No shadcn components — styling via tokens only.

- Two deploy targets (shell + app BFF).

---

## What iframes give us

<br/>

- **Hard isolation** — an app can't crash the shell.

- **Clear API** — only the SDK is usable.

- **Parallel teams** — ship on your own rhythm.

- **Same look** — shared tokens.

---

<!-- _class: lead -->

## What it unlocks

---

## New doors

<br/>

- New apps **without shell PRs**.

- Internal tooling as first-class apps.

- Third-party distribution path (later).

- Many teams, one consistent UX.

---

<!-- _class: lead -->

## Status

---

## Live today

<br/>

- `@etendoerp/apps-sdk` + `apps-sdk-bff` — published.

- Spike app migrated onto the SDK.

- `quick-order-app` ships with:
  - 2-column POS-subset UI
  - Real draft save through NEO
  - Shell CSS tokens applied

- **PR #352** — 12 unit tests green.

---

## Next steps

<br/>

- Merge PR #352.

- Unblock BP lookup 403 (external).

- Apply `styles.css` to spike app.

- Document the third-party app registration flow.

---

<!-- _class: lead -->

# Questions?

<br/>

<span class="tiny">
<code>docs/proposals/etendo-apps-sdk.md</code><br/>
<code>docs/proposals/apps-sdk-styling.md</code><br/>
<code>tools/quick-order-app/INDEX.md</code>
</span>
