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

function listReports() {
  const reports = [];
  for (const dir of readdirSync(ARTIFACTS_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const contractPath = join(ARTIFACTS_DIR, dir.name, 'report-contract.json');
    if (!existsSync(contractPath)) continue;
    try {
      const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
      if (
        contract.reportId &&
        contract.outputs?.length > 0 &&
        contract.type !== 'document' &&
        (contract.source === 'jasper-migration' || contract.source === 'manual' ||
          contract.source === 'sql' || contract.source === 'neo' || contract.mockDataFile)
      ) {
        reports.push({
          id: contract.reportId,
          title: contract.title,
          type: contract.type,
          category: contract.category || 'other',
          orientation: contract.orientation,
          outputs: contract.outputs,
          parameters: contract.parameters || [],
        });
      }
    } catch { /* skip malformed */ }
  }
  return reports;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchReportData(reportId, { limit, authToken, params = {} } = {}) {
  const contractPath = join(ARTIFACTS_DIR, reportId, 'report-contract.json');
  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));

  // NEO API path
  if (contract.neo?.endpoint) {
    if (!authToken) throw new Error('No auth token');
    const neoUrl = `${ETENDO_URL}${contract.neo.endpoint}`;
    const neoBody = { ...contract.neo.body, ...params };
    const neoRes = await fetch(neoUrl, {
      method: contract.neo.method || 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify(neoBody),
    });
    if (!neoRes.ok) {
      const text = await neoRes.text().catch(() => '');
      throw new Error(`NEO ${neoRes.status}: ${text.slice(0, 200)}`);
    }
    const data = await neoRes.json();
    let rows = extractRowsFromData(data, contract, limit);
    let neoMeta = extractNeoMeta(contract, data);
    return { rows, contract, neoMeta };
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
      const headerResult = await pool.query(replace(contract.sql.header));
      const header = headerResult.rows[0] || {};
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
  let sql = await buildReportSql(contract, reportId, authToken, params);

  sql = injectDateFilters(contract, params, sql);

  sql = applyLimitToSql(limit, sql);

  const pg = await import('pg');
  const pool = new pg.default.Pool(getDbConfig());
  try {
    const { rows } = await pool.query(sql);
    return { rows, contract };
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

async function buildReportSql(contract, reportId, authToken, params) {
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
  sql = sql.replaceAll('__CLIENT_ID__', clientId);
  for (const [k, v] of Object.entries(params)) {
    if (k.startsWith('_display_')) continue;
    if (v !== undefined && v !== null && v !== '') {
      sql = sql.replace(new RegExp(`__${k.toUpperCase()}__`, 'g'), String(v).replaceAll('\'', "''"));
    }
  }
  for (const p of (contract.parameters || [])) {
    if (p.default !== undefined && p.default !== null && p.default !== '') {
      sql = sql.replace(new RegExp(`__${p.name.toUpperCase()}__`, 'g'), String(p.default));
    }
  }
  sql = sql.replace(/=\s*'([^',]+(?:,[^',]+)+)'/g, (_, ids) => `IN (${ids.split(',').map(formatIdForSql()).join(',')})`);
  sql = sql.replace(/AND\s*\('__\w+__'\s*=\s*''\s*OR\s*[\s\S]*?'__\w+__'[^)]*\)/gi, '');
  sql = sql.replace(/AD_CLIENT_ID\s+IN\s*\(\s*'[^']+'\s*\)/gi, `AD_CLIENT_ID IN ('${clientId}')`);
  sql = sql.replace(/AD_ORG_ID\s+IN\s*\(\s*'[^']+'\s*\)/gi, `AD_ORG_ID IN (SELECT AD_ORG_ID FROM AD_ORG WHERE AD_CLIENT_ID = '${clientId}' AND ISACTIVE = 'Y')`);
  sql = sql.replace(/AD_LANGUAGE\s*=\s*'[^']+'/gi, `AD_LANGUAGE = 'en_US'`);
  return sql;
}

function formatIdForSql() {
  return id => `'${id.trim()}'`;
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
// Request handler
// ---------------------------------------------------------------------------

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
    const reportId = renderMatch[1];
    const body = await readBody(req);
    const { format = 'html', limit, params = {} } = JSON.parse(body || '{}');

    try {
      const authToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const result = await fetchReportData(reportId, { limit, authToken, params });
      let { rows, contract, documentData, neoMeta = {} } = result;

      // groupBy logic
      let groupLabel;
      let descriptionLabel;
      ({ groupLabel, descriptionLabel, rows } = getGroupedData(contract, params, rows));

      const activeFilters = filterAndTransformParams(params, contract);

      const artifactDir = join(ARTIFACTS_DIR, reportId);
      const templateContent = readFileSync(join(artifactDir, 'template.hbs'), 'utf8');
      const helpersPath = join(artifactDir, 'helpers.js');
      const helpersCode = loadHelpersFromFile(helpersPath);
      const cssPath = join(ROOT, 'templates', 'reports', 'base.css');
      const css = readCssFile(cssPath);

      const recipeMap = { html: 'html', pdf: 'chrome-pdf', xlsx: 'html-to-xlsx', csv: 'text' };
      const recipe = recipeMap[format] || 'html';
      const title = contract.title?.en_US || reportId;

      const amountCols = (contract.columns || []).filter(c => c.type === 'amount');
      const totals = {};
      calculateTotals(documentData, amountCols, rows, totals);
      const recordCount = getRowCount(rows);
      const templateData = buildTemplateData(documentData, css, { title, activeFilters, params, recordCount, totals, groupLabel, descriptionLabel, neoMeta, rows });
      // HTML: render with Handlebars locally
      if (format === 'html') {
        renderTemplateWithHelpers(helpersCode, templateContent, templateData, res);
        return;
      }

      // PDF/XLSX: delegate to jsreport
      const payload = {
        template: { content: templateContent, engine: 'handlebars', recipe, helpers: helpersCode },
        data: templateData,
      };
      if (recipe === 'chrome-pdf') {
        payload.template.chrome = {
          landscape: contract.orientation === 'landscape' || params.showLandscape === 'true',
          format: 'A4', marginTop: '10mm', marginBottom: '10mm', marginLeft: '10mm', marginRight: '10mm',
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
function buildTemplateData(documentData, css, { title, activeFilters, params, recordCount, totals, groupLabel, descriptionLabel, neoMeta, rows }) {
  if (documentData) {
    return { css, meta: { title, generatedAt: new Date().toISOString(), filters: activeFilters, params }, header: documentData.header, lines: documentData.lines, taxes: documentData.taxes };
  }
  return { css, meta: { title, generatedAt: new Date().toISOString(), recordCount, filters: activeFilters, params, totals, groupLabel, descriptionLabel, ...neoMeta }, rows };
}

function getGroupedData(contract, params, rows) {
  let groupLabel = contract.groups?.[0]?.label?.en_US || 'Account';
  let descriptionLabel = (contract.columns || []).find(c => c.field === 'groupbyname')?.label?.en_US || 'Description';
  if (params.groupBy && rows) {
    const dimensionParam = (contract.parameters || []).find(p => p.groupByValue === params.groupBy && p.groupByField);
    if (dimensionParam) {
      const sourceField = dimensionParam.groupByField;
      groupLabel = dimensionParam.label?.en_US || params.groupBy;
      descriptionLabel = dimensionParam.label?.en_US || descriptionLabel;
      rows = [...rows].sort((a, b) => (a[sourceField] || '').toLowerCase().localeCompare((b[sourceField] || '').toLowerCase()));
      rows = rows.map(r => ({ ...r, name: r[sourceField] || '', value: '' }));
    }
  }
  return { groupLabel, descriptionLabel, rows };
}

function filterAndTransformParams(params, contract) {
  return Object.entries(params)
    .filter(([k, v]) => v && v !== '' && !k.startsWith('_display_'))
    .map(([k, v]) => {
      const paramDef = contract.parameters?.find(p => p.name === k);
      let displayValue = params['_display_' + k] || v;
      if (k === 'groupBy') {
        const dimParam = (contract.parameters || []).find(p => p.groupByValue === v);
        displayValue = dimParam?.label?.en_US || v;
      }
      if (typeof displayValue === 'string' && displayValue.includes(' | '))
        displayValue = displayValue.split(' | ').filter(Boolean).join(', ');
      if (paramDef?.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(displayValue)) {
        const [y, m, d] = displayValue.split('-');
        displayValue = `${d}/${m}/${y}`;
      }
      return { label: paramDef?.label?.en_US || k, value: displayValue };
    });
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
  if (helpersCode) {
    // helpersCode is loaded from the server's own filesystem (artifacts/{id}/helpers.js),
    // never from user-supplied input — dynamic execution is intentional here. NOSONAR
    // eslint-disable-next-line no-new-func
    const helperFn = new Function(helpersCode + `
            var _out = {};
            ['isGroupBreak','resetGroupTracking','formatDate','formatCurrency',
             'formatBoolean','formatNumber','ifCond','eq','sumField','formatDateDisplay','sumRowsByCategory']
            .forEach(function(n) { try { var f = eval(n); if (typeof f === 'function') _out[n] = f; } catch(e) {} });
            return _out;
          `);
    const helpers = helperFn();
    if (typeof helpers.resetGroupTracking === 'function') helpers.resetGroupTracking();
    Object.entries(helpers).forEach(([name, fn]) => { if (typeof fn === 'function') Handlebars.registerHelper(name, fn); });
  }
  const html = Handlebars.compile(templateContent)(templateData);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
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

