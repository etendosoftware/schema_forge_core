# TBAI Config

## Intent

Backend artifact window that stores the TBAI (TicketBAI) configuration record for an organization. End users interact with this data exclusively through the **Fiscal Config** window (`fiscal-config`); this artifact is not exposed as a standalone menu entry.

TBAI applies to organizations in the Basque Country fiscal territories (Álava, Bizkaia, Gipuzkoa) and may coexist with a national SII obligation when annual revenue exceeds €6M.

## What this window should allow

- Read and update the TBAI configuration record: territory, system activation date, environment, invoice description, product description source, auto-send flag, report template path, and invoice chain validation flag.
- Provide the `header` entity that `useFiscalConfig.js` fetches by `organization` filter and `TbaiSection.jsx` writes via PUT.

## Custom UI

This window has no standalone custom UI. All custom rendering, validation, and save logic lives in:

- `tools/app-shell/src/windows/custom/fiscal-config/TbaiSection.jsx`
- `tools/app-shell/src/windows/custom/fiscal-config/CertSection.jsx` (certificate upload for TBAI)

## Key fields

| Field | Notes |
|-------|-------|
| `etsgSifTerritory` | Basque territory (`alava`, `bizkaia`, `gipuzkoa`) |
| `tbaisystemdate` | TBAI system activation date |
| `productionEnv` | Production vs test environment flag |
| `invoiceDescription` | Default invoice description |
| `uSEAsproductDesc` | Use product description as invoice description |
| `autoSendInvoices` | Auto-send invoices to the tax authority |
| `jasperreportPath` | Path to the Jasper report template |
| `validatePreviousInvoice` | Validate previous invoice chain |

## See also

- Primary entry point: `docs/generated-custom-windows/fiscal-config.md`
- Architecture: `docs/architecture-overview.md`

## Automated evidence

The `decisions.json` declares `attachments: false`, so the Attachments tab is explicitly disabled for this window.
