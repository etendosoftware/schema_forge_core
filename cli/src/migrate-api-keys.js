#!/usr/bin/env node

/**
 * Migration script: adds `apiKey` field to existing schema-curated.json files.
 *
 * For each field without an apiKey, sets apiKey = field.name (preserving current
 * API binding behavior). This is a best-effort migration because curated schemas
 * do not store the original AD_Column.Name needed to re-run toPropertyName().
 *
 * For full accuracy with the new toPropertyName(), re-extract from the DB.
 *
 * Usage:
 *   node cli/src/migrate-api-keys.js            # Migrate all curated schemas
 *   node cli/src/migrate-api-keys.js --dry-run   # Preview changes without writing
 */

import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = process.env.SF_ROOT || resolve(__dirname, '../..');
const ARTIFACTS_DIR = resolve(ROOT, 'artifacts');

const dryRun = process.argv.includes('--dry-run');

/**
 * Determine if a column is the primary key for its table.
 * Convention: PK column name === tableName + '_ID'
 * @param {string} columnName - e.g. "C_Order_ID"
 * @param {string} tableName - e.g. "C_Order"
 * @returns {boolean}
 */
function isPrimaryKey(columnName, tableName) {
  if (!columnName || !tableName) return false;
  return columnName.toUpperCase() === `${tableName.toUpperCase()}_ID`;
}

/**
 * Build a lookup map from columnName -> raw field for a raw schema entity.
 * @param {Array} rawFields
 * @returns {Map<string, object>}
 */
function buildRawFieldMap(rawFields) {
  const map = new Map();
  if (!Array.isArray(rawFields)) return map;
  for (const rf of rawFields) {
    if (rf.columnName) {
      map.set(rf.columnName, rf);
    }
  }
  return map;
}

/**
 * Try to load and parse a JSON file. Returns null on any error.
 */
