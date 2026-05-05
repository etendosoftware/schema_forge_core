#!/usr/bin/env node

/**
 * push-to-neo.js — Configure NEO Headless via direct DB writes from contract + schema artifacts.
 *
 * Reads contract.json and schema-curated.json for a given window, then writes
 * configuration directly to the ETGO_SF_* tables via PostgreSQL.
 *
 * Usage:
 *   node cli/src/push-to-neo.js <windowName>
 *   node cli/src/push-to-neo.js sales-order
 *   node cli/src/push-to-neo.js sales-order --dry-run
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDbPool, closePool } from './db.js';
import {
  upsertSpec as writerUpsertSpec,
  populateSpec as writerPopulateSpec,
  upsertField as writerUpsertField,
} from './neo-writer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Convert a window display name to kebab-case spec name.
 * "Sales Order" -> "sales-order", "Business Partner" -> "business-partner"
 */
export function toSpecName(windowName) {
  return windowName
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1 $2')   // split camelCase
    .replace(/[^a-zA-Z0-9]+/g, '-')          // non-alphanum -> dash
    .replace(/^-|-$/g, '')                    // trim leading/trailing dashes
    .toLowerCase();
}

/**
 * Map a field visibility value to NEO params.
 * Returns { isIncluded: "Y"|"N", isReadOnly: "Y"|"N" }.
 */
export function mapVisibility(visibility) {
  switch (visibility) {
    case 'editable':
      return { isIncluded: 'Y', isReadOnly: 'N' };
    case 'readOnly':
      return { isIncluded: 'Y', isReadOnly: 'Y' };
    case 'system':
      return { isIncluded: 'Y', isReadOnly: 'Y' };
    case 'discarded':
      return { isIncluded: 'N', isReadOnly: 'N' };
    default:
      return { isIncluded: 'N', isReadOnly: 'N' };
  }
}

/**
 * Build the full webhook URL from a base Etendo URL and webhook name.
 * @deprecated Use direct DB writes via neo-writer.js instead.
 */
export function buildWebhookUrl(etendoUrl, webhookName) {
  const base = etendoUrl.replace(/\/+$/, '');
  return `${base}/sws/webhooks/${webhookName}`;
}

/**
 * Extract all fields from all entities in a backend contract.
 * Returns an array of { entityName, fieldName, column, visibility }.
 */
