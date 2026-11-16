/**
 * @covers cli/src/report-query.js
 *
 * ETP-6080 — `POST /api/reports/:id/query`, the JSON data route of the
 * interactive report view. The session and org check run before any SQL; the
 * tree answer must carry exactly the numbers the render path prints.
 */
import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { handleReportQuery, buildQueryResponse, runReportSql } from '../src/report-query.js';
import { buildAccountReportTree, ELEMENT_LEVEL_RANK } from '../src/report-grouping.js';

const COOKIE = '__Host-go_session=abc';
const CSRF = 'csrf-ok';

function sessionFetch({ roleOrgs = ['0'], reportAccess } = {}) {
  return async (url) => (String(url).endsWith('/sws/neo/myreportaccess') ? {
    ok: true,
    status: 200,
    json: async () => ({ result: JSON.stringify(reportAccess || { governed: [], reportAccess: {} }) }),
  } : {
    ok: true,
    status: 200,
    json: async () => ({
      environment: { clientId: 'C1', orgId: 'O1', roleId: 'R1', userId: 'U1' },
      roleList: [{ id: 'R1', orgList: roleOrgs.map((id) => ({ id })) }],
      csrfToken: CSRF,
    }),
  });
}

// Answers by matching a marker in the SQL text; records every query.
function fakePool(answers = {}) {
  const pool = {
    queries: [],
    ended: false,
    async query(sql) {
      pool.queries.push(sql);
      if (sql.includes('FROM ad_org o') || sql.includes('unnest(')) return { rows: [] };
      for (const [marker, rows] of Object.entries(answers)) {
        if (sql.includes(marker)) return { rows: typeof rows === 'function' ? rows(sql) : rows };
      }
      return { rows: [] };
    },
    async end() { pool.ended = true; },
  };
  return pool;
}

// Profit & Loss–shaped fixture: root container > E heading > C > {D > S, D}, plus a formula.
function node(node_id, extra = {}) {
  return {
    node_id, parent_id: '', sort_path: node_id, value: node_id, name: `N ${node_id}`, elementlevel: 'C',
    isalwaysshown: 'N', own_amt: 0, own_amt_ref: 0, accountsign: 'C', group_name: 'G1', ...extra,
  };
}
const TREE_ROWS = [
  node('root', { sort_path: '1' }),
  node('E1', { parent_id: 'root', sort_path: '1.1', elementlevel: 'E' }),
  node('C1', { parent_id: 'E1', sort_path: '1.1.1' }),
  node('D1', { parent_id: 'C1', sort_path: '1.1.1.1', elementlevel: 'D' }),
  node('S1', { parent_id: 'D1', sort_path: '1.1.1.1.1', elementlevel: 'S', own_amt: -500, own_amt_ref: -400 }),
  node('D2', { parent_id: 'C1', sort_path: '1.1.1.2', elementlevel: 'D', own_amt: 120, own_amt_ref: 150 }),
  node('F1', { parent_id: 'E1', sort_path: '1.1.2', elementlevel: 'C', issummary: 'N' }),
];
const OPERANDS = [{ owner_id: 'F1', operand_id: 'C1', sign: 1 }];

let artifactsDir;
function writeContract(id, contract) {
  mkdirSync(join(artifactsDir, id), { recursive: true });
  writeFileSync(join(artifactsDir, id, 'report-contract.json'), JSON.stringify(contract));
}
const PL = {
  trend: 'result',
  parameters: [{ name: 'orgId' }, { name: 'dateFrom' }, { name: 'compareTo' }, { name: 'splitBy' },
    { name: 'splitNodeId' }, { name: 'splitSign' }, { name: 'showOnlyAccountsWithValue' }],
  sql: {
    query: "SELECT 'TREE' WHERE ('__ORGID__' = '' OR o = '__ORGID__') AND ('__DATEFROM__' = '' OR d >= '__DATEFROM__')",
    operandsQuery: "SELECT 'OPERANDS'",
    splitQuery: "SELECT 'SPLIT' WHERE n = '__SPLITNODEID__' AND ('__ORGID__' = '' OR o = '__ORGID__')",
  },
};

