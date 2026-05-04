# Design — Configuración Fiscal (fiscal-config)

> **Status:** COMPLETE — approved by user. Ready for implementation planning.
> **Date:** 2026-04-27
> **Branch:** epic/ETP-3504

---

## Context

The user wants to consolidate 3 separate fiscal configuration windows into a single streamlined "Configuración fiscal" entry in the menu. Inspired by Holded's territory-aware onboarding.

### Source Windows

| Window | Table | NEO spec name | Menu ID |
|--------|-------|--------------|---------|
| SII Configuration | `aeatsii_config` | `sii-config` | `C1D3A2A017AC4B82B9FEE6F4D2A0C55A` |
| Configuración TBAI | `TBAI_Config` | `tbai-config` | `C327DE215AC945F69363905840118177` |
| Configuración Verifactu | `etvfac_verifactu_config` | `verifactu-config` | `27A453FA86974745977672F1A8DCCEFF` |

### Key Business Rule

> **Incompatibility rule:** A Verifactu configuration and a SII (or TBAI) configuration cannot coexist for the same legal organization. The SII + TBAI combination is allowed.

### Territory → Fiscal System Mapping (legal rules)

| Territory | SII | Verifactu | TBAI | Notes |
|-----------|-----|-----------|------|-------|
| España Peninsular / Baleares | If >€6M or voluntary | If NOT in SII | — | `taxtype=IVA` |
| Canarias | If >€6M or voluntary | If NOT in SII | — | `taxtype=IGIC` |
| Ceuta / Melilla | If >€6M or voluntary | If NOT in SII | — | `taxtype=IPSI` |
| Navarra | Always (Hacienda Navarra) | — | — | `navarra=Y` in SII config |
| País Vasco — Álava | If >€6M | — | Always | `territory=Álava` |
| País Vasco — Bizkaia | If >€6M | — | Always (+Batuz) | `territory=Bizkaia` |
| País Vasco — Gipuzkoa | If >€6M | — | Always | `guipuzcoa=Y` in SII; `territory=Gipuzkoa` |

**Why Verifactu and SII are mutually exclusive:** SII already covers the invoice traceability that Verifactu requires for non-SII companies. SII-enrolled companies are exempt from Verifactu.

---

## Goal

A single "Configuración Fiscal" menu entry that:
- Shows only the fiscal system(s) relevant to the selected organization
- Works for both initial setup (first-time config) and ongoing management (edit/review)
- Provides a guided onboarding if no config exists yet for the org
- Inspired by Holded's seamless territory-aware UX

**Chosen approach: Option B — Territory-aware smart form (custom window)**

---

## Architecture (APPROVED)

```
Menu "Configuración Fiscal"
        │
        ▼
fiscal-config (custom window, layoutType: "custom")
        │
        ├── NEO: /api/sii-config       ← tabla aeatsii_config
        ├── NEO: /api/tbai-config      ← tabla TBAI_Config
        └── NEO: /api/verifactu-config ← tabla etvfac_verifactu_config
```

**Components:**

1. **3 NEO-only artifacts** — `sii-config`, `tbai-config`, `verifactu-config`. Each goes through the Schema Forge pipeline (extract → classify → contract → push-to-neo). No menu entry — data APIs only.

2. **1 custom artifact** — `fiscal-config` with `layoutType: "custom"`. Has the menu entry. Generates a shell that the React component replaces completely.

3. **1 React component** — `tools/app-shell/src/windows/custom/fiscal-config/FiscalConfigPage.jsx`. Fetches from the 3 NEO endpoints filtered by the selected org, detects which fiscal system applies, and renders the relevant section(s).

No new DB tables. No new Java backend code. All territory-awareness lives in the frontend.

---

## Section 2: Territory Detection Flow (APPROVED)

### Detection from existing config (ongoing management)

