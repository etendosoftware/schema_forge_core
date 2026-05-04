# SII Config

## Intent

Backend artifact window that stores the SII (Suministro Inmediato de Información) configuration record for an organization. End users interact with this data exclusively through the **Fiscal Config** window (`fiscal-config`); this artifact is not exposed as a standalone menu entry.

## What this window should allow

- Read and update the SII enrollment record for the current organization: enrollment flag, enrollment date, SII monitor start date, submission deadlines, invoice cadences, environment flag, XML attachment flag, RECC, and REDEME regime flags.
- Validate the SII hash via the `validHash` action (invoked from the SII section of `fiscal-config`).
- Provide the `siiConfiguration` entity that `useFiscalConfig.js` fetches by `organization` filter and `SiiSection.jsx` writes via PUT.

## Custom UI

This window has no standalone custom UI. All custom rendering, validation, and save logic lives in:

- `tools/app-shell/src/windows/custom/fiscal-config/SiiSection.jsx`
- `tools/app-shell/src/windows/custom/fiscal-config/CertSection.jsx` (certificate upload for SII)

## Key fields

| Field | Notes |
|-------|-------|
| `acogidaAlSII` | Boolean — enrolled in SII |
| `fechaAcogidaSII` | SII enrollment date |
| `monitordate` | SII monitor start date |
| `plazoLmiteDeEnvoASII` | Submission deadline (days) |
| `cadenciaEnvoFacturasVentaASII` | Sales invoice cadence (days) |
| `cadenciaEnvoFacturasCompraASII` | Purchase invoice cadence (days) |
| `entornoDeProduccin` | Production vs test environment flag |
| `adjuntarArchivosXML` | Attach XML files to submissions |
| `recc` | RECC special regime |
| `redeme` | REDEME special regime |

## See also

- Primary entry point: `docs/generated-custom-windows/fiscal-config.md`
- Architecture: `docs/architecture-overview.md`