before(() => {
  artifactsDir = mkdtempSync(join(tmpdir(), 'report-query-'));
  writeContract('profit-loss', PL);
  writeContract('ledger', { parameters: [{ name: 'orgId' }], sql: { query: "SELECT 'LEDGER' WHERE ('__ORGID__' = '' OR o = '__ORGID__')", openingQuery: "SELECT 'OPENING'" } });
  writeContract('neo-report', { parameters: [{ name: 'orgId' }], neo: { endpoint: '/x' } });
});
after(() => rmSync(artifactsDir, { recursive: true, force: true }));

function call(reportId, { body = {}, headers = { cookie: COOKIE, 'x-go-csrf': CSRF }, roleOrgs, pool = fakePool() } = {}) {
  return handleReportQuery(
    { reportId, headers, method: 'POST', body },
    { artifactsDir, etendoBase: 'http://etendo.test', createPool: () => pool, fetchImpl: sessionFetch({ roleOrgs }) },
  ).then((res) => ({ ...res, pool }));
}

describe('handleReportQuery — access', () => {
  it('401 without a session, and never opens a pool', async () => {
    let created = false;
    const res = await handleReportQuery(
      { reportId: 'profit-loss', headers: {}, method: 'POST', body: {} },
      { artifactsDir, etendoBase: 'x', createPool: () => { created = true; return fakePool(); }, fetchImpl: sessionFetch() },
    );
    assert.equal(res.status, 401);
    assert.equal(created, false);
  });

  it('403 without the CSRF header (POST)', async () => {
    const res = await call('profit-loss', { headers: { cookie: COOKIE } });
    assert.equal(res.status, 403);
  });

  it('403 ORG_ACCESS_DENIED for an org the role cannot read, with no report SQL run', async () => {
    const pool = {
      queries: [], ended: false,
      async query(sql) { this.queries.push(sql); return { rows: [] }; }, // the org check finds nothing
      async end() { this.ended = true; },
    };
    const res = await call('profit-loss', { body: { params: { orgId: 'FOREIGN' } }, roleOrgs: ['O1'], pool });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'ORG_ACCESS_DENIED');
    assert.ok(pool.queries.every((q) => !q.includes("'TREE'")), 'report SQL ran after a denied org check');
    assert.equal(pool.ended, true);
  });

  it('400 INVALID_LIMIT for a limit that is not a positive integer, before opening a pool', async () => {
    for (const limit of ['abc', -1, 0, 2.5, 1e21]) {
      let created = false;
      const res = await handleReportQuery(
        { reportId: 'profit-loss', headers: { cookie: COOKIE, 'x-go-csrf': CSRF }, method: 'POST', body: { limit } },
        { artifactsDir, etendoBase: 'x', createPool: () => { created = true; return fakePool(); }, fetchImpl: sessionFetch() },
      );
      assert.equal(res.status, 400, `limit ${limit}`);
      assert.equal(res.body.code, 'INVALID_LIMIT');
      assert.equal(created, false);
    }
  });

  it('a JSON body that is not an object (null, number, string) is an answer, not a throw', async () => {
    for (const body of [null, 5, 'x']) {
      const res = await handleReportQuery(
        { reportId: 'profit-loss', headers: { cookie: COOKIE, 'x-go-csrf': CSRF }, method: 'POST', body },
        { artifactsDir, etendoBase: 'x', createPool: () => { throw new Error('no db'); }, fetchImpl: sessionFetch() },
      );
      assert.equal(res.status, 500, `body ${JSON.stringify(body)}`);
      assert.equal(res.body.code, 'QUERY_FAILED');
    }
  });

  // Re-review W-a: every failure is an answer, never a throw (the dev
  // middleware has no outer catch, so a throw hung the request).
  it('500 QUERY_FAILED, not a throw, when the pool cannot be created', async () => {
    const res = await handleReportQuery(
      { reportId: 'profit-loss', headers: { cookie: COOKIE, 'x-go-csrf': CSRF }, method: 'POST', body: {} },
      { artifactsDir, etendoBase: 'x', createPool: () => { throw new Error('gradle.properties not found'); }, fetchImpl: sessionFetch() },
    );
    assert.deepEqual(res, { status: 500, body: { error: 'QUERY_FAILED', code: 'QUERY_FAILED' } });
  });

  it('500 QUERY_FAILED, not a throw, for a malformed contract file', async () => {
    mkdirSync(join(artifactsDir, 'broken'), { recursive: true });
    writeFileSync(join(artifactsDir, 'broken', 'report-contract.json'), '{ not json');
    const res = await call('broken');
    assert.equal(res.status, 500);
    assert.equal(res.body.code, 'QUERY_FAILED');
  });

  it('404 for an unknown or malformed report id, 400 for a non-SQL report', async () => {
    assert.equal((await call('nope')).status, 404);
    assert.equal((await call('../etc')).status, 404);
    const neo = await call('neo-report');
    assert.equal(neo.status, 400);
    assert.equal(neo.body.code, 'QUERY_NOT_SUPPORTED');
  });

  it('500 QUERY_FAILED without leaking the DB message, and still ends the pool', async () => {
    const pool = { async query() { throw new Error('relation "secret_table" does not exist'); }, async end() { this.ended = true; } };
    const res = await call('profit-loss', { pool });
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: 'QUERY_FAILED', code: 'QUERY_FAILED' });
    assert.equal(pool.ended, true);
  });
});

