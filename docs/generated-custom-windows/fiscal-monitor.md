# Fiscal Monitor

## Intent

Use this window to observe the real-time submission status of electronic invoices for an organization. It adapts to the active fiscal profile (SII, TBAI, SII+TBAI, or Verifactu) and surfaces the invoices that require attention — errors, rejections, and partial acceptances — alongside aggregate KPI counts fetched from NEO Headless.

The window is read-only. It does not create or modify invoice records; it only displays the status reported by AEAT or Hacienda Foral after submission.

## What this window should allow

- Detect the active fiscal profile for the current organization and render only the relevant section(s).
- Display KPI cards (aggregate counts per status category) at the top of each section, each clickable to jump directly to the matching table tab.
- Show paginated invoice rows per status tab, with error codes and reasons inline when present.
- Synchronize tab state bidirectionally: clicking a KPI card activates the matching tab; clicking a section tab highlights the matching KPI card.
- Show skeleton loading states while data is being fetched and clear error messages on failure.
- Provide a developer debug panel (activated via keystroke sequence) for testing all profiles and layouts with mock data.

## Profile-based rendering

`useFiscalMonitor` runs the same `detectProfile` logic as `useFiscalConfig` — reading the three config entities from NEO — then renders sections conditionally:

| Profile | Sections rendered |
|---------|-------------------|
| `sii` | SII section only |
| `sii-navarra` | SII section only |
| `sii+tbai` | SII section + TBAI section (with a divider between them) |
| `tbai` | TBAI section only |
| `verifactu` | Verifactu section only |
| `unconfigured` | Empty state with setup call-to-action |
| `conflict` | Conflict warning only |

## Data architecture

```
useFiscalMonitor(orgId, token, apiBaseUrl)
  ├── detectProfile()           ← fetches 3 config records in parallel
  ├── fetchSiiMonitorData()     ← 4 parallel fetchCount calls (emitidas, recibidas, × 2 periods)
  ├── fetchTbaiData()           ← 5 parallel calls (total + 4 per-estado criteria filters: Recibido, Rechazado, Error, Pendiente)
  └── fetchVerifactuMonitorData() ← 4 parallel fetchCount calls (1 per status entity)
        ↓
  computeKpis(profile, monitorData) → kpis object
        ↓
  FiscalKpiCards (static display + click → tab navigation)
  SiiMonitorSection / TbaiMonitorSection / VerifactuMonitorSection (paginated tables)
```

Each section component fetches its own paginated rows independently, on tab/page/filter change.

## SII section (`SiiMonitorSection`)

**Tabs:** Emitidas | Recibidas (with upload/download icon)

**Period toggle:** Periodo actual | Periodo anterior (segmented control, right side of tab bar)

The tab × period combination maps to one of 4 NEO entities:

| Tab | Period | Entity |
|-----|--------|--------|
| Emitidas | Actual | `issuedInvoices` |
| Emitidas | Anterior | `issuedInvoices(previousPeriod)` |
| Recibidas | Actual | `receivedInvoices` |
| Recibidas | Anterior | `receivedInvoices(previousPeriod)` |

All entities live under spec `sii-monitor`. Pagination: 20 rows per page.

**Status filter row** (second row, below the tabs): Todas | Correcto (CO) | Aceptado con errores (AE) | Con errores | Pendiente (PE)

The "Con errores" tab is a composite filter covering both `IN` (Incorrecto) and `EE` (Error de envío). For the real API it sends `operator: "inSet", value: ["IN","EE"]`; for mock data it filters both codes client-side. All other tabs send `operator: "equals"` with the single code.

**Columns:** Date · Invoice number · Cliente/Proveedor · Type (`aeatsiiClaveTipo` / `aeatsiiClaveTipoFc`) · Total · Status pill · CSV AEAT

The Cliente/Proveedor column renders `businessPartnerIdentifier ?? businessPartner` — the Etendo FK identifier field when present, falling back to the raw FK id.

Error rows show `[errorCode] errorMessage` below the status pill in red.

**KPI sync:** `onTabChange` callback encodes the combined key (`'emitidas'`, `'emitidas-anterior'`, `'recibidas'`, `'recibidas-anterior'`) and bubbles up to `FiscalMonitorPage`, which passes it back as `activeKey` to `FiscalKpiCards`.

