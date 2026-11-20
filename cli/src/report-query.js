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
import { buildAccountReportTree, buildChartAccountTree, parseExpandedNodeIds, buildPeriodAccountTree, buildPeriodCell, addVariation, accountSignMultiplier, cleanAmount, resultSplit, resultFields, balanceFields, hasResult } from './report-grouping.js';
import { assertNoPeriodsToken, buildPeriodValues, comparedPeriodsFor, substitutePeriods, hasPeriods, hullParams, SCREEN_MAX_BUCKETS } from './report-periods.js';
import { withReportClient, acquireTenantSlot, isStatementTimeout, ReportTimeoutError, ReportCancelledError } from './report-db.js';
import { resolveReportSession, reportAuthErrorBody, assertReportOrgAccess, assertReportAccess, accessCheckSession } from './report-auth.js';

const REPORT_ID_SHAPE = /^[\w-]+$/;
/** A contract that declares `tree: 'chart'` is answered from `sql.treeQuery` as a chart-of-accounts tree (ETP-6084). */
export const isChartTree = (contract) => contract?.tree === 'chart';
/** /render only takes the chart tree path when the interactive view sends its expanded nodes; any other request keeps the `sql.query` path unchanged. */
export const isChartTreeRender = (contract, params) => isChartTree(contract)
  && (parseExpandedNodeIds(params?.expandedNodeIds) !== undefined || parseExpandedNodeIds(params?.visibleNodeIds) !== undefined);
const SPLIT_DIMENSIONS = new Set(['org', 'bpartner', 'product']);

/** A row cap goes into the SQL text, so only a positive safe integer is one. */
const isValidLimit = (n) => Number.isSafeInteger(n) && n > 0;

function errorResult(status, code, error) {
  return { status, body: { error: error || code, code } };
}

/**
 * ETP-6239: the validated `periods` of a request, or null when it carries none
 * or the contract has no `queryKey` period query (the report then answers as it
 * always did). Throws ReportPeriodsError, so a bad value fails before any SQL.
 */
function periodSpecFor(contract, params, queryKey, maxBuckets = SCREEN_MAX_BUCKETS) {
  if (!hasPeriods(params) || !contract.sql?.[queryKey]) return null;
  assertNoPeriodsToken(params);
  // Only the export formats (maxBuckets above the screen's) cap the length of the range itself (D5).
  return buildPeriodValues(params.periods, { maxBuckets, capRange: maxBuckets > SCREEN_MAX_BUCKETS, grain: params.columns || 'total', hiddenCount: params.hiddenCount || 0 });
}

/** A period query filled: placeholders over the date hull first, then the engine-built `__PERIODS__`. */
const fillPeriodQuery = (contract, queryKey, spec, { clientId, params, locale }) =>
  substitutePeriods(applyPlaceholders(contract.sql[queryKey], { clientId, params: hullParams(params, spec), contract, locale }), spec);

