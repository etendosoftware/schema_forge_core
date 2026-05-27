# Feedback Log

Append-only log of errors, bugs, and improvement opportunities discovered during development.
Each entry should include: date, context, what happened, and suggested fix or status.

---

## 2026-03-13 — push-to-neo entity matching fails for curated names

**Context:** Pushing Sales Order to NEO Headless via `push-to-neo.js`.
**Problem:** Step 3 (field visibility update) failed for all 63 fields with "no entity" error. The contract uses curated entity names (`order`, `orderLine`) but `PopulateSpec` creates entities with AD tab names (`Header`, `Lines`). The matching logic only tried `tabId` (null in contract) and `entityName` (no match).
**Fix:** Added tableName-based fallback in `push-to-neo.js`. Three-level matching: tabId -> name -> tableName. Commit `1343db6`.
**Status:** Fixed.

## [2026-03-18] NEO Headless: List reference columns return raw code without $identifier

**Issue:** Columns with AD_Reference type "List" (e.g., DeliveryViaRule, DeliveryRule, PriorityRule, DocStatus) are returned by the NEO API as raw list codes (e.g., `"P"`, `"A"`, `"5"`, `"CO"`) without a corresponding `$_identifier` field. FK columns (TableDir/Table/Search) correctly return `fieldName$_identifier`.

**Impact:** In the UI, these fields display the internal code instead of the user-facing label ("P" instead of "Pickup Delivery", "CO" instead of "Complete", etc.).

**Expected:** NEO Headless should look up `AD_Ref_List.Name` for List-type columns and include it as `fieldName$_identifier` in the API response, consistent with FK field behavior.

**Workaround:** Mark `documentStatus` as `form: false` so it doesn't appear in the form (the status badge uses it from API data directly). Other list fields (deliveryMethod, deliveryTerms, priority) remain visible but show raw codes pending backend fix.

## 2026-05-12 — ETP-3955: Contextual FK Selectors — Implementation

**Context:** JuanCarlos agentic validation reports identified that required FK selectors return empty results without context (businessPartner, isSOTrx, date). This blocks agents from creating transactional documents.

**Changes implemented in schema_forge:**

1. **Selector inventory script** (`scripts/selector-inventory.js`): Automated scan of all affected specs reporting selector inputMode, dependsOn, validationRule cascade params, and decision coverage. Output: CSV to stdout.

2. **Normalized decisions.json** for `return-to-vendor` and `return-to-vendor-shipment`:
   - Added `partnerAddress` with `dependsOn: { field: "businessPartner", filterKey: "C_BPartner_ID" }` and `inputMode: "dependent"`.
   - Added `businessPartner` field decisions with `selectorFilter: "isVendor=Y"`.
   - Changed `return-to-vendor.lines.tax` from `inputMode: search` to `inputMode: selector`.

3. **Extended `generate-contract.js`** with `buildSelectorContext()` function:
   - Generates `context.required` and `context.optional` arrays for each selector in `apiPrediction`.
   - Sources context from: `dependsOn` declarations, `validationRule.cascadeParams`, and window category.
   - Handles: `C_BPartner_ID` from dependsOn, `IsSOTrx` from window category, `DateInvoiced` from parent field with `DD-MM-YYYY` format, `priceList` and `partnerAddress` as optional parent fields.

4. **Created `selectorContext.js`** shared helper (`tools/app-shell/src/lib/selectorContext.js`):
   - Centralizes selector context derivation previously scattered in `DetailView.jsx`.
   - Exports: `buildSelectorContext()`, `buildHeaderSelectorContext()`, `buildLineSelectorContext()`, `formatIsoToClassicDate()`, `deriveIsSOTrx()`, `deriveRoleFlags()`, `resolveDateFromRecord()`.
   - 34 unit tests covering sales/purchase categories, date formatting, dependsOn mapping, context metadata processing, and fallback behavior.

5. **Added contract-generation tests** (`cli/test/generate-contract.test.js`):
   - 5 new tests verifying selector context metadata in `generateApiPrediction` output.
   - Covers: partnerAddress dependsOn, priceList isSOTrx, tax IsSOTrx+DateInvoiced, purchase mode, and simple FK without context.

**Test results:** `npm test` passes with 12,554 passing tests and 9 skipped tests. `npm --workspace @schema-forge/app-shell run test:vitest -- src/lib/__tests__/selectorContext.vitest.js` passes with 35/35 selector-context tests.

**Remaining work (com.etendoerp.go repo):**
- Extend MCP `neo_selectors` to accept `recordContext` and map to selector params.
- Add missing-context diagnostics to selector responses.
- Verify `neo_defaults` returns `transactionDocument` and default `priceList`.
- Add per-entity `NeoHandler` fallbacks where generic behavior is insufficient.
- Java/runtime tests for selector/default behavior.