## TBAI section (`TbaiMonitorSection`)

**Filter tabs:** Todas | Enviadas (Recibido) | Rechazadas | Con error | Pendientes

Status is server-filtered via a `criteria` JSON parameter on the NEO request (`fieldName: estado, operator: equals, value: <status>`). The "Todas" tab omits the criteria parameter.

Entity: `sincronización` under spec `tbai-facturas-enviadas`.

**Columns:** Date · Invoice number · Description · Signature (check icon when `estado === 'Recibido'`) · Status pill

The Invoice number column renders `invoiceIdentifier ?? invoice` — the Etendo FK identifier field when present, falling back to the raw FK id.

KPI card "Con error / Rechazadas" aggregates both `rechazado` and `error` counts.

## Verifactu section (`VerifactuMonitorSection`)

**Status tabs:** Aceptadas | Parcialmente aceptadas | Rechazadas | Inválidas

Each tab maps to a dedicated NEO entity under spec `monitor-verifactu`:

| Tab | Entity |
|-----|--------|
| Aceptadas | `facturasAceptadas` |
| Parcialmente aceptadas | `facturasParcialmenteAceptadas` |
| Rechazadas | `facturasRechazadas` |
| Inválidas | `facturasInválidas` |

**Columns:** Invoice number · Issuer NIF · Type · CSV AEAT · Status pill · Error reason (`[codeError] errorReason`)

## KPI cards (`FiscalKpiCards`)

Each system gets a row of clickable metric cards above its section. Clicking a card calls `onPick(key)` which sets the parent's `siiInitialTab` / `tbaiInitialFilter` / `veriInitialTab` state, which flows down as `initialTab`/`initialFilter` to the section, triggering a `useEffect` that syncs the section's internal state.

| Variant | Cards |
|---------|-------|
| `sii` | Emitidas (actual) · Emitidas (anterior) · Recibidas (actual) · Recibidas (anterior) |
| `tbai` | Total enviadas · Recibido · Con error/Rechazadas |
| `verifactu` | Aceptadas · Parcialmente aceptadas · Rechazadas · Inválidas |

## Debug mode

Typing the sequence `debugfiscal` anywhere in the app (any page) activates the debug panel. State persists in `localStorage` under key `etendo-debug-fiscal` and survives page refresh. Typing the sequence again deactivates it.

`useDebugMode.js` manages activation using a module-level key buffer and a `Set` of React listener functions. This ensures all mounted instances of the hook respond simultaneously without polling.

When active, `FiscalMonitorDebugPanel` appears as a fixed dark panel (top-right, z-index 9999):
- **Profile override buttons** — clicking a profile renders that system's UI even without real config records in the DB. Clicking the active profile again clears the override and falls back to real data.
- **Mock data toggle** — when on, section components receive `mockRows` from `fiscalMonitorMockData.js` instead of fetching from NEO. KPI counts are computed from `MOCK_MONITOR_DATA` (counts match the actual mock row arrays).

`FiscalConfigDebugPanel` appears in the same position on `/fiscal-config` and allows deleting config records per system (SII, TBAI, Verifactu, certificate) for the current org — useful for resetting onboarding state during development.

## Mock data (`fiscalMonitorMockData.js`)

Three arrays with realistic Spanish invoice data:

| Export | System | Rows | Period |
|--------|--------|------|--------|
| `MOCK_SII_ROWS` | SII | 9 issued (April 2025) + 5 issued previous (March 2025) + 8 received (April 2025) + 4 received previous (March 2025) = 26 total | `_siiTab` field distinguishes the 4 variants; `aeatsiiEstado` uses 2-letter codes (CO/AE/IN/EE/PE) |
| `MOCK_TBAI_ROWS` | TBAI | 10 rows, May 2025 — 5 Recibido, 2 Rechazado, 1 Error, 2 Pendiente | `estado` field used for filtering; `invoice` = raw FK id, `invoiceIdentifier` = document number |
| `MOCK_VF_ROWS` | Verifactu | 8 rows — 4 aceptadas, 2 parcialmenteAceptadas, 1 rechazadas, 1 invalidas | `verifactuSendingStatus` field used for filtering |
| `MOCK_MONITOR_DATA` | All | KPI counts | Must always match the array lengths above |

## Refresh

