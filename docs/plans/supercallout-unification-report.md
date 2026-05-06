# Report: SuperCallout Unification vs Column-Level Callout Compatibility

**Date:** 2026-03-17
**Status:** Analysis / Decision Pending
**Ticket:** ETP-3546
**Context:** NEO Headless callout strategy for Etendo Go

## Executive Summary

Etendo's classic UI uses **167 callouts** bound to **308 columns** across **107 tables**. These callouts fire per-column on change events. For NEO Headless, we have the opportunity to replace this granular model with **unified entity-level "SuperCallouts"** — a single Java class per entity that handles all field-change logic in one place, generated with AI assistance.

**Recommendation:** Adopt the SuperCallout model for NEO Headless. The data strongly supports it — callouts are already naturally clustered by table, there are zero cross-callout column conflicts, and the column-level model adds complexity without benefit in a headless API context.

---

## 1. Current State: The Numbers

### Overview

| Metric | Value |
|--------|-------|
| Total callouts | 167 (all active) |
| Columns with a callout | 308 |
| Tables with callouts | 107 |
| Tables with multiple callouts | 41 |
| Tables with a single callout | 66 |
| Avg columns per callout | 1.9 |

### Origin

| Source | Callouts | Tables | Columns |
|--------|----------|--------|---------|
| Etendo Core | 164 | 106 | 305 |
| Etendo Modules | 3 | 1 | 3 |

Almost all callouts are core — module-level callouts are negligible.

### Complexity Distribution

| Bucket | Callouts | % |
|--------|----------|---|
| 1 column (trivial) | 100 | 61% |
| 2-3 columns | 48 | 29% |
| 4-6 columns | 11 | 7% |
| 7-10 columns (complex) | 5 | 3% |

**61% of callouts trigger on a single column.** Only 16 callouts (10%) are "complex" (>3 columns).

### Cross-Table Reuse

20 callouts are shared across multiple tables. Notable examples:

| Callout | Tables | Description |
|---------|--------|-------------|
| `OperativeQuantity_To_BaseQuantity` | 5 | UoM conversion (OrderLine, InvoiceLine, InOutLine, MovementLine, RequisitionLine) |
| `SL_AdvPayment_Document` | 5 | Payment document type logic |
| `SL_IsDefault` | 5 | Default flag toggle |
| `SE_PaymentMethod_FinAccount` | 3 | Payment method ↔ financial account |

### Key Tables (Highest Callout Density)

| Table | Callouts | Columns | Callout Names |
|-------|----------|---------|---------------|
| C_Order | 8 | 9 | BPartner, BPartnerLocation, Organization, Project, DocType, PriceList, Charge, UpdateLinesDate |
| C_Invoice | 8 | 9 | BPartner, BPartnerLocation, Organization, Project, DocType, PriceList, AccountingDate, TaxDate |
| C_OrderLine | 6 | 16 | Amt (9 cols), Product, Tax, Charge, Conversion (2), UoM (2) |
| C_InvoiceLine | 6 | 13 | Amt (6 cols), Product, Charge, Conversion (2), GlItem, UoM (2) |
| FIN_Payment | 5 | 10 | MultiCurrency (6), BPartner, FinAccount, PaymentMethod, AdvPayment |
| M_InOut | 5 | 5 | DocType, Organization, Warehouse, AccountingDate, BPartner |

### Critical Finding: Zero Column Conflicts

**No column in the system is assigned to more than one callout.** This means callouts on the same table are **completely independent** — they never compete for the same trigger column. This is the strongest argument for unification: merging them into a single class per entity has zero conflict risk.

---

## 2. The Problem with Column-Level Callouts in NEO Headless

### 2.1 Architecture Mismatch

Classic UI callouts work because:
- The UI fires an event **per field change** (user edits one field → one callout fires)
- The callout gets the full form context via `VariablesSecureApp`
- It returns field values to update in the form
- Cascades happen naturally as the user edits fields sequentially