/**
 * Runs a SQL contract's main query plus its optional secondary queries, with
 * the same placeholder rules as the render. The one place that does it: `/query`,
 * the report-server render and the dev plugin's render all call it (ETP-6080 W4).
 * `mainSql` is a main query the caller already built (a Jasper report's extracted
 * SQL with its date filters and limit); without it, `sql.query` is used. `limit`
 * caps the main query only; it is spliced into the SQL text, so anything but a
 * positive safe integer throws.
 * With `params.periods` (ETP-6239) and a contract `sql.periodQuery`, the per-period
 * amounts come back as `periodRows` with their validated `periodSpec`;
 * `maxPeriodBuckets` is the render format's cap. Without `periods` the result is
 * exactly what it was.
 *
 * `chartTree: true` (ETP-6084, a `tree: 'chart'` contract) runs `sql.treeQuery` as the main query
 * instead of `sql.query` / `mainSql`, with no row cap (a cap would drop chart nodes). With periods,
 * `treeQuery` is filled with the date hull like `periodQuery`, so its nodes cover every range.
 *
 * Chart tree row contract (the report's SQL must follow it; `buildChartAccountTree` reads it):
 *  - `treeQuery`: every chart node with a posted descendant on or before `__DATETO__`, as
 *    `node_id, parent_id (null or '0' for a root), value, name, elementlevel, sort_path, account_id (= node_id),
 *    dimension_id (NULL)`, with its OWN amounts `opening_balance, activity_debit, activity_credit,
 *    closing_balance` (raw: debit and credit are sums, a node with no posting of its own has 0). With a
 *    grouping active it adds one row per (S leaf, dimension value): `account_id` = the leaf's node_id,
 *    `dimension_id` (the value's id, '' for none), `dimension_name`, the leaf's amounts split by value.
 *  - `periodQuery` (when the request carries `periods`): `WITH buckets(idx, f, t, sf, st, pf, pt) AS
 *    (VALUES __PERIODS__)`, one row per (idx, account_id[, dimension_id]) with the amounts as
 *    `opening_balance, activity_debit, activity_credit, closing_balance` for the bucket's own range
 *    (f..t) and the same four with suffix `_sly` (sf..st) and `_prev` (pf..pt). `dimension_id` is NULL with
 *    no grouping, the value's id ('' for none) with one, plus `dimension_name`. The placeholders around
 *    it are the date HULL (`hullParams`): `__DATEFROM__` / `__DATETO__` are the earliest / latest date of
 *    any range and `__COMPARETO__` is 'false', so they are NOT a range's own dates. Per range the query
 *    must use the bucket's dates: opening = everything dated before the range's start (plus the
 *    opening entries ON that day when `__OPENINGENTRYAMOUNT__`), debit/credit within it, closing
 *    = everything up to its end. It must read `fact_acct` up to the hull's end with NO lower bound.
 */
export async function runReportSql(pool, contract, { clientId, params = {}, locale, limit, mainSql, maxPeriodBuckets, chartTree = false } = {}) {
  const periodSpec = periodSpecFor(contract, params, 'periodQuery', maxPeriodBuckets);
  const apply = (sql) => applyPlaceholders(sql, { clientId, params, contract, locale });
  if (chartTree && !contract.sql?.treeQuery) throw new Error('chart tree report has no sql.treeQuery');
  let main = chartTree
    ? applyPlaceholders(contract.sql.treeQuery, { clientId, params: periodSpec ? hullParams(params, periodSpec) : params, contract, locale })
    : mainSql ?? apply(contract.sql.query);
  if (!chartTree && limit !== undefined && limit !== null) {
    if (!isValidLimit(limit)) throw new TypeError(`runReportSql: invalid limit ${JSON.stringify(limit)}`);
    main = `${main.replace(/;\s*$/, '')} LIMIT ${limit}`;
  }
  const { rows } = await pool.query(main);
  const openingRows = contract.sql?.openingQuery ? (await pool.query(apply(contract.sql.openingQuery))).rows : null;
  const operandRows = contract.sql?.operandsQuery ? (await pool.query(apply(contract.sql.operandsQuery))).rows : null;
  if (!periodSpec) return { rows, openingRows, operandRows };
  const periodRows = (await pool.query(fillPeriodQuery(contract, 'periodQuery', periodSpec, { clientId, params, locale }))).rows;
  return { rows, openingRows, operandRows, periodRows, periodSpec };
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
  const periodSpec = periodSpecFor(contract, params, 'splitPeriodQuery');
  if (periodSpec) return runPeriodSplit(pool, contract, { clientId, params, locale, periodSpec });
  const { rows } = await pool.query(applyPlaceholders(contract.sql.splitQuery, { clientId, params, contract, locale }));
  const sign = params.splitSign === 'C' ? 'C' : 'D';
  const multiplier = accountSignMultiplier(sign);
  const split = rows.map((r) => ({
    node_id: r.dimension_id,
    name: r.dimension_name,
    amount: cleanAmount((Number(r.own_amt) || 0) * multiplier),
    amount_ref: cleanAmount((Number(r.own_amt_ref) || 0) * multiplier),
    sign,
    ...resultFields(r, cleanAmount((Number(r.own_amt) || 0) * multiplier), cleanAmount((Number(r.own_amt_ref) || 0) * multiplier), multiplier),
  }));
  return addVariation(split, { compare: params.compareTo === 'true', trend: contract.trend === 'result' });
}

