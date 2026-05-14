# Plan — Envelope quick-action + configurable Send/Download modal

**Date:** 2026-05-12
**Branch:** `feature/ETP-3914`
**Status:** Proposal — not yet implemented

## Background

The envelope icon in the row quick-actions currently only appears on
`sales-invoice` and `purchase-invoice`, because those are the two windows that
wire `documentPreview: true` in their `rowQuickActions` config and mount
`<SendDocumentModal>` manually.

User asks for:

1. Show the envelope quick-action on **every documental window** (not only when
   `documentPreview` is set).
2. Make it possible to **disable** it per window via `decisions.json`.
3. Make the modal's **email column** optional per window — e.g.
   `purchase-invoice` should show preview + download, but no email send.

The proposal also has to coexist with the existing `documentPreview` feature
(used by `return-from-customer` and `payment-in` for the preview popup) without
touching it.

## Current state (verified)

- `RowQuickActions.jsx:224` renders the envelope only when
  `documentPreview && passesVisibleWhen('email')`.
- Only `sales-invoice/index.jsx` and `purchase-invoice/index.jsx` wire `onEmail`
  and mount `<SendDocumentModal>` (duplicated boilerplate).
- `SendDocumentModal.jsx:25` always renders two columns: preview/download (left)
  and email form (right). No flag to hide the email column.
- `SendDocumentModal.jsx:63` builds `reportId = print-${windowName}` and fetches
  `/api/reports/{reportId}/render`.
- `decisions.json` `window.documentPreview` is a **separate** feature (the
  preview popup) — unrelated to the row quick-action gate. Stays untouched.

## Proposal

### A. New decisions node: `window.sendDocument`

Two boolean flags, both default `true`. Only written in `decisions.json` when
deviating from the default.

```jsonc
"window": {
  "sendDocument": {
    "enabled": false,     // omit = true. Set only to hide the envelope.
    "allowEmail": false   // omit = true. Set only to hide the email column in the modal.
  }
}
```

- `enabled` decides whether the envelope quick-action is shown — **independent
  of `documentPreview`**.
- `allowEmail` decides whether the email column is rendered in the modal.
- `titlePrefix`, `documentTypeKey`, PDF hook, etc. keep working exactly like
  today — the modal already takes them from the props each window passes.

### B. Eligibility gate (so it does not clash with master-data windows)

`enabled: true` by default cannot mean "every window shows envelope" — tax,
product, UOM, etc. would get an envelope that points nowhere.

A window is **eligible** for the envelope only if both conditions hold:

1. The header entity declares a `documentNo` field.
2. A `print-{spec}` report exists for the window.

The generator (`generate-frontend.js`) computes eligibility at build time and
emits the resolved value into the contract. Runtime reads a single resolved
boolean — no heuristics in components.

### C. `decisions.json` override wins over auto-eligibility

`sendDocument.enabled` in `decisions.json`, when present, overrides the
auto-eligibility in both directions:

| `eligible` (auto) | `enabled` in decisions | Result |
|---|---|---|
| true  | omitted   | envelope visible (default) |
| true  | `false`   | envelope hidden (explicit opt-out) |
| false | omitted   | envelope hidden |
| false | **`true`** | **envelope visible (forced)** |

### D. Final resolution (pseudo-code in the generator)

```js
const eligible    = hasDocumentNo(header) && hasPrintReport(specName);
const decided     = decisions.window?.sendDocument?.enabled;
const enabled     = decided !== undefined ? decided : eligible;
const allowEmail  = decisions.window?.sendDocument?.allowEmail !== false;
```

The contract emits the resolved values:

```jsonc
"window": {
  "sendDocument": { "enabled": true, "allowEmail": true }
}
```

### E. Generic mount in `ListView`

Today every custom window mounts `<SendDocumentModal>` manually. Centralize:

1. New hook `useSendDocument({ apiBaseUrl, token, windowName, sendDocument })`
   in `src/hooks/`:
   - Returns `(row) => openModal(row)` to use as `onEmail`.
   - Renders `<SendDocumentModal …/>` configured with `allowEmail` propagated.
