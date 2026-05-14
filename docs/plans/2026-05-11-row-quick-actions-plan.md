# Row Quick Actions — Plan

**Jira:** ETP-3914
**Status:** Draft (in iteration with user)
**Owner:** Forge team
**Date:** 2026-05-11

## 1. Problem statement

In the grid view of header entities (e.g. Sales Orders, Purchase Orders), users currently must open the record to perform common actions (edit, send by email, duplicate, run a process, delete). We want to expose those same actions directly on each row of the grid as **Row Quick Actions** — a hover overlay that shows up on the right side of the row, mirroring the toolbar/menuActions that the user would see in the edit view of that record.

The goal: reduce clicks for frequent operations without inventing new behaviors. Each quick action must execute **exactly the same handler** the corresponding toolbar button executes in edit mode (same permissions, same callouts, same confirmation flows, same callbacks).

## 2. UX specification

### 2.1 Layout

- Quick actions appear as a **floating overlay anchored to the right edge of the row** when the user hovers.
- The overlay is allowed to **cover the last column(s) of data** — that's the accepted tradeoff for keeping the grid clean when no row is hovered.
- Order of buttons (left → right), per the Figma design:
  1. **Edit** (pencil icon) — navigates to the detail/edit view of the record.
  2. **Duplicate** (copy icon)
  3. **Send by email** (mail icon)
  4. **Kebab `⋮`** (more) — opens a dropdown with the rest of the toolbar/menuActions available for that row.
  5. **Delete** (trash icon) — always rightmost, visually separated (red/destructive).
- Hover detection on the row triggers the overlay. Leaving the row hides it.
- No animation requirements yet — fade-in OK, but not mandatory.
- **Container width:** auto (driven by visible button count + gaps + padding). Figma marks 192px but assumes all 5 buttons; since Email/kebab/Delete render conditionally, fixing the width would leave dead space when buttons are hidden. Decided 2026-05-11.

### 2.2 Behavior per button

| Button | Behavior |
|--------|----------|
| Edit | Default: navigate to the record's edit view (same as double-click). Configurable via `decisions.json` to instead activate inline editing on the row (feature flag — for now shows a "coming soon" toast/popup). |
| Send email | Triggers the same email handler as the edit-view toolbar button (opens the email modal). |
| Duplicate | Triggers the same duplicate handler as the edit-view toolbar button. |
| Kebab `⋮` | Dropdown listing the **remaining** actions from the edit-view toolbar/`menuActions` (excluding the ones already shown as fixed buttons). Each item executes the same handler. |
| Delete | Triggers the same delete handler as the edit-view toolbar button (confirmation modal is whatever the edit view already shows). |

### 2.3 Visibility rules

- A quick action is shown only if the corresponding toolbar button would be visible in the edit view of that record — i.e. it reuses the **same readOnly/visibility/permission rules already evaluated for the edit toolbar**. No duplication of business logic.
- When an action does **not apply** to a record (state, permission, AD readOnly), it is **hidden** — never rendered as a disabled greyed-out button. Disabled state is reserved for the in-flight case (see §2.6).
- `decisions.json` allows the window to:
  - **Hide** a specific action from the quick-actions overlay (without affecting the edit view).
  - **Override** the visibility criterion with a custom expression (e.g. `documentStatus === 'DR'`).
- If an action is hidden by the AD permission/visibility model in edit view, it must also be hidden in quick actions. There is no "force-show" override.

### 2.4 Mobile / touch

**Out of scope for this iteration.** Desktop hover only. Touch behavior will be specified in a follow-up.

### 2.5 Confirmation / side effects

Quick actions delegate 100% to the underlying handler. Whatever modal, callout, validation or toast the edit-view button triggers, the quick action triggers identically. No parallel UX paths. Destructive actions (Delete, Void, Cancel, etc.) inherit the same confirmation modal already shown in the edit view.

### 2.6 In-flight state

- When an action is dispatched, **only that button (in that row)** becomes disabled and shows a spinner until the handler resolves.
- Actions on **different rows can run in parallel** — no global lock.
- The rest of the buttons in the same row remain enabled (the user can still click Email while Duplicate is processing, for example), unless the handler itself signals a row-level lock.

### 2.7 Edit redundancy

The Edit (pencil) button is intentionally kept even when the grid already supports double-click (or single-click) navigation to the detail view. Discoverability beats minimalism here. Can be hidden per-window via `decisions.json` if it becomes noise.

