---
marp: true
theme: default
paginate: true
header: "Etendo Apps SDK · Quick Order demo"
footer: "ETP-3805 · 2026-04-20"
style: |
  section { font-family: 'Inter', -apple-system, sans-serif; font-size: 28px; }
  h1 { color: #1f3a5f; }
  h2 { color: #2563eb; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
  pre { background: #0f172a; color: #e2e8f0; border-radius: 8px; padding: 16px; font-size: 20px; }
  .muted { color: #64748b; }
---

# Etendo Apps SDK

### Building external apps that feel native to the shell

**Demo:** `quick-order-app` — a real consumer of the SDK
Shell menu entries: _Quick Order — Sales (SDK)_ · _Quick Order — Purchase (SDK)_

<span class="muted">ETP-3805 · `feature/ETP-3805` · PR #352</span>

---

## The problem

Every new UI feature today means:

- Adding a new route inside the shell (`tools/app-shell/src/pages/...`)
- Editing shell state, i18n, design system on every change
- One deploy unit → every team waits on shell release

We want apps that:

- Live in their own repo / folder / deploy lane
- Still inherit the shell session, API access, and look
- Can be written by teams that don't know the shell internals

---

## The shape of the answer

<br/>

```
┌────────────────────────────┐        ┌──────────────────────────┐
│         Etendo shell       │        │     External app (Vite)  │
│  ┌──────────────────────┐  │        │  ┌────────────────────┐  │
│  │ React SPA            │  │ iframe │  │ React/Vue/any UI   │  │
│  │  AppIframeHost  ─────┼──┼────────┼─▶│  consumes SDK      │  │
│  └──────────────────────┘  │  JWT   │  └─────────┬──────────┘  │
│                            │        │            │             │
└────────────────────────────┘        │  ┌─────────▼──────────┐  │
                                      │  │ Node BFF (Express) │  │
                                      │  │ mountEtendoBff()   │  │
                                      │  └─────────┬──────────┘  │
                                      └────────────┼─────────────┘
                                                   ▼
                                            Etendo / NEO
```

---

## Two packages, one contract

### `@etendoerp/apps-sdk` (browser)

```js
import { createShellClient } from '@etendoerp/apps-sdk';
import '@etendoerp/apps-sdk/styles.css';   // inherit shell look

const shell = createShellClient({
  appId: 'quick-order',
  token: new URLSearchParams(location.search).get('jwt'),
});

await shell.me();                          // who am I?
await shell.fetch('/neo/sales-order/sales-order', { method: 'POST', ... });
```

### `@etendoerp/apps-sdk-bff` (Node)

```js
import express from 'express';
import { mountEtendoBff } from '@etendoerp/apps-sdk-bff';

const app = express();
mountEtendoBff(app);   // /health · /api/me · /api/etendo/*
```

---

## The JWT + service-account bridge

1. Shell mints a short-lived **app JWT** (RS256, claims: `userId`, `appId`, `tenant`).
2. App receives it via `?jwt=...` when the iframe loads.
3. SDK sends it on every call as `Authorization: Bearer <jwt>`.
4. BFF verifies the JWT (JWKS fetched from the shell).
5. BFF swaps it for a **service-account token** before calling NEO.

The app never sees the Etendo service token — only its scoped JWT.
<br/>

> **Why:** apps are sandboxed, revocable, and can be rate-limited per `appId` without touching Etendo sessions.

---

## Shared look via CSS tokens

Without tokens, iframe apps look like an unstyled Vite page.
One import fixes the visual disconnect.

```js
import '@etendoerp/apps-sdk/styles.css';
```

Ships the same `:root` tokens the shell uses (`--background`, `--foreground`,
`--primary`, `--border`, `--radius`, ...) plus minimal element defaults
for `body`, headings, buttons, inputs, tables.

<span class="muted">Proposal: `docs/proposals/apps-sdk-styling.md`</span>

---

## Demo: Quick Order

**One app, two menu entries** — differentiated by `?type=sales|purchase`.

| Menu entry                     | Slug                    | `type`     |
|--------------------------------|-------------------------|------------|
| Quick Order — Sales (SDK)      | `quick-order-sales`     | `sales`    |
| Quick Order — Purchase (SDK)   | `quick-order-purchase`  | `purchase` |

Config in `src/config.js` controls per-variant:

- Entity paths (`/neo/sales-order/sales-order` vs `/neo/purchase-order/...`)
- Business-partner criteria (`isCustomer=Y` vs `isVendor=Y`)
- Title, price-list filter

---

## Quick Order — data flow

```
 User types in search → ProductGrid
        │
        ▼
 shell.fetch('/neo/product/product?_pageSize=100')
        │  (JWT → BFF → service token → NEO)
        ▼
 Cards rendered ── click ──▶ cartReducer ──▶ CartPanel
                                  │
                        user edits qty / price / removes
                                  │
                         clicks "Save draft"
                                  │
         shell.fetch(header POST) ──▶ orderId
                                  │
        for each line: shell.fetch(line POST, { salesOrder: orderId, ... })
```

All traffic goes through the SDK. No direct `fetch` to Etendo.

---

## Quick Order — UI

**Two-column layout**, inspired by the ETP-3677 PoC:

- **Left:** `CustomerSelector` (searchable BP) · `ProductGrid` (searchable cards).
- **Right:** `CartPanel` — lines with `− qty +`, inline-editable price, remove, subtotal, `Save draft`.

**Cart reducer** (`hooks/useCart.js`): `ADD_ITEM` / `UPDATE_QTY` / `UPDATE_PRICE` / `REMOVE_ITEM` / `CLEAR_CART`. Merge-on-duplicate; qty 0 deletes line.

9 unit tests cover the reducer; 3 cover config resolution.

---

## Before → after

| Aspect                  | Inline shell page (ETP-3677)          | SDK-hosted app (ETP-3805)                         |
|-------------------------|---------------------------------------|---------------------------------------------------|
| Where it lives          | `tools/app-shell/src/pages/...`       | `tools/quick-order-app/` (own workspace + BFF)    |
| Deploy unit             | Couples to the shell bundle           | Independent; shell just opens the iframe          |
| Etendo access           | Shared session                        | Sandboxed app JWT → service token bridge          |
| Shell design system     | Tailwind + shadcn (native)            | Tokens via `@etendoerp/apps-sdk/styles.css`       |
| Data ownership          | Shell-owned state                     | App-owned state; shell is pure host               |
| Team coupling           | Every change through shell team       | App team ships on its own cadence                 |

---

## Trade-offs (honest)

**What iframe hosting costs us:**

- Separate JS context → no direct access to shell state / router / toasts.
- Styling is propagated via tokens, not components — no shadcn `<Button>`.
- Two deploy targets to watch (shell + app BFF).

**What it gives us:**

- Hard isolation: an app can't crash the shell.
- Clear API surface: only what the SDK exposes is usable.
- Independent iteration for app teams.
- Same visual language if the app imports `styles.css`.

---

## What this unlocks

- **New apps without shell PRs.** Spin up a folder, consume the SDK, register in `apps-registry.js`, done.
- **Internal tooling as first-class apps.** Smart Scan, Connections, custom reports.
- **Third-party distribution (later).** Same SDK + descriptor story, just hosted elsewhere.
- **Parallel development.** Different teams, different repos, same UX.

---

## Status · what's live today

- `@etendoerp/apps-sdk` and `@etendoerp/apps-sdk-bff` packages published to the workspace.
- Spike app (`tools/spike-hello-app`) migrated onto the SDK.
- `tools/quick-order-app` ships with:
  - Cart reducer + 2-column POS-subset UI.
  - Real draft-save flow (header + lines) through NEO.
  - Shell CSS tokens applied.
- PR `#352` against `main` · 12 unit tests green.

---

## Next steps

- User review + merge PR #352.
- Unblock the BP-location lookup 403 (external team tracking).
- Add the style import to `spike-hello-app` for consistency.
- Evaluate Option B (Tailwind preset) once a second consumer exists.
- Document the descriptor / registration flow for third-party apps.

<br/>

### Questions?

<span class="muted">docs: `docs/proposals/etendo-apps-sdk.md` · `docs/proposals/apps-sdk-styling.md` · `tools/quick-order-app/INDEX.md`</span>
