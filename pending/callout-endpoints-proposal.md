# Proposal: Callout Endpoints for Generated Modules

**Status:** Pending
**Date:** 2026-03-06
**Context:** Sales Order window analysis — applies to all generated windows

## Problem

Etendo callouts are UI-triggered server-side logic that fires when a field changes in a form.
In the classic Etendo UI, the form POSTs to a `Callout` servlet, which executes Java logic and returns
updated field values. In a generated React SPA + REST API module, we need an equivalent mechanism.

## Findings: Sales Order Callouts

12 callouts found. **All are backend-appropriate** — every one requires DB access (OBDal queries).

| Callout | Trigger Field | What It Does | DB Operations |
|---|---|---|---|
| `SE_Order_Organization` | Organization | Default warehouse, doc sequence | Warehouse query by org, sequence generator |
| `SL_Order_DocType` | Document Type | Apply doc type policies | Doc type policy lookup |
| `SL_Order_UpdateLinesDate` | Order Date / Promised Date | Propagate dates to all lines | Batch update child lines |
| `SE_Order_BPartner` | Business Partner | Auto-fill price list, payment terms, delivery rule, sales rep | Multiple master data queries |
| `SE_Order_BPartnerLocation` | BP Address | Location-specific defaults (tax, delivery) | Location tax lookup |
| `SL_Order_PriceList` | Price List | Fetch currency, tax inclusion flag | Price list attributes query |
| `SL_Order_Product` | Product | Fetch prices, UOM, attributes | Price list + UOM + attribute queries |
| `SL_Order_Amt` | Qty / Price / Discount / Tax | Recalculate totals, validate stock & price limits | Stock, precision, tax, price adjustment queries |
| `SL_Order_Tax` | Location (in line) | Calculate applicable tax | Tax.get() — complex rule-based lookup |
| `SL_Order_Conversion` | Alternate UOM | Convert quantities between UOMs | UOM conversion table lookup |
| `SL_Charge` | Charge | Fetch charge amount | Charge master query |
| `OperativeQuantity_To_BaseQuantity` | Alt UOM Qty | Convert operative to base UOM | UOMUtil conversion factor query |

**Zero callouts are frontend-appropriate.** All require server-side data access.

## Proposed Options

### Option A: Per-field callout endpoints

One endpoint per trigger field. The frontend calls the specific endpoint when a field changes.

```
POST /sales-order/callout/businessPartner
Body: { "value": "BP-001", "formData": { "organization": "...", ... } }
Response: { "priceList": "PL-001", "paymentTerms": "30 days", "deliveryRule": "A", ... }
```

**Pros:**
- Clear contract per field — easy to test and document
- Each endpoint is small and focused
- Frontend knows exactly which endpoint to call

**Cons:**
- Many endpoints (12+ per window)
- Some callouts share logic (e.g., Amt and Tax overlap)

### Option B: Generic callout dispatcher

Single endpoint per window/tab. The frontend sends the changed field name and current form state.

```
POST /sales-order/callout
Body: { "field": "businessPartner", "value": "BP-001", "formData": { ... } }
Response: { "updates": { "priceList": "PL-001", "paymentTerms": "30 days" } }
```

**Pros:**
- Single endpoint — simpler routing
- Can batch multiple field changes in one call
- Mirrors how Etendo's classic callout servlet works

**Cons:**
- Dispatcher logic adds complexity
- Harder to test individual callouts in isolation
- Response shape varies by field

### Option C: Defer callouts (recommended for MVP)

Generate callout logic as TODO stubs. Focus on CRUD first. Each handler's POST/PUT already has
auto-setters for tab filters — callouts are the next layer of complexity.

```java
// TODO(callout): SE_Order_BPartner
// When businessPartner changes, auto-fill: priceList, paymentTerms, deliveryRule, salesRep
// Source: org.openbravo.erpCommon.ad_callouts.SE_Order_BPartner
```

**Pros:**
- Ships CRUD faster
- Callouts are complex (each is a mini-API with business logic)
- Avoids premature abstraction — we'll know more about the right pattern after CRUD works

**Cons:**
- Frontend forms won't have auto-fill behavior until implemented
- May need to revisit endpoint structure later

## Recommendation

**Option C for MVP**, then **Option B for v2**. Rationale:

1. Callouts are the most complex part of form behavior — each one is essentially a standalone
   service with multiple DB queries and business rules.
2. CRUD endpoints are the foundation — they need to work first.
3. When we do implement callouts, Option B (generic dispatcher) aligns best with how Etendo
   already works and allows batching multiple field changes.

## Implementation Notes (for when we build this)

- Callout classes are at: `src/org/openbravo/erpCommon/ad_callouts/*.java`
- Extraction already captures callout references: `extract-fields.js` stores `callout` property on fields
- The curation.json has callout info at both field level (`"callout": "org.openbravo..."`) and
  rule level (`"type": "callout"` in rules section)
- For Option B, the dispatcher pattern could reuse the existing `RequestHandler` interface with
  a `doCallout()` method extension
