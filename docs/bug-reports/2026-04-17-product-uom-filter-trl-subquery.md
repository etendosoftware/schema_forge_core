# Bug Report: Product Window — UOM Filter Returns HTTP 500 Due to Broken TRL Subquery

**Date:** 2026-04-17
**Branch:** `feature/ETP-3788`
**Severity:** High (filter unusable on any translatable FK identifier)
**Status:** Fixed
**Affects:** All NEO Headless list views with FK columns whose target table has populated `_trl` rows

---

## Summary

Filtering the Products window by `uOM$_identifier` (the UOM column) through NEO Headless returns HTTP 500. The PostgreSQL log shows:

```
ERROR: more than one row returned by a subquery used as an expression
```

The same criterion against the native OpenBravo endpoint (`/org.openbravo.service.datasource/Product`) works correctly — so the HQL bug is only tripped by NEO's code path.

The sibling column `productCategory` appears to work, but only by accident: `M_Product_Category_Trl` is empty in this instance. If translations are ever loaded, the same crash will occur.

---

## Reproduction

### Failing (NEO Headless)

```
GET /sws/neo/product/product?criteria=[{"fieldName":"uOM$_identifier","operator":"iContains","value":"un"}]
→ 500 Internal Server Error
```

Tomcat stacktrace: `org.postgresql.util.PSQLException: ERROR: more than one row returned by a subquery used as an expression`.

### Working (native Etendo, same criterion)

```
POST /org.openbravo.service.datasource/Product
criteria={"fieldName":"uOM$_identifier","operator":"iContains","value":"un"}
→ 200 OK, 38 rows including {"uOM$_identifier":"Unidad"}
```

Full curl captured in the conversation transcript.

---

## Root Cause

`AdvancedQueryBuilder.createIdentifierLeftClause()` at line 1616–1621 builds an HQL correlated subquery against the `_trl` table:

```java
sb.append("COALESCE(to_char((select " + prop.getTranslationProperty().getName() + " from "
    + prop.getTranslationProperty().getEntity().getName() + " as t where t."
    + prop.getTrlParentProperty().getName() + " = "
    + prefix.substring(0, prefix.lastIndexOf('.')) + " and t.language.language='"
    + OBContext.getOBContext().getLanguage().getLanguage() + "')), to_char("
    + replaceValueWithJoins(prefix + prop.getName()) + "), '')");
```

The critical piece is `prefix.substring(0, prefix.lastIndexOf('.'))` — it uses whatever string was passed in as `prefix`, so the resulting HQL depends entirely on **who called this method and how they built the prefix**.

### When the prefix is a JOIN alias (`"join_1."`) — works

The HQL is `where t.uOM = join_1`. Because `join_1` is declared as an entity alias in the outer FROM (via `LEFT JOIN e.uOM AS join_1`), Hibernate correlates it cleanly and emits:

```sql
where uomtrl1_.C_UOM_ID = join1_.C_UOM_ID
```

### When the prefix is a property path (`"e.uOM."`) — breaks

The HQL becomes `where t.uOM = e.uOM`. The outer `e.uOM` is a property path, not an explicit alias. When Hibernate compiles the subquery, it fails to correlate to the outer scope and resolves `e.uOM` locally against the subquery alias `t`, emitting:

```sql
where uomtrl1_.C_UOM_ID = uomtrl1_.C_UOM_ID  -- self-correlation, always true
```

With an always-true correlation, the subquery returns every row in `C_UOM_Trl` for the active language (several). PostgreSQL's scalar-subquery rule then rejects it with `more than one row returned by a subquery used as an expression`.

### Why `productCategory` looks fine

Identical HQL is emitted for `M_Product_Category_Trl`, with the same self-correlation. But `M_Product_Category_Trl` is empty for both `es_ES` and `en_US` in this instance, so the subquery returns zero rows. `COALESCE` then falls through to the second argument (`e.productCategory.name`). The filter ends up comparing against the base column, which happens to be the only thing a user would want to match anyway — so it silently works. Load any translation and it breaks identically to UOM.

---

## Why Native Etendo Avoids the Bug

`AdvancedQueryBuilder.resolveLeftWherePart()` at line 984–1001 branches on how `_identifier` is processed:

