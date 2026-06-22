# ETP-4244 — Cross-domain plan

**Feature:** Simple G/L Journal window — onboarding plus a reusable
**balance footer** platform feature (live Σ debit / Σ credit with a save gate),
two declarative generator capabilities (`clearsField` mutual-exclusion and
per-field `labels`), draft-mode completion wired to the core `DocAction`
process, and a `push-to-neo` fix that populates field `java_qualifier`.

This PR is approved as cross-domain because the GL Journal window cannot be
delivered with window-config alone: it required new shared platform components
(`BalanceFooterPanel`, `balanceTotals`), new generator/pipeline capabilities
(`clearsField`, per-field `labels`, validator rule F17, field `java_qualifier`),
and shared i18n keys — all consumed by the single `simple-g-l-journal` window.

## Domains touched

### `generator-change`

- `cli/src/generate-contract.js` — emit `clearsField` via `FIELD_HINTS_PRE_GRID`.
- `cli/src/generate-frontend.js` — emit `labels` and `clearsField` in add-line
  field builders (`buildEntryFieldLine` + secondaryTabs path); `requiresBalance`
  reverted in favour of draft-mode completion.
- `cli/src/resolve-curated.js` — pass `clearsField` through the field resolver.
- `cli/src/push-to-neo.js` — set field `java_qualifier` when the camelCase key
  differs from the AD column name (enables action routing, e.g. `documentAction`).
- `cli/src/validate-pipeline.js` — new rule **F17** (+ fixtures and tests).
- `cli/config/regen-windows.json` — register `simple-g-l-journal`.
- `cli/test/generate-frontend.test.js`, `cli/test/validate-pipeline.test.js`,
  `cli/test/fixtures/pipeline-validator/window-f17-*` — generator/validator tests.

### `platform-change` (app-shell)

- `tools/app-shell/src/lib/balanceTotals.js` — pure Σ debit/credit aggregation.
- `tools/app-shell/src/components/contract-ui/BalanceFooterPanel.jsx` — shared
  balance footer card.
- `tools/app-shell/src/components/contract-ui/DetailView.jsx` — wire balance
  footer + save gate + draft-mode confirm gating (`blockCompleteForBalance`).
- `tools/app-shell/src/components/contract-ui/DataTable.jsx` — `clearsField`
  mutual-exclusion in the inline add-row.
- `tools/app-shell/src/components/contract-ui/EntityForm.jsx` — per-field `labels`
  in form placeholders.
- `tools/app-shell/src/App.jsx`, `tools/app-shell/src/windows/registry.js`,
  `tools/app-shell/src/menu.json` — register and wire the window.
- `__tests__/BalanceFooterPanel.vitest.jsx`, `__tests__/DetailView.dirtyState.test.js`,
  `lib/__tests__/balanceTotals.vitest.js` — platform tests.

### `app-shell-core`

- `packages/app-shell-core/src/locales/en_US.json`,
  `packages/app-shell-core/src/locales/es_ES.json` — balance-footer keys plus
  `complete` / `journalUnbalancedCompleteBlocked`.

### `window:simple-g-l-journal`

- `artifacts/simple-g-l-journal/decisions.json` — window decisions (draftMode,
  balanceFooter, `clearsField`, `documentAction` = system, line labels).
- `artifacts/simple-g-l-journal/contract.json`, `contract.mcp.json` — regenerated.
- `artifacts/simple-g-l-journal/generated/web/simple-g-l-journal/*` — regenerated UI.
- `docs/generated-custom-windows/simple-g-l-journal.md` — window guide.

### `e2e`

- `e2e/tests/flows/simple-gl-journal.mocked.spec.js` — mocked E2E flow.

### docs (`repo-infra` / `unknown`)

- `docs/neo-headless-extensibility.md` — `@Named`-only (never `@ApplicationScoped`)
  NeoHandler rule.
- `CLAUDE.md` — same NeoHandler correction.
- `docs/decisions-reference.md`, `docs/ui-customization.md`,
  `docs/pipeline-validator-reference.md` — document `clearsField`, balance footer,
  and rule F17.
- `docs/generated-custom-windows/INDEX.md` — index entry for the new window.

> NeoHandler / `export.database` Java + AD changes live in the sibling
> `com.etendoerp.go` repo on the same `feature/ETP-4244` branch (separate PR).

