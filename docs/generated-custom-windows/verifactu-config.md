# Verifactu Config

## Intent

Backend artifact window that stores the Verifactu configuration record for an organization. End users interact with this data exclusively through the **Fiscal Config** window (`fiscal-config`); this artifact is not exposed as a standalone menu entry.

Verifactu applies to organizations in mainland Spain/Baleares, Canarias, Ceuta, and Melilla whose annual revenue is at or below the SII threshold (≤ €6.010.121).

## What this window should allow

- Read and update the Verifactu configuration record: applicable tax type, default QR flag, and read-only system metadata.
- Enforce the lock: once `isReady` is set to `Y` (activated), the `tAXType` and `defaultQR` fields become immutable — the custom UI enforces this client-side and the backend enforces it server-side.
- Provide the `cabeceraDeConfiguraciónVerifactu` entity that `useFiscalConfig.js` fetches by `organization` filter and `VerifactuSection.jsx` writes via PUT.

## Custom UI

This window has no standalone custom UI. All custom rendering, validation, and save logic lives in:

- `tools/app-shell/src/windows/custom/fiscal-config/VerifactuSection.jsx`
- `tools/app-shell/src/windows/custom/fiscal-config/CertSection.jsx` (certificate upload for Verifactu)

## Key fields

| Field | Notes |
|-------|-------|
| `tAXType` | Applicable tax regime: `01` (IVA), `02` (IPSI — Ceuta/Melilla), `03` (IGIC — Canarias). Required before activation. |
| `defaultQR` | Include QR code on invoices by default |
| `isReady` | Lock flag — once `Y`, configuration is immutable |
| `issuerNIF` | NIF of the issuing organization (read-only, set by backend) |
| `systemStartat` | System activation timestamp (read-only) |
| `systemStopat` | System deactivation timestamp (read-only) |
| `incidentReport` | Incident report reference (read-only) |
| `inVfactuSystem` | AEAT enrollment date (read-only) |

## Tax type codes

| Code | Tax | Territory |
|------|-----|-----------|
| `01` | IVA | España / Baleares |
| `02` | IPSI | Ceuta / Melilla |
| `03` | IGIC | Canarias |

## See also

- Primary entry point: `docs/generated-custom-windows/fiscal-config.md`
- Architecture: `docs/architecture-overview.md`