/**
 * ETP-6239: the split with a value in every period (`sql.splitPeriodQuery`):
 * each row carries `cells[]` like a tree row, and the answer says which periods
 * they are. Same sign handling as the plain split.
 */
async function runPeriodSplit(pool, contract, { clientId, params, locale, periodSpec }) {
  const { rows } = await pool.query(fillPeriodQuery(contract, 'splitPeriodQuery', periodSpec, { clientId, params, locale }));
  const sign = params.splitSign === 'C' ? 'C' : 'D';
  const multiplier = accountSignMultiplier(sign);
  const trend = contract.trend === 'result';
  const byDimension = new Map();
  for (const r of rows) {
    if (!byDimension.has(r.dimension_id)) byDimension.set(r.dimension_id, { name: r.dimension_name, byIdx: new Map() });
    byDimension.get(r.dimension_id).byIdx.set(Number(r.idx), r);
  }
  const split = [...byDimension].map(([id, { name, byIdx }]) => {
    const cells = periodSpec.periods.map((p) => {
      const r = byIdx.get(p.idx);
      const signed = (v) => (Number(v) || 0) * multiplier;
      const cell = buildPeriodCell(signed(r?.own_amt), signed(r?.own_amt_sly), signed(r?.own_amt_prev), { sign, trend });
      if (hasResult(r?.own_result)) { // ETP-6083: the income-summary node's on-the-fly part
        const part = (key, amount) => (hasResult(r[key]) ? resultSplit(amount, r[key], multiplier) : { onTheFly: 0, posted: amount });
        cell.result = { ...resultSplit(cell.amount, r.own_result, multiplier), sly: part('own_result_sly', cell.sly.amount), prev: part('own_result_prev', cell.prev.amount) };
      }
      return cell;
    });
    return { node_id: id, name, sign, amount: cells[0].amount, amount_ref: cells[0].sly.amount, cells };
  });
  split.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount) || a.name.localeCompare(b.name));
  return { rows: split, periods: periodSpec.periods.map(publicPeriod), hiddenCount: periodSpec.hiddenCount };
}

const publicPeriod = ({ idx, dateFrom, dateTo, partial }) => ({ idx, dateFrom, dateTo, partial });

/**
 * Shapes the JSON answer. An account-tree report returns EVERY level (the
 * view folds on screen; `accountLevel` is only its initial expansion), with
 * variation; a listing report returns its rows as they come.
 */
