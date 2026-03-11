# Callout Endpoint: Analysis Report & Implementation Proposal

**Status:** Proposal
**Date:** 2026-03-11
**Supersedes:** `pending/callout-endpoints-proposal.md` (Option C → now moving to Option B)
**Scope:** NEO Headless callout execution endpoint + Java reuse strategy

---

## 1. Executive Summary

The existing Java callouts in Etendo **can be reused almost as-is** from a new NEO Headless endpoint. The key enabling factor is `CalloutInfo` — an abstraction layer that decouples callout business logic from the HTTP servlet. The main challenge is constructing a synthetic `RequestContext` from a REST JSON body, which is a one-time adapter problem.

**Verdict: ~80% direct reuse, ~20% adapter code.**

---

## 2. How Callouts Work Today

### Architecture

```
Classic Etendo UI (SmartClient form)
    │
    │  Field changes → POST to FormInitializationComponent
    │  (MODE=CHANGE, inpLastFieldChanged=fieldName)
    ▼
FormInitializationComponent.executeCallouts()
    │
    │  1. Looks up AD_Callout for the changed column
    │  2. Instantiates the callout class
    │  3. Creates CalloutServletConfig
    │  4. Calls calloutInstance.executeSimpleCallout(requestContext)
    ▼
SimpleCallout.executeSimpleCallout(RequestContext)
    │
    │  1. Creates VariablesSecureApp from request
    │  2. Wraps in CalloutInfo
    │  3. Calls abstract execute(CalloutInfo info)
    ▼
Concrete callout (e.g., SE_Order_BPartner)
    │
    │  - Reads fields:  info.getStringParameter("inpcBpartnerId")
    │  - Queries DB:    BpartnerMiscData.select(this, strBPartner)
    │  - Sets results:  info.addResult("inpmPricelistId", value)
    │  - Shows messages: info.addResult("MESSAGE", text)
    ▼
JSONObject result → FormInitializationComponent processes updates
```

### The `CalloutInfo` Abstraction

`CalloutInfo` is the **key** to reusability. Callout code never touches `HttpServletRequest` directly — it uses:

| Method | Purpose | HTTP dependency? |
|--------|---------|-----------------|
| `info.getStringParameter("inpfieldName")` | Read form field value | Reads from `VariablesSecureApp` → `request.getParameter()` |
| `info.getBigDecimalParameter("inpqty")` | Read numeric field | Same |
| `info.getLastFieldChanged()` | Which field triggered the callout | Reads `inpLastFieldChanged` param |
| `info.getTabId()` / `info.getWindowId()` | Tab/Window context | Reads `inpTabId` / `inpwindowId` params |
| `info.addResult("inpfieldName", value)` | Set output field value | Pure JSON, no HTTP |
| `info.addSelect() / addSelectResult() / endSelect()` | Update combo/dropdown | Pure JSON, no HTTP |
| `info.showMessage()` / `showWarning()` etc. | UI messages | Pure JSON, no HTTP |
| `info.vars.getSessionValue()` | Session context (user, role, org) | HTTP session |
| `Utility.getContext(this, info.vars, ...)` | AD context variables | Session + DB |

**Conclusion:** Inputs come from request parameters. Outputs are pure JSON. The only real coupling is input sourcing.

---

## 3. Case Study: Three Callouts Analyzed

### Case A: `SL_Order_Conversion` (Simple — LOW complexity)

**What it does:** Converts quantities between UOMs when the alternate UOM field changes.

**Inputs read:**
- `inpcUomId` (base UOM)
- `inpmProductUomId` (alternate UOM)
- `inpquantityorder` (quantity in alt UOM)
- `inpLastFieldChanged` (which field triggered)

**DB queries:**
- `SLInvoiceConversionData.initUOMId(this, ...)` — get initial UOM
- `SLInvoiceConversionData.multiplyRate(this, ...)` — conversion rate
- `SLInvoiceConversionData.stdPrecision(this, ...)` — decimal precision

**Outputs:**
- `inpqtyordered` → calculated base quantity
- `MESSAGE` → warning if no conversion rate found

