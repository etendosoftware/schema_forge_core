# Discount Feature — Estado actual y próximos pasos

**Fecha:** 2026-05-03  
**Branch activo:** `feature/ETP-3662` (rebased sobre `epic/ETP-3662`)  
**Estado:** Descuento por producto ✅ entregado — Descuento total UI ✅ visual implementado (sin persistencia) — lógica backend ⏸ pausada pendiente análisis funcional

---

## Parte 1 — Descuento por producto (IMPLEMENTADO, en PR)

### Qué hace

Inspirado en la UX de Holded, el panel de totales de los documentos (pedidos, facturas, presupuestos) incluye un desglose de descuentos totalmente client-side y en tiempo real:

**Columna de descuento**: siempre visible en la tabla de líneas y en la fila de añadir línea inline (`hiddenColumns={[]}` estático — no hay toggle).

**Filas de desglose automáticas** (aparecen cuando `discountAmt > 0`, es decir, al menos una línea tiene descuento no cero):
- "Subtotal sin descuento" (`Σ qty × listPrice`)
- "Descuento por producto" — fila **de solo lectura** que muestra el importe calculado (no es un checkbox)

Cuando el desglose está visible, el panel muestra:
- Subtotal sin descuento
- Descuento por producto (read-only)
- Subtotal (neto)
- IVA
- Total

**Botón `+ Añadir descuento total`**: aparece debajo del bloque cuando no hay descuento total activo y existen líneas (guardadas o en el add-row). Se oculta si el documento es `readOnly` o no hay líneas.
Al hacer clic, muestra la sección "Descuento total": checkbox (activado por defecto) + importe calculado + input numérico + etiqueta "%" estática. Desactivar el checkbox colapsa la sección y restaura el botón.

El cálculo de "Descuento total" es un **placeholder visual** — sin persistencia en backend todavía.

Todos los cálculos son **100% client-side y en tiempo real** — el panel actualiza sin esperar un save, incluyendo:
- La fila en proceso de escritura en el add-row inline (`pendingLine`)
- Las ediciones en curso en el sidebar (`editingLine`)

### Windows afectados

| Window | Panel |
|--------|-------|
| Sales Order | `DetailView.jsx` (directo) |
| Purchase Order | `DetailView.jsx` (directo) |
| Sales Quotation | `DetailView.jsx` (directo) |
| Sales Invoice | `InvoiceBottomPanel.jsx` → `DocumentTotalsPanel` |
| Purchase Invoice | `PurchaseInvoiceBottomPanel.jsx` → `DocumentTotalsPanel` |

### Archivos clave

| Archivo | Qué hace |
|---------|----------|
| `tools/app-shell/src/components/contract-ui/DocumentTotalsPanel.jsx` | Componente genérico — renderiza el panel con desglose automático y sección "Descuento total" interactiva; `totalDiscountOpen` es estado local |
| `tools/app-shell/src/lib/documentTotals.js` | Función pura `computeDocumentTotals()` — toda la lógica de cálculo extraída |
| `tools/app-shell/src/lib/__tests__/documentTotals.test.js` | 11 tests unitarios cubriendo edge cases |
| `tools/app-shell/src/components/contract-ui/DataTable.jsx` | `hiddenColumns` prop (siempre `[]`) + `onValuesChange` en InlineAddRow para `pendingLine` |
| `tools/app-shell/src/components/contract-ui/DetailView.jsx` | Estado `pendingLineValues`, `editingLine` — `discountPerProductEnabled` y `onDiscountPerProductChange` eliminados |
| `artifacts/purchase-order/decisions.json` | `grandTotalAmount` y `summedLineAmount` → `section: "summary"`, sin `form: false` |
| `tools/app-shell/src/locales/en_US.json` + `es_ES.json` | Claves: `addTotalDiscount` (renombrada desde `addDiscount`), `totalDiscount` (nueva), `subtotalWithoutDiscount`, `discountPerProduct` |

### Bugs resueltos durante el desarrollo