```
hasSII      = GET /api/sii-config?orgId=X       → has record?
hasTBAI     = GET /api/tbai-config?orgId=X      → has record?
hasVerifactu= GET /api/verifactu-config?orgId=X → has record?

if hasVerifactu AND (hasSII OR hasTBAI) → profile = "conflict"   (show error, block editing)
elif hasVerifactu                        → profile = "verifactu"
elif hasSII AND sii.guipuzcoa = Y        → profile = "sii+tbai"
elif hasSII AND sii.navarra = Y          → profile = "sii-navarra"
elif hasSII                              → profile = "sii"
elif hasTBAI                             → profile = "tbai"
else                                     → profile = "unconfigured"
```

All 3 fetches run in parallel on org select. Profile is derived once all 3 resolve.

### Onboarding flow (profile = "unconfigured")

Two-step wizard:

**Step 1 — Territory selection**
```
¿En qué territorio fiscal opera esta organización?

  [ España / Baleares ]   [ Canarias ]   [ Ceuta / Melilla ]
  [ Navarra ]             [ País Vasco → Álava / Bizkaia / Gipuzkoa ]

  ──────────────────────────────────────────────────────
  [ Omitir por ahora ]
  Puedes configurar el sistema fiscal más adelante
  desde este mismo menú.
```
"Omitir por ahora" creates no record and returns to the `unconfigured` idle state with a reassuring inline message. No blocking.

**Step 2a — For España / Canarias / Ceuta-Melilla:**
```
¿Está inscrita en el SII? (facturación anual > 6M€ o adhesión voluntaria)

  [ Sí, estoy en el SII ] → Create SII record (taxtype auto-filled by territory)
  [ No ]                  → Create Verifactu record
```

**Step 2b — For Navarra:**
No question needed → directly creates SII record with `navarra=Y` pre-set.

**Step 2c — For País Vasco (territory already selected in step 1):**
```
¿También está obligada al SII nacional? (facturación > 6M€)

  [ Sí ] → Create TBAI record + Create SII record (guipuzcoa=Y if Gipuzkoa)
  [ No ] → Create TBAI record only
```

### Conflict state (profile = "conflict")
Show a blocking error banner. All fields are read-only. User must delete the conflicting config before editing.

---

## Pending Design Sections (TO BE COMPLETED)

- [x] Section 3: UI layout per scenario — APPROVED
  - Org selector always visible at top; page re-renders on org change
  - `unconfigured`: 2-step card wizard (territory → SII/Verifactu or TBAI/SII+TBAI)
  - `sii`: grouped form (Estado, Entorno, Envíos, Régimen especial, Acciones). Navarra/Guipuzcoa flags set internally, not shown.
  - `sii-navarra`: same as sii, different badge ("Hacienda Foral de Navarra")
  - `sii+tbai`: two expanded sections, one global Save button at the bottom
  - `tbai`: single TBAI section, territory shown as fixed badge
  - `verifactu` unlocked: editable form + prominent "Marcar como Listo" CTA with irreversibility warning
  - `verifactu` locked (is_ready=Y): full read-only, "Activo" badge
  - `conflict`: blocking error banner, all fields read-only
- [x] Section 4: NEO backend configuration — APPROVED
  - All 3 artifacts are data-only (no menu entry); only `fiscal-config` has menu entry
  - `sii-config`: Navarra, Guipuzcoa, Taxtype → system/fromConfig (set by territory in onboarding, never user-editable); AD_Org_ID → system/fromParent; Valid_Hash → button
  - `tbai-config`: ETSG_SIF_Territory → readOnly badge (fixed at creation); AD_Org_ID → system/fromParent
  - `verifactu-config`: IS_Ready button locks all other fields when activated; AD_Org_ID → system/fromParent
- [x] Section 5: Data flow & edit behavior — APPROVED
  - Create vs update detected from recordId presence after initial fetch
  - sii+tbai global save: parallel PUT for both; per-section error if one fails
  - Verifactu "Marcar como Listo": confirmation modal → irreversible lock → all fields go readOnly → button disappears
  - Inline validation (not toasts): SII needs taxtype+plazo; TBAI needs date+description; Verifactu needs tax_type before allowing Listo
- [x] Section 6: i18n — APPROVED (see below)
- [x] Section 7: Testing — APPROVED (see below)

---

## SII Configuration Fields (18 fields, table: aeatsii_config)

