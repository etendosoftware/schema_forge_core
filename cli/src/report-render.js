#!/usr/bin/env node

/**
 * report-render.js — Execute a migrated Jasper report with real DB data via jsreport.
 *
 * Reads the report-contract.json to get the SQL query, runs it against the
 * Etendo DB, then renders via jsreport using the generated template.
 *
 * Usage:
 *   node cli/src/report-render.js --artifact <name>
 *   node cli/src/report-render.js --artifact report-order-not-shipped --format pdf --open
 *   node cli/src/report-render.js --artifact report-order-not-shipped --format html
 *   node cli/src/report-render.js --artifact <name> --client-id <id> --org-id <id>
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { createDbPool, closePool } from './db.js';
import { isMainModule } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = process.env.SF_ROOT || join(__dirname, '..', '..');

const JSREPORT_PORT = parseInt(process.env.JSREPORT_PORT, 10) || 5488;

// ---------------------------------------------------------------------------
// Query execution
// ---------------------------------------------------------------------------

/**
 * Parameterize hardcoded client/org IDs in the Jasper SQL.
 * Jasper templates often have IN ('1000000') for client/org — we replace
 * them with the actual values from the Etendo session.
 */
function parameterizeQuery(sql, { clientId, orgId }) {
  let q = sql;
  // Replace hardcoded AD_CLIENT_ID
  q = q.replace(/AD_CLIENT_ID\s+IN\s*\(\s*'[^']+'\s*\)/gi, `AD_CLIENT_ID IN ('${clientId}')`);
  // Replace hardcoded AD_ORG_ID — use org tree (org + children) or just the given org
  q = q.replace(/AD_ORG_ID\s+IN\s*\(\s*'[^']+'\s*\)/gi, `AD_ORG_ID IN (SELECT AD_ORG_ID FROM AD_ORG WHERE AD_CLIENT_ID = '${clientId}' AND ISACTIVE = 'Y')`);
  // Replace hardcoded AD_LANGUAGE
  q = q.replace(/AD_LANGUAGE\s*=\s*'[^']+'/gi, `AD_LANGUAGE = 'en_US'`);
  return q;
}

/**
 * Execute the report SQL query against the Etendo DB.
 */
async function executeReportQuery(pool, sql) {
  const { rows } = await pool.query(sql);
  return rows;
}

/**
 * Get client/org from DB defaults if not provided.
 */
async function resolveClientOrg(pool, clientId, orgId) {
  if (clientId && orgId) return { clientId, orgId };

  // Get the first active client that isn't System
  const { rows } = await pool.query(
    `SELECT ad_client_id, name FROM ad_client WHERE isactive = 'Y' AND ad_client_id != '0' ORDER BY name LIMIT 1`
  );
  const cId = clientId || rows[0]?.ad_client_id || '0';

  // Get first org for this client (not *)
  const orgResult = await pool.query(
    `SELECT ad_org_id, name FROM ad_org WHERE ad_client_id = $1 AND isactive = 'Y' AND ad_org_id != '0' ORDER BY name LIMIT 1`,
    [cId]
  );
  const oId = orgId || orgResult.rows[0]?.ad_org_id || '0';

  return { clientId: cId, orgId: oId };
}

// ---------------------------------------------------------------------------
// jsreport rendering
// ---------------------------------------------------------------------------

async function renderReport(templateContent, helpersCode, cssContent, rows, contract, format) {
  const recipeMap = {
    html: 'html',
    pdf: 'chrome-pdf',
    xlsx: 'html-to-xlsx',
    csv: 'text',
  };

  const recipe = recipeMap[format] || 'html';
  const title = contract.title?.en_US || contract.reportId;

  const payload = {
    template: {
      content: templateContent,
      engine: 'handlebars',
      recipe,
      helpers: helpersCode,
    },
    data: {
      css: cssContent,
      meta: {
        title,
        generatedAt: new Date().toISOString(),
        recordCount: rows.length,
        filters: [],
      },
      rows,
    },
  };

  if (recipe === 'chrome-pdf') {
    const isLandscape = contract.orientation === 'landscape';
    payload.template.chrome = {
      landscape: isLandscape,
      format: 'A4',
      marginTop: '10mm',
      marginBottom: '10mm',
      marginLeft: '10mm',
      marginRight: '10mm',
    };
  }

  const res = await fetch(`http://localhost:${JSREPORT_PORT}/api/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`jsreport ${res.status}: ${text.slice(0, 300)}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    artifact: null,
    format: 'html',
    clientId: null,
    orgId: null,
    open: false,
    limit: null,
  };
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === '--artifact' && argv[i + 1]) {
      opts.artifact = argv[i + 1];
      i += 2;
    } else if (a === '--format' && argv[i + 1]) {
      opts.format = argv[i + 1];
      i += 2;
    } else if (a === '--client-id' && argv[i + 1]) {
      opts.clientId = argv[i + 1];
      i += 2;
    } else if (a === '--org-id' && argv[i + 1]) {
      opts.orgId = argv[i + 1];
      i += 2;
    } else if (a === '--limit' && argv[i + 1]) {
      opts.limit = parseInt(argv[i + 1], 10);
      i += 2;
    } else if (a === '--open') {
      opts.open = true;
      i += 1;
    } else {
      i += 1;
    }
  }
  return opts;
}

