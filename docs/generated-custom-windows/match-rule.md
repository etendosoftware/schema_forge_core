# Match Rule

## Intent

Use this window to maintain the catalog of **matching rules** ("Reglas de matcheo") used by Bank Reconciliation. A finance user defines, prioritizes, activates/deactivates, and removes rules that tell the reconciliation engine how to classify bank-statement lines that the standard algorithm could not link to an invoice. The business goal is fast catalog maintenance: create and edit rules in a modal, see them all in one prioritized list, and toggle a rule on/off inline without leaving the list.

## Interaction model

- Route: `/match-rule` — a single list screen. There is **no drill-in detail route**.
- Layout: `layoutType: "list-modal"` — a grid (list) plus a create/edit **modal**, rendered by the generic `ListModalWindow` component (`tools/app-shell/src/components/contract-ui/ListModalWindow.jsx`).
- Visibility: intended for the Finance menu, label "Reglas de matcheo" (`Matching Rules` in `en_US`).
- Window shape: header-only (`detailEntity: null`). The single entity is `etgoMatchRuleHeader`, backed by table `ETGO_Match_Rule`.
- Backend: **generic NEO Headless W CRUD** (persistence served from the AD tab / `ETGO_SF_FIELD`) plus a thin validation pre-hook (`MatchRuleHandler`, `@Named("match-rule")`).

## What this window should allow

- **List** all rules in a grid styled to the Figma design (Inter, white rows, `#E8EAEF` separators). Columns and their cell renderers (`cellType`, driven by the contract):
  - Prioridad — `priorityPill` (bordered neutral pill).
  - Nombre — `nameWithSubline` (bold name + a muted `→ <counterparty>` sub-line sourced from `businessPartner`).
  - Condición — `conditionChip` (derived text `<kind>: "<pattern>"`, e.g. `empieza con: "IMPUESTO"`; kind label is i18n from `textCondition` C/S/R, pattern from `textPattern`).
  - Tipo — `typePill` (rounded-full pill of the transaction type, toned per value; label i18n via `genericLabels`).
  - Cuenta contable — plain text (the chart-of-accounts account, FK `C_ElementValue_ID`).
  - Tolerancia — `percent` (`N%`).
  - Conciliaciones — `boldText` (read-only match count).
  - Activa — `toggle` (inline `PillToggle`, `PATCH`; the shared pill toggle, same component as the modal footer and the Assets window).
  - Each row also shows a left **drag handle** (visual only; drag-to-reorder is deferred) and, on hover, an **edit** (pencil) and a **delete** (red trash) icon button. Delete opens a confirmation dialog, then `DELETE`s the rule.
- **Toolbar**: a **back button** ("Cancelar", navigates to the referrer), a **dropdown filter** "Todas las reglas" (filter by Active: Activas / Inactivas), an **advanced "by conditions" filter** (funnel button → `AdvancedFilterButton`, applied client-side via `applyConditions`), a **search** box ("Buscar…"), and the primary **"+ Nueva regla"** button (yellow `#FFD500` hover, like the Accounts window). Filters and search are applied client-side over the loaded rows.
- **Banner**: a dismissible info banner (`bannerKey`) explaining that rules are evaluated by ascending priority and only apply to statement lines the standard algorithm could not match.
- **Search** rules by name or pattern (local filter over the list).
- **Create** a rule via the "Nueva regla" button → modal. The modal groups fields:
  - *General*: Name* (placeholder "Ej. Comisiones bancarias"), Pattern to match* (placeholder "Ej. comisión"), Applies to ("Afecta a"; financial account, defaulting to "Todas las cuentas" when empty), Transaction type (3 values — Comisión `B` / Transferencia `T` / Retención `H`, translated in the selector via `genericLabels`), Accounting account (`C_ElementValue` selector), Concept condition* (Contiene / Empieza con / Regex), Amount tolerance, Priority*, **Contacto** (`C_BPartner` selector), "Create transaction automatically" footer toggle (`PillToggle`).
  - *Accounting dimensions* (`matchRuleSectionDimensions`): Project, Cost center, 1st/2nd dimension, Sales region, Activity, Campaign.
- **Edit** a rule by clicking its row → the same modal pre-filled.
- **Toggle Active** inline from the grid (no modal) — a `PATCH` that flips the rule on/off.
- **Delete** a rule from the row actions.

## Reactive behavior and dependencies