describe('handleReportQuery — answers', () => {
  it('returns the whole account tree with variation, whatever accountLevel says', async () => {
    const pool = fakePool({ "'TREE'": TREE_ROWS, "'OPERANDS'": OPERANDS });
    const res = await call('profit-loss', { pool, body: { params: { compareTo: 'true', accountLevel: 'E' } } });
    assert.equal(res.status, 200);
    assert.equal(res.body.kind, 'tree');
    assert.deepEqual(res.body.rows.map((r) => r.node_id), ['E1', 'C1', 'D1', 'S1', 'D2', 'F1']);
    const c1 = res.body.rows.find((r) => r.node_id === 'C1');
    assert.equal(c1.amount, 380);
    assert.equal(c1.amount_ref, 250);
    assert.equal(c1.trend, 'improves');
    assert.equal(c1.parentId, 'E1');
  });

  it('substitutes the request params into the SQL (blank ones stripped)', async () => {
    const pool = fakePool({ "'TREE'": [] });
    await call('profit-loss', { pool, body: { params: { orgId: 'O1', dateFrom: '' } } });
    const main = pool.queries.find((q) => q.includes("'TREE'"));
    assert.ok(main.includes("o = 'O1'"));
    assert.ok(!main.includes('__DATEFROM__'));
  });

  it('returns plain rows and opening rows for a listing report (the drill-down)', async () => {
    const pool = fakePool({ "'LEDGER'": [{ id: 1 }], "'OPENING'": [{ total: 5 }] });
    const res = await call('ledger', { pool });
    assert.deepEqual(res.body, { kind: 'rows', rows: [{ id: 1 }], openingRows: [{ total: 5 }] });
  });

  it('splits one account by a dimension, in the row\'s sign, with variation', async () => {
    const pool = fakePool({ "'SPLIT'": [{ dimension_id: 'BP1', dimension_name: 'Acme', own_amt: -300, own_amt_ref: -200 }] });
    const res = await call('profit-loss', {
      pool, body: { params: { splitBy: 'bpartner', splitNodeId: 'S1', splitSign: 'C', compareTo: 'true' } },
    });
    assert.equal(res.body.kind, 'split');
    assert.deepEqual(res.body.rows[0], {
      node_id: 'BP1', name: 'Acme', amount: 300, amount_ref: 200, sign: 'C',
      variationAmount: 100, variationPct: 50, trend: 'improves',
    });
    assert.ok(pool.queries.some((q) => q.includes("n = 'S1'")));
  });

  it('rejects a split on a report without splitQuery or with an unknown dimension', async () => {
    assert.equal((await call('ledger', { body: { params: { splitBy: 'bpartner', splitNodeId: 'x' } } })).status, 400);
    assert.equal((await call('profit-loss', { body: { params: { splitBy: 'project', splitNodeId: 'x' } } })).status, 400);
    assert.equal((await call('profit-loss', { body: { params: { splitBy: 'bpartner' } } })).status, 400);
  });
});