async function loadJson(filePath) {
  try {
    const text = await readFile(filePath, 'utf-8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Find the matching raw entity for a curated entity by tableName.
 */
function findRawEntity(rawSchema, curatedEntity) {
  if (!rawSchema?.entities) return null;
  // Match by tableName (most reliable)
  if (curatedEntity.tableName) {
    return rawSchema.entities.find(e => e.tableName === curatedEntity.tableName) || null;
  }
  // Fallback: match by tabName
  if (curatedEntity.tabName) {
    return rawSchema.entities.find(e => e.tabName === curatedEntity.tabName) || null;
  }
  return null;
}

async function main() {
  console.log(dryRun ? '=== DRY RUN MODE (no files will be written) ===' : '=== Migrating apiKey into curated schemas ===');
  console.log();

  // Discover artifact directories
  let entries;
  try {
    entries = await readdir(ARTIFACTS_DIR);
  } catch (err) {
    console.error(`Cannot read artifacts directory: ${ARTIFACTS_DIR}`);
    console.error(err.message);
    process.exit(1);
  }

  let totalFiles = 0;
  let totalFieldsMigrated = 0;
  let totalFieldsSkipped = 0;
  let filesModified = 0;

  for (const entry of entries.sort((a, b) => a.localeCompare(b))) {
    const artifactDir = join(ARTIFACTS_DIR, entry);
    const curatedPath = join(artifactDir, 'schema-curated.json');

    // Check if schema-curated.json exists
    try {
      const s = await stat(curatedPath);
      if (!s.isFile()) continue;
    } catch {
      continue;
    }

    const curated = await loadJson(curatedPath);
    if (!curated?.entities) {
      console.log(`  SKIP ${entry}/schema-curated.json (no entities)`);
      continue;
    }

    totalFiles++;

    // Try to load raw schema for richer field matching
    const rawPath = join(artifactDir, 'schema-raw.json');
    const rawSchema = await loadJson(rawPath);

    let fileFieldsMigrated = 0;
    let fileFieldsSkipped = 0;

    ({ fileFieldsSkipped, fileFieldsMigrated } = migrateApiKeys(curated, rawSchema, fileFieldsSkipped, entry, fileFieldsMigrated));

    if (fileFieldsMigrated > 0) {
      filesModified++;
      totalFieldsMigrated += fileFieldsMigrated;
      totalFieldsSkipped += fileFieldsSkipped;

      await migrateAndSaveSchema(entry, fileFieldsMigrated, fileFieldsSkipped, curated, curatedPath);
    } else {
      totalFieldsSkipped += fileFieldsSkipped;
      console.log(`  OK ${entry}: all ${fileFieldsSkipped} fields already have apiKey`);
    }
  }

  console.log();
  console.log('=== Summary ===');
  console.log(`  Curated schemas found:  ${totalFiles}`);
  console.log(`  Files modified:         ${filesModified}`);
  console.log(`  Fields migrated:        ${totalFieldsMigrated}`);
  console.log(`  Fields already had key: ${totalFieldsSkipped}`);

  logMigrationSummary(totalFieldsMigrated);
}


async function migrateAndSaveSchema(entry, fileFieldsMigrated, fileFieldsSkipped, curated, curatedPath) {
  if (dryRun) {
    console.log(`  WOULD MIGRATE ${entry}: ${fileFieldsMigrated} fields (${fileFieldsSkipped} already had apiKey)`);
  } else {
    // Write back with consistent formatting (2-space indent, trailing newline)
    const output = JSON.stringify(curated, null, 2) + '\n';
    await writeFile(curatedPath, output, 'utf-8');
    console.log(`  MIGRATED ${entry}: ${fileFieldsMigrated} fields (${fileFieldsSkipped} already had apiKey)`);
  }
}

function logMigrationSummary(totalFieldsMigrated) {
  if (dryRun) {
    console.log();
    console.log('No files were written (--dry-run). Run without --dry-run to apply changes.');
  } else if (totalFieldsMigrated > 0) {
    console.log();
    console.log('NOTE: apiKey was set to field.name (best-effort). For full accuracy,');
    console.log('re-extract from DB with: node cli/src/pipeline.js --menu-name "Window Name"');
  }
}

function migrateApiKeys(curated, rawSchema, fileFieldsSkipped, entry, fileFieldsMigrated) {
  for (const entity of curated.entities) {
    if (!Array.isArray(entity.fields)) continue;

    const tableName = entity.tableName || '';
    // Build raw field lookup if raw schema is available
    const rawEntity = rawSchema ? findRawEntity(rawSchema, entity) : null;
    const rawFieldMap = rawEntity ? buildRawFieldMap(rawEntity.fields) : new Map();

    for (const field of entity.fields) {
      // Already has apiKey — skip
      if (field.apiKey !== undefined) {
        fileFieldsSkipped++;
        continue;
      }

      // Determine apiKey: use curated field.name as the baseline.
      // This preserves the existing API binding since field.name was
      // previously used as the property name in contracts and frontend.
      let apiKey = field.name;

      // If we have a raw schema match, verify consistency (log only)
      validateRawFieldConsistency(rawFieldMap, field, entry, entity);

      field.apiKey = apiKey;
      fileFieldsMigrated++;
    }
  }
  return { fileFieldsSkipped, fileFieldsMigrated };
}

function validateRawFieldConsistency(rawFieldMap, field, entry, entity) {
  if (rawFieldMap.size > 0 && field.column) {
    const rawField = rawFieldMap.get(field.column);
    if (rawField && rawField.name && rawField.name !== field.name) {
      // The raw schema's name (old toPropertyName output) differs from
      // the curated name — the curated name was manually renamed.
      // Use curated name as apiKey since that's what the API was using.
      if (!dryRun) {
        console.log(`  NOTE ${entry}/${entity.name}: field "${field.name}" (column ${field.column}) — raw name was "${rawField.name}", keeping curated name as apiKey`);
      }
    }
  }
}

const isMain = isMainModule(import.meta.url);
if (isMain) {
  main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

export {
  isPrimaryKey,
  buildRawFieldMap,
  loadJson,
  findRawEntity,
  migrateApiKeys,
  validateRawFieldConsistency,
  main,
};