```java
if (key.equals(JsonConstants.IDENTIFIER)) {
  prefix = getMainAlias() + DalUtil.DOT;
} else if (key.endsWith(JsonConstants.IDENTIFIER) && !creatingJoinsInWhereClauseIsPrevented) {
  final String propPath = key.substring(0, key.indexOf(JsonConstants.IDENTIFIER) - 1);
  boolean fromCriteria = true;
  final String join = resolveJoins(
      getPropertyForTableReference(JsonUtils.getPropertiesOnPath(getEntity(), propPath)),
      propPath, fromCriteria);
  prefix = join + DalUtil.DOT;
}
```

The `resolveJoins(..., fromCriteria=true)` call (line 1784+) registers a new `JoinDefinition` for the FK property, returning a stable alias like `"join_1"`. Subsequent `createIdentifierLeftClause` uses that alias as the prefix, which Hibernate correlates correctly.

**Both native (`DataSourceServlet` → `DefaultDataSourceService` → `DefaultJsonDataService.fetch`) and NEO (`NeoCrudHandler.handleDefault` → `DefaultJsonDataService.fetch`) pass `_use_alias=true`.** The divergence that causes one path to hit the buggy branch and the other to take the JOIN branch was not fully isolated. Candidates worth investigating next:

1. Whether NEO adds or removes a parameter that changes the value of `orNesting` or `creatingJoinsInWhereClauseIsPrevented` in `AdvancedQueryBuilder`.
2. Whether the tab's `hqlwhereclause` pushed into `WHERE_AND_FILTER_CLAUSE` at `NeoCrudHandler.java:269` interacts with the criterion parser in a way that bypasses `resolveJoins`.
3. Whether `NeoCrudHandler` is missing some parameter that `DataSourceServlet` sets (for example, `_selectedProperties`, `Constants_FIELDSEPARATOR`, `Constants_IDENTIFIER`, `_textMatchStyle`, `_constructor`).

---

## Fix Applied

One-line fix in `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoCrudHandler.java`, method `applyWhereClause`:

```java
// BEFORE — USE_ALIAS only set when there is a WHERE_AND_FILTER_CLAUSE
if (where.length() > 0) {
    params.put(JsonConstants.WHERE_AND_FILTER_CLAUSE, where.toString());
    params.put(JsonConstants.USE_ALIAS, "true");
}

// AFTER — always set USE_ALIAS, matching DefaultDataSourceService line 171
if (where.length() > 0) {
    params.put(JsonConstants.WHERE_AND_FILTER_CLAUSE, where.toString());
}
params.put(JsonConstants.USE_ALIAS, "true");
```

### Why this works

`resolveJoins()` at line 1785 short-circuits immediately when `getMainAlias()` is null:

```java
String alias = getMainAlias();
if (alias == null) {
    return originalPath;  // returns "uOM" without creating a JOIN
}
```

Without `USE_ALIAS`, `getMainAlias()` returns null → `resolveJoins` returns the raw property path `"uOM"` → prefix becomes `"uOM."` → TRL subquery uses `WHERE t.uOM = uOM` → Hibernate resolves `uOM` as self-referential inside the subquery → all TRL rows for the language are returned → PostgreSQL scalar-subquery constraint fires.

With `USE_ALIAS`, `getMainAlias()` returns `"e"` → `resolveJoins` creates a proper `JoinDefinition` with alias `join_1` → prefix becomes `"join_1."` → TRL subquery uses `WHERE t.uOM = join_1` → correct correlated subquery → exactly one row per product → no error.

`DefaultDataSourceService` always set `USE_ALIAS=true` (line 171) unconditionally. NEO only set it when there was a tab where clause. The fix aligns NEO with the native behavior.

---

## Files That Matter for Continuing the Investigation

### Backend — OpenBravo core (do NOT modify)

