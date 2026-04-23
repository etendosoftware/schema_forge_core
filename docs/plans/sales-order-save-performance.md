# Plan: eliminar cascada de peticiones y parpadeo al guardar

**Ventana analizada:** `sales-order` (aplica a todas las ventanas que usan `DetailView`)
**Flujo:** `/sales-order/new` → click **Guardar** → `/sales-order/:id`
**Observación del usuario:** tarda mucho, se ve parpadeo molesto, sospecha de peticiones redundantes.

---

## 1. Diagnóstico

### 1.1 Medición en vivo (DevTools MCP)

Captura real del flujo, dividida por etapas:

| Etapa | Request ids | Conteo | Observaciones |
|---|---|---|---|
| **A — carga inicial `/new`** | 192–211 | 19 reqs | PriceList ×3, Paymentmethod ×4, BPartner_Location ×3, Currency ×2, 1 `/defaults`, 5 `/callout` |
| **B — click Save** | 212 | 1 req | `POST /sales-order/header` (la única estrictamente necesaria) |
| **C — post-save, onda 1** (`refresh()` dentro de `handleSave` + cambio de `editing`) | 213–222 | 10 reqs | list×1, selectors ×4, selectors w/ limit ×2, RelatedDocuments ×3 |
| **D — post-save, onda 2** (navegación `/new`→`/:id` dispara efectos por `recordId`) | 223–240 | 18 reqs | list×1 (dup), selectors ×4 (dup), GET by id, GET lines, BPartnerLoc filtrado, selectors w/limit ×2 (dup), RelatedDocuments ×3 (dup), selectors ×4 (dup), evaluate-display |

**Totales tras guardar:** 1 POST útil + **28 GET/POST derivados**, de los cuales **≥18 son duplicados literales**.

### 1.2 Causas raíz identificadas

| Causa | Dónde | Efecto |
|---|---|---|
| **`handleSave()` llama `refresh()` siempre** | `hooks/useEntity.js:486` | GET `/header?_sortBy=creationDate desc` aunque estemos en detalle (la lista no se ve) |
| **`navigate(/:id, { replace: true })` dispara re-fetch total** | `DetailView.jsx:1100` | El `recordId` cambia de `"new"` a un UUID: `useEffect`s de `useEntity`, `useCatalogs`, `useDisplayLogic`, `RelatedDocuments` vuelven a correr |
| **Desechamos la respuesta del POST** | `useEntity.js:480-488` + `DetailView:410-421` | El POST ya devuelve el registro completo con todos los `$_identifier`, pero al navegar se tira ese estado y se vuelve a hacer `GET /:id` (req 228) |
| **`useCatalogs` invalida por contexto de OTRA entidad** | `DetailView.jsx:165-202` + `useCatalogs.js:20-30` | `selectorContextByEntity` combina header + lines; cambiar `parentRecordId` (lines) invalida la clave y re-fetchea TAMBIÉN los selectores del header (Currency, PriceList, Paymentmethod), que no dependen del id |
| **`selectorContextByEntity` se recalcula con identidad nueva aunque el contenido sea igual** | `DetailView.jsx:165` (`useMemo`) | Dispara re-fetch de `useCatalogs` dos veces en la transición porque `editing` cambia antes y después de `fetchById` |
| **`SearchSelect` + `useCatalogs` hacen el mismo request** | `useCatalogs.js:54-80` + SearchSelect dropdown | Cada dropdown dispara un GET sin `limit` (catálogo prefetch) Y otro con `limit=50&offset=0` (dropdown inicial) → 2× por selector |
| **`RelatedDocuments` se vuelve a montar/re-ejecuta `useEffect`** | `artifacts/sales-order/custom/RelatedDocuments.jsx:180-206` | Dependencias `[recordId, token, apiBaseUrl, refreshKey]`: en `/new` no debería correr, pero en la transición `new→:id` corre y luego `selected.id` cambia al llegar `fetchById` → segunda ola |
| **5 callouts de defaults en serie con `STAGGER_MS=400`** | `DetailView.jsx:377-404` | 2 s de espera antes de quedar estable; cada callout re-dispara `useDisplayLogic` debounceado |
| **`handleSaveAndProcess` hace GET extra** | `useEntity.js:604` | Tras procesar, no confía en el response del POST de acción y vuelve a pedir el header |

### 1.3 Por qué se "parpadea"

El `navigate()` provoca que `currentItem` sea `null` (la lista aún no cargó → `items=[]`). El fallback es `hook.fetchById()`, que pone `loading=true` y vacía `selected`. Durante ~400–800 ms:
- `catalogs` se vacía/recarga → los selects muestran `Loading…` o vacíos
- `RelatedDocuments` muestra `"Loading..."` (ya lo vimos en la captura: uid=2_43)
- El formulario desmonta/monta campos porque `displayLogic` cambia de `{}` a los valores evaluados
- La lista lateral (si estuviera visible) también parpadea

