#!/usr/bin/env node

/**
 * report-preview.js — Render a report template with mock data via local jsreport.
 *
 * Usage:
 *   node cli/src/report-preview.js --artifact <name> --report <type>
 *   node cli/src/report-preview.js --artifact business-partner --report listing
 *   node cli/src/report-preview.js --artifact bp --report listing --format xlsx
 *   node cli/src/report-preview.js --artifact bp --report listing --locale es_ES
 *   node cli/src/report-preview.js --artifact bp --report listing --port 5500
 *   node cli/src/report-preview.js --artifact bp --report listing --open
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { isMainModule } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = process.env.SF_ROOT || join(__dirname, '..', '..');

const DEFAULT_PORT = 5488;
const DEFAULT_LOCALE = 'en_US';
const DEFAULT_FORMAT = 'pdf';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Resolve an i18n label object to a string for the given locale.
 * Falls back to en_US if the requested locale is not available.
 *
 * @param {object|string} labelObj - e.g. { en_US: 'Name', es_ES: 'Nombre' } or plain string
 * @param {string} locale - e.g. 'en_US' or 'es_ES'
 * @returns {string}
 */
export function resolveLabel(labelObj, locale) {
  if (typeof labelObj === 'string') return labelObj;
  if (!labelObj || typeof labelObj !== 'object') return '';
  return labelObj[locale] ?? labelObj['en_US'] ?? Object.values(labelObj)[0] ?? '';
}

// ---------------------------------------------------------------------------
// Exported pure functions
// ---------------------------------------------------------------------------

/**
 * Parse CLI flags into an options object.
 *
 * @param {string[]} argv - argument list (e.g. process.argv.slice(2))
 * @returns {{ artifact: string, report: string, format: string, locale: string, data: string|null, port: number, open: boolean }}
 */
export function parsePreviewArgs(argv) {
  const opts = {
    artifact: null,
    report: null,
    format: DEFAULT_FORMAT,
    locale: DEFAULT_LOCALE,
    data: null,
    port: DEFAULT_PORT,
    open: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (isArtifactFlag(arg, argv, i)) {
      opts.artifact = argv[i + 1];
      i += 2;
    } else if (isReportFlag(arg, argv, i)) {
      opts.report = argv[i + 1];
      i += 2;
    } else if (isFormatFlag(arg, argv, i)) {
      opts.format = argv[i + 1];
      i += 2;
    } else if (isLocaleFlag(arg, argv, i)) {
      opts.locale = argv[i + 1];
      i += 2;
    } else if (isDataFlag(arg, argv, i)) {
      opts.data = argv[i + 1];
      i += 2;
    } else if (arg === '--port' && argv[i + 1]) {
      opts.port = parseInt(argv[i + 1], 10);
      i += 2;
    } else if (arg === '--open') {
      opts.open = true;
      i += 1;
    } else {
      i += 1;
    }
  }

  return opts;
}

function isDataFlag(arg, argv, i) {
  return arg === '--data' && argv[i + 1];
}

function isLocaleFlag(arg, argv, i) {
  return arg === '--locale' && argv[i + 1];
}

function isFormatFlag(arg, argv, i) {
  return arg === '--format' && argv[i + 1];
}

function isReportFlag(arg, argv, i) {
  return arg === '--report' && argv[i + 1];
}

function isArtifactFlag(arg, argv, i) {
  return arg === '--artifact' && argv[i + 1];
}

/**
 * Resolve all template-related file paths for a given artifact and report type.
 *
 * @param {string} root     - repository root directory
 * @param {string} artifact - artifact name (kebab-case)
 * @param {string} report   - report type identifier (e.g. 'listing')
 * @returns {{ template: string, css: string, overrideCss: string, mockData: string, helpers: string }}
 */
export function resolveTemplateFiles(root, artifact, report) {
  const artifactReportDir = join(root, 'artifacts', artifact, 'reports', report);
  const templatesReportDir = join(root, 'templates', 'reports');

  return {
    template: join(artifactReportDir, 'template.hbs'),
    css: join(templatesReportDir, 'base.css'),
    overrideCss: join(artifactReportDir, 'style.css'),
    mockData: join(artifactReportDir, 'mockData.js'),
    helpers: join(templatesReportDir, 'helpers', 'common.js'),
  };
}

/**
 * Build the jsreport API payload from a contract, row data, and rendering options.
 *
 * @param {object} contract         - report contract object
 * @param {Array}  rows             - array of row objects
 * @param {object} opts
 * @param {string} opts.locale          - locale string, e.g. 'en_US'
 * @param {string} opts.css             - combined CSS string (base + override)
 * @param {string} opts.templateContent - Handlebars template string
 * @returns {object} jsreport API payload
 */
