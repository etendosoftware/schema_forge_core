# NEO Constraints — ETGO_SF_* Tables

Status: **APPLIED on 2026-04-13** to the local `etendo27` DB and mirrored into the AD XML at `{etendo_root}/modules/com.etendoerp.go/src-db/database/model/tables/ETGO_SF_*.xml`. Dedupe ran successfully (1 entity + 136 fields removed, 0 duplicate groups remaining) before applying.

Note: `ETGO_SF_ENTITY_SPEC_NAME_UQ` `(etgo_sf_spec_id, name)` was **already declared** in the XML before this work — the investigation's proposed `etgo_sf_entity_name_uk` was redundant and was dropped. Only 5 new constraints were added.

## Why

The investigation in [`neo-entity-naming-investigation.md`](neo-entity-naming-investigation.md) found 32 duplicate groups in the live DB (1 entity, 31 fields) plus 105 dead `ad_column_id IS NULL` rows. The `dedupe-neo.js` cleanup is the one-shot fix; these UNIQUE constraints are the regression guard so the duplicates can never come back regardless of which code path inserts.

Without these, the stable identity matching in `push-to-neo.js` is "best effort". With them, the database itself rejects any duplicate insert and the bug surfaces immediately at write time instead of being discovered weeks later.

## Constraints applied

```sql
-- 1. Specs: one spec per AD window
ALTER TABLE etgo_sf_spec
  ADD CONSTRAINT etgo_sf_spec_window_uk
  UNIQUE (ad_window_id);

-- 2. Specs: one spec per (process, type) — same process can exist as P and as R
ALTER TABLE etgo_sf_spec
  ADD CONSTRAINT etgo_sf_spec_process_uk
  UNIQUE (ad_process_id, spec_type);

-- 3. Entities: one entity per (spec, AD tab)
ALTER TABLE etgo_sf_entity
  ADD CONSTRAINT etgo_sf_entity_tab_uk
  UNIQUE (etgo_sf_spec_id, ad_tab_id);

-- 4. Entities: (spec, name) — ALREADY PRESENT as ETGO_SF_ENTITY_SPEC_NAME_UQ in ETGO_SF_ENTITY.xml
--    The originally proposed etgo_sf_entity_name_uk is redundant and was NOT kept.

-- 5. Fields: one field per (entity, AD column) — covers 31/32 of today's duplicates
ALTER TABLE etgo_sf_field
  ADD CONSTRAINT etgo_sf_field_column_uk
  UNIQUE (etgo_sf_entity_id, ad_column_id);

-- 6. Fields: one field per (entity, java_qualifier) — for process parameters
ALTER TABLE etgo_sf_field
  ADD CONSTRAINT etgo_sf_field_qualifier_uk
  UNIQUE (etgo_sf_entity_id, java_qualifier);
```

## Why CONSTRAINT and not partial INDEX

Postgres treats each `NULL` as distinct in UNIQUE constraints, so multiple rows with `NULL` in the constrained column are allowed without needing `WHERE col IS NOT NULL`. This matches reality — process specs legitimately have `ad_window_id IS NULL`, process entities have `ad_tab_id IS NULL`, window fields commonly have `java_qualifier IS NULL`.

Constraints also produce more readable error messages (`violates unique constraint "etgo_sf_field_column_uk"`) and map cleanly to Etendo's `<unique>` element when migrated to the AD XML.

## How it was applied

Single transaction — a failure on any one rolls back the rest so the DB stays usable:

```sql
BEGIN;
ALTER TABLE etgo_sf_spec   ADD CONSTRAINT etgo_sf_spec_window_uk     UNIQUE (ad_window_id);
ALTER TABLE etgo_sf_spec   ADD CONSTRAINT etgo_sf_spec_process_uk    UNIQUE (ad_process_id, spec_type);
ALTER TABLE etgo_sf_entity ADD CONSTRAINT etgo_sf_entity_tab_uk      UNIQUE (etgo_sf_spec_id, ad_tab_id);
ALTER TABLE etgo_sf_field  ADD CONSTRAINT etgo_sf_field_column_uk    UNIQUE (etgo_sf_entity_id, ad_column_id);
ALTER TABLE etgo_sf_field  ADD CONSTRAINT etgo_sf_field_qualifier_uk UNIQUE (etgo_sf_entity_id, java_qualifier);
COMMIT;
```

If any `ALTER TABLE` fails with `could not create unique constraint … duplicate key value`, **that is the correct signal** — duplicates remain, re-run `dedupe-neo --plan` to see what's left. Do NOT add `IF NOT EXISTS` or skip the failure.

## AD XML mirror (already done)

Etendo's dbsm rebuilds the schema from `src-db/database/model/tables/*.xml` on every `./gradlew update.database`, and raw-SQL-only constraints are dropped. The `<unique>` elements were added to the module at:

```
{etendo_root}/modules/com.etendoerp.go/src-db/database/model/tables/ETGO_SF_SPEC.xml
{etendo_root}/modules/com.etendoerp.go/src-db/database/model/tables/ETGO_SF_ENTITY.xml
{etendo_root}/modules/com.etendoerp.go/src-db/database/model/tables/ETGO_SF_FIELD.xml
```

Added elements (uppercase to match the module's existing convention):

- `ETGO_SF_SPEC.xml`: `ETGO_SF_SPEC_WINDOW_UK (AD_WINDOW_ID)`, `ETGO_SF_SPEC_PROCESS_UK (AD_PROCESS_ID, SPEC_TYPE)`
- `ETGO_SF_ENTITY.xml`: `ETGO_SF_ENTITY_TAB_UK (ETGO_SF_SPEC_ID, AD_TAB_ID)` — alongside the pre-existing `ETGO_SF_ENTITY_SPEC_NAME_UQ`
- `ETGO_SF_FIELD.xml`: `ETGO_SF_FIELD_COLUMN_UK (ETGO_SF_ENTITY_ID, AD_COLUMN_ID)`, `ETGO_SF_FIELD_QUALIFIER_UK (ETGO_SF_ENTITY_ID, JAVA_QUALIFIER)`

Run `./gradlew export.database` in the Etendo root to validate the XML against the DB — it should report zero diff. Commit both repos together.

## Verification checklist

Done:
- [x] `dedupe-neo --apply --confirm --prune-null-columns` ran successfully (1 entity + 136 fields removed).
- [x] `detect-neo-duplicates` reports 0 groups.
- [x] 5 new constraints applied in a single transaction on local DB.
- [x] AD XML mirrors the DB state.

Pending for the user:
- [ ] Run `./gradlew export.database` in Etendo root — should report zero diff.
- [ ] Run `push-to-neo` on a representative window — should not error.
- [ ] Run `push-to-neo` on a process — should not error.
- [ ] CI build passes.

## Rollback

If a constraint causes unexpected breakage in production:

```sql
ALTER TABLE etgo_sf_field  DROP CONSTRAINT etgo_sf_field_qualifier_uk;
ALTER TABLE etgo_sf_field  DROP CONSTRAINT etgo_sf_field_column_uk;
ALTER TABLE etgo_sf_entity DROP CONSTRAINT etgo_sf_entity_tab_uk;
ALTER TABLE etgo_sf_spec   DROP CONSTRAINT etgo_sf_spec_process_uk;
ALTER TABLE etgo_sf_spec   DROP CONSTRAINT etgo_sf_spec_window_uk;
```

Then remove the `<unique>` elements from the AD XML and re-export.