Es decir: **el parpadeo es consecuencia directa de tirar la respuesta del POST y re-hidratar la pantalla desde cero con N requests.**

---

## 2. Plan de mejora por etapas

> **Notación**: Cada ítem tiene *Impacto* (reqs ahorrados, UX) y *Costo* (esfuerzo, riesgo). El orden recomienda arrancar por Etapa 1.

### Etapa 1 — Quick wins (1 día, alto impacto)

#### 1.1. Eliminar `refresh()` de `handleSave`
- **Dónde:** `hooks/useEntity.js:486`
- **Cambio:** quitar `refresh()` al final de `handleSave`; si algún caller necesita refrescar la lista (p. ej. cerrar el modal y ver la nueva fila), que lo pida explícitamente.
- **Impacto:** −2 requests por save (una en onda C + una en onda D). UX invariante en detalle; en list view, pasar a refrescar on-mount de la lista.
- **Costo:** XS. Riesgo bajo si se audita dónde se espera el side-effect (grep de `handleSave`).

#### 1.2. Consumir el response del POST y saltar `fetchById` post-save
- **Dónde:** `DetailView.jsx:1098-1101` + `useEntity.js` (nuevo helper `primeSaved(saved)`)
- **Cambio:** después de `handleSave`, antes del `navigate`, invocar `hook.primeSaved(saved)` que setea `selected = editing = saved` y marca `directFetched = true` (ya se tiene). Pasar `location.state = { justSaved: saved }`; en `DetailView:410-421`, si `location.state.justSaved?.id === recordId`, saltar `fetchById`.
- **Impacto:** −1 request (GET `/:id`), y elimina el hueco de `loading` que causa parpadeo en el form.
- **Costo:** S. Requiere tocar `useEntity` + un guard en `DetailView`. Tests: verificar que recargar manualmente `/:id` sí hace fetch.

#### 1.3. Gatear `RelatedDocuments` al primer `saved.id` estable
- **Dónde:** `artifacts/sales-order/custom/RelatedDocuments.jsx:180-206`
- **Cambio:** eliminar la doble ejecución: `useEffect` actual depende de `[recordId]`. Como el `recordId` cambia una sola vez (de `"new"` a UUID), solo debería correr una vez — pero corre dos veces porque el componente se re-renderiza por props (`data` cambia). Agregar guard: `if (lastFetchedIdRef.current === recordId) return;` y resetearlo en `refreshKey`.
- **Impacto:** −3 requests por save (goodsShipment, listInvoices, Payment Plan duplicados). Elimina el "Loading..." que aparece y desaparece.
- **Costo:** XS. Riesgo mínimo.

#### 1.4. Generalizar 1.3 a todos los `RelatedDocuments` custom
- **Dónde:** `components/related-documents/*` + helpers `fetchByCriteria/fetchChild`
- **Cambio:** extraer el patrón "fetch once per id" a un hook `useRelatedDocuments(recordId, specs)` que ya traiga el guard. Todas las ventanas custom lo reusan (purchase-order, sales-invoice, payment-out ya copiaron el patrón).
- **Impacto:** aplica la mejora 1.3 a las demás ventanas sin duplicar código.
- **Costo:** S. Sin riesgo si se migra ventana por ventana.

#### 1.5. Eliminar flash de "Loading" full-window en la transición `/new → /:id`

- **Dónde:**
  - `tools/app-shell/src/hooks/useEntity.js:309` — el `useEffect` del list fetch
  - `tools/app-shell/src/components/contract-ui/DetailView.jsx:928` — el gate `if (hook.loading)`
- **Problema detectado al probar 1.1+1.2+1.3:** al hacer **Add Line** en `/new`, el save funciona y se salta `fetchById`, pero toda la `DetailView` se reemplaza por `"Loading..."` durante ~300–600 ms. Dos causas combinadas:
  1. `DetailView:144` pasa `skipListFetch: recordId === 'new'`. Al navegar a `/:id` el flag flipea `true → false` → el efecto de la línea 309 vuelve a correr retroactivamente → `refresh()` → `setLoading(true)` para pedir la lista (que ni siquiera se muestra en detalle).
  2. El gate de `DetailView:928` blackea **toda** la ventana con cualquier `hook.loading=true`, incluyendo un refresh de la lista lateral.
