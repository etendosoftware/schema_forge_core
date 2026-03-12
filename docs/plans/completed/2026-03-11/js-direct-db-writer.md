# Plan: Replace Webhooks with Direct JS Database Writer

**Status:** COMPLETED (Phases 1-3). Phases 4-5 deferred (Java webhooks kept as unused code).
**Date:** 2026-03-11
**Scope:** Schema Forge CLI (`push-to-neo.js`) + Etendo Go webhooks removal

## Problem

The current pipeline uses HTTP webhooks to write configuration to NEO Headless:

```
push-to-neo.js → HTTP POST → Tomcat → Java Webhooks (4) → OBDal → PostgreSQL
```

This requires:
- Etendo running (Tomcat + OBDal) just to write 3 simple tables
- Java compilation cycle for any change to the write logic
- HTTP auth, serialization, error handling across the network boundary
- ~443 lines of Java webhook code + PopulateSpecHelper (~200 lines)
- Separate Java test infrastructure (JUnit + OBBaseTest)

## Proposal

Replace webhooks with direct PostgreSQL writes from JS:

```
push-to-neo.js → pg driver → PostgreSQL
```

All infrastructure already exists: `pg` driver, `db.js` pool, `node:test` framework.

## Target Tables

| Table | Columns (relevant) |
|-------|-------------------|
| `ETGO_SF_SPEC` | `etgo_sf_spec_id`, `name`, `description`, `spec_type` (W/P), `ad_window_id`, `ad_process_id`, `ad_module_id`, audit cols |
| `ETGO_SF_ENTITY` | `etgo_sf_entity_id`, `etgo_sf_spec_id`, `ad_tab_id`, `name`, `isincluded`, `isget`, `isgetbyid`, `ispost`, `isput`, `ispatch`, `isdelete`, `java_qualifier`, `seqno`, audit cols |
| `ETGO_SF_FIELD` | `etgo_sf_field_id`, `etgo_sf_entity_id`, `ad_column_id`, `isincluded`, `isreadonly`, `defaultvalue`, `java_qualifier`, `seqno`, audit cols |

Audit columns: `ad_client_id`, `ad_org_id`, `isactive`, `created`, `createdby`, `updated`, `updatedby`

## Phases

### Phase 1: Core Writer Module (`neo-writer.js`)

**New file:** `cli/src/neo-writer.js`

Pure functions that receive a `pg` client (for transaction control) and return results.

#### 1.1 `generateId()`
- Returns Etendo-compatible UUID: `crypto.randomUUID().replace(/-/g, '').toUpperCase()`
- 32-char uppercase hex string

#### 1.2 `auditDefaults()`
- Returns object with default audit column values:
  - `ad_client_id`: configurable (default: `'0'` = System)
  - `ad_org_id`: configurable (default: `'0'` = *)
  - `isactive`: `'Y'`
  - `created` / `updated`: `new Date()`
  - `createdby` / `updatedby`: configurable (default: `'0'` = System)

#### 1.3 `upsertSpec(client, params)` → `{ specId, created: bool }`
- **Params:** `{ name, moduleId, windowId?, processId?, specType?, description?, specId? }`
- If `specId` provided → UPDATE, else → INSERT
- Check duplicate name (SELECT first, error if exists and not same ID)
- `specType` defaults to `'W'` (Window)
- For `specType='W'`: requires `windowId`; for `'P'`: requires `processId`

#### 1.4 `upsertEntity(client, params)` → `{ entityId, created: bool }`
- **Params:** `{ specId, tabId, moduleId, name?, entityId?, isIncluded?, isGet?, isGetbyid?, isPost?, isPut?, isPatch?, isDelete?, javaQualifier?, seqNo? }`
- Defaults: `isIncluded='Y'`, all HTTP methods `'N'`
- Name fallback: query `AD_Tab.name` if not provided

#### 1.5 `upsertField(client, params)` → `{ fieldId, created: bool }`
- **Params:** `{ entityId, columnId, moduleId, fieldId?, isIncluded?, isReadOnly?, defaultValue?, javaQualifier?, seqNo? }`
- Defaults: `isIncluded='Y'`, `isReadOnly='N'`

#### 1.6 `populateSpec(client, params)` → `{ entityCount, fieldCount }`
- **Params:** `{ specId, moduleId, excludeSystemColumns?, includeAllMethods? }`
- Defaults: `excludeSystemColumns=true`, `includeAllMethods=false`
- **Logic (Window specs):**
  1. DELETE existing fields for spec's entities, then DELETE entities
  2. SELECT active tabs for spec's window, ordered by `seqno`
  3. For each tab: INSERT entity, then SELECT active columns for tab's table ordered by `position`
  4. For each column (excluding system cols if flag set): INSERT field
  5. System columns: `AD_CLIENT_ID`, `AD_ORG_ID`, `ISACTIVE`, `CREATED`, `CREATEDBY`, `UPDATED`, `UPDATEDBY`
- **Logic (Process specs):**
  1. DELETE existing fields/entities
  2. INSERT single entity (POST-only, named after process)
  3. SELECT active process parameters
  4. For each parameter: INSERT field (no `ad_column_id`, name in `java_qualifier`, default value if present)
