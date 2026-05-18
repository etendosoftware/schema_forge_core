# Monitor Verifactu

> **API-only sub-window** — no standalone UI. Data is fetched directly by
> `FiscalMonitorPage` via NEO Headless. There is no route or menu entry for this spec.

## Purpose

Exposes Verifactu invoice submission records to the fiscal monitor UI. The spec provides
read access to four entity tabs, one per submission status:

| Entity | NEO path segment | Description |
|--------|-----------------|-------------|
| `facturasAceptadas` | `/facturasAceptadas` | Accepted invoices |
| `partiallyAcceptedInvoices` | `/partiallyAcceptedInvoices` | Partially accepted invoices |
| `facturasRechazadas` | `/facturasRechazadas` | Rejected invoices |
| `facturasInválidas` | `/facturasInválidas` | Invalid invoices |

> **Note:** `partiallyAcceptedInvoices` was renamed from `facturasParcialmenteAceptadas`
> in ETP-3778 to follow the English-naming convention.

## How it is consumed

`useFiscalMonitor.js` and `VerifactuMonitorSection.jsx` fetch paginated rows from:

```
GET /sws/neo/monitor-verifactu/{entity}?adOrgId=...&page=...
```

The `VerifactuMonitorSection` component drives tab switching. KPI counts are derived in
`fiscalMonitor.utils.js → computeKpis()`.

## Parent guide

See [fiscal-monitor.md](fiscal-monitor.md) for the full functional specification,
debug mode, test plan, and known issues.

## Automated evidence

The `decisions.json` declares `attachments: false`, so the Attachments tab is explicitly disabled for this window.