- `modules_core/org.openbravo.service.json/src/org/openbravo/service/json/AdvancedQueryBuilder.java`
  - **lines 1596–1674** — `createIdentifierLeftClause()`, where the TRL subquery HQL is built. Line 1619 is the culprit: `prefix.substring(0, prefix.lastIndexOf('.'))`.
  - **lines 705–713** — dispatch logic in `parseSimpleClause`: calls `resolveJoins` only when `orNesting > 0`, otherwise prefixes with `mainAlias`.
  - **lines 984–1001** — `resolveLeftWherePart` handling of `_identifier`: this is the path that creates the explicit JOIN alias when it fires.
  - **lines 1776–1835** — `resolveJoins()`: registers `JoinDefinition`s in `joinDefinitions` and returns the alias.
  - **lines 2086–2097** — `preventCreatingJoinsInWhereClause()`: only called by `HQLDataSourceService`, not relevant to NEO.

- `modules_core/org.openbravo.service.json/src/org/openbravo/service/json/DefaultJsonDataService.java`
  - **lines 595–606** and **lines 699–706** — react to `USE_ALIAS` by invoking `queryService.setUseAlias()`.

- `modules_core/org.openbravo.service.json/src/org/openbravo/service/json/DataEntityQueryService.java`
  - **lines 287–289** — `setUseAlias()` sets `mainAlias = JsonConstants.MAIN_ALIAS` ("e").

- `modules_core/org.openbravo.service.json/src/org/openbravo/service/json/JsonConstants.java`
  - **line 54** — `USE_ALIAS = "_use_alias"`.

- `modules_core/org.openbravo.service.datasource/src/org/openbravo/service/datasource/DefaultDataSourceService.java`
  - **line 171** — sets `USE_ALIAS=true` for the native datasource servlet path.

### Backend — NEO Headless module (custom code, safe to extend)

- `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoCrudHandler.java`
  - **`handleDefault`, lines 191–211** — entry point that eventually calls `DefaultJsonDataService.fetch(params)`.
  - **`buildDalParams`, lines 217–238** — copies all query params from the HTTP request into the DAL params.
  - **`applyWhereClause`, lines 243–272** — merges tab HQL + parent filter + `neoWhere` into `WHERE_AND_FILTER_CLAUSE`, and sets `USE_ALIAS=true`.

### Frontend — Schema Forge (where the fix lives)

- `tools/app-shell/src/lib/gridQuery.js`
  - **line 365** — `backendFilterKey` override already honored for the `identifier` filter mode. This is the lever for the workaround.
  - **lines 381–391** — `inferFilterMode` (already fixed in prior session to include `enum`).

- `tools/app-shell/src/components/contract-ui/DataTable.jsx`
  - Status / enum column dropdown rendering (fixed in prior session).

- `artifacts/product/generated/web/product/ProductTable.jsx`
  - Generated columns config for the Products window. Any change must be declared in `artifacts/product/decisions.json` and regenerated.

- `artifacts/sales-invoice/custom/InvoiceHeaderTable.jsx`
  - Reference for custom table overrides (tab filters, dropdowns). Useful as pattern guide but not directly related.

### Pipeline — to wire the override in

- `cli/src/generate-frontend.js` — emits the `columns` array in `*Table.jsx`. Needs to learn about `table.columnOverrides`.
- `cli/src/resolve-curated.js` — merges `decisions.json` + `schema-raw.json` → `contract.json` → generated files. Run with `--window product --write` after the generator change.

---

## Open Questions

1. **Why does native hit `orNesting > 0` or the `_identifier` branch while NEO does not?** We hypothesized this but did not prove it. A targeted test would be to enable `org.hibernate.SQL` debug logging on both endpoints with identical payloads and diff the emitted SQL. The debug logger was added and then reverted in the Tomcat container at `/usr/local/tomcat/webapps/etendo/WEB-INF/log4j2-web.xml` during this investigation.
2. **Is there an NEO-side parameter we could simply flip** (e.g., avoid `USE_ALIAS`, or force `_constructor=AdvancedCriteria`) to coerce AdvancedQueryBuilder into the working branch without touching generators?
3. **Scope of impact**: every translatable FK identifier on every window is vulnerable. Product is merely the first one noticed because `C_UOM_Trl` happens to have multi-row data.

---

## Not Yet Addressed (separate issue)

The UOM cell in the rendered grid shows `"Unit"` (English) even when the app is configured for Spanish, suggesting `OBContext.getLanguage()` is resolving to `en_US` at the moment of the NEO fetch. This is unrelated to the HQL bug but surfaced during the same investigation. Worth a separate ticket.
