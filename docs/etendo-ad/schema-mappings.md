# Etendo AD Schema Mappings

Actual table relationships in Etendo 25/26, corrected from initial TDD assumptions.

## Callouts

- `AD_Column_Callout` junction table **does not exist**.
- `AD_Column` has a direct `AD_Callout_ID` FK to `AD_Callout`.
- `AD_Callout` has **no `Classname` column**. The Java class lives in `AD_Model_Object.Classname` (linked via `AD_Model_Object.AD_Callout_ID`).
- `AD_Column.Callout` (varchar) also exists but is often NULL. `AD_Model_Object` is the authoritative source.

```
AD_Column.AD_Callout_ID → AD_Callout
                           └→ AD_Model_Object.AD_Callout_ID → AD_Model_Object.Classname
```

## Display Logic and ReadOnly Logic

These live in **different tables**:

| Logic | Table | Columns |
|-------|-------|---------|
| Display Logic | `AD_Field` | `displaylogic`, `displaylogic_server`, `displaylogicgrid` |
| ReadOnly Logic | `AD_Column` | `readonlylogic` |

- `displaylogic` — client-side, most common
- `displaylogic_server` — server-side, rare but acts as additional filter when present
- `displaylogicgrid` — grid-specific, very rare

Both DisplayLogic and ReadOnlyLogic use `@variable@` syntax. Variables can be:
- **Window field columns** (e.g. `@Processed@`, `@DocStatus@`) — resolved from the current record
- **Session context variables** (e.g. `@ACCT_DIMENSION_DISPLAY@`, `@#ShowAcct@`, `@OrderType@`) — injected by Etendo at runtime, cannot be evaluated statically

## Tab-Level Clauses

`AD_Tab` has filtering/ordering clauses that define how the tab loads its data:

| Column | Variant | Purpose |
|--------|---------|---------|
| `WhereClause` | SQL | Row filter (e.g. `C_Order.IsSOTrx='Y'`) |
| `OrderByClause` | SQL | Default sort order |
| `FilterClause` | SQL | Additional filter |
| `HQLWhereClause` | HQL | Same as WhereClause in HQL syntax |
| `HQLOrderByClause` | HQL | Same as OrderByClause in HQL syntax |
| `HQLFilterClause` | HQL | Same as FilterClause in HQL syntax |

When both SQL and HQL variants exist, the HQL version takes precedence in the modern client.