export function buildJsreportPayload(contract, rows, { locale, css, templateContent, helpersCode }) {
  // Resolve recipe — use html for preview (no Chrome dependency), chrome-pdf for production
  const recipe = 'html';

  // Resolve i18n for columns
  const columns = (contract.columns ?? []).map(col => ({
    key: col.field,
    label: resolveLabel(col.label, locale),
    type: col.type,
    width: col.width,
    sortable: col.sortable ?? false,
  }));

  // Resolve i18n title
  const title = resolveLabel(contract.title, locale);

  // Build summary
  const summary = {};
  if (contract.summary?.totalRows) {
    summary.totalRows = rows.length;
  }

  const payload = {
    template: {
      content: templateContent,
      engine: 'handlebars',
      recipe,
    },
    data: {
      css,
      meta: {
        title,
        generatedAt: new Date().toISOString(),
        locale,
        filters: [],
        truncated: false,
      },
      columns,
      rows,
      summary,
    },
  };

  // Include Handlebars helpers code for jsreport to register
  if (helpersCode) {
    payload.template.helpers = helpersCode;
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Runtime helpers (not unit-tested — depend on I/O and network)
// ---------------------------------------------------------------------------

/**
 * POST a jsreport payload and return the response buffer.
 *
 * @param {object} payload - jsreport API payload
 * @param {number} port    - jsreport server port
 * @returns {Promise<Buffer>}
 */
export async function renderReport(payload, port) {
  const url = `http://localhost:${port}/api/report`;

  // Use native fetch (Node.js 18+)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`jsreport error ${response.status}: ${text}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const isMain = isMainModule(import.meta.url);

if (isMain) {
  const opts = parsePreviewArgs(process.argv.slice(2));

  if (!opts.artifact || !opts.report) {
    console.error(
      'Usage: report-preview.js --artifact <name> --report <type> [--format pdf|xlsx] [--locale en_US] [--port 5488] [--open]'
    );
    process.exit(1);
  }

  const files = resolveTemplateFiles(ROOT, opts.artifact, opts.report);

  // Load contract
  const contractPath = join(ROOT, 'artifacts', opts.artifact, 'report-contract.json');
  let contract;
  try {
    const raw = await readFile(contractPath, 'utf8');
    contract = JSON.parse(raw);
  } catch {
    console.error(`[report-preview] No report-contract.json found at ${contractPath}`);
    process.exit(1);
  }

  // Load template
  let templateContent = '';
  try {
    templateContent = await readFile(files.template, 'utf8');
  } catch {
    console.warn(`[report-preview] Template not found: ${files.template} — using empty template`);
  }

  // Load CSS
  let baseCss = '';
  try {
    baseCss = await readFile(files.css, 'utf8');
  } catch {
    console.warn(`[report-preview] Base CSS not found: ${files.css}`);
  }

  let overrideCss = '';
  if (existsSync(files.overrideCss)) {
    try {
      overrideCss = await readFile(files.overrideCss, 'utf8');
    } catch {
      // Optional — ignore if missing
    }
  }

  const combinedCss = [baseCss, overrideCss].filter(Boolean).join('\n');

  // Load mock data (ESM dynamic import)
  let rows = [];
  try {
    const mockModule = await import(files.mockData);
    rows = mockModule.default ?? mockModule.rows ?? [];
  } catch {
    console.warn(`[report-preview] No mockData.js found at ${files.mockData} — using empty rows`);
  }

  // Override rows from --data file if provided
  if (opts.data) {
    try {
      const raw = await readFile(opts.data, 'utf8');
      rows = JSON.parse(raw);
    } catch (err) {
      console.error(`[report-preview] Failed to load data file: ${err.message}`);
      process.exit(1);
    }
  }

  // Load Handlebars helpers code for jsreport
  let helpersCode = '';
  try {
    const helpersPath = join(ROOT, 'templates', 'reports', 'helpers', 'jsreport-helpers.js');
    helpersCode = await readFile(helpersPath, 'utf8');
  } catch {
    console.warn('[report-preview] No jsreport-helpers.js found — helpers will not be available in template');
  }

  const payload = buildJsreportPayload(contract, rows, {
    locale: opts.locale,
    css: combinedCss,
    templateContent,
    helpersCode,
  });

  console.log(`[report-preview] Rendering via jsreport at port ${opts.port}...`);
  console.log(`[report-preview] Artifact: ${opts.artifact} | Report: ${opts.report} | Locale: ${opts.locale}`);
  console.log(`[report-preview] Rows: ${rows.length}`);

  let buffer;
  try {
    buffer = await renderReport(payload, opts.port);
  } catch (err) {
    console.error(`[report-preview] Render failed: ${err.message}`);
    console.error('[report-preview] Is jsreport running? Try: node cli/src/report-serve.js --detach');
    process.exit(1);
  }

  // Write output file
  const outFile = join(ROOT, 'artifacts', opts.artifact, 'reports', opts.report, `preview.${opts.format}`);
  await writeFile(outFile, buffer);
  console.log(`[report-preview] Output written to ${outFile}`);

  // Optionally open the file
  if (opts.open) {
    const { execSync } = await import('node:child_process');
    const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    try {
      execSync(`${openCmd} "${outFile}"`);
    } catch {
      console.warn('[report-preview] Could not auto-open file.');
    }
  }
}
