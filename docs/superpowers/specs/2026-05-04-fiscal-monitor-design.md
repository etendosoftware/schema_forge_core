# Fiscal Monitor — Design Spec

**Date:** 2026-05-04  
**Status:** Approved  
**Related:** `fiscal-config` (same profile-detection pattern)

---

## Overview

A unified **Fiscal Monitor** window that shows sent/received invoice statuses for the organization's active fiscal system. Each client has exactly one organization, and that organization runs exactly one fiscal system: SII, TBAI, SII+TBAI, or Verifactu. The monitor adapts its layout to the active system, showing relevant KPI cards and invoice tables.

The window is read-only. Users can navigate from any invoice row to the full invoice record in Etendo.

---

## Architecture

Three layers, mirroring the `fiscal-config` pattern:

```
Menu entry: "Monitor Fiscal"
        ↓
fiscal-monitor  (layoutType: "custom")
   ├── FiscalKpiCards             ← summary cards at top
   └── [profile-driven sections]
       ├── SiiMonitorSection      (profile: sii or sii+tbai)
       ├── TbaiMonitorSection     (profile: tbai or sii+tbai)
       └── VerifactuMonitorSection (profile: verifactu)

        ↑ each section consumes NEO endpoints from backend artifacts:

sii-monitor             (standard artifact, no menu entry)
  → header per org + 4 subtabs:
      emitidas / recibidas / emitidas-periodo-anterior / recibidas-periodo-anterior

verifactu-monitor       (standard artifact, no menu entry)
  → header per org + 4 subtabs:
      rechazadas / parcialmente-aceptadas / aceptadas / invalidas

tbai-facturas-enviadas  (standard artifact, no menu entry)
  → flat list, one record per sent invoice
```

`fiscal-monitor` itself stores no data. It orchestrates the three backends through a single menu entry.

---

## Backend Artifacts

Three new Schema Forge artifacts, each extracted from the DB using the standard pipeline:

| Artifact | Source window | Menu entry | Entity structure |
|----------|--------------|------------|-----------------|
| `sii-monitor` | Monitor SII | No | Header (per org) + 4 line subtabs |
| `verifactu-monitor` | Monitor Verifactu | No | Header (per org) + 4 status subtabs |
| `tbai-facturas-enviadas` | TBAI Facturas Enviadas | No | Flat list (one entity) |

Window IDs (from ad-menu-cache):
- Monitor SII: `FEF76C3E0F104F06A89AAD15A4A4A35C`
- Monitor Verifactu: `F4675DAB02134762B66881DAE4672AD0`
- TBAI Facturas Enviadas: `71F24BF89DE748B483BE87594747D6FB`

These artifacts are data-only backends. Their NEO Headless contracts provide pagination, sorting, and field metadata for free. They are never accessed directly by the user.

---

## Profile Detection and Routing

`useFiscalMonitor` reuses the existing `useFiscalConfig` profile detection logic (already tested with 92 regression tests). Based on the detected profile, it launches the appropriate data fetches and routes rendering:

| Profile | Data fetched | Sections rendered |
|---------|-------------|-------------------|
| `sii` | sii-monitor (header + 4 subtabs) | KPIs SII + SiiMonitorSection |
| `tbai` | tbai-facturas-enviadas | KPIs TBAI + TbaiMonitorSection |
| `sii+tbai` | sii-monitor + tbai-facturas-enviadas | KPIs SII + KPIs TBAI + both sections |
| `verifactu` | verifactu-monitor (header + 4 subtabs) | KPIs Verifactu + VerifactuMonitorSection |
| `unconfigured` | — | Empty state: "No hay sistema fiscal configurado" |

---

## KPI Cards

KPI counts come from the `totalCount` field in NEO paginated responses — no extra fetches required.

| Profile | KPI cards |
|---------|-----------|
| SII | Emitidas enviadas / Emitidas rechazadas / Recibidas enviadas / Recibidas rechazadas |
| TBAI | Enviadas OK / Con error / Pendientes |
| SII+TBAI | SII cards + TBAI cards |
| Verifactu | Aceptadas / Parcialmente aceptadas / Rechazadas / Inválidas |

Cards use the existing `listKpiCards` extension point or `FiscalKpiCards` as a custom component slot.

---

## Navigation Model per Section

### SiiMonitorSection

```
[ Emitidas ]  [ Recibidas ]                      ← primary tabs
              ┌──────────────────────┐
              │ ○ Periodo actual     │            ← period toggle
              │ ○ Periodo anterior   │
              └──────────────────────┘
┌────────────────────────────────────────────────┐
│  Paginated, sortable table (NEO)               │
│  "Nº Factura" column → link to invoice         │
└────────────────────────────────────────────────┘
```

Maps to 4 NEO subtab endpoints: `emitidas`, `recibidas`, `emitidas-periodo-anterior`, `recibidas-periodo-anterior`.

### VerifactuMonitorSection

```
[ Aceptadas ]  [ Parcialmente ]  [ Rechazadas ]  [ Inválidas ]   ← tabs (= 4 subtabs)
┌────────────────────────────────────────────────┐
│  Paginated, sortable table (NEO)               │
│  "Nº Factura" column → link to invoice         │
└────────────────────────────────────────────────┘
```

Each tab maps directly to one NEO subtab endpoint.

### TbaiMonitorSection

```
Status filter: [ Todas ]  [ Enviadas ]  [ Error ]  [ Pendientes ]
┌────────────────────────────────────────────────┐
│  Flat list (one entity, paginated via NEO)     │
│  "Nº Factura" column → link to invoice         │
└────────────────────────────────────────────────┘
```

TBAI has no subtabs. Status filter is applied as a query parameter to NEO if the status field is filterable; otherwise filtered client-side.

### SII+TBAI profile

Both SiiMonitorSection and TbaiMonitorSection stack vertically, each under their own KPI group, with a visual separator between them.

---

## Invoice Navigation

Each table row includes an invoice identifier (`documentNo` or `invoiceId`). The link constructs an Etendo URL using the established pattern (`/web/...?tabId=...&recordId=...`). Opens in read-only view — no edit action.

---

## Component Structure

```
artifacts/
├── sii-monitor/decisions.json
├── verifactu-monitor/decisions.json
├── tbai-facturas-enviadas/decisions.json
└── fiscal-monitor/decisions.json          ← layoutType: "custom", no entities

tools/app-shell/src/windows/custom/fiscal-monitor/
├── FiscalMonitorPage.jsx          ← main orchestrator, profile router
├── FiscalKpiCards.jsx             ← KPI summary cards
├── SiiMonitorSection.jsx          ← SII section: tabs + period toggle
├── VerifactuMonitorSection.jsx    ← Verifactu section: status tabs
├── TbaiMonitorSection.jsx         ← TBAI section: flat list + status filter
└── useFiscalMonitor.js            ← hook: profile detection + fetches + KPI counts
```

---

## Internationalization

All user-visible strings in `en_US.json` and `es_ES.json` under the `fiscalMonitor.*` namespace.

- AD field labels: `useLabel()` hook
- UI literals (tab names, status labels, empty states): `useUI()` hook
- Menu label: added to both locale files under existing menu key patterns

---

## Out of Scope

- Write actions (resend, retry, manual state change) — deferred to a future phase
- Export to CSV
- Date range filtering — covered by the period toggle for SII; can be added later for TBAI/Verifactu
- Push notifications for rejected invoices
