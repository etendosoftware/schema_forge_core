# NEO duplicates snapshot — 2026-04-13

Captured from the local `etendo27` DB before the `dedupe-neo --apply` run. This
is the state the constraints in `cli/sql/neo-constraints.sql` are designed to
prevent from ever recurring. Full per-row winner/loser plan in
[`plans/2026-04-13-neo-dedupe-plan.md`](plans/2026-04-13-neo-dedupe-plan.md).

## Spec level (ETGO_SF_SPEC)

- Duplicates by `ad_window_id`: **0**
- Duplicates by `(ad_process_id, spec_type)`: **0**

No spec-level duplicates were observed. The constraints are a forward guard.

## Entity level (ETGO_SF_ENTITY)

- Duplicates by `(etgo_sf_spec_id, ad_tab_id)`: **1 group**
- Duplicates by `(etgo_sf_spec_id, name)`: **0** (already protected by
  `ETGO_SF_ENTITY_SPEC_NAME_UQ` in the XML)
- Process/report entity duplicates: **0**

The only entity-level dup:

| Spec | Tab ID | Winner name → fields | Loser name → fields |
|---|---|---|---|
| `sales-invoice` | `F6C2283A…5ED4` | `Payment Details` → 23 | `paymentDetails` → 0 |

The loser was an empty shadow left over from an earlier rename cycle. Winner
kept all data.

## Field level (ETGO_SF_FIELD)

- Duplicates by `(etgo_sf_entity_id, ad_column_id)`: **31 groups** (62 rows)
- Duplicates by `(etgo_sf_entity_id, java_qualifier)` for process fields: **0**

All duplicate groups were pairs (no 3+ cases). Distribution by entity:

| Entity | Dup pairs |
|---|---|
| `purchase-order/header` | 24 |
| `purchase-order/paymentPlan` | 2 |
| `sales-quotation/Tax` | 2 |
| `purchase-invoice/Line Tax` | 2 |
| `sales-order/header` | 1 |

In 5 pairs the loser had `isincluded='N'` while the winner had `='Y'` —
dedupe correctly preserved the included row. The remaining pairs were pure
clones. `push-to-neo` re-applies `visibility / isreadonly / defaultvalue`
from the contract on every run, so per-field config is not at risk.

## Orphan fields (unreachable from runtime)

Fields with `ad_column_id IS NULL` AND `java_qualifier IS NULL` — no column
to map to, no qualifier to match a process parameter. Total: **105**.

| Entity | Orphans pruned |
|---|---|
| `sales-order/header` | 40 |
| `purchase-invoice/lines` | 39 |
| `sales-order/lines` | 16 |
| `purchase-invoice/tax` | 6 |
| `purchase-invoice/basicDiscounts` | 4 |

Every affected entity retains its real fields after the prune (spot-checked
post-apply; each still has the full column-backed field set).

## Pending naming issue (related but not duplicate)

54 entities in the DB still have AD-label style names (spaces or leading
uppercase) instead of the curated camelCase. These are not duplicates, but
they are symptoms of the same two-phase rename bug in `push-to-neo.js`
(populate with `ad_tab.name`, then UPDATE to curated). When the contract
omits a tab, the rename never fires.

Highlights (non-exhaustive — 54 total):

| Spec | AD-label entity | Fields | Expected curated |
|---|---|---|---|
| `sales-invoice` | `Payment Details` | 23 | `paymentDetails` |
| `sales-order` | `Payment Details` | 33 | `paymentDetails` |
| `sales-order` | `Payment Plan` | 13 | `paymentPlan` |
| `purchase-invoice` | `Line Tax` | 8 | `lineTax` |
| `sales-invoice` | `Line Tax` | 8 | `lineTax` |
| `sales-quotation` | `Tax` | 6 | `tax` |
| `product` | `Purchasing` | 27 | `purchasing` |
| many | `Accounting` | 45 | `accounting` |
| many | `Translation` | 6–7 | `translation` |
| many | `Exchange rates` | 10 | `exchangeRates` |

Full list can be regenerated with:

```sql
SELECT s.name AS spec, e.name AS entity, COUNT(f.etgo_sf_field_id) AS fields
FROM etgo_sf_entity e
JOIN etgo_sf_spec s ON s.etgo_sf_spec_id = e.etgo_sf_spec_id
LEFT JOIN etgo_sf_field f ON f.etgo_sf_entity_id = e.etgo_sf_entity_id
WHERE e.name ~ '[ ]' OR e.name ~ '^[A-Z]'
GROUP BY s.name, e.name
ORDER BY s.name, e.name;
```

Definitive fix is Phase C: move the rename step into `populateWindowSpec` so
entities are inserted with the curated name in the first place, eliminating
the window where the AD label persists. The UNIQUE constraints only guarantee
no duplicates; they do not rename existing rows.

## Regeneration commands

```bash
# Detector (run any time to see current duplicate state)
node cli/src/detect-neo-duplicates.js
node cli/src/detect-neo-duplicates.js --json  # machine-readable

# Plan + apply the cleanup
node cli/src/dedupe-neo.js --plan --prune-null-columns
node cli/src/dedupe-neo.js --apply --confirm --prune-null-columns

# (Re-)create the 5 constraints
PGPASSWORD=tad psql -h localhost -p 5416 -U tad -d etendo27 \
  -f cli/sql/neo-constraints.sql
```