2. `ListView` mounts the modal automatically when `sendDocument.enabled` and
   the window did **not** pass its own `onEmail` — same "fill blanks" pattern
   already used for `onEdit`/`onDelete` (`ListView.jsx:296-304`).
3. Custom windows that supply `onEmail` keep winning — their overrides are
   preserved.

### F. Component changes (concrete)

| File | Change |
|---|---|
| `RowQuickActions.jsx:224` | Replace `documentPreview &&` by `(sendDocument?.enabled !== false) &&`. Accept new prop `sendDocument`. |
| `ListView.jsx` (`effectiveRowQuickActions`) | If `sendDocument.enabled !== false` and no `onEmail`, inject default handler + render modal via `useSendDocument`. |
| `DetailView.jsx:157,1365` | Same gate switch — replace `documentPreview` with `sendDocument.enabled` for the toolbar Send/Download button so the flag is consistent across list and detail. |
| `SendDocumentModal.jsx:25` | New prop `allowEmail = true`. When `false`: hide the right column (To / Subject / Message) and replace the footer "Enviar" with a single "Cerrar". The left-column Download PDF stays. |
| `cli/src/generate-frontend.js:696,726` | Compute eligibility + resolve `sendDocument`. Emit as prop to `ListView` and `DetailView`. |
| `cli/src/resolve-curated.js` | Apply defaults in memory (`enabled: <eligible>`, `allowEmail: true`) when the key is absent in decisions. |

### G. Tests (to be delegated to Tester)

- `RowQuickActions.vitest.jsx`: envelope shown by default; hidden when
  `sendDocument.enabled: false`.
- New `SendDocumentModal.vitest.jsx`: email column present by default; absent
  when `allowEmail: false`; footer text/buttons change accordingly.
- Generator fixture: contract resolves correctly for the four combinations of
  the eligibility × override matrix.

### H. Per-window decisions after rollout

Only edit `decisions.json` when deviating from the default:

| Window | `decisions.json` entry |
|---|---|
| sales-invoice, sales-order, purchase-order, sales-quotation, goods-shipment, goods-receipt, returns, payments… | nothing (defaults apply) |
| **purchase-invoice** | `window.sendDocument: { allowEmail: false }` |
| documental window where the feature is not ready yet | `window.sendDocument: { enabled: false }` |
| non-documental window where we still want the envelope manually | `window.sendDocument: { enabled: true }` |

### I. Coexistence with existing code

- `documentPreview` at the `window.*` level (`return-from-customer`,
  `payment-in`) remains untouched. It only controls the preview popup, as
  before.
- `documentPreview` inside `rowQuickActions` in `sales-invoice` /
  `purchase-invoice` becomes unused once the new gate ships. Cleanup is a
  follow-up PR.
- Existing custom mounts of `<SendDocumentModal>` keep working until removed;
  their `onEmail` override beats the generic default.

### J. Rollout (zero regressions)

1. **PR 1** — Introduce `sendDocument` (generator + resolve + component
   gates), `useSendDocument` hook, `allowEmail` prop in the modal, eligibility
   detection in the generator. Defaults keep current windows behaving the
   same. The envelope starts appearing automatically on every eligible
   documental window.
2. **PR 2** — Add `window.sendDocument: { allowEmail: false }` to
   `purchase-invoice/decisions.json`, regenerate via `make regen
   ONLY=purchase-invoice`. Verify modal hides email column.
3. **Cleanup PR** — Remove the now-unused `documentPreview: true` from the
   `rowQuickActions` blocks in `sales-invoice` and `purchase-invoice`.

## Open questions

1. **Eligibility heuristic confirmation** — should the gate be "header has
   `documentNo`" (simple, structural) or `apiPrediction.window.category ===
   'documents'` (declarative)? Recommendation: header has `documentNo` —
   structural and stable; verify `category` is reliably populated before
   adopting it.
2. **Detail view symmetry** — confirmed that `sendDocument.enabled: false`
   hides both the row quick-action and the detail-view Send/Download button.
   No separate flag.