In a headless API:
- The client sends a **complete JSON body** with multiple fields changed at once
- There is no "current field" concept — all fields arrive simultaneously
- Ordering and cascading must be explicitly managed
- The column-level trigger model forces artificial decomposition of what is conceptually one operation

### 2.2 Maintenance Overhead

For C_OrderLine alone, the classic model means:
- 6 separate Java classes (or callout methods)
- 16 column-to-callout mappings to maintain
- Implicit dependencies between them (e.g., `SL_Order_Product` sets fields that `SL_Order_Amt` needs)
- No way to see the full logic in one place

### 2.3 NEO Headless Already Broke the Model

NEO Headless processes field changes as a batch, not individually. The `/callout` endpoint currently executes a single callout per request, but the frontend has to orchestrate multi-callout cascades client-side. This is fragile and defeats the purpose of a headless API.

---

## 3. The SuperCallout Proposal

### Concept

One `NeoHandler` implementation per entity (table) that:
1. Receives the **full field change set** (all changed fields in one call)
2. Applies all derived field logic in a single pass (with dependency ordering)
3. Returns all computed values at once
4. Is registered via CDI `@Named` qualifier in `ETGO_SF_ENTITY.java_qualifier`

### Example: C_OrderLine SuperCallout

Instead of 6 separate callouts:
```
SL_Order_Product       → sets UoM, price, tax, description
SL_Order_Amt           → recalculates amounts from 9 trigger columns
SL_Order_Tax           → updates tax from location
SL_Order_Charge_Tax    → tax for charge items
SL_Order_Conversion    → UoM conversion
OperativeQuantity...   → alternative UoM quantity
```

One unified class:
```java
@Named("OrderLineSuperCallout")
public class OrderLineSuperCallout implements NeoHandler {
    @Override
    public NeoResponse handle(NeoContext ctx) {
        Set<String> changed = ctx.getChangedFields();
        JSONObject values = ctx.getFieldValues();
        JSONObject result = new JSONObject();

        // Phase 1: Product resolution (must run first)
        if (changed.contains("product")) {
            resolveProduct(values, result);  // sets UoM, price, description, tax
        }

        // Phase 2: Quantity & UoM conversion
        if (changed.contains("orderedQuantity") || changed.contains("operativeQuantity")
            || changed.contains("productUom") || result.has("product")) {
            resolveQuantityConversion(values, result);
        }

        // Phase 3: Amount calculation (depends on phases 1-2)
        if (needsAmountRecalc(changed, result)) {
            recalculateAmounts(values, result);  // net, gross, discount, tax
        }

        // Phase 4: Tax override
        if (changed.contains("partnerAddress") || changed.contains("charge")) {
            resolveTax(values, result);
        }

        return NeoResponse.ok(result);
    }
}
```

### Naming Convention

| Entity | SuperCallout Qualifier | Replaces |
|--------|----------------------|----------|
| C_Order → Header | `OrderHeaderSuperCallout` | 8 callouts |
| C_OrderLine → Lines | `OrderLineSuperCallout` | 6 callouts |
| C_Invoice → Header | `InvoiceHeaderSuperCallout` | 8 callouts |
| C_InvoiceLine → Lines | `InvoiceLineSuperCallout` | 6 callouts |
| FIN_Payment | `PaymentSuperCallout` | 5 callouts |

---

## 4. AI-Assisted Generation Strategy

### Why AI Generation Works Here

1. **Source code is readable** — classic callouts are Java classes with clear input/output patterns
2. **Logic is deterministic** — field lookups, arithmetic, FK resolution
3. **Test oracle exists** — the classic callouts define expected behavior, we can validate against them
4. **Pattern is repetitive** — most callouts follow: read context → query DB → set fields

### Generation Pipeline

```
Per entity:
1. Extract all callout source files for the table
2. Feed to AI: "Merge these N callouts into a single NeoHandler class.
   Resolve dependencies. Preserve all business logic. Use OBDal for queries."
3. AI generates SuperCallout with phased execution
4. Generate integration tests that validate against classic callout behavior
5. Human review + iterate
```