**Reusability: ✅ TRIVIAL.** No session context, no combo updates. Just reads 3 params, does math with DB data, writes 1-2 results. Perfectly reusable with a synthetic request.

---

### Case B: `SE_Order_BPartner` (Complex — HIGH complexity)

**What it does:** When the business partner changes, auto-fills ~15 fields: price list, payment terms, delivery rule, warehouse, sales rep, invoice rule, etc.

**Inputs read:**
- `inpcBpartnerId` (the new BP)
- `inpadOrgId` (organization)
- `inpcDoctypetargetId` (document type)
- `inpcBpartnerId_LOC` (hidden: location from selector)
- `inpcBpartnerId_CON` (hidden: contact from selector)
- `inpissotrx` (via `Utility.getContext` → session)
- `inpwindowId` (window context)

**DB queries:**
- `BpartnerMiscData.select()` — BP master data (delivery rule, payment terms, price list, etc.)
- `SEOrderBPartnerData.userIdSalesRep()` — sales rep lookup
- `SLOrderDocTypeData.select()` — document subtype
- `SEOrderBPartnerData.defaultPriceList()` — fallback price list
- `ComboTableData` queries × 4 — for warehouse, sales rep, invoice rule, delivery rule combos
- `FIN_Utility.isBlockedBusinessPartner()` — BP blocked check
- `OBDal` criteria — warehouse list by org

**Outputs:**
- ~15 field values via `addResult()`
- 4 combo rebuilds via `addSelect() / addSelectResult() / endSelect()`
- Credit limit warning message

**Session dependencies:**
- `Utility.getContext(this, info.vars, "isSOTrx", windowId)` — sales/purchase flag
- `info.vars.getUser()` — current user as fallback sales rep
- `info.vars.getWarehouse()` — default warehouse
- `info.vars.getClient()` — client filter
- `Utility.getContext(this, info.vars, "#User_Client", windowId)` — accessible clients
- `Utility.getContext(this, info.vars, "#AccessibleOrgTree", ...)` — org access tree

**Reusability: ✅ REUSABLE, but needs session adapter.** The code itself is clean `CalloutInfo` API. The challenge is that `Utility.getContext()` reads from session, and combo queries need org/client access trees. These would need to be injected into the synthetic request context from the JWT token.

---

### Case C: `SE_Order_Organization` (Medium — uses CDI + sequences)

**What it does:** When org changes, resets warehouse and regenerates document number.

**Inputs read:**
- `inpadOrgId`, `inpissotrx`, `inpcBpartnerId`, `inpcBpartnerLocationId`
- `inpmWarehouseId` (current warehouse)
- `inpcOrderId` (existing order ID, to skip doc number on edits)

**DB queries:**
- `OBDal` criteria — org warehouses
- `ComboTableData` — warehouse combo
- `CashVATUtil.isCashVAT()` — cash VAT check
- `NextSequenceValue.getInstance()` — document sequence (CDI injection)
- `BpDocTypeUtils.applyOrderDocType()` — document type policies

**Special dependencies:**
- `RequestContext.get()` — used directly for sequence generation (line 122)
- `NextSequenceValue` — CDI-managed singleton
- `Field` entity lookup via `Utilities.getField(info)` — AD metadata

**Reusability: ✅ REUSABLE.** `RequestContext.get()` is thread-local and already set by servlet filters, so if the NEO endpoint sets up `OBContext` properly (which it already does for CRUD), this works. CDI beans resolve normally.

---

## 4. Dependency Analysis Summary

