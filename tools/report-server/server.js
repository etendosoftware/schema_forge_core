/**
 * report-server.js — Standalone HTTP server for the report API.
 *
 * Handles:
 *   GET  /api/reports                       — list available reports
 *   GET  /api/reports/:id/data              — execute SQL and return JSON rows
 *   POST /api/reports/:id/render            — render via jsreport (HTML/PDF/XLSX)
 *   GET  /api/report-selectors/:type        — selector search (BP, Product, Org…)
 *   GET  /api/ping                          — health check
 *
 * Config via environment variables:
 *   PORT            HTTP port (default 3001)
 *   JSREPORT_URL    jsreport base URL (default http://localhost:5488)
 *   ETENDO_URL      Etendo Tomcat base URL for NEO calls (default http://localhost:8080/etendo)
 *   BBDD_HOST       PostgreSQL host
 *   BBDD_PORT       PostgreSQL port (default 5432)
 *   BBDD_USER       PostgreSQL user
 *   BBDD_PASSWORD   PostgreSQL password
 *   BBDD_SID        PostgreSQL database name
 */

import http from 'node:http';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerReportHelpers, computeDocumentQrDataUrl, buildJsreportHelpersString } from '../../templates/reports/helpers/report-html-helpers.js';
import { listReportDescriptors } from '../../cli/src/report-descriptor.js';
import { pickLabel, pickUiStrings, buildContractLabels } from '../../cli/src/report-i18n.js';
import { resolveGrouping, buildNestedGroups, buildAccountReportTree } from '../../cli/src/report-grouping.js';
import { applyPlaceholders } from '../../cli/src/report-sql.js';
import { filterAndTransformParams } from '../../cli/src/report-filters.js';
import { hydrateDocumentBranding, resolveCompanyLogoDataUrl } from '../../cli/src/report-branding.js';

const _require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = Number.parseInt(process.env.PORT) || 3001;
const JSREPORT_URL = process.env.JSREPORT_URL || 'http://localhost:5488';
const ETENDO_URL = process.env.ETENDO_URL || 'http://localhost:8080/etendo';

const ARTIFACTS_DIR = resolve(__dirname, '../../artifacts');
const ROOT = resolve(ARTIFACTS_DIR, '..');
const REPORT_PARTIALS_DIR = resolve(ROOT, 'templates', 'reports');

// `{{> document-branding}}` string-replace expansion (ETP-4998 / ETP-5013
// follow-up) — ported from the Vite dev plugin (report-api.js), which was the
// ONLY engine that ever had this. Without it, a print-* template's raw
// `{{> document-branding}}` text reaches Handlebars.compile() unexpanded —
// and Handlebars throws "The partial document-branding could not be found"
// for an unregistered `{{> }}` reference (verified), it does not render
// blank. Not a native Handlebars partial on purpose (see report-api.js's own
// comment): this keeps the jsreport payload a single self-contained string,
// no partial registration needed on jsreport's side either.
function expandReportPartials(templateContent) {
  const brandingPartial = readFileSync(join(REPORT_PARTIALS_DIR, 'document-branding.hbs'), 'utf8');
  return templateContent.replace(/\{\{>\s*document-branding\s*\}\}/g, brandingPartial);
}

function getDbConfig() {
  const cfg = {
    host: process.env.BBDD_HOST || 'localhost',
    port: Number.parseInt(process.env.BBDD_PORT) || 5432,
    user: process.env.BBDD_USER,
    password: process.env.BBDD_PASSWORD,
    database: process.env.BBDD_SID,
    max: 3,
  };
  // RDS requires SSL; skip certificate verification (self-signed RDS cert)
  if (process.env.BBDD_HOST?.includes('rds.amazonaws.com')) {
    cfg.ssl = { rejectUnauthorized: false };
  }
  return cfg;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Instance-wide currency separators for the jsreport helper string, from the
// same NEO config source the browser's formatCurrency.js reads (ETP-4314).
// Cached for the process lifetime; falls back to './,' when NEO is unreachable.
// Mirrors getReportCurrencySeparators() in the Vite dev plugin (report-api.js).
let currencySeparatorsPromise = null;
async function getReportCurrencySeparators() {
  if (currencySeparatorsPromise) return currencySeparatorsPromise;
  currencySeparatorsPromise = fetch(`${ETENDO_URL}/sws/neo/currency-format`)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`status ${res.status}`))))
    .then((data) => ({
      thousandsSeparator: typeof data?.thousandsSeparator === 'string' ? data.thousandsSeparator : '.',
      decimalSeparator: typeof data?.decimalSeparator === 'string' ? data.decimalSeparator : ',',
    }))
    .catch(() => ({ thousandsSeparator: '.', decimalSeparator: ',' }));
  return currencySeparatorsPromise;
}

