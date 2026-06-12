# ETP-4177 — Client-tax → System-tax migration

Staging migration that reconciles client-level Spanish fiscal taxes with the
system-level dataset (`ad_client_id='0'`) introduced by
`com.etendoerp.go.localization.es.data`.

## Background

The Spanish fiscal taxes were **promoted in place** inside GOClient: the
`c_tax` rows kept their `c_tax_id`, only `ad_client_id` changed to `'0'`. So
GOClient's own documents already point at the now-system taxes — **nothing to
do for GOClient**.

Other clients (e.g. F&B International Group, QA Testing) carry their **own**
client-level tax copies with different IDs. Where a client tax has an exact
Spanish-system twin, its references are re-pointed to the system tax and the
client copy is deleted. Taxes with **no** system twin (US sales taxes, QA test
data, unused summary taxes) are **left client-level**.

## Matching key

| Entity | Natural key | Notes |
|--------|-------------|-------|
| `c_tax` | `(name, rate, sopotype)` | verified unique within the 653 system taxes |
| `c_taxcategory` | `(name)` | |

A client row that matches → `status='AUTO'` (migrated). No match →
`status='REVIEW'` (left untouched).

## Scope discovered (beyond invoices/orders)

Re-pointed for AUTO taxes: `c_invoiceline`, `c_invoicetax`, `c_invoicelinetax`,
`c_orderline`, `c_ordertax`, `c_orderlinetax`, `c_projectline`, `fact_acct`,
`gl_journalline`, `c_tax_acct`, the VAT-book chain (`c_taxregisterline`,
`c_taxregister_type_lines`, `c_tax_report`, `obirb_invbookline` ×2 cols,
`obirb_invbooktax_setup`, `obcvat_manualsettlementline`), config
(`ad_orginfo`, `c_bp_withholding`, `c_glitem`), and the `c_tax` self-refs
(`parent_tax_id`, `c_taxbase_id`). Categories drive `m_product`, `c_charge`,
`c_glitem`, `s_expensetype`, `s_resourcetype`, `m_product_servicelinked`.

**OBTL 303/349:** no-op. All `obtl_tax_parameter` rows live at `ad_client_id='0'`
pointing at system taxes; clients have none. Once a client's documents point at
system taxes, the system-level 303/349 config covers them. (Confirm functionally
that the report reads client-0 config for a non-system client.)

## Policy (decided in ETP-4177)

**Full remap** — re-point `c_tax_id` on ALL references including posted
documents, `fact_acct` and VAT books, so old client taxes become fully
unreferenced and are deleted. Re-pointing to the identical promoted tax (same
name/rate) changes no amounts.

Etendo's document-protection trigger (`c_invline_chk_restrictions_trg`, message
`@20501@`) blocks changing `C_TAX_ID` on posted lines. The script wraps the data
changes in `ad_disable_triggers()` / `ad_enable_triggers()` — Etendo's sanctioned
bulk-operation mechanism.

## Files

| File | Effect |
|------|--------|
| `01-assess.sql` | **Read-only.** Builds `etp4177_tax_map` / `etp4177_taxcat_map`, reports AUTO vs REVIEW and the blocker list. |
| `02-migrate.sql` | **Destructive.** Transactional remap + safe-delete of AUTO rows. Dry-run (ROLLBACK) by default; `-v do_commit=1` to apply. |

## Procedure

```bash
# 1. Assess (safe, read-only) — REVIEW report #3 (BLOCKERS) before continuing
psql -h <host> -p <port> -U <user> -d <staging_db> -f 01-assess.sql

# 2. Dry run (executes everything, then ROLLBACK; prints row counts)
psql -h <host> -p <port> -U <user> -d <staging_db> -f 02-migrate.sql

# 3. Apply for real (single transaction; all-or-nothing)
psql -h <host> -p <port> -U <user> -d <staging_db> -v do_commit=1 -f 02-migrate.sql
```

After applying, run `./gradlew export.database` is **not** needed (this is
client transactional data, not AD metadata).

## Verification evidence (dry run on `testendo`, 2026-06-12)

`testendo` holds the 653 system taxes plus real client taxes (F&B 302, QA 23).

- `01-assess.sql`: F&B 257 AUTO / 45 REVIEW; QA 0 AUTO / 23 REVIEW. Blockers =
  US sales taxes (`Sales Exempt` 2401 inv, `CA Sales Tax` 986 inv…) + QA test
  taxes — all correctly REVIEW.
- `02-migrate.sql` dry run: remapped 5 158 invoice lines, 4 574 order lines,
  594 `fact_acct`, 514 `c_tax_acct`, 80 parent self-refs; deleted 257 client
  taxes (+514 trl, +9 381 zone) and 7 categories. Verification phase reported
  **0 remaining references**; FK-safe deletes; rolled back cleanly.
- Caveat: VAT-book tables and `gl_journalline` had 0 rows in `testendo`; those
  statements are structurally identical to the validated ones but were not
  exercised with data.

## QA

Pending validation by QA: Matías Bernal / Emilio Polliotti — functional check
that 303/349 and VAT books resolve for a migrated non-system client.
