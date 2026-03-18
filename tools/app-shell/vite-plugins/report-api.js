/**
 * Vite plugin: Report API
 *
 * Exposes endpoints for migrated Jasper reports:
 *   GET  /api/reports                    — list available migrated reports
 *   GET  /api/reports/:id/data           — execute SQL and return JSON rows
 *   POST /api/reports/:id/render         — render via jsreport (returns HTML/PDF/etc)
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ARTIFACTS_DIR = resolve(import.meta.dirname, '../../../artifacts');
const ROOT = resolve(ARTIFACTS_DIR, '..');
const JSREPORT_URL = process.env.JSREPORT_URL || 'http://localhost:5488';

// Find gradle.properties for DB connection
function findGradleProps() {
  const candidates = [
    process.env.ETENDO_GRADLE_PROPERTIES,
    resolve(ROOT, 'etendo_core/gradle.properties'),
    resolve(ROOT, '../gradle.properties'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function parseGradleProps(path) {
  const content = readFileSync(path, 'utf8');
  const props = {};
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    props[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return props;
}

/**
 * List all artifact dirs that have a report-contract.json
 */
function listReports() {
  const reports = [];
  for (const dir of readdirSync(ARTIFACTS_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const contractPath = join(ARTIFACTS_DIR, dir.name, 'report-contract.json');
    if (existsSync(contractPath)) {
      try {
        const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
        if (contract.reportId && contract.outputs?.length > 0 && (contract.source === 'jasper-migration' || contract.source === 'manual' || contract.mockDataFile)) {
          reports.push({
            id: contract.reportId,
            title: contract.title,
            type: contract.type,
            category: contract.category || 'other',
            orientation: contract.orientation,
            outputs: contract.outputs,
          });
        }
      } catch { /* skip malformed */ }
    }
  }
  return reports;
}

/**
 * Fetch report data — from DB (jasper SQL) or from mock data file.
 */
async function fetchReportData(reportId, { limit } = {}) {
  const contractPath = join(ARTIFACTS_DIR, reportId, 'report-contract.json');
  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));

  // If contract has a mockDataFile, use it directly (no DB needed)
  if (contract.mockDataFile) {
    const mockPath = join(ARTIFACTS_DIR, reportId, contract.mockDataFile);
    if (existsSync(mockPath)) {
      let rows = JSON.parse(readFileSync(mockPath, 'utf8'));
      if (limit) rows = rows.slice(0, parseInt(limit, 10));
      return { rows, contract };
    }
  }

  // Otherwise, use Jasper SQL from the jrxml
  if (!contract.jasper?.originalFile) {
    throw new Error('No data source configured (no mockDataFile or jasper.originalFile)');
  }

  const jrxmlPath = resolve(ROOT, contract.jasper.originalFile);
  if (!existsSync(jrxmlPath)) {
    throw new Error(`JRXML not found: ${jrxmlPath}`);
  }

  const extractorPath = resolve(ROOT, 'cli/src/extract-from-jasper.js');
  const { parseJrxml } = await import(/* @vite-ignore */ extractorPath);
  const parsed = parseJrxml(readFileSync(jrxmlPath, 'utf8'));
  let sql = parsed.query;
  if (!sql) throw new Error('No SQL query in jrxml');

  // Connect to DB
  const gradlePath = findGradleProps();
  if (!gradlePath) throw new Error('gradle.properties not found');
  const gradle = parseGradleProps(gradlePath);

  const pg = await import('pg');
  const pool = new pg.default.Pool({
    host: gradle['bbdd.host'] || 'localhost',
    port: parseInt(gradle['bbdd.port']) || 5432,
    user: gradle['bbdd.user'],
    password: gradle['bbdd.password'],
    database: gradle['bbdd.sid'],
    max: 3,
  });

  try {
    // Get client ID
    const clientRes = await pool.query(
      `SELECT ad_client_id FROM ad_client WHERE isactive = 'Y' AND ad_client_id != '0' ORDER BY name LIMIT 1`
    );
    const clientId = clientRes.rows[0]?.ad_client_id || '0';

    // Parameterize query
    sql = sql.replace(/AD_CLIENT_ID\s+IN\s*\(\s*'[^']+'\s*\)/gi, `AD_CLIENT_ID IN ('${clientId}')`);
    sql = sql.replace(/AD_ORG_ID\s+IN\s*\(\s*'[^']+'\s*\)/gi,
      `AD_ORG_ID IN (SELECT AD_ORG_ID FROM AD_ORG WHERE AD_CLIENT_ID = '${clientId}' AND ISACTIVE = 'Y')`);
    sql = sql.replace(/AD_LANGUAGE\s*=\s*'[^']+'/gi, `AD_LANGUAGE = 'en_US'`);

    if (limit) sql = sql.replace(/;\s*$/, '') + ` LIMIT ${parseInt(limit, 10)}`;

    const { rows } = await pool.query(sql);
    return { rows, contract };
  } finally {
    await pool.end();
  }
}

export default function reportApiPlugin() {
  return {
    name: 'report-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        const path = url.pathname;

        // GET /api/reports — list migrated reports
        if (req.method === 'GET' && path === '/api/reports') {
          try {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(listReports()));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
          return;
        }

        // GET /api/reports/:id/data — fetch report data from DB
        const dataMatch = path.match(/^\/api\/reports\/([\w-]+)\/data$/);
        if (req.method === 'GET' && dataMatch) {
          const reportId = dataMatch[1];
          const limit = url.searchParams.get('limit');
          try {
            const { rows, contract } = await fetchReportData(reportId, { limit });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ rows, contract, count: rows.length }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
          return;
        }

        // POST /api/reports/:id/render — render via jsreport
        const renderMatch = path.match(/^\/api\/reports\/([\w-]+)\/render$/);
        if (req.method === 'POST' && renderMatch) {
          const reportId = renderMatch[1];
          let body = '';
          for await (const chunk of req) body += chunk;
          const { format = 'html', limit } = JSON.parse(body || '{}');

          try {
            const { rows, contract } = await fetchReportData(reportId, { limit });
            const artifactDir = join(ARTIFACTS_DIR, reportId);
            const templateContent = readFileSync(join(artifactDir, 'template.hbs'), 'utf8');
            const helpersPath = join(artifactDir, 'helpers.js');
            const helpersCode = existsSync(helpersPath) ? readFileSync(helpersPath, 'utf8') : '';
            const cssPath = join(ROOT, 'templates', 'reports', 'base.css');
            const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : '';

            const recipeMap = { html: 'html', pdf: 'chrome-pdf', xlsx: 'html-to-xlsx', csv: 'text' };
            const recipe = recipeMap[format] || 'html';
            const title = contract.title?.en_US || reportId;

            const payload = {
              template: { content: templateContent, engine: 'handlebars', recipe, helpers: helpersCode },
              data: { css, meta: { title, generatedAt: new Date().toISOString(), recordCount: rows.length, filters: [] }, rows },
            };

            if (recipe === 'chrome-pdf') {
              payload.template.chrome = {
                landscape: contract.orientation === 'landscape',
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
            res.setHeader('Content-Type', contentType);
            const buffer = Buffer.from(await jsRes.arrayBuffer());
            res.end(buffer);
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message }));
          }
          return;
        }

        next();
      });
    },
  };
}
