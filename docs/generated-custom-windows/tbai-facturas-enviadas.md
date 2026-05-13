# TBAI Facturas Enviadas

> **API-only sub-window** — no standalone UI. Data is fetched directly by
> `FiscalMonitorPage` via NEO Headless. There is no route or menu entry for this spec.

## Purpose

Exposes TBAI (TicketBAI) invoice submission records to the fiscal monitor UI. The spec
provides read access to a single entity tab filtered by submission status:

| Entity | Description |
|--------|-------------|
| `sincronización` | All TBAI invoices sent, filterable by status |

Supported status filters (matched against `r.estado`):

| Filter key | Meaning |
|-----------|---------|
| `'all'` | No filter — show all rows |
| `'Recibido'` | Accepted by the tax authority |
| `'Rechazado'` | Rejected (combines rejected + error counts in the KPI) |

> These filter keys are TBAI API status codes, not UI labels. Labels are resolved
> via `fiscalMonitor.tbai.tab.*` i18n keys.

## How it is consumed

`useFiscalMonitor.js` and `TbaiMonitorSection.jsx` fetch paginated rows from:

```
GET /sws/neo/tbai-facturas-enviadas/sincronización?adOrgId=...&page=...&estado=...
```

The `TbaiMonitorSection` component drives filter switching and row rendering.

## Parent guide

See [fiscal-monitor.md](fiscal-monitor.md) for the full functional specification,
debug mode, test plan, and known issues.

## Automated evidence

The `decisions.json` declares `attachments: false`, so the Attachments tab is explicitly disabled for this window.