| Dependency | Used by | Solvable? | How |
|-----------|---------|-----------|-----|
| `info.getStringParameter()` | ALL callouts | ✅ Easy | Populate synthetic request params from JSON body |
| `info.addResult()` | ALL callouts | ✅ Already REST-ready | Returns JSONObject — just transform to REST response |
| `info.vars.getSessionValue()` | ~50% of callouts | ✅ Medium | Populate from JWT claims (user, role, org, client) |
| `Utility.getContext()` | ~60% of callouts | ✅ Medium | Set `OBContext` from JWT (NeoServlet already does this) |
| `info.vars.getWarehouse()` | Some callouts | ⚠️ Needs solution | Include in JWT or pass in request body |
| `ComboTableData` | Complex callouts | ✅ Works | Uses `ConnectionProvider` (callout inherits this) + session vars |
| `OBDal` / Hibernate | Many callouts | ✅ Works | OBContext already initialized by NeoServlet auth flow |
| `RequestContext.get()` | Few callouts | ✅ Works | Thread-local, set by servlet filter chain |
| CDI beans | Few callouts | ✅ Works | CDI context active in servlet container |
| `this` as ConnectionProvider | ALL (for SQL queries) | ✅ Works | `SimpleCallout` extends `DelegateConnectionProvider` |
| `executeCodeInBrowser()` | Rare | ❌ Ignore | Not applicable in REST context — skip/warn |

---

## 5. Implementation Proposal

### 5.1 New Endpoint

```
POST /sws/neo/{specName}/{entityName}/callout
```

**Request:**
```json
{
  "field": "businessPartner",
  "value": "ABC123-BP-ID",
  "formState": {
    "organization": "org-id",
    "documentType": "doc-type-id",
    "warehouse": "warehouse-id",
    "priceList": "pricelist-id",
    "...": "current form field values"
  }
}
```

**Response:**
```json
{
  "updates": {
    "priceList": { "value": "PL-001", "identifier": "General Price List" },
    "paymentTerms": { "value": "PT-001", "identifier": "30 days" },
    "deliveryRule": { "value": "A", "identifier": "Availability" }
  },
  "combos": {
    "warehouse": {
      "selected": "WH-001",
      "entries": [
        { "id": "WH-001", "identifier": "Main Warehouse" },
        { "id": "WH-002", "identifier": "Secondary" }
      ]
    }
  },
  "messages": [
    { "type": "WARNING", "text": "Credit limit exceeded by 1500.00" }
  ]
}
```

### 5.2 Adapter: `NeoCalloutAdapter` (the 20% that's new)

The adapter is the **only new Java code** needed in Etendo Go. Its job:

```
REST JSON body
    │
    ▼
NeoCalloutAdapter
    │  1. Build synthetic HttpServletRequest from formState
    │  2. Set request params: inpLastFieldChanged, inpTabId, inpwindowId
    │  3. Map formState keys → inpColumnName format
    │  4. Set session attributes from JWT (user, role, org, client, warehouse)
    │  5. Wrap in RequestContext
    ▼
callout.executeSimpleCallout(requestContext)
    │
    ▼
JSONObject result (native callout output)
    │
    ▼
NeoCalloutAdapter.transformResponse()
    │  1. Separate field updates from combo updates from messages
    │  2. Map inpColumnName → clean field names
    │  3. Filter out JSEXECUTE (not applicable)
    │  4. Build REST response
    ▼
REST JSON response
```

### 5.3 Key Design Decisions

**Field name mapping:** Callouts use `inpColumnName` format (e.g., `inpcBpartnerId`). Two options:

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| A. Frontend sends `inp*` names | No mapping needed | Zero adapter logic | Frontend leaks AD internals |
| **B. Map at adapter** | REST uses clean names, adapter translates | Clean API | Need column→inp mapping (from `AD_Column`) |

**Recommendation:** Option B. NeoServlet already has entity/field metadata from `ETGO_SF_FIELD`. Add a `columnName` ↔ `inpFieldName` mapping to the adapter. The formula is deterministic: `inp` + lowercase first char of column name + rest of column name (with `_ID` → `Id`).

**Session context:** NeoServlet already resolves JWT → OBContext (user, role, org, client). The adapter just needs to:
1. Create a `VariablesSecureApp` that reads from the JWT context instead of HTTP session
2. Set `#AD_User_ID`, `#AD_Role_ID`, `#AD_Client_ID`, `#AD_Org_ID` as session-equivalent values

**Warehouse:** The user's default warehouse is in session in classic Etendo. For NEO:
- Option 1: Include in JWT claims (minor JWT extension)
- Option 2: Accept as optional field in `formState` (simpler, no JWT change)
- **Recommendation:** Option 2 — the form already has the warehouse field, so just read it from `formState`.