## 3. Configuration model (`decisions.json`)

New section `window.rowQuickActions` (follows the pattern of `window.statusBar` / `window.menuActions`).

```jsonc
{
  "window": {
    "rowQuickActions": {
      "enabled": true,            // default true; set false to disable on this window
      "editMode": "navigate",     // "navigate" (default) | "inline" (feature-flagged)
      "actions": {
        "edit":      { "show": true },
        "email":     { "show": true },
        "duplicate": { "show": true },
        "delete":    { "show": true },
        "<processKey>": {
          "show": "kebab",        // true (default) | false | "fixed" | "kebab"
          "visibleWhen": "@DocumentStatus@='DR'"  // optional override — Etendo display-logic syntax (NOT JS)
        }
      }
    }
  }
}
```

Rules:
- Missing `rowQuickActions` ⇒ feature enabled with defaults: the **four canonical** actions (edit, email, duplicate, delete) appear as fixed buttons; **all other toolbar/menuActions go into the kebab** automatically. No per-process declaration needed for the default behavior.
- `show: false` ⇒ action never appears (not even in kebab).
- `show: "kebab"` ⇒ action only appears inside the kebab dropdown.
- `show: "fixed"` ⇒ promote a non-canonical action to a fixed button slot (after the four canonical ones, before the kebab).
- `show: true` ⇒ explicit form of the default (only meaningful for canonical actions where the implicit default is already `true`).
- `visibleWhen` ⇒ extra predicate ANDed with the existing edit-view visibility logic. Uses **Etendo display-logic syntax** (e.g. `"@DocStatus@='DR'"`, AND-chained clauses, `!=` supported), evaluated by the same matcher as `DetailView.evalDisplayLogicRaw`. **Not JavaScript syntax.**

## 4. Architectural impact

### 4.1 Where the component lives

- New generic component: `tools/app-shell/src/components/contract-ui/RowQuickActions.jsx` (stub already exists per `git status`).
- Mounted inside the grid row renderer of the generic list/grid component used by header entities.
- Receives `record`, `entity`, `actionsConfig` (resolved from `decisions.json`) and a reference to the same action-dispatch hook used by the edit toolbar.

### 4.2 Reusing the edit toolbar handlers

- Extract the dispatch logic of the edit-view toolbar into a hook, e.g. `useRecordActions(entity, record)`, returning the same array of action descriptors (`{ key, icon, label, handler, visible, disabled }`) used by both the edit toolbar and `RowQuickActions`.
- The edit toolbar gets refactored to consume this hook (no behavior change there).
- `RowQuickActions` consumes the same hook, filters/orders by `actionsConfig`, and renders accordingly.

### 4.3 Generator changes

- `cli/src/generate-frontend.js` reads `decisions.json → window.rowQuickActions` and:
  - Emits the `<RowQuickActions actionsConfig={…} />` slot in `ListPage.jsx` (or wherever the row renderer lives).
  - Skips emission when `enabled: false`.
- `cli/src/generate-contract.js` propagates the config into `frontendContract.window.rowQuickActions` (or equivalent).
- `cli/src/resolve-curated.js` adds defaults so a window with no declaration gets the standard set.

### 4.4 Pipeline validator

- New rule (F11): if `window.rowQuickActions.actions.<key>` references a process key that doesn't exist in the contract's action list, fail validation.
- Add fixtures and tests under `cli/test/fixtures/pipeline-validator/`.
- Document in `docs/pipeline-validator-reference.md`.

## 4.5. Progress tracker

Legend: ⬜ pending · 🟡 in progress · ✅ done · ⛔ blocked · ➖ skipped