// Q6 — the interactive view folds the all-level query answer on screen; the
// render path cuts at accountLevel on the server. Same rows in, so every level
// must show the same numbers either way.
describe('query vs render — same numbers at every account level (regression, Q6)', () => {
  it('folding the query answer to a level equals the render cutoff at that level', () => {
    const query = buildQueryResponse(PL, {}, { rows: TREE_ROWS, operandRows: OPERANDS }).rows;
    for (const level of ['E', 'C', 'D', 'S']) {
      const render = buildAccountReportTree(TREE_ROWS, OPERANDS, { accountLevel: level });
      const folded = query.filter((r) => ELEMENT_LEVEL_RANK[r.elementlevel] <= ELEMENT_LEVEL_RANK[level]);
      assert.deepEqual(
        folded.map((r) => [r.node_id, r.amount, r.amount_ref]),
        render.map((r) => [r.node_id, r.amount, r.amount_ref]),
        `level ${level}`,
      );
    }
  });
});

// Re-review W-b: runReportSql is exported and splices `limit` into the SQL
// text, so it validates the value itself, whatever its caller did.
describe('handleReportQuery — report access (ETP-6080)', () => {
  it('answers 403 REPORT_ACCESS_DENIED before any SQL for a report the role cannot open', async () => {
    let created = false;
    const result = await handleReportQuery(
      { reportId: 'profit-loss', headers: { cookie: COOKIE, 'x-go-csrf': CSRF }, method: 'POST', body: { params: {} } },
      { artifactsDir, etendoBase: 'x', createPool: () => { created = true; return fakePool(); },
        fetchImpl: sessionFetch({ reportAccess: { governed: ['profit-loss'], reportAccess: {} } }) },
    );
    assert.equal(result.status, 403);
    assert.equal(result.body.code, 'REPORT_ACCESS_DENIED');
    assert.equal(created, false);
  });
});

describe('runReportSql — limit', () => {
  it('throws for anything but a positive safe integer, before running any SQL', async () => {
    for (const limit of ['5; DROP TABLE x', '10', -1, 0, 2.5, 1e21, Number.NaN]) {
      const pool = fakePool();
      await assert.rejects(runReportSql(pool, PL, { clientId: 'C1', limit }), TypeError, `limit ${limit}`);
      assert.equal(pool.queries.length, 0);
    }
  });

  it('runs a main query the caller built, then the secondary ones (W4)', async () => {
    const pool = fakePool();
    await runReportSql(pool, PL, { clientId: 'C1', mainSql: 'SELECT 1 LIMIT 3' });
    assert.equal(pool.queries[0], 'SELECT 1 LIMIT 3');
    assert.equal(pool.queries.length, 2);
    assert.equal(pool.queries[1], "SELECT 'OPERANDS'");
  });

  it('runs a contract with no `sql` block (Jasper) without secondary queries', async () => {
    const pool = fakePool();
    const result = await runReportSql(pool, { parameters: [] }, { clientId: 'C1', mainSql: 'SELECT 2' });
    assert.deepEqual(pool.queries, ['SELECT 2']);
    assert.equal(result.openingRows, null);
    assert.equal(result.operandRows, null);
  });

  it('appends a valid limit to the main query only', async () => {
    const pool = fakePool();
    await runReportSql(pool, PL, { clientId: 'C1', limit: 5 });
    assert.ok(pool.queries[0].endsWith(' LIMIT 5'));
    assert.ok(!pool.queries[1].includes('LIMIT'));
  });
});