export function extractFieldsFromContract(backendContract) {
  const fields = [];
  for (const [entityName, entityData] of Object.entries(backendContract.entities)) {
    for (const field of entityData.fields) {
      fields.push({
        entityName,
        tabId: entityData.tabId || null,
        tableName: entityData.tableName || null,
        fieldName: field.name,
        column: field.column,
        visibility: field.visibility,
      });
    }
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Configuration loading
// ---------------------------------------------------------------------------

/**
 * Parse a simple .properties file (key=value lines, # comments).
 */
function parseProperties(content) {
  const props = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    props[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return props;
}

/**
 * Load Etendo connection config from env vars or schema_forge.properties.
 * Env vars take precedence.
 * @deprecated HTTP config is no longer needed for live mode. DB config comes from db.js.
 *             Kept for backwards compatibility with dry-run display and existing tests.
 */
export async function loadConfig(projectRoot) {
  const env = process.env;
  let fileProps = {};

  try {
    const raw = await readFile(join(projectRoot, 'schema_forge.properties'), 'utf-8');
    fileProps = parseProperties(raw);
  } catch {
    // Properties file is optional if env vars are set
  }

  const url = env.ETENDO_URL || fileProps['etendo.url'];
  const user = env.ETENDO_USER || fileProps['etendo.user'];
  const password = env.ETENDO_PASSWORD || fileProps['etendo.password'];

  if (!url) throw new Error('Missing Etendo URL. Set ETENDO_URL env var or etendo.url in schema_forge.properties.');
  if (!user) throw new Error('Missing Etendo user. Set ETENDO_USER env var or etendo.user in schema_forge.properties.');
  if (!password) throw new Error('Missing Etendo password. Set ETENDO_PASSWORD env var or etendo.password in schema_forge.properties.');

  return { url, user, password };
}

// com.etendoerp.go — the module that owns the NEO Headless config.
const GO_MODULE_ID = '94E1B433CF55451EABB764750AC5902A';

/**
 * Mark com.etendoerp.go as "in development" so AD changes can be applied.
 * Idempotent — only updates if the flag is not already 'Y'.
 */
async function setGoModuleInDevelopment(client) {
  const res = await client.query(
    `UPDATE ad_module
     SET isindevelopment = 'Y', updated = now()
     WHERE ad_module_id = $1 AND COALESCE(isindevelopment, 'N') <> 'Y'`,
    [GO_MODULE_ID],
  );
  if (res.rowCount > 0) {
    console.log(`       Module com.etendoerp.go marked as 'In Development'.`);
  }
}

/**
 * Detect duplicate (entity_id, ad_column_id) rows in etgo_sf_field for a given spec.
 *
 * Duplicates make `populateSpec` and the field lookup in pushToNeo non-deterministic:
 * each run picks a different row to update, producing a Y/N flip on every push and
 * a noisy diff in `src-db/database/sourcedata/ETGO_SF_FIELD.xml`.
 *
 * Scoped to the spec being pushed so unrelated dirty data does not block the work.
 * Returns an array of `{ entityName, columnName, fieldIds[] }` — empty if clean.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} specName
 */
export async function checkDuplicateFields(client, specName) {
  const res = await client.query(
    `SELECT e.name AS entity_name,
            c.columnname AS column_name,
            ARRAY_AGG(f.etgo_sf_field_id ORDER BY f.created, f.etgo_sf_field_id) AS field_ids
       FROM etgo_sf_field f
       JOIN etgo_sf_entity e ON e.etgo_sf_entity_id = f.etgo_sf_entity_id
       JOIN etgo_sf_spec   s ON s.etgo_sf_spec_id   = e.etgo_sf_spec_id
       JOIN ad_column      c ON c.ad_column_id      = f.ad_column_id
      WHERE s.name = $1
      GROUP BY e.name, c.columnname
     HAVING COUNT(*) > 1
      ORDER BY e.name, c.columnname`,
    [specName],
  );
  return res.rows.map(r => ({
    entityName: r.entity_name,
    columnName: r.column_name,
    fieldIds: r.field_ids,
  }));
}

/**
 * Format duplicates as a human-readable error message for fail-fast reporting.
 *
 * fieldIds inside each duplicate are sorted (oldest first) by checkDuplicateFields,
 * so the first ID is the suggested "keep" and the rest are the suggested "delete".
 * push-to-neo will UPDATE the surviving row in the next run.
 */
export function formatDuplicateFieldsError(specName, duplicates) {
  const idsToDelete = [];
  const lines = [
    `Duplicate ETGO_SF_FIELD rows detected for spec '${specName}'.`,
    `Push aborted — keep ONE row per (entity, column) and delete the rest, then retry.`,
    ``,
  ];
  for (const d of duplicates) {
    lines.push(`  - entity='${d.entityName}' column='${d.columnName}'`);
    const [keepId, ...dropIds] = d.fieldIds;
    lines.push(`      keep:    ${keepId}`);
    for (const id of dropIds) {
      lines.push(`      delete:  ${id}`);
      idsToDelete.push(id);
    }
  }
  lines.push(``);
  lines.push(`Suggested SQL (review before running — adjust which row to keep if needed):`);
  lines.push(`  DELETE FROM etgo_sf_field WHERE etgo_sf_field_id IN (`);
  lines.push(idsToDelete.map(id => `    '${id}'`).join(',\n'));
  lines.push(`  );`);
  lines.push(``);
  lines.push(`The surviving row will be updated by the next \`make regen ONLY=${specName} PUSH_TO_NEO=1\`.`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main push function
// ---------------------------------------------------------------------------

/**
 * Push a window's contract configuration to NEO Headless via direct DB writes.
 *
 * @param {string} windowName - The window artifact folder name (e.g., "sales-order")
 * @param {object} [options] - Override options
 * @param {boolean} [options.dryRun] - If true, log planned actions without writing to DB
 * @param {string} [options.projectRoot] - Override project root path
 * @param {string} [options.moduleId='94E1B433CF55451EABB764750AC5902A'] - AD_Module_ID for new rows (defaults to com.etendoerp.go)
 * @param {object} [options.dbConfig] - Override DB pool config (passed to createDbPool)
 * @param {object} [options.audit] - Override audit defaults
 * @param {string} [options.etendoUrl] - Kept for backwards compat (dry-run plan display)
 * @param {string} [options.user] - Kept for backwards compat
 * @param {string} [options.password] - Kept for backwards compat
 * @returns {object} Result summary with spec, entities, and field updates
 */
export async function pushToNeo(windowName, options = {}) {
  const projectRoot = options.projectRoot || ROOT;
  const artifactsDir = join(projectRoot, 'artifacts', windowName);

  // Load artifacts
  let contractRaw, schemaRawJson;
  try {
    contractRaw = await readFile(join(artifactsDir, 'contract.json'), 'utf-8');
  } catch (err) {
    throw new Error(`Cannot read contract.json for window '${windowName}': ${err.message}`);
  }
  try {
    schemaRawJson = await readFile(join(artifactsDir, 'schema-raw.json'), 'utf-8');
  } catch (err) {
    throw new Error(`Cannot read schema-raw.json for window '${windowName}': ${err.message}`);
  }

  const contract = JSON.parse(contractRaw);
  const schemaRawData = JSON.parse(schemaRawJson);

  let windowId = schemaRawData.window.id;
  if (options.overrideWindow) {
    windowId = options.overrideWindow;
  } else if (contract.backendContract?.window?.id) {
    windowId = contract.backendContract.window.id;
  }
  const windowDisplayName = schemaRawData.window.name;
  // Use the artifact slug (windowName) as spec name so it matches the frontend route
  const specName = windowName;

  // Load decisions.json for per-field overrides (e.g. defaultExpr)
  let decisionsData = {};
  try {
    const decisionsRaw = await readFile(join(artifactsDir, 'decisions.json'), 'utf-8');
    decisionsData = JSON.parse(decisionsRaw);
  } catch { /* optional — not all windows have decisions.json */ }

  // Build map: "entityName.fieldName" -> defaultExpr (from decisions.json)
  const fieldDefaultExprs = {};
  for (const [entityKey, entityConf] of Object.entries(decisionsData.entities || {})) {
    const entityName = entityConf.name || entityKey;
    for (const [fieldName, fieldConf] of Object.entries(entityConf.fields || {})) {
      if (fieldConf.defaultExpr != null) {
        fieldDefaultExprs[`${entityName}.${fieldName}`] = fieldConf.defaultExpr;
      }
    }
  }

  // Extract all fields from backend contract
  const allFields = extractFieldsFromContract(contract.backendContract);

  // Dry run mode — plan generation without DB writes
  if (options.dryRun === true) {
    const plan = {
      spec: {
        action: 'upsertSpec',
        params: { windowId, name: specName, specType: 'W' },
      },
      populate: {
        action: 'populateSpec',
        params: { specId: '(from step 1)' },
      },
      fields: allFields.map(f => {
        const vis = mapVisibility(f.visibility);
        return {
          action: 'upsertField',
          entityName: f.entityName,
          params: {
            entityId: '(from populate)',
            column: f.column,
            isIncluded: vis.isIncluded,
            isReadOnly: vis.isReadOnly,
          },
        };
      }),
    };

    console.log(`[DRY RUN] Push to NEO for window: ${windowDisplayName} (${windowName})`);
    console.log(`  Spec name: ${specName}`);
    console.log(`  Window ID: ${windowId}`);
    console.log(`  Method: direct DB write`);
    console.log(`\n  Step 1: upsertSpec`);
    console.log(`    Params:`, plan.spec.params);
    console.log(`\n  Step 2: populateSpec`);
    console.log(`    Params: { specId: <returned from step 1> }`);
    console.log(`\n  Step 3: ${plan.fields.length} field updates via upsertField`);

    const included = plan.fields.filter(f => f.params.isIncluded === 'Y');
    const excluded = plan.fields.filter(f => f.params.isIncluded === 'N');
    const readOnly = plan.fields.filter(f => f.params.isReadOnly === 'Y');

    console.log(`    Included: ${included.length}, Excluded: ${excluded.length}, ReadOnly: ${readOnly.length}`);

    return {
      dryRun: true,
      specName,
      windowId,
      plan,
      summary: {
        totalFields: allFields.length,
        included: included.length,
        excluded: excluded.length,
        readOnly: readOnly.length,
      },
    };
  }

  // Live mode — write to DB via transaction
  const moduleId = options.moduleId || '94E1B433CF55451EABB764750AC5902A';
  const auditOpts = options.audit || {};
  const pool = createDbPool(options.dbConfig);
  const client = await pool.connect();

  try {
    // Pre-flight: fail fast if the spec already has duplicate (entity, column)
    // field rows. Running the push on duplicated data produces a non-deterministic
    // Y/N flip across runs and a noisy ETGO_SF_FIELD.xml diff — better to surface
    // it before any write so the developer can clean it up first.
    const duplicates = await checkDuplicateFields(client, specName);
    if (duplicates.length > 0) {
      throw new Error(formatDuplicateFieldsError(specName, duplicates));
    }

    await client.query('BEGIN');
    await setGoModuleInDevelopment(client);

    // Step 1: Upsert spec (look up existing spec first for idempotent updates)
    const existingSpec = await client.query(
      'SELECT etgo_sf_spec_id FROM etgo_sf_spec WHERE name = $1',
      [specName],
    );
    const existingSpecId = existingSpec.rows.length > 0
      ? existingSpec.rows[0].etgo_sf_spec_id
      : null;
    console.log(`[1/4] Upserting spec '${specName}' for window ${windowId}...`);
    const specResult = await writerUpsertSpec(client, {
      name: specName,
      moduleId,
      windowId,
      specType: 'W',
      specId: existingSpecId,
      audit: auditOpts,
    });
    const specId = specResult.specId;
    console.log(`       Spec ID: ${specId} (${specResult.created ? 'created' : 'updated'})`);

    // Step 2: Populate spec from AD metadata
    console.log(`[2/4] Populating spec from AD metadata...`);
    const popResult = await writerPopulateSpec(client, {
      specId,
      moduleId,
      includeAllMethods: true,
      audit: auditOpts,
    });

    // Build entity lookup maps from populate result
    // Primary: by tabId (exact match, safe for tabs sharing same table)
    // Fallback 1: by tab name (AD tab display name, e.g. "Header", "Lines")
    // Fallback 2: by tableName (e.g. "C_Order") — bridges curated names to AD tab names
    const entityMapByTabId = {};
    const entityMapByName = {};
    const entityMapByTableName = {};
    for (const ent of popResult.entities) {
      if (ent.tabId) entityMapByTabId[ent.tabId] = ent.entityId;
      entityMapByName[ent.name] = ent.entityId;
    }

    // Query DB to map populated entities to their table names (via ad_tab -> ad_table)
    if (popResult.entities.length > 0) {
      const tableNameQuery = await client.query(
        `SELECT e.etgo_sf_entity_id, t.tablename, tab.seqno
         FROM etgo_sf_entity e
         JOIN ad_tab tab ON tab.ad_tab_id = e.ad_tab_id
         JOIN ad_table t ON t.ad_table_id = tab.ad_table_id
         WHERE e.etgo_sf_spec_id = $1
         ORDER BY tab.seqno`,
        [specId],
      );
      for (const row of tableNameQuery.rows) {
        // If multiple entities share a table, keep the first one (lowest seqno)
        if (!entityMapByTableName[row.tablename]) {
          entityMapByTableName[row.tablename] = row.etgo_sf_entity_id;
        }
      }
    }

    // Build entity name -> tableName map from schema-raw (used for entity matching)
    const curatedToTable = {};
    if (schemaRawData.entities) {
      for (const ent of schemaRawData.entities) {
        if (ent.name && ent.tableName) {
          curatedToTable[ent.name] = ent.tableName;
        }
      }
    }

    console.log(`       Entities populated: ${popResult.entityCount}, Fields: ${popResult.fieldCount}`);

    // Rename entities to match contract names (e.g. "Header" → "order")
    // Uses tabName (AD tab display name) as the primary key — unique within a window
    // and handles tabs that share the same DB table correctly.
    // Read entity names from the backend contract which reflects the resolved curated schema.
    // java_qualifier is a CDI bean name (@Named) used by NeoServlet.lookupHandler
    // to route to a specific NeoHandler. It is NOT the Hibernate entity FQN —
    // schema-raw's entityFullClass would never match any @Named bean and would
    // silently override hand-wired handlers. Only propagate values explicitly
    // declared in decisions.json (which flow through backendContract).
    const schemaEntities = (schemaRawData.entities || []).map((ent) => ({
      name: ent.name,
      tabName: ent.tabName,
      tableName: ent.tableName,
    }));
    const desiredEntities = new Map(
      schemaEntities
        .filter((ent) => ent.tabName || ent.tableName)
        .map((ent) => [ent.tabName || ent.tableName, { ...ent, javaQualifier: undefined }]),
    );

    if (contract.backendContract?.entities) {
      for (const [name, data] of Object.entries(contract.backendContract.entities)) {
        const schemaFallback = schemaEntities.find((ent) =>
          ent.name === name
          || (data.tabName && ent.tabName === data.tabName)
          || (data.tableName && ent.tableName === data.tableName)
        );
        const tabOrTableKey = data.tabName || schemaFallback?.tabName || data.tableName || schemaFallback?.tableName;
        if (!tabOrTableKey) continue;
        desiredEntities.set(tabOrTableKey, {
          name,
          tabName: data.tabName || schemaFallback?.tabName || null,
          tableName: data.tableName || schemaFallback?.tableName || null,
          javaQualifier: data.javaQualifier ?? undefined,
        });
      }
    }

    if (desiredEntities.size > 0) {
      for (const ent of desiredEntities.values()) {
        const entityId = (ent.tabName && entityMapByName[ent.tabName])
          || (ent.tableName && entityMapByTableName[ent.tableName]);
        if (!entityId) continue;
        if (ent.javaQualifier !== undefined) {
          await client.query(
            'UPDATE etgo_sf_entity SET name = $1, java_qualifier = $2 WHERE etgo_sf_entity_id = $3',
            [ent.name, ent.javaQualifier, entityId],
          );
        } else {
          // Preserve any existing java_qualifier set manually or by a NeoHandler wiring.
          await client.query(
            'UPDATE etgo_sf_entity SET name = $1 WHERE etgo_sf_entity_id = $2',
            [ent.name, entityId],
          );
        }
        entityMapByName[ent.name] = entityId;
      }
      console.log('       Entity names updated to contract names');
    }

    // Step 3: Update field visibility from contract
    console.log(`[3/4] Updating ${allFields.length} fields from contract visibility...`);
    let successCount = 0;
    let errorCount = 0;
    const fieldResults = [];

    for (const f of allFields) {
      // Match by tabId first (exact, handles same-table tabs),
      // then by curated name (if AD tab name matches),
      // then by tableName (bridges curated name -> table -> populated entity)
      const tableForEntity = f.tableName || curatedToTable[f.entityName];
      const entityId = (f.tabId && entityMapByTabId[f.tabId])
        || entityMapByName[f.entityName]
        || (tableForEntity && entityMapByTableName[tableForEntity]);
      if (!entityId) {
        console.warn(`  Warning: No entity ID found for '${f.entityName}', skipping field '${f.column}'`);
        errorCount++;
        fieldResults.push({ column: f.column, entityName: f.entityName, success: false, error: 'no entity' });
        continue;
      }

      const vis = mapVisibility(f.visibility);

      // Find the field by entity + column name (look up column ID first).
      // ORDER BY makes the choice deterministic when duplicates exist;
      // duplicates are also caught up-front by checkDuplicateFields() below.
      const colLookup = await client.query(
        `SELECT sf.etgo_sf_field_id
         FROM etgo_sf_field sf
         JOIN ad_column c ON c.ad_column_id = sf.ad_column_id
         WHERE sf.etgo_sf_entity_id = $1 AND c.columnname = $2
         ORDER BY sf.created, sf.etgo_sf_field_id`,
        [entityId, f.column],
      );

      if (colLookup.rows.length === 0) {
        // Field might have been excluded as a system column — skip silently
        fieldResults.push({ column: f.column, entityName: f.entityName, success: true, skipped: true });
        successCount++;
        continue;
      }

      const fieldId = colLookup.rows[0].etgo_sf_field_id;
      const defaultExprKey = `${f.entityName}.${f.fieldName}`;
      // java_qualifier on a field is an API-key alias used by NeoFieldFilter ONLY when
      // it differs from the DAL propName. Since f.fieldName comes from toPropertyName()
      // and matches the DAL propName by construction, persisting it adds zero runtime
      // effect, generates an UPDATE per field, and bloats sourcedata XML on export.
      // upsertField() ignores undefined params and preserves the existing value, so
      // explicit aliasing (if introduced later) can re-enable it via a different path.
      const fieldParams = {
        entityId,
        fieldId,
        moduleId,
        isIncluded: vis.isIncluded,
        isReadOnly: vis.isReadOnly,
        audit: auditOpts,
      };
      if (defaultExprKey in fieldDefaultExprs) {
        fieldParams.defaultValue = fieldDefaultExprs[defaultExprKey] || null;
      }
      await writerUpsertField(client, fieldParams);
      fieldResults.push({ column: f.column, entityName: f.entityName, success: true });
      successCount++;
    }

    // Step 4: Exclude all fields NOT in the contract
    console.log(`[4/4] Excluding non-contract fields...`);
    const contractColumns = new Set(allFields.map(f => f.column));
    let excludedCount = 0;

    for (const ent of popResult.entities) {
      const entityId = ent.entityId;
      const allEntityFields = await client.query(
        `SELECT sf.etgo_sf_field_id, c.columnname
         FROM etgo_sf_field sf
         JOIN ad_column c ON c.ad_column_id = sf.ad_column_id
         WHERE sf.etgo_sf_entity_id = $1 AND sf.isincluded = 'Y'`,
        [entityId],
      );

      for (const row of allEntityFields.rows) {
        if (!contractColumns.has(row.columnname)) {
          await client.query(
            `UPDATE etgo_sf_field SET isincluded = 'N', updated = now() WHERE etgo_sf_field_id = $1`,
            [row.etgo_sf_field_id],
          );
          excludedCount++;
        }
      }
    }
    console.log(`       ${excludedCount} non-contract fields excluded.`);

    await client.query('COMMIT');

    console.log(`\nDone. ${successCount} fields updated, ${errorCount} errors, ${excludedCount} excluded.`);

    return {
      dryRun: false,
      specName,
      specId,
      windowId,
      entitiesPopulated: popResult.entityCount,
      fieldsUpdated: successCount,
      fieldsErrored: errorCount,
      fieldsExcluded: excludedCount,
      fieldResults,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await closePool(pool);
  }
}

// ---------------------------------------------------------------------------
// Process push function
// ---------------------------------------------------------------------------

/**
 * Push a process contract configuration to NEO Headless via direct DB writes.
 *
 * @param {string} processName - The process artifact folder name (e.g., "generate-invoices")
 * @param {object} [options] - Override options
 * @param {boolean} [options.dryRun] - If true, log planned actions without writing to DB
 * @param {string} [options.projectRoot] - Override project root path
 * @param {string} [options.moduleId='94E1B433CF55451EABB764750AC5902A'] - AD_Module_ID for new rows (defaults to com.etendoerp.go)
 * @param {object} [options.dbConfig] - Override DB pool config
 * @param {object} [options.audit] - Override audit defaults
 * @param {string} [options.specType='P'] - Spec type: 'P' (process) or 'R' (report)
 * @returns {object} Result summary
 */
export async function pushProcessToNeo(processName, options = {}) {
  const projectRoot = options.projectRoot || ROOT;
  const artifactsDir = join(projectRoot, 'artifacts', processName);

  // Load process contract
  let contractRaw;
  try {
    contractRaw = await readFile(join(artifactsDir, 'contract.json'), 'utf-8');
  } catch (err) {
    throw new Error(`Cannot read contract.json for process '${processName}': ${err.message}`);
  }

  const contract = JSON.parse(contractRaw);

  if (contract.type !== 'process') {
    throw new Error(`Contract type is '${contract.type}', expected 'process'`);
  }

  const processId = contract.process.id;
  const specName = contract.process.specName;
  const processDisplayName = contract.process.name;
  const specType = options.specType || 'P';

  // Dry run mode
  if (options.dryRun === true) {
    const typeLabel = specType === 'R' ? 'report' : 'process';
    console.log(`[DRY RUN] Push to NEO for ${typeLabel}: ${processDisplayName} (${processName})`);
    console.log(`  Spec name: ${specName}`);
    console.log(`  Process ID: ${processId}`);
    console.log(`  Spec type: ${specType}`);
    console.log(`  Method: direct DB write`);
    console.log(`\n  Step 1: upsertSpec (specType=${specType})`);
    console.log(`    Params: { name: '${specName}', specType: '${specType}', processId: '${processId}' }`);
    console.log(`\n  Step 2: populateSpec (auto-creates entity + fields from AD_Process_Para)`);
    console.log(`    Params: { specId: <from step 1> }`);

    return {
      dryRun: true,
      specName,
      processId,
      plan: {
        spec: { action: 'upsertSpec', params: { name: specName, specType, processId } },
        populate: { action: 'populateSpec', params: { specId: '(from step 1)' } },
      },
    };
  }

  // Live mode — write to DB via transaction
  const moduleId = options.moduleId || '94E1B433CF55451EABB764750AC5902A';
  const auditOpts = options.audit || {};
  const pool = createDbPool(options.dbConfig);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await setGoModuleInDevelopment(client);

    // Step 1: Upsert spec (look up existing spec first for idempotent updates)
    const existingSpec = await client.query(
      'SELECT etgo_sf_spec_id FROM etgo_sf_spec WHERE name = $1',
      [specName],
    );
    const existingSpecId = existingSpec.rows.length > 0
      ? existingSpec.rows[0].etgo_sf_spec_id
      : null;
    console.log(`[1/2] Upserting spec '${specName}' for process ${processId}...`);
    const specResult = await writerUpsertSpec(client, {
      name: specName,
      moduleId,
      processId,
      specType,
      specId: existingSpecId,
      audit: auditOpts,
    });
    const specId = specResult.specId;
    console.log(`       Spec ID: ${specId} (${specResult.created ? 'created' : 'updated'})`);

    // Step 2: Populate spec from AD metadata (creates entity + fields automatically)
    console.log(`[2/2] Populating spec from AD_Process_Para...`);
    const popResult = await writerPopulateSpec(client, {
      specId,
      moduleId,
      audit: auditOpts,
    });
    console.log(`       Entity: ${popResult.entities[0]?.name || 'unnamed'}, Fields: ${popResult.fieldCount}`);

    await client.query('COMMIT');

    console.log(`\nDone. Process spec '${specName}' configured.`);

    return {
      dryRun: false,
      specName,
      specId,
      processId,
      entityCount: popResult.entityCount,
      fieldCount: popResult.fieldCount,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await closePool(pool);
  }
}

// ---------------------------------------------------------------------------
// Report push function (NeoHandler-based reports)
// ---------------------------------------------------------------------------

/**
 * Push a report's configuration to NEO Headless.
 * Creates a spec (type R) and an entity with the NeoHandler java_qualifier.
 *
 * Uses report-contract.json from the artifact directory.
 * The handler class must be compiled and deployed in the Etendo module.
 *
 * @param {string} reportName - The report artifact folder name (e.g., "aging-receivable")
 * @param {object} [options] - Override options
 * @param {boolean} [options.dryRun] - If true, log planned actions without writing to DB
 * @param {string} [options.projectRoot] - Override project root path
 * @param {string} [options.moduleId='94E1B433CF55451EABB764750AC5902A'] - AD_Module_ID
 * @param {object} [options.dbConfig] - Override DB pool config
 * @param {object} [options.audit] - Override audit defaults
 * @returns {object} Result summary
 */
export async function pushReportToNeo(reportName, options = {}) {
  const projectRoot = options.projectRoot || ROOT;
  const artifactsDir = join(projectRoot, 'artifacts', reportName);

  // Load report contract
  let contractRaw;
  try {
    contractRaw = await readFile(join(artifactsDir, 'report-contract.json'), 'utf-8');
  } catch (err) {
    throw new Error(`Cannot read report-contract.json for '${reportName}': ${err.message}`);
  }

  const contract = JSON.parse(contractRaw);
  const specName = contract.reportId || reportName;
  const handler = contract.neo?.handler || null;
  const title = contract.title?.en_US || specName;
  const description = `Report: ${title}`;

  // Resolve process ID if referenced in jasper config
  const processId = contract.jasper?.processId || null;

  if (options.dryRun === true) {
    console.log(`[DRY RUN] Push report to NEO: ${title} (${specName})`);
    console.log(`  Spec name: ${specName}`);
    console.log(`  Spec type: R (report)`);
    console.log(`  Process ID: ${processId || '(none)'}`);
    console.log(`  NeoHandler: ${handler || '(none)'}`);
    console.log(`  Method: direct DB write`);
    console.log(`\n  Step 1: upsertSpec (specType=R)`);
    console.log(`  Step 2: create entity with java_qualifier='${handler}'`);
    return { dryRun: true, specName, handler };
  }

  // Live mode
  const moduleId = options.moduleId || '94E1B433CF55451EABB764750AC5902A';
  const auditOpts = options.audit || {};
  const pool = createDbPool(options.dbConfig);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await setGoModuleInDevelopment(client);

    // Step 1: Upsert spec
    const existingSpec = await client.query(
      'SELECT etgo_sf_spec_id FROM etgo_sf_spec WHERE name = $1',
      [specName],
    );
    const existingSpecId = existingSpec.rows.length > 0
      ? existingSpec.rows[0].etgo_sf_spec_id
      : null;

    console.log(`[1/2] Upserting spec '${specName}' (type=R)...`);
    const specResult = await writerUpsertSpec(client, {
      name: specName,
      moduleId,
      processId,
      specType: 'R',
      description,
      specId: existingSpecId,
      audit: auditOpts,
    });
    const specId = specResult.specId;
    console.log(`       Spec ID: ${specId} (${specResult.created ? 'created' : 'updated'})`);

    // Step 2: Create/update the entity with the handler qualifier
    if (handler) {
      const existingEntity = await client.query(
        'SELECT etgo_sf_entity_id FROM etgo_sf_entity WHERE etgo_sf_spec_id = $1',
        [specId],
      );

      if (existingEntity.rows.length > 0) {
        // Update handler qualifier on existing entity
        const entityId = existingEntity.rows[0].etgo_sf_entity_id;
        await client.query(
          `UPDATE etgo_sf_entity SET java_qualifier = $1, name = $2, updated = now() WHERE etgo_sf_entity_id = $3`,
          [handler, specName, entityId],
        );
        console.log(`[2/2] Updated entity handler: ${handler} (entity ${entityId})`);
      } else {
        // Create a minimal entity for the handler
        const { generateId } = await import('./neo-writer.js');
        const entityId = generateId();
        const auditVals = {
          ad_client_id: auditOpts.ad_client_id || '0',
          ad_org_id: auditOpts.ad_org_id || '0',
          isactive: 'Y',
          created: new Date(),
          createdby: auditOpts.createdby || '0',
          updated: new Date(),
          updatedby: auditOpts.updatedby || '0',
        };
        await client.query(
          `INSERT INTO etgo_sf_entity
           (etgo_sf_entity_id, etgo_sf_spec_id, name, ad_module_id, java_qualifier,
            isget, ispost, isput, ispatch, isdelete, seqno,
            ad_client_id, ad_org_id, isactive, created, createdby, updated, updatedby)
           VALUES ($1, $2, $3, $4, $5,
                   'Y', 'Y', 'N', 'N', 'N', 10,
                   $6, $7, $8, $9, $10, $11, $12)`,
          [entityId, specId, specName, moduleId, handler,
           auditVals.ad_client_id, auditVals.ad_org_id, auditVals.isactive,
           auditVals.created, auditVals.createdby, auditVals.updated, auditVals.updatedby],
        );
        console.log(`[2/2] Created entity with handler: ${handler} (entity ${entityId})`);
      }
    } else if (processId) {
      // No handler — populate from AD_Process metadata (standard report flow)
      console.log(`[2/2] Populating spec from AD_Process...`);
      const popResult = await writerPopulateSpec(client, {
        specId,
        moduleId,
        audit: auditOpts,
      });
      console.log(`       Entity: ${popResult.entities[0]?.name || 'unnamed'}, Fields: ${popResult.fieldCount}`);
    } else {
      console.log(`[2/2] No handler or processId — spec-only registration.`);
    }

    await client.query('COMMIT');
    console.log(`\nDone. Report spec '${specName}' configured.`);

    return { dryRun: false, specName, specId, handler };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await closePool(pool);
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const isReport = args.includes('--type') && args[args.indexOf('--type') + 1] === 'report';
  const overrideWindowArg = args.find(a => a.startsWith('--override-window='));
  const overrideWindow = overrideWindowArg ? overrideWindowArg.split('=')[1] : null;
  const name = args.find(a => !a.startsWith('--') && a !== 'report');

  if (!name) {
    console.error('Usage:');
    console.error('  node cli/src/push-to-neo.js <windowName> [--dry-run] [--override-window=123]');
    console.error('  node cli/src/push-to-neo.js <reportName> --type report [--dry-run]');
    console.error('');
    console.error('Examples:');
    console.error('  node cli/src/push-to-neo.js sales-order');
    console.error('  node cli/src/push-to-neo.js aging-receivable --type report');
    console.error('  node cli/src/push-to-neo.js aging-receivable --type report --dry-run');
    process.exit(1);
  }

  try {
    let result;
    if (isReport) {
      result = await pushReportToNeo(name, { dryRun });
    } else {
      result = await pushToNeo(name, { dryRun, overrideWindow });
    }
    if (!dryRun) {
      console.log('\nResult:', JSON.stringify(result, null, 2));
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

// Run CLI when executed directly
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main();
}