- **Priority auto-seed**: opening the create modal pre-fills `priority` with `max(priority) + 10` computed in the **frontend** from the loaded list (`templateConfig.autoPriorityField`/`autoPriorityStep`). There is no backend defaults endpoint for it.
- **Scope = financial account**: `financialAccount` ("Afecta a") scopes a rule to one account, or to all accounts when left empty. Priority uniqueness is enforced **within that scope**.
- **FK selectors** (accounting account, financial account, business partner, and the 7 dimensions) load from the generic `/sws/neo/match-rule/etgoMatchRuleHeader/selectors/<field>` endpoints that the W contract emits — no mock catalog.
- **Validation** runs server-side in the `MatchRuleHandler` pre-hook before the generic CRUD persists:
  - `textCondition` must be `C` (Contains), `S` (Starts with) or `R` (Regex) — HTTP 400.
  - `textPattern` is required — HTTP 400.
  - when the condition is Regex, the pattern is compiled and test-matched under a 200 ms cap; a pattern that fails to compile or shows catastrophic backtracking is rejected — HTTP 400.
  - `priority` must be unique within the financial-account scope — HTTP 409.
  - On a partial `PATCH` (inline Active toggle), content fields absent from the body are not re-validated; a `priority` patch still triggers the uniqueness check.

## CRUD endpoints (generic W convention)

```
list   GET    /sws/neo/match-rule/etgoMatchRuleHeader
create POST   /sws/neo/match-rule/etgoMatchRuleHeader
update PUT    /sws/neo/match-rule/etgoMatchRuleHeader/{id}
patch  PATCH  /sws/neo/match-rule/etgoMatchRuleHeader/{id}   (inline Active toggle)
delete DELETE /sws/neo/match-rule/etgoMatchRuleHeader/{id}
```

## Gap assessment

- This window only **stores and lists** rules. The engine that evaluates them against bank-statement lines is a separate ticket; nothing here proves a rule actually matches a line.
- Inline editing of `priority` directly in the grid is carried as a contract flag (`inlineEdit`) but the primary edit path verified here is the modal; treat in-grid priority editing as future behavior.
- The accounting account (`C_ElementValue`) selector lists every account in scope, including summary/header accounts; restricting it to postable accounts is a future refinement.

## Manual verification

1. After the user runs `push-to-neo` + `export.database` + smartbuild and wires the menu, open `/match-rule` from the Finance menu and confirm the prioritized grid renders with the columns above and the read-only Reconciliations count.
2. Click "Nueva regla", confirm the modal opens with Priority pre-filled to `max + 10`, fill Name + Pattern + Concept condition, save, and confirm the row appears.
3. Create a Regex-condition rule with a deliberately catastrophic pattern (e.g. `((a+)+)+$` — Java 17 optimizes the single-nested form) and confirm the save is rejected with a 400 error message (shown in Spanish via `translateBackendError`).
4. Create two rules with the same Priority and the same "Afecta a" account and confirm the second is rejected with a 409.
5. Toggle a rule's Active switch in the grid and confirm it persists after refresh (PATCH, no modal).
6. Edit a rule by clicking its row, change a dimension under "Dimensiones contables", save, and confirm the change persists.

## Automated evidence

- `artifacts/match-rule/decisions.json` declares `layoutType: "list-modal"`, the `templateConfig` (incl. `toolbarFilters` and `backLabelKey`), the grid/modal field classification, the per-field `cellType` config (`priorityPill`/`nameWithSubline`/`conditionChip`/`typePill`/`percent`/`boldText`/`toggle`), and the `inlineToggle`/`inlineEdit` flags.
- `tools/app-shell/src/components/contract-ui/listModalCells.jsx` + `ListModalToolbarFilter.jsx` — the generic cell-renderer registry and toolbar dropdown used by `list-modal` (with `__tests__/listModalCells.vitest.jsx` and `__tests__/ListModalToolbarFilter.vitest.jsx`).
- `artifacts/match-rule/contract.json` carries `frontendContract.window.layoutType = "list-modal"` + `templateConfig`, the `etgoMatchRuleHeader` fields, and the `apiPrediction` selectors.
- `artifacts/match-rule/generated/web/match-rule/EtgoMatchRuleHeaderPage.jsx` renders `<ListModalWindow>` with the generated `columns`/`fields`/`sections`/`config`.
- `tools/app-shell/src/components/contract-ui/ListModalWindow.jsx` + `__tests__/ListModalWindow.vitest.jsx` — the generic component and its tests.
- `cli/test/generate-frontend-list-modal.test.js` + `cli/test/generate-contract-list-modal.test.js` — generator regression tests.
- `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/MatchRuleHandler.java` — the validation pre-hook.