// ETP-6239 — columns by period. Without `periods` nothing changes; with them the
// period queries run once over the hull, and a bad value is a 400 before any SQL.
describe('report-query — periods (ETP-6239)', () => {
  const PERIODS = [
    '2026-01-01..2026-02-28|2025-01-01..2025-02-28|2025-11-01..2025-12-31',
    '2026-01-01..2026-01-31|2025-01-01..2025-01-31|2025-12-01..2025-12-31',
    '2026-02-01..2026-02-28|2025-02-01..2025-02-28|2026-01-01..2026-01-31',
  ].join(',');
  const PERIOD_PARAMS = { dateFrom: '2026-01-01', compareTo: 'true', columns: 'month', periods: PERIODS };
  const PL_PERIODS = {
    ...PL,
    parameters: [...PL.parameters, { name: 'dateTo' }],
    sql: {
      ...PL.sql,
      periodQuery: "SELECT 'PERIODQ' FROM (VALUES __PERIODS__) b WHERE ('__DATEFROM__' = '' OR d >= '__DATEFROM__') AND '__COMPARETO__' = 'false'",
      splitPeriodQuery: "SELECT 'SPLITP' FROM (VALUES __PERIODS__) b WHERE n = '__SPLITNODEID__'",
    },
  };
  const ROW = (account_id, idx, own_amt, own_amt_sly = 0, own_amt_prev = 0) => ({ account_id, idx, own_amt, own_amt_sly, own_amt_prev });
  const sql = (pool, marker) => pool.queries.filter((q) => q.includes(marker));

  before(() => {
    writeContract('profit-loss-periods', PL_PERIODS);
  });

  it('runReportSql skips the period query when periods is absent, empty, or the contract has no periodQuery', async () => {
    for (const [contract, params] of [[PL_PERIODS, {}], [PL_PERIODS, { periods: '' }], [PL_PERIODS, { periods: null }], [PL, PERIOD_PARAMS]]) {
      const pool = fakePool();
      const result = await runReportSql(pool, contract, { clientId: 'C1', params });
      assert.equal(sql(pool, 'PERIODQ').length, 0);
      assert.equal('periodRows' in result, false);
      assert.equal('periodSpec' in result, false);
    }
  });

  it('runs the period query once, over the hull dates with compareTo=false', async () => {
    const pool = fakePool({ PERIODQ: [ROW('S1', 0, 1)] });
    const result = await runReportSql(pool, PL_PERIODS, { clientId: 'C1', params: PERIOD_PARAMS });
    const [q] = sql(pool, 'PERIODQ');
    assert.equal(sql(pool, 'PERIODQ').length, 1);
    assert.ok(q.includes("d >= '2025-01-01'"), 'the hull start replaces dateFrom');
    assert.ok(q.includes("'false' = 'false'"), 'compareTo forced to false');
    assert.ok(q.includes("(0, '2026-01-01'::date"), 'VALUES substituted');
    assert.ok(!q.includes('__PERIODS__'));
    assert.equal(result.periodRows.length, 1);
    assert.equal(result.periodSpec.periods.length, 3);
    assert.equal(result.periodSpec.grain, 'month');
  });

  it('honours the per-format bucket cap (maxPeriodBuckets)', async () => {
    await assert.rejects(
      runReportSql(fakePool(), PL_PERIODS, { clientId: 'C1', params: PERIOD_PARAMS, maxPeriodBuckets: 2 }),
      (e) => e.name === 'ReportPeriodsError' && e.code === 'PERIOD_RANGE_TOO_LONG',
    );
  });

  it('a bad periods value is a 400 with no report SQL at all', async () => {
    const pool = fakePool();
    const res = await call('profit-loss-periods', { pool, body: { params: { ...PERIOD_PARAMS, periods: "2026-01-01'..2026-02-01|a|b" } } });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'INVALID_PERIODS');
    assert.equal(sql(pool, "'TREE'").length, 0);
    assert.equal(sql(pool, 'PERIODQ').length, 0);
    assert.equal(pool.ended, true);
  });

  it('a bad columns value is a 400 INVALID_PERIODS', async () => {
    const res = await call('profit-loss-periods', { body: { params: { ...PERIOD_PARAMS, columns: 'week' } } });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'INVALID_PERIODS');
  });

  it('an unexpected error while running the period query is a 500 QUERY_FAILED', async () => {
    const pool = fakePool({ "'TREE'": TREE_ROWS, "'OPERANDS'": OPERANDS });
    const base = pool.query.bind(pool);
    pool.query = async (q) => { if (q.includes('PERIODQ')) throw new Error('boom secret'); return base(q); };
    const res = await call('profit-loss-periods', { pool, body: { params: PERIOD_PARAMS } });
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: 'QUERY_FAILED', code: 'QUERY_FAILED' });
  });

  it('answers a tree with periods, hiddenCount and cells[] on every row', async () => {
    const pool = fakePool({
      "'TREE'": TREE_ROWS, "'OPERANDS'": OPERANDS,
      PERIODQ: [ROW('S1', 0, -500, -400), ROW('S1', 1, -200, -100), ROW('S1', 2, -300, -300)],
    });
    const res = await call('profit-loss-periods', { pool, body: { params: { ...PERIOD_PARAMS, hiddenCount: 2 } } });
    assert.equal(res.status, 200);
    assert.equal(res.body.kind, 'tree');
    assert.equal(res.body.hiddenCount, 2);
    assert.deepEqual(res.body.periods.map((p) => p.idx), [0, 1, 2]);
    assert.ok(res.body.rows.every((r) => r.cells.length === 3));
    assert.equal(res.body.rows.find((r) => r.node_id === 'S1').cells[1].amount, 200);
  });

  describe('split with periods', () => {
    const splitBody = { params: { ...PERIOD_PARAMS, splitBy: 'bpartner', splitNodeId: 'S1', splitSign: 'C' } };
    const SPLIT_ROWS = [
      { dimension_id: 'B', dimension_name: 'Beta', idx: 0, own_amt: -100, own_amt_sly: -50, own_amt_prev: 0 },
      { dimension_id: 'A', dimension_name: 'Alpha', idx: 0, own_amt: -300, own_amt_sly: -200, own_amt_prev: -100 },
      { dimension_id: 'A', dimension_name: 'Alpha', idx: 2, own_amt: -10, own_amt_sly: 0, own_amt_prev: 0 },
      { dimension_id: 'C', dimension_name: 'Aardvark', idx: 0, own_amt: -100, own_amt_sly: 0, own_amt_prev: 0 },
    ];

    it('uses splitPeriodQuery only, once, and not the plain splitQuery', async () => {
      const pool = fakePool({ SPLITP: SPLIT_ROWS });
      await call('profit-loss-periods', { pool, body: splitBody });
      assert.equal(sql(pool, 'SPLITP').length, 1);
      assert.equal(sql(pool, "'SPLIT'").length, 0);
      assert.ok(sql(pool, 'SPLITP')[0].includes("n = 'S1'"));
    });

    it('signs the amounts (C positive, D flipped), zero-fills missing periods and keeps the period list', async () => {
      const credit = (await call('profit-loss-periods', { pool: fakePool({ SPLITP: SPLIT_ROWS }), body: splitBody })).body;
      assert.equal(credit.kind, 'split');
      assert.deepEqual(credit.periods.map((p) => p.idx), [0, 1, 2]);
      const alpha = credit.rows.find((r) => r.node_id === 'A');
      assert.deepEqual(alpha.cells.map((c) => c.amount), [300, 0, 10]);
      assert.equal(alpha.cells[0].sly.amount, 200);
      assert.equal(alpha.cells[1].sly.amount, 0, 'a missing period is zero, not absent');
      assert.equal(alpha.sign, 'C');
      const debit = (await call('profit-loss-periods', {
        pool: fakePool({ SPLITP: SPLIT_ROWS }), body: { params: { ...splitBody.params, splitSign: 'D' } },
      })).body;
      assert.equal(debit.rows.find((r) => r.node_id === 'A').cells[0].amount, -300);
      assert.equal(debit.rows.find((r) => r.node_id === 'A').sign, 'D');
    });

    it('sorts by |amount| descending, ties by name', async () => {
      const { rows } = (await call('profit-loss-periods', { pool: fakePool({ SPLITP: SPLIT_ROWS }), body: splitBody })).body;
      assert.deepEqual(rows.map((r) => r.node_id), ['A', 'C', 'B']); // 300, then 100 (Aardvark before Beta)
    });

    it('a contract with no splitPeriodQuery ignores periods and answers the plain split', async () => {
      const pool = fakePool({ "'SPLIT'": [{ dimension_id: 'BP1', dimension_name: 'Acme', own_amt: -300, own_amt_ref: -200 }] });
      const res = await call('profit-loss', { pool, body: { params: { ...splitBody.params } } });
      assert.equal(res.body.rows[0].amount, 300);
      assert.equal(res.body.rows[0].cells, undefined);
      assert.equal(res.body.periods, undefined);
    });

    it('a bad periods value on a split is a 400 before any SQL', async () => {
      const pool = fakePool();
      const res = await call('profit-loss-periods', { pool, body: { params: { ...splitBody.params, periods: 'nope' } } });
      assert.equal(res.status, 400);
      assert.equal(sql(pool, 'SPLITP').length, 0);
    });
  });
});
