# Plan: Resolver defaults de líneas vía `/defaults` (NEO Headless)

**Owner:** ETP-3859
**Status:** Draft
**Date:** 2026-04-25

## Problema

Hoy la cabecera (`useEntity.handleNew`, `useEntity.js:464-499`) llama a `GET /sws/neo/{spec}/{entity}/defaults` y NEO Headless evalúa `@SQL=`, `@FieldName@`, preferencias, doc-type sequences, link-to-parent y mandatory defaults server-side.

Las líneas, en cambio, NO llaman a `/defaults`. `InlineAddRow.buildEmpty` (`DataTable.jsx:300-312`) y el reset post-save (`:362-381`) solo leen el `f.defaultValue` estático del contract y lo meten literal en el row vacío. Único caso especial: `lineNo` se calcula con `Math.max(lineNos) + 10` en JS (`:295-298`).

### Síntomas

1. Cualquier campo de línea con `defaultValue: "@SQL=..."`, `"@Variable@"` o `"@FieldName@"` se renderiza con la string cruda como valor inicial. Ejemplo concreto: `M_MovementLine.Line` en `goods-movements` → contrato emite `defaultValue: '@SQL=SELECT COALESCE(MAX(Line),0)+10 ... WHERE M_Movement_ID=@M_Movement_ID@'`. Lo salva el hardcode JS de `lineNo`, pero cualquier otro campo con `@SQL=` se rompe.
2. El cálculo JS de `lineNo` puede divergir del SQL real (líneas borradas, registros no visibles, concurrencia).
3. Defaults derivados del padre (`@M_Warehouse_ID@`, `@AD_Client_ID@`, `@C_BPartner_ID@`) no se aplican en líneas — el usuario tiene que tipearlos o esperar a callouts.
4. Link-to-parent FK (`M_Movement_ID` en `M_MovementLine`) tampoco se autocompleta vía defaults — depende de que el guardado backend lo infiera.
5. Mandatory defaults / fallback FK / preferencias del usuario no se aplican a líneas.

## Validación del backend

`NeoServlet.handleDefaults` (`NeoServlet.java:1019-1052`) y `NeoDefaultsService.resolveDefaults` ya soportan **cualquier entidad** (header o child) con `parentId` opcional:

- **Endpoint:** `GET /sws/neo/{specName}/{entityName}/defaults?parentId={headerId}` (`NeoServlet.java:1034,1045`).
- **Link-to-parent:** `resolveFieldDefault` (`NeoDefaultsService.java:311-313`) devuelve `parentId` para columnas FK al padre.
- **`@SQL=` con valores del padre:** `resolveSQLDefault(... Map<String,Object> parentValues)` (`:550-589`) resuelve `@M_Movement_ID@`, `@AD_Client_ID@`, etc. desde el registro padre antes de caer a sesión.
- **Mandatory defaults:** `injectMandatoryDefaults(body, adTab, ctx, parentId)` (`:752`) ya carga `parentValues` con `loadParentValues(adTab, parentId)`.
- **Sequences / doc types / preferencias:** todo el pipeline ya implementado.

**Conclusión:** no hay cambios de backend. El fix es 100% frontend.

## Cambios propuestos

### 1. `tools/app-shell/src/components/contract-ui/DataTable.jsx`

Convertir `InlineAddRow.buildEmpty` en async + cachear el resultado de `/defaults` por sesión de "agregar líneas".

**Estado actual:**
```js
const buildEmpty = useCallback(() => {
  const empty = {};
  for (const f of fields) {
    if (f.key === 'lineNo') empty[f.key] = defaultLineNo;
    else if (f.defaultValue !== undefined) empty[f.key] = f.defaultValue;
    else empty[f.key] = '';
  }
  return empty;
}, [fields, defaultLineNo]);
```

**Propuesta:**
- Agregar prop `parentId` a `InlineAddRow` (DetailView lo pasa desde `hook.editing?.id ?? hook.selected?.id`).
- En el primer render del `InlineAddRow` activo, hacer `fetch(${apiBaseUrl}/${entity}/defaults?parentId=${parentId})` y guardar el payload en estado local (`backendDefaults`).
- `buildEmpty` consume `backendDefaults` primero, después `f.defaultValue` solo si no vino del backend, y elimina el hardcode de `lineNo` (el backend lo resuelve via `@SQL=`).
- Re-llamar `/defaults` después de cada save exitoso (para que el siguiente row tenga `lineNo` actualizado y cualquier secuencia incremental refresque).
- Aplicar las mismas normalizaciones que ya hace `useEntity.handleNew` (fechas dd-MM-yyyy → yyyy-MM-dd, `Y/N` → boolean, ints de listas → string). Idealmente extraer eso a `tools/app-shell/src/lib/normalizeBackendDefaults.js` para reusar.

### 2. `tools/app-shell/src/lib/normalizeBackendDefaults.js` (nuevo)

Mover la lógica de normalización de `useEntity.js:474-498` a una función pura. Tests unitarios cubren: dates, booleans Y/N, int → string para list refs, strip de comillas SQL.

### 3. `useEntity.js` (refactor)

Reemplazar las normalizaciones inline por la nueva función. Cero cambio de comportamiento.

### 4. Eliminar el cálculo JS de `lineNo`

