# tools/quick-order-app

Unified external app for Quick Sales Order and Quick Purchase Order, driven by the `type` query param (`sales` | `purchase`). Both shell menu entries (`quick-sales-order`, `quick-purchase-order`) load the same iframe UI and the shell-side window wrapper maps the menu slug to a `type`.

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

## Scope (v1)

- Save header + lines as Draft only (`documentStatus: 'DR'`).
- No pricelist callout, no edit, no complete/post.

## Reference docs

- Proposal: `docs/proposals/etendo-apps-sdk.md`
- Plan: `docs/plans/2026-04-17-quick-order-app-plan.md`
