#!/usr/bin/env node

/**
 * push-to-neo.js — Configure NEO Headless via webhooks from contract + schema artifacts.
 *
 * Reads contract.json and schema-curated.json for a given window, then calls
 * Etendo webhooks (SFUpsertSpec, SFPopulateSpec, SFUpsertField) to configure
 * the NEO Headless runtime.
 *
 * Usage:
 *   node cli/src/push-to-neo.js <windowName>
 *   node cli/src/push-to-neo.js sales-order
 *   node cli/src/push-to-neo.js sales-order --dry-run
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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
 * Map a field visibility value to NEO webhook params.
 * Returns { isIncluded: "Y"|"N", isReadOnly: "Y"|"N" }.
 */
export function mapVisibility(visibility) {
  switch (visibility) {
    case 'editable':
      return { isIncluded: 'Y', isReadOnly: 'N' };
    case 'readOnly':
      return { isIncluded: 'Y', isReadOnly: 'Y' };
    case 'system':
    case 'discarded':
      return { isIncluded: 'N', isReadOnly: 'N' };
    default:
      return { isIncluded: 'N', isReadOnly: 'N' };
  }
}

/**
 * Build the full webhook URL from a base Etendo URL and webhook name.
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

// ---------------------------------------------------------------------------
// Webhook callers
// ---------------------------------------------------------------------------

/**
 * Build Basic auth header value.
 */
function basicAuth(user, password) {
  return 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
}

/**
 * Call a webhook. Returns the parsed JSON response.
 * Throws on non-2xx status.
 */
