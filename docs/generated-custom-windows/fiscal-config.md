# Fiscal Config

## Intent

Use this window to configure the electronic invoicing system for an organization — selecting the correct regime (SII, TBAI, SII+TBAI, or Verifactu) based on the organization's fiscal territory, and then filling in the operational details required by the corresponding tax authority.

The window serves two distinct phases: onboarding (first-time setup via a guided wizard) and ongoing configuration maintenance (editing the records created during onboarding).

## What this window should allow

- Guide new organizations through fiscal territory selection and system assignment via a 6-screen onboarding wizard.
- Detect which fiscal records already exist and render only the applicable section(s): SII, TBAI, SII+TBAI (combined), or Verifactu.
- Allow editing of operational fields for each system: fiscal year dates, SII submission cadences, TBAI certificate upload, and Verifactu editable fields only.
- Prompt certificate upload (`.p12`/`.pfx`) for systems that require it (TBAI, SII+TBAI, Verifactu) at the end of onboarding.
- Show a conflict warning when incompatible records coexist (e.g. Verifactu + SII).
- Persist Verifactu tax type using the AD enum codes (`01` IVA, `03` IGIC, `02` IPSI), while showing the human-readable labels in the custom UI.
- Normalize fiscal boolean fields from NEO (`true`/`false` or `Y`/`N`) so switches render correctly and writes persist the intended boolean state.

## Wizard screens

The onboarding wizard activates when the organization has no fiscal configuration records (`profile = unconfigured`). It walks through 6 logical screens:

| Screen | Key | When shown |
|--------|-----|------------|
| Territory selection | `territory` | Always first |
| Sub-question | `subquestion` | When territory has `askNational` or `askVolume` |
| Manual system selection | `manual` | When the user taps "Select manually"; if a territory was already chosen it stays preselected |
| Confirmation | `confirm` | After territory + sub-question resolved |
| Detail (operational fields) | `detail` | After confirmation creates DB records |
| Applied / success | `applied` | After a successful detail save |
| Skipped | `skipped` | When user explicitly skips |

Territory groups and their regimes:

| Regime | Territories | Sub-question asked |
|--------|-------------|-------------------|
| `sii_foral` | Navarra | None (always SII) |
| `tbai` | Álava, Bizkaia, Gipuzkoa | `askNational`: also SII national? |
| `siiver` | España/Baleares, Canarias, Ceuta/Melilla | `askVolume`: billing > or ≤ 6.010.121 € |

`resolveSystem({ regime, alsoNational, volume, lowChoice })` in `fiscalConfig.utils.js` is the pure function that maps those answers to a final system (`SII`, `TBAI`, `SII+TBAI`, or `VERIFACTU`).

The manual screen still enforces territory-driven compatibility, but it no longer requires a prior selection on the first screen. Users can open manual mode directly, pick a territory there, and then choose one of the compatible systems. If they had already chosen a territory on the first screen, that territory appears preselected in the manual screen.

Changing the territory in either the main wizard screen or the manual screen resets the auto-flow answers (`alsoNational`, billing volume, and low-volume choice) so stale answers from a previous territory cannot leak into the confirmation summary. When the user reaches confirmation from manual mode, the back button returns to the manual screen rather than to the automatic sub-question flow.

## Profile detection

`detectProfile(sii, tbai, verifactu)` in `fiscalConfig.utils.js` derives the active profile from the presence and flags of the 3 config records:

| Profile | Condition |
|---------|-----------|
| `unconfigured` | All 3 records null |
| `sii` | SII record present, no special flags |
| `sii-navarra` | SII record with `navarra=Y` |
| `sii+tbai` | Both SII and TBAI records exist; OR SII record with `guipuzcoa=Y` (legacy fallback for Gipuzkoa) |
| `tbai` | Only TBAI record present |
| `verifactu` | Only Verifactu record present |
| `conflict` | Verifactu + SII or Verifactu + TBAI both exist |

## Interaction model

- Route: `/fiscal-config` (custom window, not generated).
- Visibility: visible in the Settings menu.
- Implementation type: `layoutType: "custom"` — loaded from `customLoaders` in `tools/app-shell/src/windows/registry.js`.
- Entry point: `FiscalConfigPage.jsx` — determines profile and delegates to wizard or section components.
- Date fields: `SiiSection.jsx` (`fechaAcogidaSII`, `monitordate`) and `TbaiSection.jsx` (`tbaisystemdate`) use the generic `DateField` component (`tools/app-shell/src/components/ui/date-field.jsx`) instead of a native `<Input type="date">`. This gives the Figma-aligned calendar popover with month/year picker.

## Data model

Three independent NEO Headless entities (one per system):

| System | Entity spec | Entity name |
|--------|------------|-------------|
| SII | `sii-config` | `siiConfiguration` |
| TBAI | `tbai-config` | `header` |
| Verifactu | `verifactu-config` | `cabeceraDeConfiguraciónVerifactu` |

Records are POST-created during wizard confirmation step and then edited in the detail step. `useFiscalConfig.js` parallelizes the 3 GET fetches and derives the profile client-side.

## Certificate upload (CertModal + CertSection)

`CertSection.jsx` renders the certificate status widget inside SII, TBAI, and Verifactu section forms. On mount it calls `GET /sws/neo/certificate?orgId=` to restore the cert status from `etsg_certificate`, so the "loaded" state persists across window refreshes. `CertModal.jsx` is the 3-step upload modal (pick → verify spinner → done/confirmNif).