- **Cambio:**
  - Convertir el efecto de `useEntity.js:309` en mount-only (`didListFetchRef`): si en mount `skipListFetch=false`, corre una vez; cambios posteriores del flag no dispararán un fetch retroactivo. Los callers que necesiten refrescar la lista llaman `refresh()` explícitamente.
  - Afinar el gate de `DetailView.jsx:928`: solo mostrar `"Loading..."` si `!hasRecordForRoute` (= no `isNew` y `hook.selected.id !== recordId`). Un refresh de la lista u otro fetch de background ya no puede tapar un formulario en el que el usuario está trabajando.
- **Impacto:** elimina el flash residual de "cargando" en Add Line y en cualquier save que navegue `/new → /:id`. Junto con 1.1/1.2/1.3 el parpadeo percibido queda prácticamente en cero en el happy path.
- **Costo:** XS. Riesgo bajo — el efecto de línea 309 sigue resolviendo el caso de mount normal; secondary hooks ya pasaban `skipListFetch: true` y no se ven afectados.

**Suma Etapa 1:** ≈ −6 requests por save + sin flash full-window en transición, ≈ 1 día de trabajo.

---

### Etapa 2 — Cache y dedupe estructural (2–3 días, alto impacto)

#### 2.1. Separar `selectorContextByEntity` por entidad (clave estable)
- **Dónde:** `DetailView.jsx:165-202` + `useCatalogs.js`
- **Problema:** hoy `useCatalogs` recibe el objeto completo y genera una sola `selectorContextKey`; si cambia cualquier entrada, re-fetch a todos los selectores.
- **Cambio:** `useCatalogs` debe generar una sub-clave por selector (`entity+column+context[entity]`) y solo re-fetchar los selectores cuya sub-clave cambió. Memoizar por selector en un `ref` map.
- **Impacto:** −8 requests por save (los selectores del header no se re-fetchean al cambiar `parentRecordId`). Elimina el flash de dropdowns vacíos.
- **Costo:** M. Requiere rearquitectura del hook. Riesgo: dependientes (p. ej. `C_BPartner_Location_ID?C_BPartner_ID=...`) deben seguir invalidando correctamente — test unitario necesario.

#### 2.2. Unificar prefetch + dropdown inicial en `SearchSelect`
- **Dónde:** `useCatalogs.js:54-80` y el componente de combobox
- **Problema:** el combobox abre y pide `?limit=50&offset=0` aunque el prefetch ya trajo el catálogo completo.
- **Cambio:** si `useCatalogs` ya tiene resultados para ese selector, el `SearchSelect` consume de `catalogs` y solo hace fetch incremental al tipear (`?q=...` o `?offset=50`).
- **Impacto:** −2 requests por selector de combo (pre-save y post-save). En `/new` solo: −4.
- **Costo:** S. Riesgo bajo, ya hay fallback.

#### 2.3. Cachear selectores globales con TTL
- **Dónde:** nuevo `lib/selectorCache.js`
- **Cambio:** selectores "globales" (`C_Currency_ID`, `FIN_Paymentmethod_ID`, `M_PriceList_ID` cuando `isSOTrx/isCustomer` no varían) se cachean en memoria con TTL (p. ej. 5 min) o hasta logout. Al reabrir la ventana, se reusan.
- **Impacto:** −3 a −4 requests al abrir `/new` por segunda vez. Aplica a navegación general de la app.
- **Costo:** M. Riesgo bajo si se invalida en logout y en eventos conocidos (cambio de org, etc.).

#### 2.4. Evitar `refresh()` duplicado en `useEntity` post-navegación
- **Dónde:** `useEntity.js:309` (`useEffect(() => { if (!skipListFetch) refresh(); }, [refresh, skipListFetch])`)
- **Problema:** al pasar `skipListFetch` de `true` a `false` (por `recordId: 'new' → ':id'`), el efecto corre y pide la lista aunque el detalle no la use.
- **Cambio:** añadir opción `listFetchTrigger: 'mount' | 'always'` y, en DetailView, solo fetchar la lista cuando no sabemos el record o cuando el usuario abre el drawer de navegación.
- **Impacto:** −1 request por save (la lista `?_sortBy=creationDate desc` req 223).
- **Costo:** S.

**Suma Etapa 2:** ≈ −13 requests adicionales por save, dropdowns estables, ≈ 2–3 días.

---

### Etapa 3 — UX continua sin navegación (1 semana, máximo impacto)

#### 3.1. Guardar sin cambiar URL hasta que el usuario quiera
- **Dónde:** `DetailView.jsx:1098-1137`
- **Cambio conceptual:** en `/new`, al hacer save, NO navegar automáticamente. Montar el registro saved en el mismo componente y actualizar la URL con `window.history.replaceState` SIN disparar React Router. El `recordId` local pasa a `saved.id` pero los efectos siguen el camino "ya estoy en detalle, ya tengo data".
- **Impacto:** elimina el parpadeo por completo. La transición se percibe como "Se generó el Nº 1000025" sin re-montar nada.
- **Costo:** L. Requiere:
  - Refactor del `isNew` para no depender sólo del param `/new`
  - Asegurar que al recargar F5 la ruta `/:id` sigue resolviendo correctamente (ya lo hace)
  - Tests E2E: navegación hacia afuera (botón "Cancelar", breadcrumb) debe funcionar