Una vez que el backend devuelve el `lineNo` correcto vía `@SQL=`, borrar `defaultLineNo` (`:295-298`) y la lógica especial en `buildEmpty` y en el reset post-save (`:363-368`). Esto cierra el bug de divergencia con el SQL real.

### 5. Pipeline level — generator (`generate-frontend.js`)

**Decisión:** una sola fuente de verdad para defaults runtime → `/defaults`. El JSX no debe emitir `defaultValue`.

Razonamiento:
- El backend lee `AD_Column.DefaultValue` directo, así que cubre tanto estáticos (`'0'`, `'Y'`) como dinámicos (`@SQL=`, `@FieldName@`).
- Si NEO está caído, igual no se puede crear un registro (PATCH/POST fallarían). Mantener literales como "fallback" da una UX falsa con valores que pueden estar desfasados de Etendo.
- El flicker se mitiga con loading state, no con valores precargados.
- El metadata sigue en `contract.json` y `schema-raw.json` para review/validators/debugging.

**Cambios concretos:**
- Eliminar la emisión de `defaultValue` en campos del form principal (`:293-296`, `:324`).
- Eliminar la emisión de `defaultValue` en `addLineFields.entry` (`:585-594`).
- **Mantener** la emisión en:
  - Hidden defaults (`:606-618`) — son valores que el front fuerza al guardar, fuera del flujo `/defaults`. Caso por caso: si NEO ya los cubre vía `injectMandatoryDefaults`, eliminarlos también; si no, dejarlos pero filtrar dinámicos como hoy.
  - Process parameters (`:1264`, `:1333`) — los procesos no tienen `/defaults`, ahí sí hace falta el literal.
- `contract.json` y `schema-raw.json` siguen llevando `defaultValue` intacto (metadata).

## Edge cases a cubrir

1. **Crear cabecera y agregar línea sin guardar** → `parentId` es `null` o un id temporal. El backend rechaza con 404/400. **Solución:** forzar guardar la cabecera antes de habilitar `addRow` (ya es el comportamiento actual: `addRow` solo se muestra cuando hay `editing.id`).
2. **Fallo de red en `/defaults`** → caer al `f.defaultValue` estático del contract (comportamiento actual). Loggear warning, no bloquear UI.
3. **Backend devuelve `null` para un campo con default estático** → respetar el null del backend (es la decisión de NEO).
4. **Save concurrente de dos líneas** → cada save dispara su propio `/defaults` para el próximo row. Sin race porque cada InlineAddRow es un componente local.
5. **Ventanas con `addLineFields.hidden` (e.g. `priceList: fromParent`)** → esos también deben venir del backend; verificar que `injectMandatoryDefaults` los cubre. Si no, ajustar el contrato del endpoint para incluirlos.

## Tests

### Frontend (Vitest + RTL)
- `InlineAddRow` llama a `/defaults?parentId=X` en mount.
- `lineNo` se popula con el valor del backend, no con `Math.max+10`.
- `@SQL=` literales nunca aparecen en inputs después del fetch.
- Fallback a `defaultValue` estático cuando `/defaults` falla.
- Normalizer: dates, booleans, ints-of-list-refs.

### Backend (JUnit, ya existente)
- Confirmar `NeoDefaultsServiceTest` cubre `resolveDefaults` con `parentId` para una entity hija. Si no, agregar test con `M_MovementLine` y `M_Movement_ID` como link-to-parent.

### E2E (Playwright)
- Goods Movements: crear cabecera, abrir add-line, verificar que `lineNo` arranca en 10 (o el siguiente correcto), verificar que `M_Warehouse_ID` viene heredado del header.

## Validación post-implementación

1. `make regen` para todos los windows con líneas.
2. `cli/src/validate-pipeline.js` clean.
3. Probar en local con Goods Movements, Sales Order, Purchase Invoice (los 3 tienen líneas con defaults heredados).
4. Confirmar en Network tab que `/defaults?parentId=X` se llama una vez por click de "+ Agregar línea" y una vez post-save.

## Riesgos

- **Latencia adicional:** un fetch extra por línea agregada. Mitigación: cache por `parentId` en el componente, invalidar solo post-save.
- **Backend dispara queries SQL pesadas en `@SQL=` por cada add-line:** medir; si se vuelve problema, agregar cache server-side por `(entity, parentId, sessionVars)`.
- **Cambio sutil de UX:** algunos usuarios podían depender de la string `@SQL=...` literal apareciendo (improbable, pero confirmar con QA).

## Pasos de implementación (DEV)

1. Branch ya existente `feature/ETP-3859`.
2. Extraer normalizer (commit 1).
3. Agregar fetch en `InlineAddRow` con fallback (commit 2).
4. Borrar hardcode `lineNo` (commit 3).
5. Tests unit + actualizar/regenerar contract si hace falta (commit 4).
6. PR con checklist Window Change Integrity (`CLAUDE.md`).

## Out of scope

- Cambiar el formato de `defaultValue` en `contract.json` / `schema-raw.json` (sigue intacto como metadata).
- Migrar `addLineFields.hidden` a backend-only (queda para una iteración posterior si se confirma que `injectMandatoryDefaults` los cubre).
- Cache global de `/defaults` cross-componente.
- Eliminar `defaultValue` de los process parameters (no aplica — los procesos no tienen `/defaults`).