| Slice | Step | Description | Status | Owner | Notes |
|-------|------|-------------|--------|-------|-------|
| 1 | 1 | Spike: locate edit-view toolbar + grid row renderer in `tools/app-shell/` | ✅ | Explore | done 2026-05-11 — see findings below |
| 1 | 2 | Extract `useRecordActions(entity, record)` hook + unit tests | ➖ | — | deferred to slice 3 (see spike findings) |
| 2 | 3 | Validate stub vs spec + extract Delete gate to shared util + i18n keys | ✅ | schema-forge-developer | done 2026-05-11 — 3 TODOs flagged for slice 3 |
| 2 | 4 | Mount stub in `DataTable.jsx` via new optional `rowQuickActions` prop | ✅ | schema-forge-developer | done 2026-05-11 — additive, no regressions |
| 3 | 5 | Extend `decisions.json` schema + migration defaults | ✅ | schema-forge-developer | done 2026-05-11 |
| 3 | 6 | Update `generate-contract.js`, `generate-frontend.js`, `resolve-curated.js` | ✅ | schema-forge-developer | done 2026-05-11 — `visibleWhen` reuses Etendo `@Field@='Value'` syntax |
| 3 | 7 | Pipeline validator rule F11 + fixtures + tests + docs | ✅ | schema-forge-developer | done 2026-05-11 — 52/52 validator tests pass |
| 4 | 8 | Regenerate pilot windows (`make regen ONLY=sales-order,purchase-order,sales-invoice,purchase-invoice`) | ✅ | window-agent | done 2026-05-11 — 4/4 windows, 0 violations on each |
| 4 | 9 | i18n keys in `en_US.json` + `es_ES.json` | ✅ | schema-forge-developer | done in slice 2 |
| 4 | 10 | Tests: unit (`RowQuickActions`) ✅ slice 2/3, contract (generator) ✅ slice 3, **E2E Playwright** ⏸ paused for manual smoke first | ⏸ | — | user will smoke test manually before investing in Playwright automation |
| 4 | 11 | Docs: `docs/ui-customization.md` + per-window guides | ✅ | documentarian | done 2026-05-11 — new §13 added |

### Spike findings (slice 1, step 1)

Recon completed on 2026-05-11. Key facts:

- **Edit toolbar:** `tools/app-shell/src/components/contract-ui/DetailView.jsx:1009–1168`. Handlers are **inline `onClick`**, no centralized dispatch. Visibility checks (Delete gate, `action.visible`, `displayLogicRaw`, `documentPreview`) are spread per-button — no shared utility.
- **Action dispatch:** `useDocumentAction` hook at `tools/app-shell/src/hooks/useDocumentAction.js:1–55` covers POST to `/{entity}/{id}/action/documentAction`. Other dispatch paths (`action.onClick`, `action.columnName`) are inline in DetailView. No `useRecordActions` hook exists — **greenfield**.
- **Grid row renderer:** Generic `DataTable.jsx:1273–1356`. Rows already use `group/row` class with `opacity-0 group-hover/row:opacity-100` pattern (proven precedent: Clone button cell at lines 1337–1354).
- **Per-window code is prop-passing only.** Both DetailView and DataTable are generic; generated `HeaderPage.jsx` just wires props. We extend generic components, not generators (mostly).
- **🎁 Stub `RowQuickActions.jsx` (209 lines, untracked) already implements** the hover overlay, fixed buttons (Edit/Clone/Email), kebab dropdown with `menuActions`, delete with the same visibility gate as DetailView, and uses `useDocumentAction`. Big head start — slice 2 becomes mostly wiring + refactor instead of building from scratch.
- **Delete visibility gate is duplicated** between DetailView and the stub — must extract to a shared utility in slice 2 to avoid drift.

Implications for the plan:
- Slice 2 reorders: (a) read the stub and validate it against the plan spec, (b) extract the Delete visibility gate into a shared util, (c) mount the stub into `DataTable.jsx` via a new optional prop, (d) write unit tests.
- The `useRecordActions` hook refactor (step 2) is now *recommended but not strictly required* for slice 2 to ship — the stub already dispatches via `useDocumentAction` + callbacks. We can defer the full hook to slice 3 when `decisions.json` integration forces a cleaner API. **Decision:** defer step 2, ship slice 2 with the existing stub + extracted Delete gate.

### Open questions tracker

| # | Question | Status | Decision |
|---|----------|--------|----------|
| Q1 | Naming: `rowQuickActions` vs alternatives | ⬜ open | tentative: `rowQuickActions` |
| Q2 | Kebab include "Edit" as fallback when fixed Edit hidden | ⬜ open | — |
| Q3 | Overlay flotante vs columna sticky | ✅ resolved | overlay (revisit if issues) |
| Q4 | Multi-row selection support | ⬜ open | tentative: single row only |
| Q5 | Accessibility spec (focus, keyboard, ARIA) | ⬜ open | to spec in slice 2 |
| Q6 | Performance / memoization strategy | ⬜ open | — |
| Q7 | Telemetry (Mixpanel) | ⬜ open | — |
| Q8 | Rollout: ON por defecto vs flag global | ⬜ open | — |

