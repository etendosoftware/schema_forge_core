# SII Monitor

> **API-only sub-window** — no standalone UI. Data is fetched directly by
> `FiscalMonitorPage` via NEO Headless. There is no route or menu entry for this spec.

## Purpose

Exposes SII (Suministro Inmediato de Información) invoice submission records to the fiscal
monitor UI. The spec provides read access to four entity tabs:

| Entity | Description |
|--------|-------------|
| `issuedInvoices` | Current-period issued invoices sent to AEAT SII |
| `issuedInvoices(previousPeriod)` | Prior-period issued invoices |
| `receivedInvoices` | Current-period received invoices |
| `receivedInvoices(previousPeriod)` | Prior-period received invoices |

Each entity also exposes a `*SiiData` sub-entity with the raw AEAT response fields.

## How it is consumed

`useFiscalMonitor.js` and `SiiMonitorSection.jsx` fetch paginated rows from:

```
GET /sws/neo/sii-monitor/{entity}?adOrgId=...&page=...
```

The `SiiMonitorSection` component drives tab/period switching and row filtering. KPI
counts are derived in `fiscalMonitor.utils.js → computeKpis()`.

## Parent guide

See [fiscal-monitor.md](fiscal-monitor.md) for the full functional specification,
debug mode, test plan, and known issues.