| SeqNo | Field | Column | Type | Mandatory |
|-------|-------|--------|------|-----------|
| 20 | Organization | AD_Org_ID | Selector | Y |
| 40 | In SII system | Insiisystem | YesNo | Y |
| 50 | In SII system date | Insiisystemdate | Date | N |
| 80 | SII sending deadline | Plazo | Integer | Y |
| 90 | Sales Invoice SII sending Cadence | Cadencia | Integer | Y |
| 100 | Purchase Invoice SII sending Cadence | Cadencia_Compra | Integer | Y |
| 110 | Production environment | Produccion | YesNo | Y |
| 120 | Attach XML files | Adjuntos | YesNo | Y |
| 140 | RECC affected | Recc | YesNo | Y |
| 150 | Subject in REDEME | Redeme | YesNo | Y |
| 160 | From date display in SII Monitor | Monitordate | Date | N |
| 170 | SII - Navarra Tax Agency | Navarra | YesNo | Y |
| 175 | SII - Guipuzcoa Agency | Guipuzcoa | YesNo | N |
| 180 | Send to SII only Posted Purchase Invoices | Posted_Invoices | YesNo | Y |
| 190 | Tax Type | Taxtype | List | Y |
| 200 | Authorization No. | Authorizationno | String | N |
| 3000 | Active | Isactive | YesNo | Y |
| 3080 | Validate Hash | Valid_Hash | Button | Y |

## TBAI Configuration Fields (9 fields, table: TBAI_Config)

| SeqNo | Field | Column | Type | Mandatory |
|-------|-------|--------|------|-----------|
| 10 | Organización | AD_Org_ID | TableDir | Y |
| 61 | Territorio SIF | ETSG_SIF_Territory | List | N |
| 62 | Fecha Acogida TBAI | Tbaisystemdate | Date | Y |
| 63 | Entorno de Producción | Production_Env | YesNo | Y |
| 120 | Descripción de Facturas | Invoice_Description | String | Y |
| 125 | Utilizar descripción también para nombre producto | USE_Asproduct_Desc | YesNo | Y |
| 130 | Auto enviar facturas al completarse | Auto_Send_Invoices | YesNo | Y |
| 140 | Ruta de Reporte Jasper | Jasperreport_Path | String | N |
| 150 | Validar factura anterior | Validate_Previous_Invoice | YesNo | Y |

## Verifactu Configuration Fields (9 fields, table: etvfac_verifactu_config)

| SeqNo | Field | Column | Type | Mandatory |
|-------|-------|--------|------|-----------|
| 10 | Organización | AD_Org_ID | Selector | Y |
| 40 | Impuesto de Aplicación | TAX_Type | List | Y |
| 55 | QR Por Defecto | Default_Qr | YesNo | Y |
| 80 | NIF de Emisor | Issuer_Nif | String | N |
| 110 | Arranque del Sistema | System_Startat | String | N |
| 120 | Parada del Sistema | System_Stopat | String | N |
| 130 | Detalle Incidencia | Incident_Report | Text | N |
| 140 | Marcar Como Listo | IS_Ready | Button | Y |
| 150 | Fecha de Acogida | IN_Vfactu_System | DateTime | N |

---

## Section 6: i18n Requirements

All user-visible strings must be translated to both `es_ES.json` and `en_US.json`. Primary language is Spanish.

### New i18n keys required

