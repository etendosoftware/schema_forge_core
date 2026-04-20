# tools/quick-order-app

Unified external app for Quick Sales Order and Quick Purchase Order, driven by the `type` query param (`sales` | `purchase`). Both shell menu entries (`quick-order-sales`, `quick-order-purchase`) load the same iframe UI and the shell-side window wrapper maps the menu slug to a `type`.

Consumes the SDK packages:
- `@etendoerp/apps-sdk` (browser) — shell client, fetches data via the BFF, plus shared CSS tokens (`@etendoerp/apps-sdk/styles.css`).
- `@etendoerp/apps-sdk-bff` (Node) — mounts `/health`, `/api/me`, `/api/etendo/*`.

## Ports (dev)

- Vite UI: `5174`
- BFF: `4101`

## UX

Two-column layout inspired by the ETP-3677 `/quick-sales-order` PoC:

- Left: `CustomerSelector` (searchable BP) + `ProductGrid` (searchable product cards).
- Right: `CartPanel` — lines with inline qty `-/+`, editable unit price, remove button, subtotal, `Save draft` action.
- Save draft flow: POST header → loop POST each line to the per-type NEO path.

## Layout

- `src/App.jsx` — root, picks config from `?type`, wires shell client, owns cart state + save-draft flow, renders two columns.
- `src/config.js` — per-variant configuration (paths, BP criteria, titles).
- `src/hooks/useCart.js` — cart reducer (`ADD_ITEM` / `UPDATE_QTY` / `UPDATE_PRICE` / `REMOVE_ITEM` / `CLEAR_CART`) + `useCart` hook.
- `src/hooks/useLookup.js` — minimal NEO criteria-based fetch.
- `src/components/CustomerSelector.jsx` — searchable BP picker.
- `src/components/ProductGrid.jsx` — searchable product grid, click to add to cart.
- `src/components/CartPanel.jsx` — cart lines, qty +/-, inline price edit, total, `Save draft`.
- `src/app.css` — app-level layout/cards; design tokens come from the SDK.
- `server.js` — Express BFF wired through `mountEtendoBff`.

## Scripts

- `npm run dev` — Vite + BFF.
- `npm run dev:with-shell` — Vite + BFF + app-shell together.
- `npm run build` — production UI build.
- `npm start` — production BFF (serves `dist/`).
- `npm test` — unit tests (cart reducer + config resolution).

## Scope (v1)

- Save header + lines as Draft only (`documentStatus: 'DR'`).
- No pricelist callout, no edit-after-save, no complete/post, no barcode scanner, no payment panel.

## Reference docs

- Proposal: `docs/proposals/etendo-apps-sdk.md`
- Styling: `docs/proposals/apps-sdk-styling.md`
- Plan: `docs/plans/2026-04-17-quick-order-app-plan.md`