1. ~~**Click en "+ Añadir descuento" guardaba la línea inline**~~: resuelto y ya no aplica — el mecanismo de checkbox/toggle fue eliminado. El botón `+ Añadir descuento total` opera solo sobre estado local de `DocumentTotalsPanel` sin interferir con `InlineAddRow`. El atributo `data-inline-add-portal="true"` se mantiene en los divs raíz del panel como salvaguarda para la interacción con el input de porcentaje.

2. ~~**Panel se reseteaba al guardar la primera línea (race condition)**~~: resuelto y ya no aplica — `discountPerProductEnabled` y su lógica de `useRef` fueron eliminados. El desglose de "Descuento por producto" se deriva directamente de `discountAmt > 0`, por lo que no hay estado booleano que pueda desincronizarse.

3. **"Descuento por producto" se cortaba en facturas**: columna derecha de 300px no alcanzaba. Solución: `w-[340px]` en ambos bottom panels + `whitespace-nowrap` en el label + `max-w-xs` en el panel para evitar que se expanda en pedidos/presupuestos.

4. **Purchase order no mostraba el panel**: `getReadOnlyFields()` filtra `f.form && f.visibility === 'readOnly'`. El `decisions.json` tenía `form: false` en `grandTotalAmount` y `summedLineAmount`. Para `visibility: "readOnly"` el default es `form: true` — solo había que quitar `form: false` y dejar que `visibilityDefaults()` lo resuelva.

5. **Ediciones en sidebar no se reflejaban en el panel**: el panel solo leía `lines` (datos guardados). Solución: `DetailView` pasa `editingLine = { ...selectedLine, ...lineEdits }` al panel, que reemplaza la línea guardada en el cómputo.

---

## Parte 2 — Descuento total (UI VISUAL IMPLEMENTADA — backend pausado)

La interfaz visual del "Descuento total" está implementada en `DocumentTotalsPanel`: botón `+ Añadir descuento total`, checkbox, importe calculado, input de porcentaje y etiqueta "%". La sección es completamente interactiva en la UI pero no persiste datos en el backend todavía. Las preguntas funcionales del analista siguen abiertas antes de avanzar con la persistencia.

### UX objetivo (referencia Holded)

En el estado expandido del panel, debajo de "Descuento por producto":

```
Subtotal sin descuento          100,00€
  □ Descuento por producto         0,00€
  ☑ Descuento total               -12,00€
    [ 12 ] [ % ▼ ]
    ☑ Mostrar descuento en documento
─────────────────────────────────────────
Subtotal                          88,00€
IVA 21%                           18,48€
Total                            106,48€
```

El descuento total:
- Es un checkbox independiente del de por producto (pueden coexistir)
- Tiene un input numérico + selector de tipo (`%` o importe fijo)
- Se aplica sobre el `netSubtotal` (después de descuentos por producto): `100€ × 12% = -12€`
- El IVA se recalcula sobre la base reducida

### Análisis técnico realizado

#### Lo que NO funciona: modificar GrandTotal directamente

Se investigó la DB de Etendo Classic. Conclusiones:

- `GrandTotal` es recalculado por el trigger `c_invoiceline_trg2` en cada modificación de línea: `GrandTotal = TotalLines + TaxAmt`
- Durante el completado (`C_Invoice_Post`), hay un `UPDATE C_INVOICELINE SET UPDATED = now()` que vuelve a disparar ese trigger en todas las líneas → **cualquier valor manual en GrandTotal se sobreescribe**
- `ChargeAmt` de cabecera tampoco es seguro: el trigger incremental no lo incluye en la fórmula, se pierde en la siguiente edición de línea
- Modificar `GrandTotal` manualmente en borrador se permite por el trigger `c_invoice_trg`, pero no sobrevive el completado

#### El mecanismo propuesto: `basicDiscount` + `EM_Etgo_Discount`

La solapa `basicDiscounts` del documento (tabla `C_Invoice_Discount` / `C_Order_Discount`) tiene el campo `EM_Etgo_Discount` agregado por `com.etendoerp.go`. El analista funcional confirmó que crear registros allí y llenar ese campo con el porcentaje de descuento no genera problemas al completar el documento.