Both `FiscalMonitorPage` and `FiscalConfigPage` expose a manual refresh control.

**FiscalMonitorPage:** The `OrgLead` bar replaces the static "Sincronizado" indicator with a `RefreshButton` component. When idle it shows the sync dot + "Sincronizado" label (same visual). When loading it shows a spinning `RefreshCw` icon (Lucide) and is non-clickable. Clicking calls `refetch()` (re-loads profile + KPIs via `useFiscalMonitor`) and increments `refreshKey` — a counter passed as prop to all three section components. Each section adds `refreshKey` to its row-fetch `useEffect` dependency array, re-triggering the current tab/page/filter fetch without resetting those states.

**FiscalConfigPage:** A small `RefreshCw` icon button in the page header calls `refetch` from `useFiscalConfig`. No `refreshKey` propagation needed — section components re-render completely on `refetch`.

i18n key: `fiscalMonitor.refresh` → "Actualizar" / "Refresh".

## Fiscal Status in InvoicePreviewModal

`StatsPanel` (inside `InvoicePreviewModal`) renders per-system submission status rows directly below the document "Estado" row. Visibility is driven by `getInvoiceFiscalTargets(specName, profile)` — only rows where `showSii`/`showTbai`/`showVerifactu` is `true` are rendered.

Status is fetched by `useFiscalStatus(invoiceId, specName, profile, apiBaseUrl, token)` from `tools/app-shell/src/windows/custom/shared/useFiscalStatus.js`. It queries in parallel (via `Promise.all`) once per active system on mount:

| System | Spec | Entity | FK field | Status field |
|--------|------|--------|----------|--------------|
| SII | `sii-monitor` | `issuedInvoices` (then `receivedInvoices` fallback) | `aeatsiiInvoice` | `aeatsiiEstado` |
| TBAI | `tbai-facturas-enviadas` | `sincronización` | `invoice` | `estado` |
| Verifactu | `monitor-verifactu` | `facturasAceptadas` → `partiallyAcceptedInvoices` → `facturasRechazadas` → `facturasInválidas` (first match) | `invoice` | `verifactuSendingStatus` |

No match → pill shows `PE` (SII/Verifactu) or `Pendiente` (TBAI). While fetching, rows show a skeleton shimmer.

i18n keys: `invoicePreview.fiscalStatus.sii`, `invoicePreview.fiscalStatus.tbai`, `invoicePreview.fiscalStatus.verifactu`.

## Interaction model

- Route: `/fiscal-monitor` (custom window).
- Implementation type: `layoutType: "custom"` — loaded from `customLoaders` in `tools/app-shell/src/windows/registry.js`.
- Entry point: `FiscalMonitorPage.jsx` — fetches profile + KPIs, renders OrgLead header, delegates to section components.
- The page container uses `overflow-y: auto` so long multi-section views (e.g. `sii+tbai`) are scrollable within the fixed app shell container.

## Manual verification

1. Open `/fiscal-monitor` with an org that has no fiscal config — confirm the unconfigured empty state renders with the setup CTA buttons.
2. Open with an SII org — confirm one KPI row (4 cards) and the SII table appear. Switch between Emitidas/Recibidas tabs and verify the table reloads. Switch period and verify a different entity is queried.
3. Open with an SII+TBAI org — confirm both sections render. Scroll down and confirm the TBAI section is reachable. Verify the "Y también" divider appears between them.
4. Click an SII KPI card (e.g. "Emitidas · periodo anterior") — confirm the section tab and period toggle both update to match.
5. Click a section tab — confirm the corresponding KPI card becomes active (highlighted).
6. Type `debugfiscal` anywhere on the page — confirm the debug panel appears top-right. Select "SII+TBAI" and enable mock data — confirm both sections render with mock rows and the KPI counts match the row counts in each tab.
7. Switch tabs in each section under mock data — confirm the rows change (e.g. TBAI "Rechazadas" shows only 2 rows).
8. Refresh the page with debug mode active — confirm the panel persists (localStorage). Type `debugfiscal` again — confirm it disappears.
9. Open `/fiscal-config` with debug mode active — confirm `FiscalConfigDebugPanel` appears and delete buttons work.

## Automated evidence