| Key | es_ES | en_US |
|-----|-------|-------|
| `fiscal.title` | Configuración Fiscal | Fiscal Configuration |
| `fiscal.territory.question` | ¿En qué territorio fiscal opera esta organización? | What fiscal territory does this organization operate in? |
| `fiscal.territory.espania` | España / Baleares | Spain / Balearic Islands |
| `fiscal.territory.canarias` | Canarias (IGIC) | Canary Islands (IGIC) |
| `fiscal.territory.ceuta` | Ceuta / Melilla (IPSI) | Ceuta / Melilla (IPSI) |
| `fiscal.territory.navarra` | Navarra | Navarre |
| `fiscal.territory.paisvasco` | País Vasco | Basque Country |
| `fiscal.sii.question` | ¿Está inscrita en el SII? | Is this organization enrolled in SII? |
| `fiscal.sii.enrolled` | Sí, estoy en el SII | Yes, enrolled in SII |
| `fiscal.sii.notenrolled` | No, usar Verifactu | No, use Verifactu |
| `fiscal.tbai.sii.question` | ¿También está obligada al SII nacional? (>6M€) | Also obligated for national SII? (>€6M) |
| `fiscal.skip` | Omitir por ahora | Skip for now |
| `fiscal.skip.hint` | Puedes configurar el sistema fiscal más adelante desde este mismo menú. | You can configure the fiscal system later from this same menu. |
| `fiscal.verifactu.ready.modal.title` | Activar Verifactu | Activate Verifactu |
| `fiscal.verifactu.ready.modal.body` | Esta acción bloqueará la configuración de Verifactu permanentemente. Una vez activado, no podrás modificar los parámetros del sistema. ¿Continuar? | This will permanently lock the Verifactu configuration. Once activated, system parameters cannot be modified. Continue? |
| `fiscal.verifactu.locked.badge` | Activo | Active |
| `fiscal.verifactu.unlocked.badge` | No activado | Not activated |
| `fiscal.conflict.title` | Configuración inválida | Invalid configuration |
| `fiscal.conflict.body` | Esta organización tiene Verifactu y SII/TBAI configurados simultáneamente. Estos sistemas son incompatibles. Elimina uno de los dos antes de continuar. | This organization has both Verifactu and SII/TBAI configured. These systems are incompatible. Remove one before continuing. |
| `fiscal.sii.badge.navarra` | Hacienda Foral de Navarra | Navarre Tax Authority |
| `fiscal.save` | Guardar | Save |

Field labels are loaded via `useLabel()` from the AD column names — no new keys needed for field names.

---

## Section 7: Testing Requirements

### Unit tests (component logic)

| Scenario | What to assert |
|----------|----------------|
| 3 fetches return empty | profile = `unconfigured`, onboarding renders |
| Only SII record with `guipuzcoa=Y` | profile = `sii+tbai`, both sections render |
| Only SII record with `navarra=Y` | profile = `sii-navarra`, Navarra badge shows |
| Only TBAI record (no SII) | profile = `tbai` |
| Only Verifactu with `is_ready=N` | profile = `verifactu`, button visible |
| Only Verifactu with `is_ready=Y` | profile = `verifactu` locked, all fields readOnly, button gone |
| SII + Verifactu both exist | profile = `conflict`, error banner, no save button |
| Org changes | 3 fetches re-fire, state resets |
| "Omitir por ahora" clicked | No record created, hint message shown |

### Edge cases

| Case | Expected behavior |
|------|-------------------|
| Onboarding: Navarra selected | Skip step 2, create SII directly with `navarra=Y` |
| Onboarding: Gipuzkoa + SII | Create both records with `guipuzcoa=Y` in SII |
| `sii+tbai` save: SII PUT fails, TBAI PUT succeeds | Show error on SII section only; TBAI shows success |
| Verifactu "Marcar como Listo" confirm → API fails | Stay unlocked, show inline error |
| Verifactu "Marcar como Listo" confirm → success | Re-fetch, enter locked state |

### Integration tests (NEO endpoints)

- `GET /api/sii-config?orgId=X` returns correct record for org
- `POST /api/sii-config` creates record with correct defaults
- `PUT /api/verifactu-config/:id` with `IS_Ready=Y` locks the record
- Confirm `Navarra=Y` and `Guipuzcoa=Y` are not user-settable via the API (field classified as system)

---

## Notes

- Verifactu `IS_Ready` button is irreversible — confirmation modal required. Button disappears after lock.
- SII `Guipuzcoa=Y` and `Navarra=Y` are set programmatically during onboarding, never shown as user-editable fields.
- `ETSG_SIF_Territory` in TBAI is set at creation time and shown as a read-only badge thereafter.
- The `fiscal-config` artifact has `layoutType: "custom"` — the generated shell is fully replaced by `FiscalConfigPage.jsx`.