### 5.4 What Does NOT Need to Change

| Component | Why it stays the same |
|-----------|----------------------|
| All `SimpleCallout` subclasses | They only use `CalloutInfo` API |
| `CalloutInfo` class | Already produces clean JSONObject output |
| `DelegateConnectionProvider` | DB connection pooling works in any servlet context |
| SQL data classes (`SLInvoiceConversionData`, etc.) | Pure SQL, no HTTP dependency |
| `OBDal` / `OBCriteria` calls | Work via `OBContext`, which NeoServlet already sets |
| CDI beans (`NextSequenceValue`, etc.) | CDI context active in any servlet request |

### 5.5 Implementation Phases

#### Phase 1: Core adapter + simple callouts
1. Add `/callout` route to `NeoServlet` path parser
2. Implement `NeoCalloutAdapter`:
   - Synthetic `HttpServletRequest` wrapper (populate params from JSON body)
   - `RequestContext` setup from JWT-derived `OBContext`
   - Response transformer (JSONObject → REST format)
3. Callout resolver: `AD_Column.AD_Callout_ID` → class name → instantiate
4. Field name mapper: `columnName` ↔ `inpColumnName`
5. Test with `SL_Order_Conversion` (simplest callout, no session deps)

#### Phase 2: Session-dependent callouts
1. Extend adapter to populate session-equivalent values from JWT
2. Support `Utility.getContext()` calls (populate AD context vars)
3. Test with `SE_Order_BPartner` (full session + combo complexity)

#### Phase 3: Schema Forge integration
1. Update `push-to-neo.js` to flag callout-enabled fields in `ETGO_SF_FIELD`
2. Update `generate-contract.js` to emit callout endpoint URL in contract
3. Update `generate-frontend.js` to emit `onChange` → POST callout (instead of TODO)

### 5.6 Effort Estimation

| Component | Complexity | Notes |
|-----------|-----------|-------|
| `NeoServlet` routing | Low | Add one more path pattern |
| Synthetic request wrapper | Medium | Core adapter — ~200 lines |
| Response transformer | Low | JSONObject → REST mapping — ~100 lines |
| Callout resolver (AD lookup) | Low | Single query to `AD_Column` → `AD_Callout` |
| Field name mapper | Low | Deterministic formula, ~50 lines |
| Session context from JWT | Medium | Populate `VariablesSecureApp` from `OBContext` |
| Schema Forge updates | Low | Contract + frontend changes |

**Total new Java code: ~400-500 lines** in Etendo Go.
**Callout reuse: 100%** — zero changes to existing callout classes.

---

## 6. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Some callouts read obscure session variables | Callout fails or returns wrong data | Phase 2 testing with full Sales Order callout set; log missing context vars |
| `ComboTableData` depends on `#AccessibleOrgTree` | Combo fields return wrong options | Populate org tree from JWT role (NeoServlet already resolves this) |
| Callout chains (one callout triggers another) | Classic UI handles sequentially; REST needs same | `FormInitializationComponent` logic for chain detection can be reused |
| `executeCodeInBrowser()` used by some callouts | Not applicable in REST | Ignore and log warning; frontier callouts rarely use this |
| Performance: complex callouts do many queries | Slow REST response | Callouts are already optimized for classic UI; same perf characteristics |

---

## 7. Conclusion

The existing Java callouts are **well-abstracted** behind `CalloutInfo`. The `execute(CalloutInfo info)` contract is clean:
- **Inputs:** named string parameters (form field values)
- **Outputs:** JSON field updates + combo updates + messages
- **Dependencies:** DB via `ConnectionProvider` + session via `VariablesSecureApp`

The only new code is an **adapter layer** that:
1. Translates REST JSON → synthetic request parameters
2. Sets up session context from JWT (NeoServlet already does most of this)
3. Translates callout JSONObject output → clean REST response

**No callout Java code needs to be modified.** The ~500 lines of adapter code unlock the entire existing callout library for REST usage.