- SeqNo: entities start at 10, increment by 10. Fields: same pattern per entity.

### Phase 2: Refactor `push-to-neo.js`

Modify the existing `push-to-neo.js` to use `neo-writer.js` instead of HTTP calls.

#### Changes:
1. Replace `callWebhook()` with direct function calls to `neo-writer.js`
2. Replace HTTP config (`ETENDO_URL`, `ETENDO_USER`, `ETENDO_PASSWORD`) with DB config (already in `db.js`)
3. Wrap the 3-step flow in a transaction (`BEGIN` / `COMMIT` / `ROLLBACK` on error)
4. Keep all existing pure functions: `toSpecName()`, `mapVisibility()`, `extractFieldsFromContract()`
5. Keep `--dry-run` mode (plan generation without DB writes)
6. Keep the same return value shape: `{ specName, specId, entitiesPopulated, fieldsUpdated, ... }`

#### Transaction flow:
```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const { specId } = await upsertSpec(client, { ... });
  const { entityCount, fieldCount } = await populateSpec(client, { specId, ... });
  // Update field visibility from contract
  for (const field of contractFields) {
    await upsertField(client, { ... });
  }
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

### Phase 3: Tests

#### 3.1 Unit Tests (`neo-writer.test.js`) — Pure Logic
- `generateId()` — format: 32-char uppercase hex
- `auditDefaults()` — all required columns present
- No DB needed

#### 3.2 Integration Tests (`neo-writer.integration.test.js`) — Against Real DB
- Use `BEGIN` / `ROLLBACK` pattern — zero side effects
- Each test gets its own transaction, rolled back at end

```js
describe('upsertSpec (integration)', () => {
  let client;
  beforeEach(async () => {
    client = await pool.connect();
    await client.query('BEGIN');
  });
  afterEach(async () => {
    await client.query('ROLLBACK');
    client.release();
  });

  it('creates a window spec', async () => {
    // Use a known AD_Window_ID from the DB
    const result = await upsertSpec(client, {
      name: 'test-spec-' + Date.now(),
      moduleId: '0',  // System module
      windowId: '<known-window-id>',
      specType: 'W'
    });
    assert.ok(result.specId);
    assert.equal(result.created, true);

    // Verify in DB
    const { rows } = await client.query(
      'SELECT * FROM etgo_sf_spec WHERE etgo_sf_spec_id = $1',
      [result.specId]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, result.specName || 'test-spec-...');
  });

  it('rejects duplicate spec name', async () => {
    await upsertSpec(client, { name: 'dup-test', moduleId: '0', windowId: '...' });
    await assert.rejects(
      () => upsertSpec(client, { name: 'dup-test', moduleId: '0', windowId: '...' }),
      /already exists/
    );
  });
});
```

#### 3.3 Adapt existing `push-to-neo.test.js`
- Pure function tests (toSpecName, mapVisibility, etc.) stay unchanged
- Webhook-specific tests become DB integration tests
- Dry-run tests stay as-is

### Phase 4: Remove Java Webhooks

After JS writer is validated:

1. Delete webhook Java files:
   - `SFUpsertSpec.java`
   - `SFUpsertEntity.java`
   - `SFUpsertField.java`
   - `SFPopulateSpec.java`
2. Delete `PopulateSpecHelper.java`
3. Delete corresponding Java test files
4. Remove webhook registrations from Etendo AD (if registered via XML/data)
5. Update `pipeline.js` step F7 to use new DB writer path

### Phase 5: Documentation

1. Update `CLAUDE.md` — remove webhook references, add direct DB writer info
2. Update `docs/architecture-overview.md` — simplified data flow diagram
3. Move this plan to `docs/plans/completed/`

## Estimation

| Phase | Effort | Files Changed |
|-------|--------|---------------|
| Phase 1: neo-writer.js | Medium | 1 new file (~165 loc) |
| Phase 2: Refactor push-to-neo.js | Low | 1 file (remove HTTP, add DB calls) |
| Phase 3: Tests | Medium | 1 new + 1 adapted (~200 loc tests) |
| Phase 4: Remove Java | Low | Delete ~8 files |
| Phase 5: Docs | Low | 2-3 files |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Audit columns missed | Explicit `auditDefaults()` helper; integration tests verify all NOT NULL columns |
| PopulateSpec port misses edge case | Port tests from Java side; test with real AD metadata (Sales Order window) |
| Process spec handling differs | Dedicated test case for process specs with parameters |
| Future OBDal triggers on tables | These are Schema Forge's own tables — no triggers exist or are planned |
| DB schema changes | ETGO_SF_* tables are stable (defined by us); any change updates both writer and tests |

## Decision: What Happens to Webhook Infrastructure?

The 4 webhooks + PopulateSpecHelper are **only** used by Schema Forge tooling. No other system calls them. They can be safely deleted after the JS writer is validated.

However, the **webhook registration in AD** (if any) should be cleaned up to avoid dead references.

## Out of Scope

- Changes to NeoServlet or runtime behavior (reads from same tables, no change needed)
- Changes to contract generation or test runner
- Changes to frontend generation
- New features in the writer (only port existing functionality)