## Tests

- `cli/test/validate-pipeline.test.js` — rule F17 pass/fail fixtures.
- `cli/test/generate-frontend.test.js` — generator emits `labels`/`clearsField`.
- `tools/app-shell/src/lib/__tests__/balanceTotals.vitest.js` — aggregation.
- `tools/app-shell/src/components/contract-ui/__tests__/BalanceFooterPanel.vitest.jsx`
  and `DetailView.dirtyState.test.js` — footer + save-gate behaviour.
- `e2e/tests/flows/simple-gl-journal.mocked.spec.js` — mocked end-to-end flow.
- `make regen ONLY=simple-g-l-journal` is byte-stable (regenerates with no diff).

## Rollback

- **window:simple-g-l-journal:** remove the window from `regen-windows.json`,
  `menu.json`, and `registry.js`; delete `artifacts/simple-g-l-journal/` and the
  window guide. No other window depends on it.
- **generator-change:** the new capabilities (`clearsField`, per-field `labels`,
  field `java_qualifier`, rule F17) are additive and gated on the presence of the
  corresponding field/decision property — they are inert for windows that don't
  use them. Revert the individual `cli/src/*` commits to remove them; re-run
  `make regen` for any affected window.
- **platform-change:** the balance footer is opt-in via `window.balanceFooter`;
  with no window declaring it, `BalanceFooterPanel`/`balanceTotals` are unused.
  Revert the app-shell commits and rebuild the bundle.
- **app-shell-core:** added i18n keys are additive; revert to remove.

## Follow-up changes (2026-06-22)

A second cross-domain batch on the same `feature/ETP-4244` branch, refining the
GL Journal window plus a generic add-row validation fix.

### `platform-change` (app-shell)

- `tools/app-shell/src/components/contract-ui/DataTable.jsx` — inline add-row
  required-field validation no longer flags a required boolean/checkbox left
  unchecked, nor the empty member of a `clearsField` mutual-exclusion pair
  (treated as "one-of"). Fixes a save being blocked client-side with no network
  call. Generic across all windows.
- `__tests__/DataTable.requiredValidation.vitest.jsx` (new),
  `__tests__/DataTable.inlineAddValidation.test.js`,
  `__tests__/DataTable.helpers.test.js` — regression coverage for the above.

### `window:simple-g-l-journal`

- `artifacts/simple-g-l-journal/decisions.json` — header field order via `seq`
  (Accounting Date, Period, Description); `documentDate` set to `system` (hidden)
  so the backend derives `DateDoc` from the accounting date.
- `contract.json`, `contract.mcp.json`, `generated/web/simple-g-l-journal/*` —
  regenerated. `docs/generated-custom-windows/simple-g-l-journal.md` — guide.

### Backend (sibling `com.etendoerp.go`, same branch — separate PR)

- `NeoAuxiliaryInputResolver` + `NeoDefaultsService` — generic: evaluate a tab's
  auxiliary inputs into the session before resolving column defaults, so a
  default referencing one (line `Description` = `@DESCRIPTION1@`) resolves from
  the parent. `ETGO_SF_FIELD.xml` — `documentDate` read-only (matches the
  window change above).

### Tests

- `DataTable.requiredValidation.vitest.jsx` + the two source-pattern node tests —
  checkbox/boolean and `clearsField` one-of behaviour.
- `make regen ONLY=simple-g-l-journal` is byte-stable; `validate-pipeline` clean.

### Rollback

- **platform-change:** the validation change is additive and behaviour-narrowing
  (it only stops false "required" blocks); revert the `DataTable.jsx` commit.
- **window:simple-g-l-journal:** revert the decisions/regen commit and re-run
  `make regen` to restore prior field order / `documentDate` visibility.
- **backend:** the auxiliary-input resolver is inert for tabs without auxiliary
  inputs; revert the `com.etendoerp.go` commits and rebuild.

> Deferred (tracked under ETP-4244): the inline add-row UI does not yet fetch
> the line `/defaults` endpoint, so the backend-resolved `@DESCRIPTION1@` line
> description is not pre-filled in the form. Completing it needs a generic
> frontend `/{detailEntity}/defaults?parentId=…` fetch on add-row open.