function getClientIdFromToken(authHeader) {
  try {
    const token = (authHeader || '').replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return payload.client || null;
  } catch { return null; }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// Report manifest
// ---------------------------------------------------------------------------

// Delegates to the canonical descriptor module — this function used to keep its
// own copy of the field list and silently dropped `sections`, so servers served
// a report list the frontend couldn't build its accordion sidebar from while
// every dev machine looked fine. See cli/src/report-descriptor.js.
function listReports() {
  return listReportDescriptors(ARTIFACTS_DIR);
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchReportData(reportId, { limit, authToken, params = {}, locale } = {}) {
  const contractPath = join(ARTIFACTS_DIR, reportId, 'report-contract.json');
  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));

  // NEO API path
  if (contract.neo?.endpoint) {
    if (!authToken) throw new Error('No auth token');
    const neoUrl = `${ETENDO_URL}${contract.neo.endpoint}`;
    const neoBody = { ...contract.neo.body, ...params };
    const neoRes = await fetch(neoUrl, {
      method: contract.neo.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        // Same as the dev plugin's copy (report-api.js) — see its comment for the
        // full rationale (ETP-5013). Kept byte-identical in behaviour on purpose:
        // a header sent only by the dev engine would translate reports locally and
        // silently leave every server rendering the wrong language.
        ...(locale ? { 'Accept-Language': locale } : {}),
      },
      body: JSON.stringify(neoBody),
    });
    if (!neoRes.ok) {
      const text = await neoRes.text().catch(() => '');
      throw new Error(`NEO ${neoRes.status}: ${text.slice(0, 200)}`);
    }
    const data = await neoRes.json();
    let rows = extractRowsFromData(data, contract, limit);
    let neoMeta = extractNeoMeta(contract, data);

    // Company logo (ETP-5013) — missed in the first pass: this branch has no
    // DB access at all (NEO does the data fetch remotely), so the SQL/Jasper
    // branch's orgId-based lookup below never ran for the 4 NEO-sourced
    // listing reports (Aging of Payables/Receivables, Tax Report, Inventory
    // Stock Report) — the logo silently never resolved for any of them. Opens
    // a short-lived pool just for this lookup, same per-request-Pool pattern
    // every other branch already uses.
    const pg = await import('pg');
    const logoPool = new pg.default.Pool(getDbConfig());
    let companyLogoDataUrl;
    try {
      const clientId = getClientIdFromToken(`Bearer ${authToken}`) || '0';
      companyLogoDataUrl = await resolveCompanyLogoDataUrl(logoPool, {
        clientId, orgId: params.orgId, authToken, etendoBase: ETENDO_URL,
      });
    } finally {
      await logoPool.end();
    }

    return { rows, contract, neoMeta, companyLogoDataUrl };
  }

  // Document type (header + lines + taxes)
  if (contract.type === 'document' && contract.sql?.header) {
    const pg = await import('pg');
    const pool = new pg.default.Pool(getDbConfig());
    try {
      const replace = (sql) => {
        let q = sql;
        for (const [k, v] of Object.entries(params)) {
          if (v) q = q.replace(new RegExp(`__${k.toUpperCase()}__`, 'g'), String(v).replaceAll('\'', "''"));
        }
        return q;
      };
      // Company logo (ETP-4998 / ETP-5013 follow-up) — this branch used to
      // read the header SQL as-is, with no org_logo_id and no branding call
      // at all. Ported from the Vite dev plugin (report-api.js), which was
      // the ONLY engine that ever had this: every print-* document rendered
      // through THIS server threw "The partial document-branding could not
      // be found" (verified: Handlebars throws on an unregistered `{{> }}`,
      // it doesn't render blank) because expandReportPartials() below never
      // ran either. Same fallback as report-api.js: only auto-inject the
      // subquery when the contract's own header SQL doesn't already expose
      // org_logo_id itself.
      const headerSql = replace(contract.sql.header);
      const brandedHeaderSql = headerSql.includes('org_logo_id')
        ? headerSql
        : headerSql.replace(/^SELECT\s+/i,
          'SELECT (SELECT oi.your_company_document_image FROM ad_orginfo oi WHERE oi.ad_org_id = org.ad_org_id) AS org_logo_id, ');
      const headerResult = await pool.query(brandedHeaderSql);
      const header = await hydrateDocumentBranding(headerResult.rows[0] || {}, {
        authToken,
        etendoBase: process.env.ETENDO_URL || 'http://localhost:8080/etendo',
      });
      const linesResult = await pool.query(replace(contract.sql.lines));
      const lines = linesResult.rows;
      let taxes = [];
      if (contract.sql.taxes) {
        const taxResult = await pool.query(replace(contract.sql.taxes));
        taxes = taxResult.rows;
      }
      return { rows: lines, contract, documentData: { header, lines, taxes } };
    } finally {
      await pool.end();
    }
  }

  // SQL / Jasper path
  let sql = await buildReportSql(contract, reportId, authToken, params, locale);

  sql = injectDateFilters(contract, params, sql);

  sql = applyLimitToSql(limit, sql);

  // Same client the main query was scoped to — the secondary queries below must
  // not resolve it independently, or they could annotate one client's rows with
  // another's data.
  const clientId = getClientIdFromToken(`Bearer ${authToken}`) || '0';

  const pg = await import('pg');
  const pool = new pg.default.Pool(getDbConfig());
  try {
    const { rows } = await pool.query(sql);

    // Optional secondary queries. Libro Mayor's "Initial Balance" (openingQuery,
    // ETP-4898) and Profit & Loss's computed formula nodes (operandsQuery,
    // ETP-4899) are declared per report in its contract. They were never run
    // here, so the account trees and opening balances had no data to render
    // server-side even once the functions that build them were available.
    // Same placeholder rules as the main query, no LIMIT — both are already
    // aggregated in SQL.
    let openingRows = null;
    if (contract.sql?.openingQuery) {
      openingRows = (await pool.query(
        applyPlaceholders(contract.sql.openingQuery, { clientId, params, contract, locale }))).rows;
    }
    let operandRows = null;
    if (contract.sql?.operandsQuery) {
      operandRows = (await pool.query(
        applyPlaceholders(contract.sql.operandsQuery, { clientId, params, contract, locale }))).rows;
    }

    // Company logo for listing reports (ETP-5013) — same shared orgId/clientId
    // lookup as report-api.js: no `header` object exists for listing reports,
    // so this falls back to the client's own logo when the report has no
    // `orgId` filter (e.g. Inventory Stock Report, Order Not Shipped).
    const companyLogoDataUrl = await resolveCompanyLogoDataUrl(pool, {
      clientId, orgId: params.orgId, authToken,
      etendoBase: process.env.ETENDO_URL || 'http://localhost:8080/etendo',
    });

    return { rows, contract, openingRows, operandRows, companyLogoDataUrl };
  } finally {
    await pool.end();
  }
}

