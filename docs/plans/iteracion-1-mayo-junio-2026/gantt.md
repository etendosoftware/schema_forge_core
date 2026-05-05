# Gantt + Árbol de requerimientos — Iteración 1 (Mayo–Junio 2026)

Vista temporal y de dependencias derivada de los TASKS por tema.
Fuente original: `gantt-etendo-mayo-junio-2026.xlsx`.
Este documento es la **vista canónica**; cada barra/nodo enlaza con su `.md` detallado.

## Calendario de referencia

| Semana | Rango | Notas |
|--------|-------|-------|
| S1 | 01/05 → 05/05 | Día festivo 01/05 (España) |
| S2 | 06/05 → 11/05 | |
| S3 | 12/05 → 18/05 | |
| S4 | 19/05 → 25/05 | |
| S5 | 26/05 → 01/06 | |
| S6 | 02/06 → 08/06 | |
| post-S6 | 09/06 → 30/06 | Cierre Iteración 1 |

## Gantt — Timeline

```mermaid
gantt
    title Iteración 1 — Etendo Schema Forge — Mayo-Junio 2026
    dateFormat YYYY-MM-DD
    axisFormat %d/%m

    section Finanzas (P1)
    Accounting Dashboard            :f1, 2026-05-01, 5d
    PSD2 Bank Connection            :f2, after f1, 7d
    AI Reconciliation Engine        :f3, after f2, 12d
    AI Recon Suggestions            :f4, after f3, 5d
    Cash Flow + Payment In          :f5, 2026-05-26, 7d
    Payment Out + Standard Cost     :f6, 2026-06-02, 5d
    Year-End Close                  :f7, 2026-06-09, 10d
    Financial Reports               :f8, 2026-06-09, 10d
    Manual Journal Entries          :f9, 2026-06-09, 10d

    section Localización (P1)
    Spain Chart of Accounts         :l1, 2026-05-01, 5d
    Spain SII                       :l2, 2026-05-01, 14d
    Verifactu + TBAI                :l3, after l2, 9d
    Localization Others             :l4, after l3, 9d

    section Ventas (P2)
    Sales Quotations                :v1, 2026-05-01, 7d
    Sales Shipments                 :v2, after v1, 7d
    Sales Payment Collection        :v3, after v2, 7d
    Customer Returns + Credit Notes :v4, after v3, 7d

    section Compras (P2)
    Goods Receipt                   :c1, 2026-05-01, 7d
    OCR Smart Scan                  :c2, after c1, 7d
    Email Invoice Ingestion         :c3, after c2, 7d
    Vendor Payments + Returns       :c4, after c3, 7d

    section Inventario (P3)
    Multi-Warehouse Stock           :i1, 2026-05-26, 7d
    Inventory Movements + Alerts    :i2, after i1, 5d

    section Configuración (P3)
    Onboarding + Roles + Email      :o1, 2026-05-26, 12d

    section Activos (P3)
    Asset Amortization              :a1, 2026-06-02, 5d

    section Productos (P3)
    Product Catalog + Variants      :p1, 2026-06-09, 14d

    section Copilot (P3)
    AI Specialized Agents           :ai1, 2026-06-09, 21d

    section Hito
    Iteración 1 completa            :milestone, m1, 2026-06-30, 0d
```

## Árbol de requerimientos (dependencias)

Las flechas sólidas son **bloqueos duros** (la tarea destino no puede empezar hasta que la origen termine). Las punteadas son **integraciones blandas** (consume servicio/infra de la otra pero puede empezar en paralelo).

```mermaid
graph LR
    %% Localización es la base de Finanzas
    L1[Spain Chart of Accounts]:::p1
    L2[Spain SII]:::p1
    L3[Verifactu + TBAI]:::p1
    L4[Localization Others]:::p1

    L1 --> L2
    L2 --> L3
    L1 --> L4
    L3 --> L4

    %% Finanzas
    F1[Accounting Dashboard]:::p1
    F2[PSD2 Bank Connection]:::p1
    F3[AI Recon Engine]:::p1
    F4[AI Recon Suggestions]:::p1
    F5[Cash Flow + Payment In]:::p1
    F6[Payment Out + Std Cost]:::p1
    F7[Year-End Close]:::p1
    F8[Financial Reports]:::p1
    F9[Manual Journal Entries]:::p1

    F1 --> F2
    F2 --> F3
    F3 --> F4
    F1 --> F5
    L1 --> F8
    L1 --> F9
    F9 --> F7
    L1 --> F7

    %% Ventas
    V1[Sales Quotations]:::p2
    V2[Sales Shipments]:::p2
    V3[Sales Payment Collection]:::p2
    V4[Customer Returns + CN]:::p2

    V1 --> V2
    V2 --> V3
    V2 --> V4
    F5 --> V3
    L3 --> V4

    %% Compras
    C1[Goods Receipt]:::p2
    C2[OCR Smart Scan]:::p2
    C3[Email Invoice Ingestion]:::p2
    C4[Vendor Payments + Returns]:::p2

    C1 --> C2
    C2 --> C3
    C1 --> C4
    F6 --> C4
    L3 --> C4

    %% Inventario
    I1[Multi-Warehouse Stock]:::p3
    I2[Inventory Mov + Alerts]:::p3

    V2 --> I1
    C1 --> I1
    I1 --> I2

    %% Configuración / Activos / Productos / Copilot
    O1[Onboarding + Email Config]:::p3
    A1[Asset Amortization]:::p3
    P1[Product Catalog]:::p3
    AI1[AI Specialized Agents]:::p3

    L1 --> O1
    L4 --> O1
    O1 -.->|email engine| V3
    O1 -.->|email engine| C3

    L1 --> A1
    F9 --> A1

    AI1 -.->|LLM infra| C2
    AI1 -.->|LLM infra| F4

    classDef p1 fill:#dbeafe,stroke:#1e40af,color:#1e3a8a
    classDef p2 fill:#dcfce7,stroke:#15803d,color:#14532d
    classDef p3 fill:#ffedd5,stroke:#c2410c,color:#7c2d12
```

