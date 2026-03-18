#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '../..');

/**
 * Validate that contract field names match NEO API response keys.
 * Optional step (F7b) — skipped gracefully if Etendo is not running or no data exists.
 *
 * @param {string} specName - The spec/window name (kebab-case, matches artifact dir)
 * @param {object} [opts] - Options
 * @param {string} [opts.token] - JWT token (overrides env/script)
 * @param {string} [opts.apiBaseUrl] - Base URL (overrides env)
 * @returns {Promise<object>} Validation result
 */
export async function validateFieldNames(specName, opts = {}) {
  const apiBaseUrl = opts.apiBaseUrl || process.env.ETENDO_URL || 'http://localhost:8080/etendo';

  // 1. Read contract
  const contractPath = resolve(ROOT, `artifacts/${specName}/contract.json`);
  let contract;
  try {
    contract = JSON.parse(await readFile(contractPath, 'utf8'));
  } catch (err) {
    return { matched: [], mismatched: [], missing: [], extra: [], skipped: true, reason: `Cannot read contract: ${err.message}` };
  }

  // 2. Determine primary entity and extract expected field keys
  const frontendContract = contract.frontendContract;
  if (!frontendContract || !frontendContract.window) {
    return { matched: [], mismatched: [], missing: [], extra: [], skipped: true, reason: 'No frontendContract.window in contract' };
  }

  const primaryEntityName = frontendContract.window.primaryEntity;
  if (!primaryEntityName) {
    return { matched: [], mismatched: [], missing: [], extra: [], skipped: true, reason: 'No primaryEntity in contract window' };
  }

  const entityDef = frontendContract.entities?.[primaryEntityName];
  if (!entityDef || !entityDef.fields || entityDef.fields.length === 0) {
    return { matched: [], mismatched: [], missing: [], extra: [], skipped: true, reason: `No fields found for entity '${primaryEntityName}'` };
  }

  // Collect expected field keys from contract (apiKey takes precedence over name)
  const contractFields = entityDef.fields
    .filter(f => f.visibility !== 'system' && f.visibility !== 'discarded')
    .map(f => f.apiKey || f.name);

  // 3. Get JWT token
  const token = opts.token || process.env.NEO_TOKEN || getTokenFromScript();
  if (!token) {
    return { matched: [], mismatched: [], missing: [], extra: [], skipped: true, reason: 'No JWT token available (set NEO_TOKEN or ensure Etendo is running)' };
  }

  // 4. Fetch one record from NEO API
  const url = `${apiBaseUrl}/sws/neo/${specName}/${primaryEntityName}?_startRow=0&_endRow=1`;
  let apiKeys;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { matched: [], mismatched: [], missing: [], extra: [], skipped: true, reason: `API returned ${response.status}: ${response.statusText}` };
    }

    const body = await response.json();

    // NEO API returns { data: [...] } or { response: { data: [...] } }
    const records = body.data || body.response?.data || [];
    if (!Array.isArray(records) || records.length === 0) {
      return { matched: [], mismatched: [], missing: [], extra: [], skipped: true, reason: 'No data in entity' };
    }

    apiKeys = Object.keys(records[0]);
  } catch (err) {
    if (err.name === 'AbortError') {
      return { matched: [], mismatched: [], missing: [], extra: [], skipped: true, reason: 'API request timed out (5s)' };
    }
    return { matched: [], mismatched: [], missing: [], extra: [], skipped: true, reason: `Etendo not running (${err.code || err.message})` };
  }

  // 5. Compare keys
  const apiKeySet = new Set(apiKeys);
  const contractKeySet = new Set(contractFields);

  // Ignore common metadata keys that NEO adds but are not in the contract
  const metaKeys = new Set(['id', 'etag', '$ref', 'recordTime', '_identifier', '_entityName', 'updated', 'updatedBy', 'createdBy', 'creationDate']);

  const matched = [];
  const missing = []; // In contract but not in API
  const mismatched = [];

  for (const contractKey of contractFields) {
    if (apiKeySet.has(contractKey)) {
      matched.push(contractKey);
    } else {
      // Check for case-insensitive match (potential mismatch)
      const apiMatch = apiKeys.find(k => k.toLowerCase() === contractKey.toLowerCase());
      if (apiMatch) {
        mismatched.push({ contract: contractKey, api: apiMatch });
      } else {
        missing.push(contractKey);
      }
    }
  }

  // Extra: in API but not in contract (excluding meta keys)
  const extra = apiKeys.filter(k => !contractKeySet.has(k) && !metaKeys.has(k));

  return { matched, mismatched, missing, extra, skipped: false };
}

/**
 * Attempt to get a JWT token using the helper script.
 * Returns null if the script fails (Etendo not running).
 */
function getTokenFromScript() {
  const scriptPath = resolve(ROOT, 'scripts/neo-token-sysadmin.sh');
  try {
    const token = execSync(`bash "${scriptPath}"`, {
      timeout: 10000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return token || null;
  } catch {
    return null;
  }
}

/**
 * Print a human-readable summary of the validation result.
 */
function printSummary(result, specName) {
  if (result.skipped) {
    console.log(`[F7b] Field name validation skipped: ${result.reason}`);
    return;
  }

  console.log(`[F7b] Field name validation for '${specName}':`);
  console.log(`  Matched: ${result.matched.length}`);

  if (result.mismatched.length > 0) {
    console.warn(`  Mismatched (case difference): ${result.mismatched.length}`);
    result.mismatched.forEach(m => console.warn(`    ${m.contract} -> API returns: ${m.api}`));
  }

  if (result.missing.length > 0) {
    console.warn(`  Missing from API: ${result.missing.length}`);
    result.missing.forEach(k => console.warn(`    ${k}`));
  }

  if (result.extra.length > 0) {
    console.log(`  Extra in API (not in contract): ${result.extra.length}`);
    result.extra.forEach(k => console.log(`    ${k}`));
  }
}

// CLI entry point
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('validate-field-names.js') ||
  process.argv[1].endsWith('sf-validate-fields')
);

if (isMainModule) {
  const specName = process.argv[2];
  if (!specName) {
    console.error('Usage: validate-field-names.js <specName>');
    console.error('  e.g.: validate-field-names.js sales-order');
    console.error('');
    console.error('Env vars:');
    console.error('  NEO_TOKEN      - JWT token (skips login script)');
    console.error('  ETENDO_URL     - Base URL (default: http://localhost:8080/etendo)');
    process.exit(1);
  }

  validateFieldNames(specName)
    .then(result => {
      printSummary(result, specName);
      process.exit(0);
    })
    .catch(err => {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    });
}