export function buildQueryResponse(contract, params, { rows, openingRows, operandRows, periodRows, periodSpec }) {
  if (isChartTree(contract)) {
    // ETP-6084: the chart-of-accounts tree with 4 amounts per row, totals and the balance check.
    const periods = periodSpec?.periods;
    const tree = buildChartAccountTree(rows, periodSpec ? periodRows : null, {
      periods, showOnlyWithValue: params.showOnlyAccountsWithValue === 'true',
      comparedPeriods: comparedPeriodsFor(params.columns || 'total'),
    });
    return { kind: 'tree', ...tree, ...(periodSpec ? { periods: periods.map(publicPeriod), hiddenCount: periodSpec.hiddenCount } : {}) };
  }
  if (periodSpec && contract.sql.operandsQuery !== undefined) {
    // ETP-6239: one column per period. `cells[]` and the per-mode `visible` / `parentIds` come back in EVERY mode (Total too).
    const tree = buildPeriodAccountTree(rows, operandRows, periodRows, {
      periods: periodSpec.periods,
      accountLevel: 'S',
      showOnlyWithValue: params.showOnlyAccountsWithValue === 'true',
      trend: contract.trend === 'result',
      comparedPeriods: comparedPeriodsFor(params.columns || 'total'),
    });
    return { kind: 'tree', rows: tree, ...balanceFields(contract, tree, { periods: true }), periods: periodSpec.periods.map(publicPeriod), hiddenCount: periodSpec.hiddenCount };
  }
  if (contract.sql.operandsQuery !== undefined) {
    const tree = buildAccountReportTree(rows, operandRows, {
      accountLevel: 'S',
      showOnlyWithValue: params.showOnlyAccountsWithValue === 'true',
    });
    const compare = params.compareTo === 'true';
    return { kind: 'tree', rows: addVariation(tree, { compare, trend: contract.trend === 'result' }), ...balanceFields(contract, tree, { compare }) };
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
function parseQueryRequest(rawBody, contract) {
  // JSON `null`, a number or a string is valid JSON but no request object: read it as `{}`.
  const body = rawBody && typeof rawBody === 'object' ? rawBody : {};
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
 * @param {Function} [deps.createPool] returns a pg Pool; ended here (dev engine)
 * @param {object} [deps.pool] shared pg Pool (ETP-6146): never ended here; one
 *   connection is checked out per request, its SQL is cancelled on `signal`
 * @param {AbortSignal} [deps.signal] aborts when the client disconnects
 * @param {Function} [deps.fetchImpl] session lookup fetch (tests)
 * @returns {Promise<{status: number, body: object}>}
 */
export async function handleReportQuery({ reportId, headers, method, body = {} }, { artifactsDir, etendoBase, createPool, pool: sharedPool, signal, fetchImpl }) {
  let session;
  try {
    const deps = { etendoBase, ...(fetchImpl ? { fetchImpl } : {}) };
    // The access check needs only the cookie and Origin, so it runs alongside
    // the session lookup; a session failure still wins over an access one.
    // Without a session cookie resolveReportSession throws NO_SESSION first,
    // so the access check below is never awaited with a null session.
    const early = accessCheckSession(headers);
    const accessP = early ? assertReportAccess(early, reportId, deps) : null;
    accessP?.catch(() => {});
    session = await resolveReportSession(headers, { method, ...deps });
    await accessP;
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
  let releaseSlot;
  try {
    const work = async (db) => {
      await assertReportOrgAccess(db, session, { contract, params });
      const ctx = { clientId: session.clientId, params, locale: body.locale };
      if (isSplit) {
        const split = await runSplit(db, contract, ctx);
        return { status: 200, body: Array.isArray(split) ? { kind: 'split', rows: split } : { kind: 'split', ...split } };
      }
      const result = await runReportSql(db, contract, { ...ctx, limit, chartTree: isChartTree(contract) });
      return { status: 200, body: buildQueryResponse(contract, params, result) };
    };
    if (sharedPool) {
      releaseSlot = await acquireTenantSlot(session.clientId, signal);
      return await withReportClient(sharedPool, signal, work);
    }
    pool = createPool();
    return await work(pool);
  } catch (e) {
    if (e?.name === 'ReportAuthError') return reportAuthErrorBody(e);
    if (e?.name === 'ReportPeriodsError') return errorResult(e.status, e.code, e.message);
    if (e instanceof ReportTimeoutError || isStatementTimeout(e)) return errorResult(504, 'REPORT_TIMEOUT');
    if (e instanceof ReportCancelledError) return errorResult(499, 'REPORT_CANCELLED');
    // Logged server-side only: the SQL text and DB messages never reach the client.
    console.error(`[report-query] ${reportId}:`, e?.message);
    return errorResult(500, 'QUERY_FAILED');
  } finally {
    releaseSlot?.();
    await pool?.end();
  }
}