const isMain = isMainModule(import.meta.url);

if (isMain) {
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.artifact) {
    console.error('Usage: report-render.js --artifact <name> [--format html|pdf|xlsx|csv] [--client-id <id>] [--org-id <id>] [--limit N] [--open]');
    process.exit(1);
  }

  const artifactDir = join(ROOT, 'artifacts', opts.artifact);

  // Load contract
  const contractPath = join(artifactDir, 'report-contract.json');
  if (!existsSync(contractPath)) {
    console.error(`[report-render] No contract found: ${contractPath}`);
    process.exit(1);
  }
  const contract = JSON.parse(await readFile(contractPath, 'utf8'));

  // Load template + helpers
  const templatePath = join(artifactDir, 'template.hbs');
  const helpersPath = join(artifactDir, 'helpers.js');
  if (!existsSync(templatePath)) {
    console.error(`[report-render] No template found: ${templatePath}. Run generate-report-template.js first.`);
    process.exit(1);
  }
  const templateContent = await readFile(templatePath, 'utf8');
  const helpersCode = existsSync(helpersPath) ? await readFile(helpersPath, 'utf8') : '';

  // Load CSS
  const cssPath = join(ROOT, 'templates', 'reports', 'base.css');
  const cssContent = existsSync(cssPath) ? await readFile(cssPath, 'utf8') : '';

  // Get SQL query from migration notes or contract
  const notesPath = join(artifactDir, 'migration-notes.md');
  let sql = '';
  if (contract.jasper?.originalFile) {
    // Parse jrxml to get the query
    try {
      const { parseJrxml } = await import('./extract-from-jasper.js');
      const jrxmlPath = join(ROOT, contract.jasper.originalFile);
      if (existsSync(jrxmlPath)) {
        const parsed = parseJrxml(await readFile(jrxmlPath, 'utf8'));
        sql = parsed.query;
      }
    } catch (e) {
      console.error(`[report-render] Failed to parse jrxml: ${e.message}`);
    }
  }

  if (!sql) {
    console.error('[report-render] No SQL query found in contract or jrxml. Cannot fetch data.');
    process.exit(1);
  }

  // Connect to DB
  const pool = createDbPool();
  try {
    const { clientId, orgId } = await resolveClientOrg(pool, opts.clientId, opts.orgId);
    console.log(`[report-render] Client: ${clientId} | Org: ${orgId}`);

    // Parameterize and execute query
    let query = parameterizeQuery(sql, { clientId, orgId });
    if (opts.limit) {
      query = query.replace(/;\s*$/, '') + ` LIMIT ${opts.limit}`;
    }

    console.log(`[report-render] Executing SQL (${query.length} chars)...`);
    const rows = await executeReportQuery(pool, query);
    console.log(`[report-render] Rows: ${rows.length}`);

    if (rows.length === 0) {
      console.warn('[report-render] No data returned. The report will be empty.');
      console.warn('[report-render] This may be because there are no orders awaiting delivery in this client/org.');
    }

    // Render via jsreport
    console.log(`[report-render] Rendering ${opts.format} via jsreport...`);
    const buffer = await renderReport(templateContent, helpersCode, cssContent, rows, contract, opts.format);

    // Write output
    const outputPath = join(artifactDir, `output.${opts.format}`);
    await writeFile(outputPath, buffer);
    console.log(`[report-render] Output: ${outputPath} (${(buffer.length / 1024).toFixed(1)} KB)`);

    if (opts.open) {
      const { execSync } = await import('node:child_process');
      const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
      try { execSync(`${cmd} "${outputPath}"`); } catch { /* ignore */ }
    }
  } finally {
    await closePool(pool);
  }
}