## Camino crítico

El **camino crítico** (la cadena de tareas más larga que define la fecha de cierre de la iteración) es:

```
Spain Chart of Accounts (S1)
  → Spain SII (S1-S3)
  → Verifactu + TBAI (S3-S4)
  → Localization Others (S4-S5)
  → Onboarding + Roles + Email (S5-S6)
```

Y en paralelo, otra cadena casi tan larga del lado de Finanzas:

```
Accounting Dashboard (S1-S2)
  → PSD2 Connection (S2-S3)
  → AI Reconciliation Engine (S3-S5)
  → AI Reconciliation Suggestions (S5-S6)
```

## Dependencias entre temas (resumen)

| Tema | Bloquea a | Bloqueado por |
|------|-----------|---------------|
| Localización | Finanzas (reportes, cierre, asientos), Ventas (CN), Compras (CN), Configuración | — |
| Finanzas | Ventas (cobros), Compras (pagos), Activos | Localización |
| Ventas | Inventario (multi-warehouse) | Finanzas, Localización |
| Compras | Inventario (multi-warehouse), Copilot consume OCR | Finanzas, Localización |
| Inventario | — | Ventas, Compras |
| Activos | — | Localización, Finanzas |
| Configuración | Email engine de Ventas / Compras | Localización |
| Productos | — | (independiente; idealmente antes de tarifas en Ventas) |
| Copilot | OCR y AI Recon | (independiente) |

## Riesgos del cronograma

- **SII está en el camino crítico**. Cualquier slip en SII bloquea Verifactu+TBAI y la base de localización para otros países. Tener el certificado digital del cliente disponible en S1 es prerequisito no negociable.
- **AI Reconciliation Engine es la tarea más larga (12 días)**. Empezar el diseño en S1 mientras Dev A todavía trabaja en el dashboard reduce riesgo.
- **Onboarding (Configuración)** depende de Localization Others; si Dev B se atrasa con la abstracción de packs, Onboarding se rompe.
- **OCR Smart Scan** depende de la infra de Copilot, pero Copilot está planificada para post-S6. Solución: implementar el cliente LLM ad-hoc en OCR primero, refactorizar a `AgentRegistry` cuando Copilot aterrice.
- **Wizard layout** (necesario para Year-End Close y Onboarding) NO existe en el generador hoy. Es un prerequisito de Schema Forge Developer que debería arrancar en abril/inicio de mayo.

## Enlaces a las tareas

Cada barra del Gantt y cada nodo del árbol corresponden a un `.md` detallado:

- Finanzas: [accounting-dashboard](./finanzas/accounting-dashboard.md) · [psd2-bank-connection](./finanzas/psd2-bank-connection.md) · [ai-reconciliation-engine](./finanzas/ai-reconciliation-engine.md) · [ai-reconciliation-suggestions](./finanzas/ai-reconciliation-suggestions.md) · [cash-flow-payment-in](./finanzas/cash-flow-payment-in.md) · [payment-out-standard-cost](./finanzas/payment-out-standard-cost.md) · [year-end-close](./finanzas/year-end-close.md) · [financial-reports](./finanzas/financial-reports.md) · [manual-journal-entries](./finanzas/manual-journal-entries.md)
- Localización: [chart-of-accounts-spain](./localizacion/chart-of-accounts-spain.md) · [sii-spain](./localizacion/sii-spain.md) · [verifactu-tbai](./localizacion/verifactu-tbai.md) · [localization-others](./localizacion/localization-others.md)
- Ventas: [quotations](./ventas/quotations.md) · [sales-shipments](./ventas/sales-shipments.md) · [sales-payment-collection](./ventas/sales-payment-collection.md) · [customer-returns-credit-notes](./ventas/customer-returns-credit-notes.md)
- Compras: [goods-receipt-flow](./compras/goods-receipt-flow.md) · [ocr-smart-scan](./compras/ocr-smart-scan.md) · [email-invoice-ingestion](./compras/email-invoice-ingestion.md) · [vendor-payments-returns](./compras/vendor-payments-returns.md)
- Inventario: [multi-warehouse-stock](./inventario/multi-warehouse-stock.md) · [inventory-movements-alerts](./inventario/inventory-movements-alerts.md)
- Productos: [product-catalog-variants-pricing](./productos/product-catalog-variants-pricing.md)
- Activos: [asset-amortization](./activos/asset-amortization.md)
- Copilot: [ai-specialized-agents](./copilot/ai-specialized-agents.md)
- Configuración: [onboarding-roles-email](./configuracion/onboarding-roles-email.md)