async function callWebhook(url, params, authHeader) {
  const searchParams = new URLSearchParams(params);
  const fullUrl = `${url}?${searchParams.toString()}`;

  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Webhook ${url} failed with status ${response.status}: ${body}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// ---------------------------------------------------------------------------
// Main push function
// ---------------------------------------------------------------------------

/**
 * Push a window's contract configuration to NEO Headless via webhooks.
 *
 * @param {string} windowName - The window artifact folder name (e.g., "sales-order")
 * @param {object} [options] - Override options
 * @param {string} [options.etendoUrl] - Override Etendo base URL
 * @param {string} [options.user] - Override auth user
 * @param {string} [options.password] - Override auth password
 * @param {boolean} [options.dryRun] - If true, log planned actions without calling webhooks
 * @param {string} [options.projectRoot] - Override project root path
 * @returns {object} Result summary with spec, entities, and field updates
 */
export async function pushToNeo(windowName, options = {}) {
  const projectRoot = options.projectRoot || ROOT;
  const artifactsDir = join(projectRoot, 'artifacts', windowName);

  // Load artifacts
  let contractRaw, schemaRaw;
  try {
    contractRaw = await readFile(join(artifactsDir, 'contract.json'), 'utf-8');
  } catch (err) {
    throw new Error(`Cannot read contract.json for window '${windowName}': ${err.message}`);
  }
  try {
    schemaRaw = await readFile(join(artifactsDir, 'schema-curated.json'), 'utf-8');
  } catch (err) {
    throw new Error(`Cannot read schema-curated.json for window '${windowName}': ${err.message}`);
  }

  const contract = JSON.parse(contractRaw);
  const schema = JSON.parse(schemaRaw);

  const windowId = schema.window.id;
  const windowDisplayName = schema.window.name;
  const specName = toSpecName(windowDisplayName);

  // Load connection config (options override file/env)
  let config;
  if (options.etendoUrl && options.user && options.password) {
    config = { url: options.etendoUrl, user: options.user, password: options.password };
  } else {
    config = await loadConfig(projectRoot);
    if (options.etendoUrl) config.url = options.etendoUrl;
    if (options.user) config.user = options.user;
    if (options.password) config.password = options.password;
  }

  const authHeader = basicAuth(config.user, config.password);
  const dryRun = options.dryRun === true;

  // Extract all fields from backend contract (has all visibility levels)
  const allFields = extractFieldsFromContract(contract.backendContract);

  // Build planned actions
  const plan = {
    spec: {
      webhook: 'SFUpsertSpec',
      url: buildWebhookUrl(config.url, 'SFUpsertSpec'),
      params: { windowId, name: specName, type: 'W' },
    },
    populate: {
      webhook: 'SFPopulateSpec',
      url: buildWebhookUrl(config.url, 'SFPopulateSpec'),
      params: { specId: '(from step 1)' },
    },
    fields: allFields.map(f => {
      const vis = mapVisibility(f.visibility);
      return {
        webhook: 'SFUpsertField',
        url: buildWebhookUrl(config.url, 'SFUpsertField'),
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

  if (dryRun) {
    console.log(`[DRY RUN] Push to NEO for window: ${windowDisplayName} (${windowName})`);
    console.log(`  Spec name: ${specName}`);
    console.log(`  Window ID: ${windowId}`);
    console.log(`  Etendo URL: ${config.url}`);
    console.log(`\n  Step 1: ${plan.spec.webhook}`);
    console.log(`    URL: ${plan.spec.url}`);
    console.log(`    Params:`, plan.spec.params);
    console.log(`\n  Step 2: ${plan.populate.webhook}`);
    console.log(`    URL: ${plan.populate.url}`);
    console.log(`    Params: { specId: <returned from step 1> }`);
    console.log(`\n  Step 3: ${plan.fields.length} field updates via ${plan.fields[0]?.webhook || 'SFUpsertField'}`);

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

  // Step 1: Upsert spec
  console.log(`[1/3] Upserting spec '${specName}' for window ${windowId}...`);
  const specResult = await callWebhook(plan.spec.url, plan.spec.params, authHeader);
  const specId = specResult.specId || specResult.id || specResult.data?.id;
  if (!specId) {
    throw new Error(`SFUpsertSpec did not return a specId. Response: ${JSON.stringify(specResult)}`);
  }
  console.log(`       Spec ID: ${specId}`);

  // Step 2: Populate spec (auto-creates entities + fields from AD metadata)
  console.log(`[2/3] Populating spec from AD metadata...`);
  const populateResult = await callWebhook(
    plan.populate.url,
    { specId },
    authHeader,
  );
  // Extract entity IDs from populate result
  const entityMap = {};
  if (populateResult.entities) {
    for (const ent of populateResult.entities) {
      entityMap[ent.name] = ent.id || ent.entityId;
    }
  }
  console.log(`       Entities populated: ${Object.keys(entityMap).length}`);

  // Step 3: Update fields based on contract visibility
  console.log(`[3/3] Updating ${allFields.length} fields...`);
  const fieldResults = [];
  let successCount = 0;
  let errorCount = 0;

  for (const fieldPlan of plan.fields) {
    const entityId = entityMap[fieldPlan.entityName];
    if (!entityId) {
      console.warn(`  Warning: No entity ID found for '${fieldPlan.entityName}', skipping field '${fieldPlan.params.column}'`);
      errorCount++;
      continue;
    }

    try {
      const result = await callWebhook(
        fieldPlan.url,
        { ...fieldPlan.params, entityId },
        authHeader,
      );
      fieldResults.push({ ...fieldPlan.params, entityId, success: true });
      successCount++;
    } catch (err) {
      console.warn(`  Warning: Failed to update field '${fieldPlan.params.column}': ${err.message}`);
      fieldResults.push({ ...fieldPlan.params, entityId, success: false, error: err.message });
      errorCount++;
    }
  }

  console.log(`\nDone. ${successCount} fields updated, ${errorCount} errors.`);

  return {
    dryRun: false,
    specName,
    specId,
    windowId,
    entitiesPopulated: Object.keys(entityMap).length,
    fieldsUpdated: successCount,
    fieldsErrored: errorCount,
    fieldResults,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const windowName = args.find(a => !a.startsWith('--'));

  if (!windowName) {
    console.error('Usage: node cli/src/push-to-neo.js <windowName> [--dry-run]');
    console.error('Example: node cli/src/push-to-neo.js sales-order');
    process.exit(1);
  }

  try {
    const result = await pushToNeo(windowName, { dryRun });
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
