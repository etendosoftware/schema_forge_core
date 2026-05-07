# SIF in Etendo GO — Status & Remaining Work

**Branch:** `feature/ETP-3778`
**Fecha:** 2026-05-07

---

## Lo que ya está hecho

### SendToSifButton (topbar)

- **Componente:** `artifacts/sales-invoice/custom/SendToSifButton.jsx`
- Detecta el perfil fiscal vía `useFiscalConfig` + `useAuth().selectedOrg`
- Visible solo en facturas `CO` con perfil `sii`, `sii-navarra`, `tbai`, o `sii+tbai`
- Modal de 3 fases: confirmación → enviando (bloqueante) → resultado por sistema
- Llama `POST /sws/neo/sales-invoice/header/{id}/action/Em_aeatsii_send` (SII) y `Em_Tbai_Xmlgenerator` (TBAI)
- Tests: `custom/__tests__/SendToSifButton.test.js` (18 tests, pasan)
- i18n: 11 claves `sendToSif*` en `en_US.json` y `es_ES.json`

### SifDataTabs (panel inferior)

- **Componente:** `artifacts/sales-invoice/custom/SifDataTabs.jsx`
- Renderiza dentro de `InvoiceBottomPanel`, sección izquierda al final
- Tab SII visible para perfiles `sii`, `sii-navarra`, `sii+tbai`
- Tab TBAI visible para perfiles `tbai`, `sii+tbai`
- Badge de estado prominente al tope de cada tab:
  - SII: `aeatsiiEstado` → Correcto / Aceptado con errores / Incorrecto / Pendiente / etc.
  - TBAI: `tbaiIssent` → Enviada a TBAI / No enviada
- Campos SII editables hasta que `aeatsiiIssent = Y`: tipo factura, descripción maestra, descripción SII, causa exención, autorización
- `etsgDateOperation` (Fecha operación) read-only una vez completada la factura
- Ejercicio y periodo SII siempre read-only
- Auto-save on blur con PATCH a `/sales-invoice/header/{id}`
- Tests: `custom/__tests__/SifDataTabs.test.js` (18 tests, pasan)

### Campos reclasificados en decisions.json (header)

Los siguientes campos pasaron de `discarded`/`system` a `editable` o `readOnly` con `form: false`,
quedando disponibles en el response de la API sin renderizarse en `HeaderForm.jsx`:

| Campo API            | Columna AD                  | Visibility |
|---------------------|-----------------------------|-----------|
| `aeatsiiClaveTipo`  | EM_Aeatsii_Clave_Tipo        | editable  |
| `aeatsiiDescription`| EM_Aeatsii_Description_ID    | editable  |
| `aeatsiiDescripcionSii` | EM_Aeatsii_Descripcion_Sii | editable |
| `aeatsiiCauseExemption` | EM_Aeatsii_Cause_Exemption_ID | editable |
| `aeatsiiIsauthorization` | EM_Aeatsii_Isauthorization | editable |
| `etsgDateOperation` | EM_Etsg_Date_Operation       | editable  |
| `aeatsiiEjercicio`  | EM_Aeatsii_Ejercicio         | readOnly  |
| `aeatsiiPeriodo`    | EM_Aeatsii_Periodo           | readOnly  |
| `aeatsiiIssent`     | EM_Aeatsii_Issent            | readOnly  |
| `aeatsiiEstado`     | EM_Aeatsii_Estado            | readOnly  |
| `tbaiSequence`      | EM_Tbai_Sequence             | readOnly  |
| `tbaiInvoicenum`    | EM_Tbai_Invoicenum           | readOnly  |
| `tbaiInvoiceseq`    | EM_Tbai_Invoiceseq           | readOnly  |
| `tbaiIssent`        | EM_Tbai_Issent               | readOnly  |

---

## Lo que falta — El 404

### Problema

```
POST /sws/neo/sales-invoice/header/{id}/action/Em_aeatsii_send
→ 404 Not Found

POST /sws/neo/sales-invoice/header/{id}/action/Em_Tbai_Xmlgenerator
→ 404 Not Found (pendiente de verificar)
```

### Causa raíz

`Em_aeatsii_send` y `Em_Tbai_Xmlgenerator` son **columnas de tipo Button sin `AD_Process_ID`** en Classic Etendo. No son AD_Process estándar — son botones que disparan Java directamente desde la UI clásica.

NEO Headless solo expone endpoints `action/<columnName>` cuando el proceso está configurado a través de la infraestructura de NEO (bien como `menuAction` en decisions.json vinculado a un AD_Process, o bien mediante un `NeoHandler` Java).

### Lo que hay que hacer

Hay dos opciones:

#### Opción A — NeoHandler Java (recomendada)

Implementar dos beans `NeoHandler` en `com.etendoerp.go`:

```
modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/handlers/
  SiiSendHandler.java        → @Named("sales-invoice-sii-send")
  TbaiXmlgeneratorHandler.java → @Named("sales-invoice-tbai-send")
```

Cada handler intercepta la llamada `action/Em_aeatsii_send` o `action/Em_Tbai_Xmlgenerator`
y ejecuta la lógica Java del módulo SII/TBAI correspondiente.

Ver: `docs/neo-headless-extensibility.md` para la API del NeoHandler.

Necesitarás identificar la clase Java que ejecuta la acción en Classic Etendo:
- SII: buscar `EM_Aeatsii_Send` en el código Java de `org.openbravo.module.aeatSii` o similar
- TBAI: buscar `EM_Tbai_Xmlgenerator` en el código Java del módulo TBAI

#### Opción B — menuActions con AD_Process vinculado

Si los botones tienen un `AD_Process_ID` asociado en alguna versión del módulo (o se puede crear uno), se puede registrar como `menuAction` en `decisions.json` y NEO lo expone automáticamente.

Actualmente `EM_Aeatsii_Send` en `C_Invoice` tiene `AD_Process_ID = NULL`, por lo que esta opción requeriría modificar el módulo SII.

---

## Archivos pendientes de push (cuando esté todo listo)

- `etendo_schema_forge/` → rama `feature/ETP-3778` (11 commits adelante de origin)
- `com.etendoerp.go/` → rama `feature/ETP-3778` (commits pendientes)