- **Riesgo:** M. Hay que auditar todo el código que hace `navigate(location.pathname, { replace: true, state: {} })` (DetailView tiene 3 ocurrencias).

#### 3.2. Transición con `useTransition` + skeleton estable
- **Dónde:** todo `DetailView`
- **Cambio:** envolver el update de estado post-save en `React.startTransition` para que las re-evaluaciones de displayLogic/catalogs no bloqueen la UI. Skeletons que no "parpadean" (mantener el último render válido durante la transición).
- **Impacto:** aunque quede algún fetch inevitable, no se percibe como flash.
- **Costo:** M. Sin riesgo funcional.

#### 3.3. Endpoint `GET /:entity/:id?include=lines,relatedDocs`
- **Dónde:** NEO Headless (Etendo Go, `NeoServlet` + `NeoCrudHandler`)
- **Cambio:** extender el GET por id para que devuelva en una sola respuesta lo que hoy son 3–4 requests (header + lines + shipments + invoices + payment plan). Opt-in vía `?include=`.
- **Impacto:** −3 a −5 requests en detalle (no solo post-save: también en F5). Reduce round-trips en conexiones lentas.
- **Costo:** L. Toca backend Java, necesita review por Alex + tests de integración de Sentinel. Requiere versionar el contrato.

#### 3.4. Mover callouts de defaults al backend
- **Dónde:** `DetailView.jsx:377-404` + `NeoDefaultsService`
- **Cambio:** `/defaults` ya devuelve valores por defecto; que ejecute en el backend la cadena de callouts derivados (priceList → paymentTerms, etc.) y devuelva el estado final en una sola respuesta. El frontend ya no dispara 5 `/callout` en serie al abrir `/new`.
- **Impacto:** −5 requests en `/new` (las 205, 206, 209, 210, 211). Elimina los 2 segundos de `STAGGER_MS`.
- **Costo:** L. Refactor backend. Alto valor, aplica a TODAS las ventanas nuevas.

**Suma Etapa 3:** guardado "instantáneo" percibido, ≈ 1 semana.

---

## 3. Resumen comparativo

| Métrica | Hoy | Tras Etapa 1 | Tras Etapa 2 | Tras Etapa 3 |
|---|---|---|---|---|
| Reqs post-save (onda C+D) | 28 | ~22 | ~9 | ~3 |
| Tiempo percibido post-save | ~1.2–1.8 s | ~0.8 s | ~0.4 s | <0.2 s, sin parpadeo |
| Parpadeo visible | Sí | Parcial | Mínimo | No |
| Costo total (developer-days) | — | ~1 | +2–3 | +5 |

## 4. Entregables y orden propuesto

1. **PR 1** (Etapa 1): 1.1 + 1.2 + 1.3 + 1.5 → medir en DevTools que `RelatedDocuments` deja de hacer doble onda, que `GET /:id` post-save desaparece, y que ya no aparece el flash full-window de "Loading" en la transición `/new → /:id` (Add Line en particular).
2. **PR 2** (Etapa 1 cont.): 1.4 → generalizar `useRelatedDocuments`.
3. **PR 3** (Etapa 2): 2.1 + 2.4 → dedupe estructural de `useCatalogs` y `refresh` del detalle.
4. **PR 4** (Etapa 2 cont.): 2.2 + 2.3 → cache + unificación `SearchSelect`.
5. **Spike** (Etapa 3): POC de 3.1 en una ventana de baja criticidad (p. ej. `payment-out`) antes de generalizar.
6. **Etapa 3** full: 3.1 + 3.2 en `DetailView`, 3.3 + 3.4 coordinado con el runtime Go.

## 5. Riesgos y notas

- El patrón de `navigate` `/new → /:id` está replicado en **6 `onClick`** de `DetailView.jsx` (líneas 329, 342, 1077, 1089, 1100, 1113, 1130). La refactorización debe tocar todos de forma coherente o dejarlos funcionando en paralelo durante la transición.
- `useCatalogs` es core: cambios deben ir acompañados de tests unitarios — hoy solo hay tests de integración.
- El cambio 3.3 (backend `?include=`) ya tiene precedente en `action/listInvoices`; reutilizar el contrato.
- El 3.4 (backend callouts en `/defaults`) requiere coordinación con el equipo de runtime (Etendo Go) — no es puramente front.