## 5. Implementation steps

1. **Spike / discovery** — Locate the current edit-view toolbar implementation in `tools/app-shell/`, identify the dispatch hook (or absence of it), and confirm the row renderer extension point.
2. **Refactor `useRecordActions` hook** — Extract from the existing edit toolbar. No behavioral change. Add unit tests.
3. **Build `RowQuickActions` component** — Hover overlay, fixed buttons + kebab dropdown, i18n strings (both `en_US.json` and `es_ES.json`).
4. **Wire it to the grid** — Mount in the generic list grid; gate behind `rowQuickActions.enabled`.
5. **Extend `decisions.json` schema** — Update `docs/decisions-reference.md`, schema validation, and migration defaults.
6. **Update generators** — `generate-contract.js`, `generate-frontend.js`, `resolve-curated.js`.
7. **Pipeline validator** — Add F11 rule + fixtures + tests + docs.
8. **Regenerate Sales Orders** as the pilot window (`make regen ONLY=sales-order`). Verify the protocol (contract integrity, import paths, etc.).
9. **i18n** — Add keys for action labels and tooltips in both locale files.
10. **Tests** — Unit tests for `RowQuickActions`, integration test on the Sales Orders grid, contract test for the generator. **E2E (Playwright) covers four windows**: Sales Order, Purchase Order, Sales Invoice, Purchase Invoice. Minimum scenarios per window: hover reveals overlay, edit navigates to detail, email opens modal, duplicate creates a copy, delete shows confirmation, kebab lists remaining actions, hidden action (via `decisions.json`) does not appear, action unavailable for the record state stays hidden (not disabled).
11. **Docs** — Update `docs/ui-customization.md` with a new section on row quick actions (decision tree + real example), and the per-window guide for Sales Orders.

## 6. Open questions

- [ ] Naming: `rowQuickActions` vs `quickActions` vs `gridRowActions`? (Prefer `rowQuickActions` — explicit.)
- [ ] Should the kebab also include "Edit" as a fallback when the fixed Edit button is hidden by config?
- [ ] Overlay flotante vs columna sticky a la derecha (overlay puede parpadear con grids virtualizados / scroll horizontal).
- [ ] What happens with multi-row selection? Does any quick action operate on selection, or only single row? (Tentative: single row only; bulk actions stay in the top toolbar.)
- [ ] Accessibility: focus management, keyboard activation, ARIA labels — to spec in step 3.
- [ ] Performance: hover overlay must not re-render the whole row. Memoization strategy.
- [ ] Telemetría de uso de quick actions (Mixpanel u otro).
- [ ] Rollout: feature ON por defecto en todas las ventanas, o detrás de flag y activar window por window durante el piloto.

**Resueltos en esta iteración:**
- Edit redundante con doble-click → se deja siempre, configurable por ventana (§2.7).
- Umbral fijo vs kebab → 4 canónicas fijas, todo el resto al kebab por defecto; `show: "fixed"` para promover (§3).
- In-flight: disabled + spinner por botón, paralelo entre filas (§2.6).
- Acción no aplicable al registro → oculta, no disabled (§2.3).
- Confirmaciones destructivas → heredan el modal de la vista edit (§2.5).
- E2E piloto sobre 4 ventanas: Sales Order, Purchase Order, Sales Invoice, Purchase Invoice (§5 step 10).

## 7. Out of scope (this iteration)

- Mobile / touch UX.
- Inline editing implementation (only the config flag is reserved).
- Bulk / multi-row quick actions.
- Drag-to-reorder of the action buttons.
- Custom icons per action (uses default icon set).

## 8. Success criteria

- Sales Orders grid shows the quick actions overlay on hover, with at least Edit + Email + Duplicate + Delete + kebab.
- Clicking any quick action produces the same outcome (UI + DB + side effects) as clicking the equivalent button in the edit view.
- Hiding `email` via `decisions.json` removes it from both the fixed buttons and the kebab.
- `make regen ONLY=sales-order` succeeds and the integrity protocol passes.
- Pipeline validator rule F11 catches a misconfigured `rowQuickActions` block.
- No regressions on windows that don't declare `rowQuickActions` (defaults apply transparently).