- `artifacts/fiscal-monitor/decisions.json` — `layoutType: "custom"`, window registered.
- `tools/app-shell/src/windows/registry.js` — `fiscal-monitor` in `customLoaders` at `customLoaders['fiscal-monitor']`.
- `tools/app-shell/src/windows/custom/fiscal-monitor/FiscalMonitorPage.jsx` — profile-routing orchestrator; debug mode integration.
- `tools/app-shell/src/windows/custom/fiscal-monitor/useFiscalMonitor.js` — parallel config + monitor data fetcher; exports entity/spec constants for section components.
- `tools/app-shell/src/windows/custom/fiscal-monitor/fiscalMonitor.utils.js` — `buildMonitorFetchPlan`, `computeKpis` (pure functions, fully tested).
- `tools/app-shell/src/windows/custom/fiscal-monitor/FiscalKpiCards.jsx` — clickable metric cards per system variant.
- `tools/app-shell/src/windows/custom/fiscal-monitor/SiiMonitorSection.jsx` — emitidas/recibidas × actual/anterior; `onTabChange` callback with combined key.
- `tools/app-shell/src/windows/custom/fiscal-monitor/TbaiMonitorSection.jsx` — server-side criteria filter per status; `onFilterChange` callback.
- `tools/app-shell/src/windows/custom/fiscal-monitor/VerifactuMonitorSection.jsx` — entity-per-status tab; `onTabChange` callback.
- `tools/app-shell/src/windows/custom/fiscal-monitor/FmPrimitives.jsx` — shared `StatusPill`, `NumFactura`, `Pager`, `RowActionBtn` primitives.
- `tools/app-shell/src/windows/custom/fiscal-monitor/useDebugMode.js` — module-level keystroke sequence listener; localStorage persistence; multi-instance sync via listener Set.
- `tools/app-shell/src/windows/custom/fiscal-monitor/FiscalMonitorDebugPanel.jsx` — profile override + mock data toggle panel.
- `tools/app-shell/src/windows/custom/fiscal-config/FiscalConfigDebugPanel.jsx` — config record deletion panel (shared debug mode).
- `tools/app-shell/src/windows/custom/fiscal-monitor/fiscalMonitorMockData.js` — realistic multi-system mock rows + matching KPI counts.
- `tools/app-shell/src/windows/custom/fiscal-monitor/fiscal-monitor.css` — `.fm-*` design-system CSS; `overflow-y: auto` on `.fm-page` for scroll in fixed shell.
- `cli/test/fiscal-monitor.utils.test.js` — 18 tests covering `buildMonitorFetchPlan` and `computeKpis` for all profiles and edge cases.
- `cli/test/fiscal-monitor.mockdata.test.js` — mock data integrity tests: KPI counts match actual row arrays; all rows have required fields.
- `cli/test/useFiscalMonitor.test.js` — 22 tests covering source guards (named export, Promise.all × ≥2, computeKpis/detectProfile wiring, entity constant exports), `get` helper (URL encoding, Authorization header, response parsing, error handling), `fetchCount` (totalRows extraction, zero fallback), `fetchSiiMonitorData` (4 parallel calls, correct entity names), `fetchVerifactuMonitorData` (4 parallel calls), and `fetchTbaiData` (5 calls: total + Recibido + Rechazado + Error + Pendiente, criteria filter with `estado` fieldName).
- `tools/app-shell/src/windows/custom/fiscal-monitor/__tests__/FiscalKpiCards.test.js` — 16 component source-guard tests: SII/TBAI/Verifactu variants, `activeKey` active-class logic, `onPick` callback dispatch, `de-DE` number formatting.
- `tools/app-shell/src/windows/custom/fiscal-monitor/__tests__/SiiMonitorSection.test.js` — 15 component source-guard tests: tab state (issued/received), period segmented control, `initialTab` derivation, `mockRows` bypass, data fetching with pagination params.
- `e2e/tests/flows/fiscal-monitor.mocked.spec.js` — 13 Playwright mocked E2E tests: no-org, unconfigured, SII/TBAI/Verifactu/combined/conflict profiles, KPI card → tab sync, period toggle; all assertions use `t()` i18n helper.
- i18n: 40+ `fiscalMonitor.*` keys in `en_US.json` / `es_ES.json`; all user-visible strings go through `useUI()`. E2E tests resolved via `e2e/tests/helpers/i18n.js` (locale-switchable).
