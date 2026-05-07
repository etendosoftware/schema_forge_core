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

Ambos botones tienen `OBUIAPP_Process_ID` pero NO `AD_Process_ID` estándar. NEO Headless no los expone automáticamente como endpoints `action/<columnName>`.

| Botón               | OBUIAPP_Process_ID                   | Tipo     | Implementación |
|--------------------|--------------------------------------|----------|----------------|
| `Em_aeatsii_send`  | `2ECF46DAAEEB486EAF79D3594D50DE5F`   | **JavaScript** | `OB.AEATSII.send` (client-side en Classic Etendo) |
| `Em_Tbai_Xmlgenerator` | `BE2486102F2C41779B760609FD69A225` | **Java**   | `com.smf.ticketbai.process.XMLConvertionFromInvoice` |

### Lo que hay que hacer

#### TBAI — NeoHandler Java (directo)

TBAI tiene un proceso Java conocido. Implementar un `NeoHandler` en `com.etendoerp.go` que instancie o invoque `com.smf.ticketbai.process.XMLConvertionFromInvoice` pasándole el `C_Invoice_ID`.

```
modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/handlers/
  TbaiXmlgeneratorHandler.java   → @Named("tbai-xmlgenerator")
```

Ver `docs/neo-headless-extensibility.md` para la API del NeoHandler y cómo configurar el `Java_Qualifier` en `ETGO_SF_ENTITY`.

#### SII — Investigar el servidor detrás de `OB.AEATSII.send`

`OB.AEATSII.send` es JavaScript de client-side en Classic Etendo. Antes de implementar el NeoHandler hay que descubrir a qué servlet/endpoint Java llama ese JS:

1. Buscar en el código fuente del módulo `org.openbravo.module.aeatSii` (o similar) el servlet al que `OB.AEATSII.send` hace POST
2. Identificar la clase Java que procesa esa request
3. Implementar `SiiSendHandler.java` que llame a esa clase directamente (sin pasar por el servlet HTTP)

```
modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/handlers/
  SiiSendHandler.java   → @Named("sii-send")
```

Si el servlet de SII no es invocable directamente, la alternativa es hacer una llamada HTTP interna desde el NeoHandler al mismo Tomcat (localhost).

---

## Archivos pendientes de push (cuando esté todo listo)

- `etendo_schema_forge/` → rama `feature/ETP-3778` (11 commits adelante de origin)
- `com.etendoerp.go/` → rama `feature/ETP-3778` (commits pendientes)
