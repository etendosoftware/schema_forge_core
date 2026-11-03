/**
 * report-query.js — `POST /api/reports/:id/query` (ETP-6080).
 *
 * Returns a report's data as JSON instead of a rendered document, for the
 * interactive report view: the account tree with every level and its
 * variation for Profit & Loss–shaped reports (`sql.operandsQuery` declared),
 * plain rows for listing reports (General Ledger, Journal Entries — the
 * view's drill-down), and an account split by one dimension (`sql.splitQuery`).
 *
 * Both engines (core `tools/report-server/server.js` and the functional repo's
 * `vite-plugins/report-api.js`) call `handleReportQuery`, so the session, the
 * org check and the response shape cannot drift between dev and production.
 * The numbers come from the same `applyPlaceholders` + `buildAccountReportTree`
 * the render uses, so the screen and the exports agree.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { applyPlaceholders } from './report-sql.js';
import { buildAccountReportTree, addVariation, accountSignMultiplier, cleanAmount } from './report-grouping.js';
import { resolveReportSession, reportAuthErrorBody, assertReportOrgAccess } from './report-auth.js';

const REPORT_ID_SHAPE = /^[\w-]+$/;
const SPLIT_DIMENSIONS = new Set(['org', 'bpartner', 'product']);

/** A row cap goes into the SQL text, so only a positive safe integer is one. */
const isValidLimit = (n) => Number.isSafeInteger(n) && n > 0;

function errorResult(status, code, error) {
  return { status, body: { error: error || code, code } };
}

/**
 * Runs a SQL contract's main query plus its optional secondary queries, with
 * the same placeholder rules as the render. `limit` caps the main query only;
 * it is spliced into the SQL text, so anything but a positive safe integer throws.
 */
export async function runReportSql(pool, contract, { clientId, params = {}, locale, limit } = {}) {
  const apply = (sql) => applyPlaceholders(sql, { clientId, params, contract, locale });
  let main = apply(contract.sql.query);
  if (limit !== undefined && limit !== null) {
    if (!isValidLimit(limit)) throw new TypeError(`runReportSql: invalid limit ${JSON.stringify(limit)}`);
    main = `${main.replace(/;\s*$/, '')} LIMIT ${limit}`;
  }
  const { rows } = await pool.query(main);
  const openingRows = contract.sql.openingQuery ? (await pool.query(apply(contract.sql.openingQuery))).rows : null;
  const operandRows = contract.sql.operandsQuery ? (await pool.query(apply(contract.sql.operandsQuery))).rows : null;
  return { rows, openingRows, operandRows };
}

/**
 * Account split (ticket item 8): one account's amounts per org / business
 * partner / product. `sql.splitQuery` returns `dimension_id`, `dimension_name`,
 * `own_amt`, `own_amt_ref` (raw debit − credit). It must carry the same
 * `__ORGID__` predicate as the main query, or a split by org would list orgs
 * the org check never covered. The row's effective sign
 * (`splitSign`, from the tree row the user split) turns them into the same
 * polarity the tree shows. The sign only affects display, never which rows
 * are read.
 */
async function runSplit(pool, contract, { clientId, params, locale }) {
  const { rows } = await pool.query(applyPlaceholders(contract.sql.splitQuery, { clientId, params, contract, locale }));
  const sign = params.splitSign === 'C' ? 'C' : 'D';
  const multiplier = accountSignMultiplier(sign);
  const split = rows.map((r) => ({
    node_id: r.dimension_id,
    name: r.dimension_name,
    amount: cleanAmount((Number(r.own_amt) || 0) * multiplier),
    amount_ref: cleanAmount((Number(r.own_amt_ref) || 0) * multiplier),
    sign,
  }));
  return addVariation(split, { compare: params.compareTo === 'true', trend: contract.trend === 'result' });
}

/**
 * Shapes the JSON answer. An account-tree report returns EVERY level (the
 * view folds on screen; `accountLevel` is only its initial expansion), with
 * variation; a listing report returns its rows as they come.
 */