**Flujo propuesto:**

1. Usuario activa "Descuento total = 12%" en el panel
2. Etendo GO crea un registro en `basicDiscount` con `EM_Etgo_Discount = 12`
3. Al guardar cada línea, el descuento total también se aplica a `unitPrice` (oculto, calculado al persistir) y a `lineGrossAmount` → Classic queda consistente
4. Al cargar el documento: leer `EM_Etgo_Discount` de `basicDiscount`, usar ese valor en el panel para mostrar el desglose correcto

**La matemática del panel funciona limpiamente:**
```
grossSubtotal  = Σ(qty × listPrice)                         ← listPrice no se modifica
netSubtotal    = Σ(qty × listPrice × (1 − discount%))       ← discount por producto tampoco
totalDiscAmt   = netSubtotal × totalDiscountPct / 100
grandTotal     = Σ(lineGrossAmount)                         ← ya tiene total discount baked in
taxAmt         = grandTotal − (netSubtotal × (1 − totalDiscPct/100))   ← correcto
```

### Punto de pausa — preguntas abiertas para el analista funcional

**P1 — ¿Qué hace Classic al completar con un registro en `basicDiscount`?**

¿Los `lineGrossAmount` en la DB cambian después del completado (Classic aplicó el descuento a las líneas), o el ajuste se hace solo a nivel de asientos contables? Esto es crítico para saber si hay double-discounting.

**P2 — ¿Total discount y per-product discount pueden coexistir siempre?**

Holded los muestra como checkboxes independientes. ¿En el modelo de negocio de Etendo, tiene sentido aplicar ambos al mismo tiempo? ¿O son mutuamente excluyentes?

**P3 — Visibilidad en el documento PDF / confirmado**

Holded tiene "Mostrar descuento en documento". ¿Etendo Go tiene o planea tener generación de PDF propia? Si no, ¿importa qué se muestre?

**P4 — ¿Importe fijo además de porcentaje?**

Holded ofrece `%` y presumiblemente importe fijo. ¿El caso de uso real de los clientes requiere importe fijo, o con porcentaje alcanza?

### Riesgo técnico flagueado

Si el descuento total se hornea en `lineGrossAmount` al guardar (para consistencia con Classic), y además se guarda en `basicDiscount`, al recargar el documento el panel necesita **revertir visualmente** ese descuento del `lineGrossAmount` para no mostrar el descuento dos veces:

```
displayLineGrossAmount = lineGrossAmount / (1 − totalDiscountPct/100)
```

Esto funciona matemáticamente (redondeo manejable), pero crea un acoplamiento frágil: si alguien modifica una línea directamente en Classic, el `lineGrossAmount` cambia pero el registro en `basicDiscount` no — Etendo GO mostraría una reversa incorrecta sin ningún error visible.

**Alternativa más limpia (a validar con analista):** no hornear el descuento en `lineGrossAmount` al guardar. Solo guardar en `basicDiscount`. Que Classic aplique el descuento en el completado desde ese registro. Esto elimina el problema de reversa completamente. Requiere confirmar que Classic no hace double-discounting.

---

## Próximos pasos cuando se retome

1. Responder las 4 preguntas abiertas con el analista funcional
2. Confirmar comportamiento de Classic en el completado con basicDiscount ya cargado
3. Decidir si hornear o no el descuento en lineGrossAmount
4. Diseñar el NeoHandler que cree/actualice el registro en basicDiscount
5. ~~Implementar la UI: checkbox + input + tipo en `DocumentTotalsPanel`~~ ✅ DONE
6. Actualizar `computeDocumentTotals` para aceptar `totalDiscountPct` y `totalDiscountType` (actualmente el input no afecta al cálculo)
7. Conectar el input del panel con el backend (leer `EM_Etgo_Discount` de `basicDiscount` al cargar; persistir al cambiar)
8. Tests unitarios del nuevo cálculo con `totalDiscountPct`