function applyLimitToSql(limit, sql) {
  if (limit) sql = sql.replace(/;\s*$/, '') + ` LIMIT ${Number.parseInt(limit, 10)}`;
  return sql;
}

function injectDateFilters(contract, params, sql) {
  if (contract.jasper?.originalFile) {
    const dateParams = (contract.parameters || []).filter(p => p.type === 'date');
    const extraClauses = [];
    applyDateFilters(dateParams, params, contract, sql, extraClauses);
    if (extraClauses.length > 0) {
      const insertPoint = sql.search(/\bGROUP\s+BY\b/i);
      if (insertPoint > 0) sql = sql.slice(0, insertPoint) + 'AND ' + extraClauses.join(' AND ') + '\n' + sql.slice(insertPoint);
      else {
        const orderPoint = sql.search(/\bORDER\s+BY\b/i);
        if (orderPoint > 0) sql = sql.slice(0, orderPoint) + 'AND ' + extraClauses.join(' AND ') + '\n' + sql.slice(orderPoint);
      }
    }
  }
  return sql;
}

function applyDateFilters(dateParams, params, contract, sql, extraClauses) {
  for (const p of dateParams) {
    const val = params[p.name];
    if (!val) continue;
    const col = p.column || contract.jasper.dateColumn
      || (sql.match(/\b(\w+\.)?DATEORDERED\b/i)?.[0])
      || (sql.match(/\b(\w+\.)?DATEACCT\b/i)?.[0])
      || 'DATEACCT';
    const escaped = String(val).replaceAll('\'', "''");
    if (p.name.toLowerCase().includes('from')) extraClauses.push(`${col} >= '${escaped}'::date`);
    else if (p.name.toLowerCase().includes('to')) extraClauses.push(`${col} <= '${escaped}'::date`);
  }
}

async function buildReportSql(contract, reportId, authToken, params, locale) {
  let sql = contract.sql?.query || null;

  if (!sql && contract.jasper?.originalFile) {
    const jrxmlPath = resolve(ROOT, contract.jasper.originalFile);
    if (!existsSync(jrxmlPath)) throw new Error(`JRXML not found: ${jrxmlPath}`);
    const extractorPath = resolve(ROOT, 'cli/src/extract-from-jasper.js');
    const { parseJrxml } = await import(extractorPath);
    const parsed = parseJrxml(readFileSync(jrxmlPath, 'utf8'));
    sql = parsed.query;
  }

  if (!sql) throw new Error(`No data source configured for report '${reportId}'`);

  const clientId = getClientIdFromToken(`Bearer ${authToken}`) || '0';
  return applyPlaceholders(sql, { clientId, params, contract, locale });
}