### Backend endpoints (`NeoCertificateHelper`)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/sws/neo/certificate` | Upload a PKCS#12 cert via `multipart/form-data` (fields: `certificate`, `orgId`, `password`, optional `setOrgNif`) |
| `GET`  | `/sws/neo/certificate?orgId=` | Return `{exists, validTo}` for the active cert of that org |

The upload delegates to `AddCertificateToOrg` (existing SIF process) via reflection.

### NIF/CIF validation

Before storing the cert the backend parses the X.509 subject DN to extract the org NIF, using this priority order:

1. `organizationIdentifier` (OID 2.5.4.97) — FNMT RPJ certs; holds the company CIF.
2. `SERIALNUMBER` (OID 2.5.4.5) — personal/autónomo certs; holds the person's NIF.
3. `CN=… (R: NIF)` — fallback for older FNMT formats.

The extracted NIF is then compared (case-insensitive, hyphen-stripped) against `ad_orginfo.taxid`. Values `null`, empty, or `'?'` are treated as "org has no NIF configured". Three outcomes:

- **Match** — proceed to store.
- **No org NIF** — return `{pendingNifConfirmation: true, certNif}`. Frontend shows a confirmation step; if the user confirms, client re-posts with `setOrgNif=true` and the backend writes the NIF to `ad_orginfo.taxid`.
- **Mismatch** — return HTTP 422 with an explanatory error message.

`NeoCertificateHelperTest.java` (17 unit tests) covers `parseNifFromDn` and `normalizeNif` for all supported certificate formats.

## `onGoHome` prop

`OnboardingWizard` accepts an optional `onGoHome` prop. If provided, "Ir al inicio" (applied screen) and "Ir al inicio" (skipped screen) will call it instead of `onComplete`. This allows the host application to navigate to a dashboard or first-steps screen rather than staying in the fiscal-config window. When omitted, both buttons fall back to `onComplete`.

## Manual verification

1. Delete any existing SII/TBAI/Verifactu records for the test org, open `/fiscal-config`, and confirm the wizard territory screen appears.
2. Select "España/Baleares", confirm the volume sub-question appears, choose "≤ 6M€", choose "Verifactu", advance to confirm, and verify the summary shows Verifactu before pressing "Confirmar".
3. After confirmation, verify the detail screen shows the Verifactu form. Press "Guardar y aplicar" and confirm the applied screen appears with the success card.
4. Select "Álava" and choose "SII + TicketBAI", advance to confirm. After confirmation, verify both SiiSection and TbaiSection appear in the detail screen.
5. Upload a `.p12` certificate in the CertModal; confirm the stepper advances through pick → verify → done (or through the confirmNif step if the org has no taxid). Close and reopen the window — the "Certificado cargado" state should still show (persisted via GET endpoint).
6. Open `/fiscal-config` with an org that already has an SII record and confirm the wizard is NOT shown — only SiiSection renders.
7. Open `/fiscal-config` with an org that has both SII and Verifactu records and confirm the conflict warning renders.
8. Press "Omitir por ahora" on the territory screen and confirm the skipped screen shows with a "← Volver al asistente" button that returns to territory selection.

## Automated evidence

- `artifacts/fiscal-config/decisions.json` — `layoutType: "custom"`, window registered.
- `tools/app-shell/src/windows/registry.js` — `fiscal-config` in `customLoaders`; data-only fiscal specs are not registered as navigable windows.
- `tools/app-shell/src/menu.json` — `fiscal-config` entry under Settings group.
- `tools/app-shell/src/windows/custom/fiscal-config/FiscalConfigPage.jsx` — profile-routing orchestrator.
- `tools/app-shell/src/windows/custom/fiscal-config/OnboardingWizard.jsx` — 6-screen wizard with territory groups, sub-questions, confirm, detail, applied, and skipped screens.
- `tools/app-shell/src/windows/custom/fiscal-config/CertSection.jsx` — cert status widget with on-mount GET fetch to restore state after refresh.
- `tools/app-shell/src/windows/custom/fiscal-config/CertModal.jsx` — PKCS#12 upload modal (pick → verify → confirmNif? → done).
- `tools/app-shell/src/windows/custom/fiscal-config/fiscalConfig.utils.js` — `detectProfile`, `resolveSystem`, `getTerritoryDefaults`, `getCertificateContext`.
- `cli/test/fiscal-config.utils.test.js` — 92 regression tests covering profile detection, onboarding payloads, contract-specific ids, Verifactu save guards, SII field mapping, CertModal upload flow, and confirmNif flow (all passing).
- `tools/app-shell/src/windows/custom/fiscal-config/useFiscalConfig.js` — parallel fetcher hook for the 3 config records.
- `modules/com.etendoerp.go/.../NeoCertificateHelper.java` — certificate upload + GET endpoints; NIF extraction from X.509 DN; SAVEPOINT-protected org NIF lookup; confirmNif flow.
- `modules/com.etendoerp.go/.../NeoCertificateHelperTest.java` — 17 unit tests for NIF parsing and normalization.
- i18n: 250+ `fiscal.*` keys in `en_US.json` / `es_ES.json`; territory names, group hints, system descriptions, and all CertModal strings go through `useUI()`.