### Effort Estimate by Table Complexity

| Complexity | Tables | Callouts | AI Generation | Human Review |
|------------|--------|----------|---------------|-------------|
| Simple (1 callout) | 66 | 66 | Trivial — wrapper only | Minimal |
| Medium (2-3 callouts) | 28 | ~65 | Straightforward merge | Light |
| Complex (4+ callouts) | 13 | ~36 | Needs dependency analysis | Careful |
| **Total** | **107** | **167** | | |

The 13 complex tables (C_Order, C_Invoice, C_OrderLine, C_InvoiceLine, FIN_Payment, etc.) need the most attention but represent the highest ROI.

---

## 5. Cost/Benefit Analysis

### Option A: Maintain Column-Level Compatibility

| Aspect | Assessment |
|--------|-----------|
| NEO implementation | Complex — needs callout chain orchestration in NeoServlet |
| Client complexity | High — frontend must manage cascade ordering |
| Maintenance | Scattered across 167 files/methods |
| Extension model | Modules add column-level callouts → fragile interactions |
| Testing | Per-callout unit tests, hard to test interactions |
| Performance | Multiple DB roundtrips per field change |

### Option B: SuperCallout per Entity (Recommended)

| Aspect | Assessment |
|--------|-----------|
| NEO implementation | Simple — one NeoHandler per entity, already supported |
| Client complexity | Minimal — send changed fields, get all derived values back |
| Maintenance | One class per entity with all logic visible |
| Extension model | Modules extend SuperCallout via CDI decorators or override |
| Testing | Integration tests per entity, easy to test field interactions |
| Performance | Single DB transaction, optimized queries, one roundtrip |
| AI generation | Natural fit — merge N callouts into one class with clear phases |

### Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Behavioral drift from classic callouts | Side-by-side tests comparing classic vs SuperCallout outputs |
| Module callout compatibility | Only 3 module callouts exist today — handle case by case |
| Complex dependency chains | AI-assisted analysis + phased execution model |
| Completeness verification | Automated comparison: feed same inputs to both, diff outputs |

---

## 6. Recommended Approach

### Phase 1: Prove the Pattern (1 entity)
- Pick **C_OrderLine** (most complex: 6 callouts, 16 columns)
- AI-generate the SuperCallout
- Validate against classic callouts with real data
- Establish the generation pipeline and test harness

### Phase 2: Cover High-Priority Tables (5-6 entities)
- C_Order, C_Invoice, C_InvoiceLine, FIN_Payment, M_InOut
- These 6 tables + OrderLine cover the core business flows
- Parallel generation, human review

### Phase 3: Long Tail (remaining 100 tables)
- Most are simple (1 callout → trivial wrapper)
- Batch-generate, spot-check

### Extension Model for Modules

For third-party modules that need to add callout logic to existing entities:

```java
// Module extends the SuperCallout via CDI @Specializes or decorator
@Specializes
public class CustomOrderLineSuperCallout extends OrderLineSuperCallout {
    @Override
    public NeoResponse handle(NeoContext ctx) {
        NeoResponse base = super.handle(ctx);
        // Add module-specific logic
        if (ctx.getChangedFields().contains("customField")) {
            base.getPayload().put("derivedCustomField", computeValue());
        }
        return base;
    }
}
```

---

## 7. Conclusion

| Factor | Column-Level | SuperCallout |
|--------|-------------|-------------|
| Complexity | High (167 units) | Low (107 units, mostly simple) |
| NEO fit | Poor (needs orchestration layer) | Native (NeoHandler) |
| AI generability | N/A (already exists) | Excellent |
| Testability | Fragmented | Unified |
| Performance | Multiple roundtrips | Single pass |
| Module extensibility | Column-level overrides | CDI specialization |

**The data is clear:** callouts are already naturally grouped by table with zero conflicts. The SuperCallout model aligns perfectly with NEO Headless architecture, is AI-friendly to generate, and dramatically simplifies the codebase. The only reason to maintain column-level compatibility would be to support the classic UI — which NEO Headless is designed to replace.