export function buildQueryResponse(contract, params, { rows, openingRows, operandRows }) {
  if (contract.sql.operandsQuery !== undefined) {
    const tree = buildAccountReportTree(rows, operandRows, {
      accountLevel: 'S',
      showOnlyWithValue: params.showOnlyAccountsWithValue === 'true',
    });
    return { kind: 'tree', rows: addVariation(tree, { compare: params.compareTo === 'true', trend: contract.trend === 'result' }) };
  }
  return { kind: 'rows', rows, openingRows };
}

/** The report's SQL contract, or the error answer when it cannot be queried. */
function loadQueryContract(artifactsDir, reportId) {
  const contractPath = REPORT_ID_SHAPE.test(reportId || '') && join(artifactsDir, reportId, 'report-contract.json');
  if (!contractPath || !existsSync(contractPath)) return { error: errorResult(404, 'REPORT_NOT_FOUND') };
  let contract;
  try {
    contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  } catch (e) {
    console.error(`[report-query] ${reportId}: unreadable contract:`, e?.message);
    return { error: errorResult(500, 'QUERY_FAILED') };
  }
  if (!contract.sql?.query) return { error: errorResult(400, 'QUERY_NOT_SUPPORTED', 'Only SQL reports can be queried') };
  return { contract };
}

/** Params, limit and split mode from the request body, or the 400 answer. */
function parseQueryRequest(body, contract) {
  const params = body.params && typeof body.params === 'object' ? body.params : {};
  const limit = body.limit === undefined || body.limit === null || body.limit === '' ? undefined : Number(body.limit);
  if (limit !== undefined && !isValidLimit(limit)) return { error: errorResult(400, 'INVALID_LIMIT') };
  const isSplit = Boolean(params.splitBy || params.splitNodeId);
  if (isSplit && (!contract.sql.splitQuery || !SPLIT_DIMENSIONS.has(params.splitBy) || !params.splitNodeId)) {
    return { error: errorResult(400, 'SPLIT_NOT_SUPPORTED') };
  }
  return { params, limit, isSplit };
}

/**
 * The whole route, engine-independent. Order matters: the session and the
 * org check run BEFORE any report SQL, and a failure never reaches the DB.
 *
 * @param {object} req
 * @param {string} req.reportId      from the route match
 * @param {object} req.headers       incoming request headers (cookie, CSRF)
 * @param {string} req.method
 * @param {object} req.body          parsed JSON: { params, locale, limit }
 * @param {object} deps
 * @param {string} deps.artifactsDir where `<reportId>/report-contract.json` lives
 * @param {string} deps.etendoBase   for the session lookup
 * @param {Function} deps.createPool returns a pg Pool; ended here
 * @param {Function} [deps.fetchImpl] session lookup fetch (tests)
 * @returns {Promise<{status: number, body: object}>}
 */
export async function handleReportQuery({ reportId, headers, method, body = {} }, { artifactsDir, etendoBase, createPool, fetchImpl }) {
  let session;
  try {
    session = await resolveReportSession(headers, { method, etendoBase, ...(fetchImpl ? { fetchImpl } : {}) });
  } catch (e) {
    return reportAuthErrorBody(e);
  }

  const { contract, error: contractError } = loadQueryContract(artifactsDir, reportId);
  if (contractError) return contractError;
  const { params, limit, isSplit, error: requestError } = parseQueryRequest(body, contract);
  if (requestError) return requestError;

  // Every failure from here on (no DB config, DB down, bad SQL) is an answer,
  // never a throw: the dev engine's middleware has no outer catch.
  let pool;
  try {
    pool = createPool();
    await assertReportOrgAccess(pool, session, { contract, params });
    const ctx = { clientId: session.clientId, params, locale: body.locale };
    if (isSplit) return { status: 200, body: { kind: 'split', rows: await runSplit(pool, contract, ctx) } };
    const result = await runReportSql(pool, contract, { ...ctx, limit });
    return { status: 200, body: buildQueryResponse(contract, params, result) };
  } catch (e) {
    if (e?.name === 'ReportAuthError') return reportAuthErrorBody(e);
    // Logged server-side only: the SQL text and DB messages never reach the client.
    console.error(`[report-query] ${reportId}:`, e?.message);
    return errorResult(500, 'QUERY_FAILED');
  } finally {
    await pool?.end();
  }
}