function extractNeoMeta(contract, data) {
  let neoMeta = {};
  if (contract.neo.dataPath) {
    const pathParts = contract.neo.dataPath.split('.');
    const metaParts = [...pathParts.slice(0, -1), 'meta'];
    let metaObj = data;
    for (const key of metaParts) metaObj = metaObj?.[key];
    if (metaObj && typeof metaObj === 'object') neoMeta = metaObj;
  }
  return neoMeta;
}

function extractRowsFromData(data, contract, limit) {
  let rows = data;
  if (contract.neo.dataPath) {
    for (const key of contract.neo.dataPath.split('.')) rows = rows?.[key];
  }
  if (limit && Array.isArray(rows)) rows = rows.slice(0, Number.parseInt(limit, 10));
  return rows;
}

// ---------------------------------------------------------------------------
// Report data resolution
// ---------------------------------------------------------------------------

/**
 * Turns fetchReportData's flat SQL result into what the template needs to
 * render: the account tree (when the contract declares operandsQuery), then
 * the groupBy dimension resolution. Extracted out of handleRequest's render
 * branch — pure sequencing, no behavior change — because inlining both steps
 * there pushed handleRequest's cognitive complexity past the Sonar budget.
 */
function resolveReportData(result, params, locale) {
  let { rows } = result;
  const { contract, operandRows, openingRows } = result;

  // Account-report tree reports (ETP-4899 — Profit & Loss, Balance Sheet): the
  // SQL returns the FLAT node list, and the indented tree (roll-up, formula
  // nodes, account-level cutoff) is assembled here, replacing `rows` so
  // recordCount/totals and the Excel/CSV templates keep working unchanged.
  if (contract.sql?.operandsQuery !== undefined && Array.isArray(rows)) {
    rows = buildAccountReportTree(rows, operandRows, {
      accountLevel: params.accountLevel || 'S',
      showOnlyWithValue: params.showOnlyAccountsWithValue === 'true',
    });
  }

  const grouped = resolveGrouping(contract, params, rows, locale);
  return { ...grouped, openingRows };
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

/**
 * Handles POST /api/reports/:id/render — resolves the report data, builds the
 * template data and either renders HTML locally or delegates to jsreport for
 * PDF/XLSX/CSV. Extracted out of handleRequest, whose own job is now just
 * routing: the try/catch and branching that belong to this ONE route were
 * counted against handleRequest's cognitive complexity budget even though
 * every other route here is a plain two-line if/return.
 */
async function renderReport(renderMatch, req, res) {
  const reportId = renderMatch[1];
  const body = await readBody(req);
  const { format = 'html', limit, params = {}, locale = 'en_US' } = JSON.parse(body || '{}');

  try {
    const authToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const result = await fetchReportData(reportId, { limit, authToken, params, locale });
    const { contract, documentData, neoMeta = {}, companyLogoDataUrl } = result;
    const {
      rows, groupLabel, descriptionLabel, dimensionLabel, dimensionField, tbGroups, openingRows,
    } = resolveReportData(result, params, locale);

    const activeFilters = filterAndTransformParams(params, contract, locale);

    const artifactDir = join(ARTIFACTS_DIR, reportId);
    // Excel/CSV get their own flat, calculation-friendly template when the report
    // declares one (ETP-4898). Both recipes render whatever markup/text they're given —
    // reusing the HTML/PDF template (grouped bands, formatted amounts, full <style>
    // block) makes a .xlsx that can't be summed/pivoted, and for CSV (recipe 'text',
    // which streams the compiled template output byte-for-byte) it means the ENTIRE
    // rendered HTML page — <style>, <div>s and all — gets dumped verbatim into a .csv
    // file. Falls back to the shared template.hbs otherwise — reports without a
    // per-format template are unaffected.
    //
    // Ported verbatim from the dev plugin (schema_forge's report-api.js, the
    // `perFormatTemplateFile` block) — ETP-4898 only ever landed there, so every
    // SERVER-rendered Excel/CSV silently kept coming out of the screen template
    // while local dev looked correct. Same divergence class the module docstring
    // of report-sql.js warns about: an engine-level rule implemented in one of the
    // two render paths is a rule that does not reach production. Keep the two in
    // sync; better still, hoist into a shared module the next time this is touched.
    const perFormatTemplateFile = { xlsx: 'template-excel.hbs', csv: 'template-csv.hbs' }[format];
    const perFormatTemplatePath = perFormatTemplateFile ? join(artifactDir, perFormatTemplateFile) : null;
    const templatePath = (perFormatTemplatePath && existsSync(perFormatTemplatePath))
      ? perFormatTemplatePath
      : join(artifactDir, 'template.hbs');
    const templateContent = expandReportPartials(readFileSync(templatePath, 'utf8'));
    const helpersPath = join(artifactDir, 'helpers.js');
    const helpersCode = loadHelpersFromFile(helpersPath);
    const cssPath = join(ROOT, 'templates', 'reports', 'base.css');
    const css = readCssFile(cssPath);

    const recipeMap = { html: 'html', pdf: 'chrome-pdf', xlsx: 'html-to-xlsx', csv: 'text' };
    const recipe = recipeMap[format] || 'html';
    const title = pickLabel(contract.title, locale, reportId);

    const amountCols = (contract.columns || []).filter(c => c.type === 'amount');
    const totals = {};
    calculateTotals(documentData, amountCols, rows, totals);
    const recordCount = getRowCount(rows);
    const ui = pickUiStrings(locale);
    const labels = buildContractLabels(contract, locale);
    // Always built (ETP-4898): every account — grouped by a dimension or not —
    // needs its opening balance / running balance / subtotal / total, so both
    // the flat and nested-card templates read the same `meta.groups` shape.
    const groups = (!documentData && Array.isArray(rows))
      ? buildNestedGroups(rows, dimensionField, openingRows)
      : null;
    // isInteractive (ETP-5013) — true only for the on-screen preview (the
    // app's own iframe, where a drill-down span's onclick postMessage reaches
    // a listening parent window). PDF/Excel/CSV are static exports where the
    // same onclick does nothing, so link-styled (blue/underlined) drill-down
    // controls only render that way when this is true — see report-*'s own
    // `{{#if meta.isInteractive}}` guard around each `.xxx-link` CSS rule.
    const isInteractive = format === 'html' || format === 'preview';
    const templateData = buildTemplateData(documentData, css, { title, activeFilters, params, recordCount, totals, groupLabel, descriptionLabel, neoMeta, rows, locale, ui, labels, dimensionLabel, dimensionField, groups, tbGroups, companyLogoDataUrl, isInteractive });
    await injectDocumentQr(documentData, templateData);
    // HTML: render with Handlebars locally
    if (format === 'html') {
      renderTemplateWithHelpers(helpersCode, templateContent, templateData, res);
      return;
    }

    // PDF/XLSX: delegate to jsreport. jsreport runs in a separate container
    // with its own sandbox, so it gets the canonical helper set as SOURCE
    // TEXT plus only this report's specific extras — never the raw artifact
    // helpers.js alone (post-ETP-4083 it no longer defines the formatting
    // helpers, which broke every {{#ifCond}}/{{formatDate}} template here).
    // Same composition as the Vite dev plugin (report-api.js).
    const separators = await getReportCurrencySeparators();
    const payload = {
      template: { content: templateContent, engine: 'handlebars', recipe, helpers: buildJsreportHelpersString(helpersCode, undefined, separators) },
      data: templateData,
    };
    if (recipe === 'chrome-pdf') {
      // "Printed on <date>" + "Page N" footer (ETP-5013), matching Classic's own
      // JasperReports footer layout exactly (verified against a real Classic PDF
      // export). headerTemplate/footerTemplate are plain Puppeteer HTML, NOT
      // Handlebars — jsreport's chrome-pdf recipe forwards them straight to
      // Chrome's page.pdf(), so the label/date text below is interpolated with
      // plain JS before the request is built; only `pageNumber` is a live
      // per-page value Chrome itself replaces (Classic doesn't show a page total
      // either, so neither do we). headerTemplate is an empty span on purpose:
      // displayHeaderFooter alone would otherwise show Chrome's default header
      // (page URL + system date). Same shape as the Vite dev plugin (report-api.js).
      const printedOnDate = new Date(templateData.meta.generatedAt);
      const printedOnStr = isNaN(printedOnDate.getTime()) ? '' :
        new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(printedOnDate);
      payload.template.chrome = {
        landscape: contract.orientation === 'landscape' || params.showLandscape === 'true',
        // marginBottom bumped from 10mm to 14mm (ETP-5013) to leave room for
        // the footer below — otherwise Chrome's native footer can overlap the
        // last table row on a full page.
        format: 'A4', marginTop: '10mm', marginBottom: '14mm', marginLeft: '10mm', marginRight: '10mm',
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: `<div style="width:100%;font-size:8px;color:#94a3b8;font-family:Arial,sans-serif;padding:0 10mm;display:flex;justify-content:space-between;box-sizing:border-box;"><span>${ui.printedOn} ${printedOnStr}</span><span>${ui.page} <span class="pageNumber"></span></span></div>`,
      };
    }

    const jsRes = await fetch(`${JSREPORT_URL}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!jsRes.ok) {
      const text = await jsRes.text();
      throw new Error(`jsreport ${jsRes.status}: ${text.slice(0, 200)}`);
    }

    const contentType = jsRes.headers.get('content-type') || 'text/html';
    const buffer = Buffer.from(await jsRes.arrayBuffer());
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(buffer);

  } catch (e) {
    console.error('[render]', e.message);
    json(res, 500, { error: e.message });
  }
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost`);
  const path = url.pathname;
  const method = req.method;

  // CORS for same-origin calls from the SPA
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (method === 'OPTIONS') {
    res.writeHead(204); res.end();
    return;
  }

  // Health check
  if (path === '/api/ping') {
    res.writeHead(200); res.end('pong');
    return;
  }

  // GET /api/reports
  if (isGetReportsRequest(method, path)) {
    getReportsList(res);
    return;
  }

  // GET /api/reports/:id/data
  const dataMatch = new RegExp(/^\/api\/reports\/([\w-]+)\/data$/).exec(path);
  if (isGetDataRequest(method, dataMatch)) {
    await fetchReportDataById(dataMatch, url, req, res);
    return;
  }

  // POST /api/reports/:id/render
  const renderMatch = new RegExp(/^\/api\/reports\/([\w-]+)\/render$/).exec(path);
  if (isPostRequestForRender(method, renderMatch)) {
    await renderReport(renderMatch, req, res);
    return;
  }

  // GET /api/report-selectors/:type
  const selectorMatch = matchReportSelectorRequest(method, path);
  if (selectorMatch) {
    await fetchReportSelectors(selectorMatch, url, req, res);
    return;
  }

  res.writeHead(404); res.end('Not found');
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (e) {
    console.error('[server]', e.message);
    if (!res.headersSent) json(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`[report-server] Listening on :${PORT}`);
  console.log(`[report-server] JSREPORT_URL=${JSREPORT_URL}`);
  console.log(`[report-server] ETENDO_URL=${ETENDO_URL}`);
  console.log(`[report-server] ARTIFACTS_DIR=${ARTIFACTS_DIR}`);
});
function buildTemplateData(documentData, css, { title, activeFilters, params, recordCount, totals, groupLabel, descriptionLabel, neoMeta, rows, locale, ui, labels, dimensionLabel, dimensionField, groups, tbGroups, companyLogoDataUrl, isInteractive }) {
  // `locale`/`ui`/`labels` go into BOTH branches on purpose: print-* document
  // reports render their own headings from meta.labels just like listings do,
  // and that branch is the easy one to forget.
  if (documentData) {
    return { css, meta: { title, generatedAt: new Date().toISOString(), filters: activeFilters, params, locale, ui, labels, isInteractive }, header: documentData.header, lines: documentData.lines, taxes: documentData.taxes };
  }
  // companyLogoDataUrl (ETP-5013) only applies to this branch — document
  // reports carry their own logo on `header.companyLogoDataUrl` instead, set
  // above by hydrateDocumentBranding() before documentData was built.
  return { css, meta: { title, generatedAt: new Date().toISOString(), recordCount, filters: activeFilters, params, locale, ui, labels, totals, groupLabel, descriptionLabel, dimensionLabel, dimensionField, groups, tbGroups, companyLogoDataUrl, isInteractive, ...neoMeta }, rows };
}


function readCssFile(cssPath) {
  return existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : '';
}

function loadHelpersFromFile(helpersPath) {
  return existsSync(helpersPath) ? readFileSync(helpersPath, 'utf8') : '';
}

function calculateTotals(documentData, amountCols, rows, totals) {
  if (!documentData && amountCols.length && Array.isArray(rows)) {
    for (const col of amountCols) totals[col.field] = rows.reduce((sum, r) => sum + (Number(r[col.field]) || 0), 0);
  }
}

function matchReportSelectorRequest(method, path) {
  if (method !== 'GET') return null;
  return path.match(/^\/api\/report-selectors\/([\w-]+)$/);
}

async function fetchReportSelectors(selectorMatch, url, req, res) {
  const type = selectorMatch[1];
  const q = (url.searchParams.get('q') || '').trim();
  const limit = Math.max(1, Math.min(Number.parseInt(url.searchParams.get('limit') || '20', 10), 100));
  const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') || '0', 10));
  const selectedOrgId = url.searchParams.get('selectedOrgId') || '';
  const selectedAcctSchemaId = url.searchParams.get('selectedAcctSchemaId') || '';
  const selectedWarehouseIds = (url.searchParams.get('warehouseIds') || '').split(',').map(s => s.trim()).filter(Boolean);
  const roleOrgIds = (url.searchParams.get('roleOrgIds') || '').split(',').map(s => s.trim()).filter(Boolean);

  try {
    const clientId = getClientIdFromToken(req.headers.authorization);
    const byClient = (col) => clientId ? `AND ${col} = '${clientId}'` : '';

    const queries = {
      bpartner: { select: `SELECT c_bpartner_id AS id, name, name AS label`, fromWhere: `FROM c_bpartner WHERE isactive='Y' ${byClient('ad_client_id')} AND name ILIKE $1`, orderBy: 'ORDER BY name' },
      product: { select: `SELECT m_product_id AS id, value AS "searchKey", name, value || ' - ' || name AS label`, fromWhere: `FROM m_product WHERE isactive='Y' ${byClient('ad_client_id')} AND (name ILIKE $1 OR value ILIKE $1)`, orderBy: 'ORDER BY value, name' },
      warehouse: { select: `SELECT m_warehouse_id AS id, name, name AS label`, fromWhere: `FROM m_warehouse WHERE isactive='Y' ${byClient('ad_client_id')} AND name ILIKE $1`, orderBy: 'ORDER BY name' },
      project: { select: `SELECT c_project_id AS id, name, name AS label`, fromWhere: `FROM c_project WHERE isactive='Y' ${byClient('ad_client_id')} AND name ILIKE $1`, orderBy: 'ORDER BY name' },
      costcenter: { select: `SELECT c_costcenter_id AS id, name, name AS label`, fromWhere: `FROM c_costcenter WHERE isactive='Y' ${byClient('ad_client_id')} AND name ILIKE $1`, orderBy: 'ORDER BY name' },
      org: { select: `SELECT ad_org_id AS id, name, name AS label`, fromWhere: `FROM ad_org WHERE isactive='Y' AND ad_org_id != '0' ${byClient('ad_client_id')} AND name ILIKE $1`, orderBy: 'ORDER BY name' },
      account: { select: `SELECT ev.value AS id, ev.value || ' - ' || ev.name AS name, ev.value || ' - ' || ev.name AS label`, fromWhere: `FROM c_elementvalue ev WHERE ev.isactive='Y' AND ev.issummary='N' ${byClient('ev.ad_client_id')} AND (ev.value ILIKE $1 OR ev.name ILIKE $1)`, orderBy: 'ORDER BY ev.value' },
      acctschema: { select: `SELECT c_acctschema_id AS id, name, name AS label`, fromWhere: `FROM c_acctschema WHERE isactive='Y' ${byClient('ad_client_id')} AND name ILIKE $1`, orderBy: 'ORDER BY name' },
      currency: { select: `SELECT c_currency_id AS id, iso_code AS name, iso_code || ' - ' || description AS label`, fromWhere: `FROM c_currency WHERE isactive='Y' AND (iso_code ILIKE $1 OR description ILIKE $1)`, orderBy: clientId ? `ORDER BY (CASE WHEN c_currency_id = (SELECT c_currency_id FROM ad_client WHERE ad_client_id = '${clientId}') THEN 0 ELSE 1 END), iso_code` : 'ORDER BY iso_code' },
      tax: { select: `SELECT c_tax_id AS id, name, name AS label`, fromWhere: `FROM c_tax WHERE isactive='Y' ${byClient('ad_client_id')} AND name ILIKE $1`, orderBy: 'ORDER BY name' },
      year: { select: `SELECT y.c_year_id AS id, y.year || ' (' || c.name || ')' AS name, y.year || ' (' || c.name || ')' AS label`, fromWhere: `FROM c_year y JOIN c_calendar c ON c.c_calendar_id = y.c_calendar_id WHERE y.isactive='Y' ${byClient('y.ad_client_id')} AND (y.year || ' (' || c.name || ')') ILIKE $1`, orderBy: 'ORDER BY y.year DESC' },
    };
    // accounting is alias of acctschema
    queries.accounting = queries.acctschema;

    const queryCfg = queries[type];
    if (!queryCfg) throw new Error(`Unknown selector type: ${type}`);

    const values = [`%${q}%`];
    const whereFragments = [queryCfg.fromWhere];

    if (type === 'year' && selectedOrgId) {
      values.push(selectedOrgId);
      whereFragments.push(`AND EXISTS (SELECT 1 FROM ad_org o WHERE o.c_calendar_id = c.c_calendar_id AND o.ad_org_id = $${values.length})`);
    }
    if (type === 'warehouse') {
      addWarehouseOrgFilters(selectedOrgId, values, whereFragments, roleOrgIds);
    }
    if (type === 'product') {
      applyWarehouseFilters(selectedWarehouseIds, values, whereFragments, selectedOrgId, roleOrgIds);
    }
    if (type === 'account' && selectedAcctSchemaId) {
      values.push(selectedAcctSchemaId);
      whereFragments.push(`AND ev.c_element_id IN (SELECT c_element_id FROM c_acctschema_element WHERE c_acctschema_id = $${values.length} AND c_element_id IS NOT NULL)`);
    }

    const fullFromWhere = whereFragments.join(' ');
    const pg = await import('pg');
    const pool = new pg.default.Pool(getDbConfig());
    try {
      const countResult = await pool.query(`SELECT COUNT(*)::int AS total ${fullFromWhere}`, values);
      const totalCount = countResult.rows[0]?.total ?? 0;
      const { rows } = await pool.query(`${queryCfg.select} ${fullFromWhere} ${queryCfg.orderBy} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, offset]);
      json(res, 200, { items: rows, totalCount, hasMore: offset + rows.length < totalCount });
    } finally { await pool.end(); }
  } catch (e) {
    console.error('[selector]', e.message);
    json(res, 500, { error: e.message });
  }
}

function addWarehouseOrgFilters(selectedOrgId, values, whereFragments, roleOrgIds) {
  if (selectedOrgId) { values.push(selectedOrgId); whereFragments.push(`AND EXISTS (SELECT 1 FROM ad_org_warehouse ow WHERE ow.m_warehouse_id = m_warehouse.m_warehouse_id AND ow.ad_org_id = $${values.length})`); }
  if (roleOrgIds.length > 0) { values.push(roleOrgIds); whereFragments.push(`AND EXISTS (SELECT 1 FROM ad_org_warehouse ow WHERE ow.m_warehouse_id = m_warehouse.m_warehouse_id AND ow.ad_org_id = ANY($${values.length}))`); }
}

function applyWarehouseFilters(selectedWarehouseIds, values, whereFragments, selectedOrgId, roleOrgIds) {
  if (selectedWarehouseIds.length > 0) { values.push(selectedWarehouseIds); whereFragments.push(`AND EXISTS (SELECT 1 FROM m_storage_detail sd JOIN m_locator l ON l.m_locator_id = sd.m_locator_id WHERE sd.m_product_id = m_product.m_product_id AND l.m_warehouse_id = ANY($${values.length}))`); }
  if (selectedOrgId) { values.push(selectedOrgId); whereFragments.push(`AND EXISTS (SELECT 1 FROM m_storage_detail sd JOIN m_locator l ON l.m_locator_id = sd.m_locator_id WHERE sd.m_product_id = m_product.m_product_id AND ad_isorgincluded(l.ad_org_id, $${values.length}, m_product.ad_client_id) <> -1)`); }
  if (roleOrgIds.length > 0) { values.push(roleOrgIds); whereFragments.push(`AND EXISTS (SELECT 1 FROM m_storage_detail sd JOIN m_locator l ON l.m_locator_id = sd.m_locator_id WHERE sd.m_product_id = m_product.m_product_id AND l.ad_org_id = ANY($${values.length}))`); }
}

function getRowCount(rows) {
  return Array.isArray(rows) ? rows.length : undefined;
}

function renderTemplateWithHelpers(helpersCode, templateContent, templateData, res) {
  const Handlebars = _require('handlebars');
  // Register the trusted in-repo helper set — no dynamic code execution.
  // helpersCode is read (not executed) only to preserve a report's formatNumber
  // decimals. Document QR codes are precomputed as data (header.qrDataUrl) by
  // injectDocumentQr() before this synchronous compile — never as a helper.
  registerReportHelpers(Handlebars, helpersCode);
  const html = Handlebars.compile(templateContent)(templateData);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

// Document (print-*) reports render a QR of the header. QRCode.toDataURL is
// async while Handlebars.compile is sync, so the QR cannot be a helper on the
// local HTML path — precompute it once here, before the format branch, so both
// the local HTML render and the jsreport PDF/XLSX payload see the same
// {{header.qrDataUrl}}. A QR failure degrades to a report without QR instead
// of failing the whole render.
async function injectDocumentQr(documentData, templateData) {
  if (!documentData?.header || !templateData.header) return;
  try {
    templateData.header.qrDataUrl = await computeDocumentQrDataUrl(documentData.header, { qrcode: _require('qrcode') });
  } catch (e) {
    console.warn('[render] QR generation failed:', e.message);
  }
}

function isPostRequestForRender(method, renderMatch) {
  return method === 'POST' && renderMatch;
}

async function fetchReportDataById(dataMatch, url, req, res) {
  const reportId = dataMatch[1];
  const limit = url.searchParams.get('limit');
  try {
    const authToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const { rows, contract } = await fetchReportData(reportId, { limit, authToken });
    json(res, 200, { rows, contract, count: rows.length });
  } catch (e) { json(res, 500, { error: e.message }); }
}

function isGetDataRequest(method, dataMatch) {
  return method === 'GET' && dataMatch;
}

function isGetReportsRequest(method, path) {
  return method === 'GET' && path === '/api/reports';
}

function getReportsList(res) {
  try { json(res, 200, listReports()); }
  catch (e) { json(res, 500, { error: e.message }); }
}

