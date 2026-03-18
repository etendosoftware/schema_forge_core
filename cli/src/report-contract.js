#!/usr/bin/env node

/**
 * report-contract.js — Generate, validate, and inspect report contracts.
 *
 * A report contract describes what columns appear in a report, what filters
 * are available, how the output is sorted, and which output formats are
 * supported. It is derived from a schema-curated.json artifact.
 *
 * Usage:
 *   node cli/src/report-contract.js --artifact <name> --type listing
 *   node cli/src/report-contract.js --artifact <name> --validate
 *   node cli/src/report-contract.js --artifact <name> --available
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { toSpecName } from './push-to-neo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYSTEM_VISIBILITIES = new Set(['system', 'discarded']);
const REQUIRED_CONTRACT_KEYS = ['reportId', 'type', 'entity', 'columns'];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Collect all non-system fields from the first entity in a schema.
 * @param {object} schema - schema-curated.json object
 * @returns {Array} field descriptors
 */
function getUsableFields(schema) {
  const entity = schema.entities[0];
  if (!entity) return [];
  return entity.fields.filter(f => !SYSTEM_VISIBILITIES.has(f.visibility));
}

/**
 * Derive a filter type string from a field's data type.
 * @param {object} field
 * @returns {string} filter type
 */
function filterTypeFor(field) {
  if (field.type === 'boolean') return 'boolean';
  if (['date', 'datetime'].includes(field.type)) return 'dateRange';
  if (['amount', 'number', 'quantity', 'integer'].includes(field.type)) return 'numberRange';
  return 'text';
}

// ---------------------------------------------------------------------------
// Exported pure functions
// ---------------------------------------------------------------------------

/**
 * Generate a report contract from a schema-curated.json object.
 *
 * @param {object} schema - parsed schema-curated.json
 * @param {string} type   - report type identifier (e.g. 'listing')
 * @returns {object} report contract
 */
export function generateReportContract(schema, type) {
  const specName = toSpecName(schema.window.name);
  const usableFields = getUsableFields(schema);

  // Columns: grid fields only (default visible columns in the report)
  const columns = usableFields
    .filter(f => f.grid)
    .map(f => ({
      field: f.name,
      label: { en: f.name },
      type: f.type,
      sortable: true,
    }));

  // Filters: searchable string fields get text filters; booleans get boolean filters
  const filters = usableFields
    .filter(f => f.searchable || f.type === 'boolean')
    .map(f => ({
      field: f.name,
      label: { en: f.name },
      type: filterTypeFor(f),
    }));

  // Default sort: first sortable column, ascending
  const firstColumn = columns[0];
  const defaultSort = firstColumn
    ? { field: firstColumn.field, direction: 'asc' }
    : { field: null, direction: 'asc' };

  return {
    version: 1,
    reportId: `${specName}-${type}`,
    type,
    entity: specName,
    title: {
      en_US: schema.window.name,
      es_ES: schema.window.name,
    },
    columns,
    filters,
    defaultSort,
    outputs: ['pdf'],
    summary: { totalRows: true },
  };
}

/**
 * Validate a report contract against its source schema.
 *
 * @param {object} contract - report contract object
 * @param {object} schema   - schema-curated.json object
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateReportContract(contract, schema) {
  const errors = [];

  // Check required top-level keys
  for (const key of REQUIRED_CONTRACT_KEYS) {
    if (contract[key] === undefined || contract[key] === null) {
      errors.push(`Missing required field: ${key}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Build a set of valid field names from the schema
  const allFields = new Set(
    (schema.entities[0]?.fields ?? []).map(f => f.name)
  );

  // Validate columns reference known fields
  for (const col of contract.columns ?? []) {
    if (!allFields.has(col.field)) {
      errors.push(`Column references unknown field: ${col.field}`);
    }
  }

  // Validate filters reference known fields
  for (const filter of contract.filters ?? []) {
    if (!allFields.has(filter.field)) {
      errors.push(`Filter references unknown field: ${filter.field}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * List schema fields that are not yet included in the contract's columns.
 * Excludes system/discarded fields.
 *
 * @param {object} contract - report contract object
 * @param {object} schema   - schema-curated.json object
 * @returns {Array<{ name: string, column: string, type: string, visibility: string }>}
 */
export function listAvailableFields(contract, schema) {
  const usableFields = getUsableFields(schema);
  const usedFields = new Set((contract.columns ?? []).map(c => c.field));

  return usableFields
    .filter(f => !usedFields.has(f.name))
    .map(f => ({ name: f.name, column: f.column, type: f.type, visibility: f.visibility }));
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const args = process.argv.slice(2);

  function getArg(flag) {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : null;
  }

  function hasFlag(flag) {
    return args.includes(flag);
  }

  const artifactName = getArg('--artifact');
  const reportType = getArg('--type') ?? 'listing';
  const doValidate = hasFlag('--validate');
  const doAvailable = hasFlag('--available');

  if (!artifactName) {
    console.error('Usage: report-contract.js --artifact <name> [--type <type> | --validate | --available]');
    process.exit(1);
  }

  const artifactDir = join(ROOT, 'artifacts', artifactName);
  const schemaPath = join(artifactDir, 'schema-curated.json');
  const contractPath = join(artifactDir, 'report-contract.json');

  try {
    const schemaRaw = await readFile(schemaPath, 'utf8');
    const schema = JSON.parse(schemaRaw);

    if (doValidate) {
      let contractRaw;
      try {
        contractRaw = await readFile(contractPath, 'utf8');
      } catch {
        console.error(`No report-contract.json found at ${contractPath}`);
        process.exit(1);
      }
      const contract = JSON.parse(contractRaw);
      const result = validateReportContract(contract, schema);
      if (result.valid) {
        console.log('Contract is valid.');
      } else {
        console.error('Contract validation failed:');
        for (const err of result.errors) console.error(`  - ${err}`);
        process.exit(1);
      }
    } else if (doAvailable) {
      let contract = {};
      try {
        const contractRaw = await readFile(contractPath, 'utf8');
        contract = JSON.parse(contractRaw);
      } catch {
        // No existing contract — all usable fields are available
      }
      const available = listAvailableFields(contract, schema);
      if (available.length === 0) {
        console.log('No additional fields available.');
      } else {
        console.log('Available fields not yet in contract:');
        for (const f of available) {
          console.log(`  ${f.name} (${f.column}, ${f.type}, ${f.visibility})`);
        }
      }
    } else {
      // Generate mode
      const contract = generateReportContract(schema, reportType);
      await writeFile(contractPath, JSON.stringify(contract, null, 2), 'utf8');
      console.log(`Report contract written to ${contractPath}`);
      console.log(`  reportId : ${contract.reportId}`);
      console.log(`  columns  : ${contract.columns.length}`);
      console.log(`  filters  : ${contract.filters.length}`);
      console.log(`  outputs  : ${contract.outputs.join(', ')}`);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
