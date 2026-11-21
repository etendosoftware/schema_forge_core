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

import { handleReportQuery, buildQueryResponse, runReportSql, isChartTreeRender } from '../src/report-query.js';
import { buildAccountReportTree, ELEMENT_LEVEL_RANK } from '../src/report-grouping.js';
import { maxPeriodBucketsFor } from '../src/report-periods.js';

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
      if (sql.includes('FROM ad_org WHERE')) return { rows: [{ '?column?': 1 }] }; // the fixture's orgs exist
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

describe('handleReportQuery — session and access in parallel (ETP-6146)', () => {
  const okSession = { ok: true, status: 200, json: async () => ({ environment: { clientId: 'C1', orgId: 'O1', roleId: 'R1', userId: 'U1' }, roleList: [{ id: 'R1', orgList: [{ id: '0' }] }], csrfToken: CSRF }) };
  const okAccess = { ok: true, status: 200, json: async () => ({ result: JSON.stringify({ governed: [], reportAccess: {} }) }) };
  const run = (fetchImpl) => handleReportQuery(
    { reportId: 'profit-loss', headers: { cookie: COOKIE, 'x-go-csrf': CSRF }, method: 'POST', body: {} },
    { artifactsDir, etendoBase: 'x', createPool: () => fakePool(), fetchImpl },
  );

  it('starts both Tomcat calls before either resolves', async () => {
    const started = [];
    const release = [];
    const fetchImpl = (url) => new Promise((resolve) => {
      started.push(String(url));
      release.push(() => resolve(String(url).endsWith('/sws/neo/myreportaccess') ? okAccess : okSession));
    });
    const done = run(fetchImpl);
    await new Promise((r) => setImmediate(r));
    assert.equal(started.length, 2, 'both calls in flight');
    release.forEach((r) => r());
    assert.equal((await done).status, 200);
  });

  it('an error from the session lookup is still answered', async () => {
    const res = await run(async (url) => (String(url).endsWith('/sws/neo/myreportaccess') ? okAccess : { ok: false, status: 401, json: async () => ({}) }));
    assert.equal(res.status, 401);
    assert.equal(res.body.code, 'NO_SESSION');
  });

  it('an error from the access check is still answered', async () => {
    const res = await run(async (url) => (String(url).endsWith('/sws/neo/myreportaccess') ? { ok: false, status: 500, json: async () => ({}) } : okSession));
    assert.equal(res.status, 502);
    assert.equal(res.body.code, 'REPORT_ACCESS_UNAVAILABLE');
  });
});

describe('handleReportQuery — shared pool (ETP-6146)', () => {
  const sharedPool = (queryImpl) => {
    const client = { processID: 7, released: [], query: queryImpl, release: (a) => client.released.push(a) };
    return { client, connect: async () => client, query: async () => ({ rows: [] }), end: () => assert.fail('shared pool ended') };
  };
  const run = (pool, signal) => handleReportQuery(
    { reportId: 'profit-loss', headers: { cookie: COOKIE, 'x-go-csrf': CSRF }, method: 'POST', body: {} },
    { artifactsDir, etendoBase: 'x', pool, signal, fetchImpl: sessionFetch() },
  );

  it('uses a client of the shared pool, releases it and never ends the pool', async () => {
    const pool = sharedPool(async () => ({ rows: [] }));
    const res = await run(pool);
    assert.equal(res.status, 200);
    assert.deepEqual(pool.client.released, [undefined]);
  });

  it('a statement timeout answers 504 REPORT_TIMEOUT', async () => {
    const pool = sharedPool(async (sql) => {
      if (sql.includes('ad_org')) return { rows: [{ '?column?': 1 }] };
      throw Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' });
    });
    const res = await run(pool);
    assert.deepEqual(res, { status: 504, body: { error: 'REPORT_TIMEOUT', code: 'REPORT_TIMEOUT' } });
  });

  it('an abort during the SQL cancels the backend and answers REPORT_CANCELLED', async () => {
    const ac = new AbortController();
    const cancels = [];
    const pool = sharedPool(async (sql) => {
      if (sql.includes('ad_org')) return { rows: [{ '?column?': 1 }] };
      ac.abort();
      throw Object.assign(new Error('canceling statement due to user request'), { code: '57014' });
    });
    pool.query = async (sql, args) => { cancels.push([sql, args]); return { rows: [] }; };
    const res = await run(pool, ac.signal);
    assert.equal(res.body.code, 'REPORT_CANCELLED');
    assert.deepEqual(cancels, [['SELECT pg_cancel_backend($1)', [7]]]);
    assert.deepEqual(pool.client.released, [true]);
  });
});

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

  it('403 ORG_ACCESS_DENIED for a role with org 0 asking for an org that does not exist', async () => {
    const pool = {
      queries: [], ended: false,
      async query(sql) { this.queries.push(sql); return { rows: [] }; },
      async end() { this.ended = true; },
    };
    const res = await call('profit-loss', { body: { params: { orgId: 'GHOST' } }, roleOrgs: ['0'], pool });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'ORG_ACCESS_DENIED');
    assert.ok(pool.queries.every((q) => !q.includes("'TREE'")));
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

  it('a comparison mode only looks at the last 6 months and the Total; none looks at every period (screen query)', async () => {
    const months = ['01', '02', '03', '04', '05', '06', '07'].map((m) => `2026-${m}-01..2026-${m}-28|2025-${m}-01..2025-${m}-28|2025-${m}-01..2025-${m}-28`);
    const periods = [`2026-01-01..2026-07-28|2025-01-01..2025-07-28|2025-01-01..2025-07-28`, ...months].join(',');
    // S1 moves only in January (the oldest period, trimmed by a comparison) and nets to zero over the range.
    const pool = fakePool({ "'TREE'": TREE_ROWS, "'OPERANDS'": OPERANDS, PERIODQ: [ROW('S1', 1, -80, -80, -80)] });
    const res = await call('profit-loss-periods', { pool, body: { params: { ...PERIOD_PARAMS, periods, showOnlyAccountsWithValue: 'true' } } });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.rows.find((r) => r.node_id === 'S1').visible, { none: true, sly: false, prev: false });
  });

  describe('period request validation (before any SQL)', () => {
    const LONG = '2023-01-01..2025-12-31|2022-01-01..2022-12-31|2020-01-01..2022-12-31';
    const MONTH = '2024-02-01..2024-02-29|2023-02-01..2023-02-28|2024-01-01..2024-01-31';
    const OUTSIDE = '2026-01-01..2026-01-31|2025-01-01..2025-01-31|2025-12-01..2025-12-31';
    const longParams = (periods) => ({ dateFrom: '2023-01-01', columns: 'month', periods });
    const YEAR = {
      ...PL_PERIODS,
      parameters: [...PL_PERIODS.parameters, { name: 'yearId' }, { name: 'referenceYearId' }, { name: 'bPartnerId' }],
      sql: {
        ...PL_PERIODS.sql,
        query: "SELECT 'TREE' WHERE ('__YEARID__' = '' OR y = '__YEARID__') AND ('__BPARTNERID__' = '' OR bp = '__BPARTNERID__')",
        periodQuery: "SELECT 'PERIODQ' FROM (VALUES __PERIODS__) b WHERE true AND ('__YEARID__' = '' OR y = '__YEARID__') AND ('__REFERENCEYEARID__' = '' OR ry = '__REFERENCEYEARID__')",
        splitPeriodQuery: "SELECT 'SPLITP' FROM (VALUES __PERIODS__) b WHERE true AND ('__YEARID__' = '' OR y = '__YEARID__') AND n = '__SPLITNODEID__'",
      },
    };

    it('a 3-year range is accepted on screen and in the PDF, refused with PERIOD_RANGE_TOO_LONG for xlsx and csv', async () => {
      const params = longParams(`${LONG},${MONTH}`);
      for (const maxPeriodBuckets of [undefined, 7]) {
        const pool = fakePool();
        await runReportSql(pool, PL_PERIODS, { clientId: 'C1', params, maxPeriodBuckets });
        assert.equal(sql(pool, 'PERIODQ').length, 1);
      }
      for (const format of ['xlsx', 'csv']) {
        const pool = fakePool();
        await assert.rejects(
          runReportSql(pool, PL_PERIODS, { clientId: 'C1', params, maxPeriodBuckets: maxPeriodBucketsFor(format) }),
          (e) => e.name === 'ReportPeriodsError' && e.code === 'PERIOD_RANGE_TOO_LONG',
        );
        assert.equal(pool.queries.length, 0, 'no SQL for a refused period');
      }
    });

    it('/query accepts the 3-year range (screen cap)', async () => {
      const res = await call('profit-loss-periods', { body: { params: longParams(`${LONG},${MONTH}`) } });
      assert.equal(res.status, 200);
    });

    it('a bucket outside bucket 0 is a 400 INVALID_PERIODS on /query, runReportSql and the split, with no SQL', async () => {
      const params = longParams(`${LONG},${OUTSIDE}`);
      const pool = fakePool();
      const res = await call('profit-loss-periods', { pool, body: { params } });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'INVALID_PERIODS');
      assert.equal(sql(pool, "'TREE'").length + sql(pool, 'PERIODQ').length, 0);

      await assert.rejects(runReportSql(fakePool(), PL_PERIODS, { clientId: 'C1', params }), (e) => e.code === 'INVALID_PERIODS');

      const splitPool = fakePool();
      const split = await call('profit-loss-periods', { pool: splitPool, body: { params: { ...params, splitBy: 'bpartner', splitNodeId: 'S1' } } });
      assert.equal(split.status, 400);
      assert.equal(split.body.code, 'INVALID_PERIODS');
      assert.equal(sql(splitPool, 'SPLITP').length, 0);
    });

    it('yearId and referenceYearId sent with periods never reach the period query or the split period query', async () => {
      const pool = fakePool();
      const params = { ...PERIOD_PARAMS, yearId: 'YEAR-X', referenceYearId: 'REF-X' };
      await runReportSql(pool, YEAR, { clientId: 'C1', params });
      const [period] = sql(pool, 'PERIODQ');
      assert.ok(!period.includes('YEAR-X') && !period.includes('REF-X'), 'the period query ignores both years');
      assert.ok(!period.includes('y ='), 'the blank year clause is stripped');
      assert.ok(sql(pool, "'TREE'")[0].includes("y = 'YEAR-X'"), 'the main query still reads yearId');

      const splitPool = fakePool();
      await call('profit-loss-periods', { pool: splitPool, body: { params: { ...params, splitBy: 'bpartner', splitNodeId: 'S1' } } });
      assert.equal(sql(splitPool, 'SPLITP').length, 1);
    });

    it('the split period query ignores yearId too', async () => {
      writeContract('profit-loss-year', YEAR);
      const pool = fakePool();
      await call('profit-loss-year', { pool, body: { params: { ...PERIOD_PARAMS, yearId: 'YEAR-X', splitBy: 'bpartner', splitNodeId: 'S1' } } });
      const [q] = sql(pool, 'SPLITP');
      assert.ok(q && !q.includes('YEAR-X'));
    });

    it('a request value carrying __PERIODS__ is a 400 INVALID_PERIODS on /query, runReportSql and the split, with no SQL', async () => {
      writeContract('profit-loss-year', YEAR);
      const evil = { ...PERIOD_PARAMS, bPartnerId: "x__PERIODS__' OR '1'='1" };
      const pool = fakePool();
      const res = await call('profit-loss-year', { pool, body: { params: evil } });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'INVALID_PERIODS');
      assert.equal(sql(pool, "'TREE'").length + sql(pool, 'PERIODQ').length, 0);

      const renderPool = fakePool();
      await assert.rejects(runReportSql(renderPool, YEAR, { clientId: 'C1', params: evil }), (e) => e.code === 'INVALID_PERIODS');
      assert.equal(renderPool.queries.length, 0);

      const splitPool = fakePool();
      const split = await call('profit-loss-year', { pool: splitPool, body: { params: { ...evil, splitBy: 'bpartner', splitNodeId: 'S1' } } });
      assert.equal(split.status, 400);
      assert.equal(split.body.code, 'INVALID_PERIODS');
      assert.equal(sql(splitPool, 'SPLITP').length, 0);
    });
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

describe('report-query — chart tree (ETP-6084)', () => {
  const TB = {
    tree: 'chart',
    parameters: [{ name: 'orgId' }, { name: 'dateFrom' }, { name: 'dateTo' }, { name: 'compareTo' }, { name: 'showOnlyAccountsWithValue' }],
    sql: {
      query: "SELECT 'OLDQ' WHERE ('__DATEFROM__' = '' OR d >= '__DATEFROM__')",
      treeQuery: "SELECT 'TREEQ' WHERE ('__DATEFROM__' = '' OR d >= '__DATEFROM__') AND ('__DATETO__' = '' OR d <= '__DATETO__') AND '__COMPARETO__' = 'false'",
      periodQuery: "SELECT 'PERIODQ' FROM (VALUES __PERIODS__) b WHERE '__DATEFROM__' <> '' AND '__DATETO__' <> ''",
    },
  };
  const CHART = (id, parent, amounts = {}) => ({
    node_id: id, parent_id: parent, sort_path: id, value: id, name: id, elementlevel: parent ? 'S' : 'E', account_id: id, dimension_id: null,
    opening_balance: 0, activity_debit: 0, activity_credit: 0, closing_balance: 0, ...amounts,
  });
  const TREE = [CHART('E1', null), CHART('S1', 'E1', { activity_debit: 10, closing_balance: 10 }), CHART('S2', 'E1', { activity_credit: 10, closing_balance: -10 })];
  const PERIODS = '2026-01-01..2026-02-28|2025-01-01..2025-02-28|2025-11-01..2025-12-31';

  before(() => {
    writeContract('trial-balance-chart', TB);
    writeContract('trial-balance-old', { ...TB, tree: undefined });
  });

  it('/query runs sql.treeQuery (not sql.query) and answers a tree with rows, totals and the balance check', async () => {
    const pool = fakePool({ TREEQ: TREE });
    const { status, body } = await call('trial-balance-chart', { pool, body: { params: { dateFrom: '2026-01-01', dateTo: '2026-02-28' } } });
    assert.equal(status, 200);
    assert.equal(body.kind, 'tree');
    assert.ok(pool.queries.some((q) => q.includes('TREEQ')));
    assert.ok(!pool.queries.some((q) => q.includes('OLDQ')));
    assert.deepEqual(body.rows.map((r) => r.node_id), ['E1', 'S1', 'S2']);
    assert.equal(body.totals[0].debit.amount, 10);
    assert.equal(body.balance.balanced, true);
  });

  it('a contract without tree: chart still runs sql.query as before', async () => {
    const pool = fakePool({ OLDQ: [{ a: 1 }] });
    const { body } = await call('trial-balance-old', { pool, body: { params: {} } });
    assert.equal(body.kind, 'rows');
    assert.ok(!pool.queries.some((q) => q.includes('TREEQ')));
  });

  it('with periods it runs periodQuery on the date hull and treeQuery on the hull too, without comparison', async () => {
    const pool = fakePool({ TREEQ: TREE, PERIODQ: [{ idx: 0, account_id: 'S1', dimension_id: null, activity_debit: 10, closing_balance: 10 }] });
    const params = { dateFrom: '2026-01-01', dateTo: '2026-02-28', compareTo: 'true', columns: 'total', periods: PERIODS };
    const { body } = await call('trial-balance-chart', { pool, body: { params } });
    const tree = pool.queries.find((q) => q.includes('TREEQ'));
    assert.ok(tree.includes("d >= '2025-01-01'") && tree.includes("d <= '2026-02-28'")); // hull of every range
    assert.ok(tree.includes("'false' = 'false'"));
    assert.ok(pool.queries.find((q) => q.includes('PERIODQ')).includes('(0, '));
    assert.equal(body.periods.length, 1);
    assert.equal(body.rows.find((r) => r.node_id === 'S1').cells[0].debit.amount, 10);
    assert.equal(body.totals[0].debit.amount, 10);
  });

  it('does not cap treeQuery with the limit (a cap would drop chart nodes)', async () => {
    const pool = fakePool({ TREEQ: TREE });
    await runReportSql(pool, TB, { clientId: 'C', params: {}, limit: 5, chartTree: true });
    assert.ok(!pool.queries.some((q) => /LIMIT/.test(q)));
  });

  it('refuses a chart tree contract with no treeQuery', async () => {
    await assert.rejects(runReportSql(fakePool(), { tree: 'chart', sql: { query: 'SELECT 1' } }, { clientId: 'C', chartTree: true }), /treeQuery/);
  });

  it('/render takes the tree path only for a chart contract with expandedNodeIds', () => {
    assert.equal(isChartTreeRender(TB, { expandedNodeIds: 'E1' }), true);
    assert.equal(isChartTreeRender(TB, { expandedNodeIds: 'none' }), true);
    assert.equal(isChartTreeRender(TB, { expandedNodeIds: '' }), false); // the old viewer sends '' for what it has none of
    assert.equal(isChartTreeRender(TB, { visibleNodeIds: 'E1,S1' }), true);
    assert.equal(isChartTreeRender(TB, {}), false);
    assert.equal(isChartTreeRender({ ...TB, tree: undefined }, { expandedNodeIds: 'E1' }), false);
  });

  it('buildQueryResponse leaves the PyG answer untouched', () => {
    const out = buildQueryResponse({ sql: { operandsQuery: 'x' } }, {}, { rows: TREE_ROWS, operandRows: OPERANDS });
    assert.equal(out.kind, 'tree');
    assert.equal(out.totals, undefined);
  });
});

describe('Balance Sheet answers (ETP-6083)', () => {
  const bn = (id, parent, path, group, sign, extra = {}) => ({
    node_id: id, parent_id: parent, sort_path: path, group_name: group, value: id, name: id,
    elementlevel: parent ? 'C' : 'E', isalwaysshown: 'N', accountsign: sign, own_amt: 0, own_amt_ref: 0, issummary: parent ? 'N' : 'Y', ...extra,
  });
  const ROWS = [
    bn('RA', null, '0', 'Activo', 'D'), bn('A', 'RA', '1', 'Activo', 'D'), bn('cash', 'A', '1.1', 'Activo', 'D', { own_amt: 100 }),
    bn('RP', null, '2', 'PN', 'C'), bn('P', 'RP', '2.0', 'PN', 'C'), bn('r129', 'P', '2.1', 'PN', 'C', { own_amt: -100, result_onthefly: -40 }),
  ];
  const BS = { balanceCheck: true, sql: { operandsQuery: 'x' } };

  it('/query tree carries balance only for a balanceCheck contract', () => {
    const on = buildQueryResponse(BS, {}, { rows: ROWS, operandRows: [] });
    assert.deepEqual(on.balance, { balanced: true, activo: 100, pnPasivo: 100, diff: 0 });
    assert.equal(on.balanceRef, undefined);
    assert.deepEqual(on.rows.find((r) => r.node_id === 'r129').result, { onTheFly: 40, posted: 60 });
    const off = buildQueryResponse({ sql: { operandsQuery: 'x' } }, {}, { rows: ROWS, operandRows: [] });
    assert.ok(!('balance' in off));
  });

  it('a period answer carries balance / balanceRef and the cell result', () => {
    const periodRows = [
      { account_id: 'cash', idx: 0, own_amt: 100, own_amt_sly: 80, own_amt_prev: 0 },
      { account_id: 'r129', idx: 0, own_amt: -100, own_amt_sly: -80, own_amt_prev: 0, own_result: -40, own_result_sly: -30, own_result_prev: null },
    ];
    const periodSpec = { periods: [{ idx: 0, dateFrom: '2026-01-01', dateTo: '2026-03-31', partial: false }], hiddenCount: 0 };
    const out = buildQueryResponse(BS, { columns: 'total' }, { rows: ROWS, operandRows: [], periodRows, periodSpec });
    assert.equal(out.balance.balanced, true);
    assert.equal(out.balanceRef.sly.balanced, true);
    assert.deepEqual(out.rows.find((r) => r.node_id === 'r129').cells[0].result.sly, { onTheFly: 30, posted: 50 });
  });

  it('split rows of the income-summary node carry result in the split sign', async () => {
    writeContract('balance-sheet-split', { ...BS, sql: { ...BS.sql, query: "SELECT 'T'", splitQuery: "SELECT 'BSSPLIT' WHERE n = '__SPLITNODEID__'" } });
    const pool = fakePool({ BSSPLIT: [
      { dimension_id: 'B1', dimension_name: 'Acme', own_amt: -100, own_amt_ref: 0, result_onthefly: -40 },
      { dimension_id: 'B2', dimension_name: 'Beta', own_amt: -10, own_amt_ref: 0 },
    ] });
    const res = await call('balance-sheet-split', { pool, body: { params: { splitBy: 'bpartner', splitNodeId: 'r129', splitSign: 'C' } } });
    const [acme, beta] = res.body.rows;
    assert.deepEqual(acme.result, { onTheFly: 40, posted: 60 });
    assert.ok(!('result' in beta));
  });

  it('a period split carries cells[i].result', async () => {
    writeContract('balance-sheet-splitp', { ...BS, sql: { ...BS.sql, query: "SELECT 'T'", periodQuery: 'SELECT 1 FROM (VALUES __PERIODS__) b', splitQuery: 'x',
      splitPeriodQuery: "SELECT 'BSSPLITP' WHERE n = '__SPLITNODEID__' AND z IN (VALUES __PERIODS__)" } });
    const pool = fakePool({ BSSPLITP: [{ dimension_id: 'B1', dimension_name: 'Acme', idx: 0, own_amt: -100, own_amt_sly: -50, own_amt_prev: 0, own_result: -40, own_result_sly: -20, own_result_prev: null }] });
    const res = await call('balance-sheet-splitp', { pool, body: { params: { periods: '2026-01-01..2026-03-31|2025-01-01..2025-03-31|2025-10-01..2025-12-31', columns: 'total', splitBy: 'bpartner', splitNodeId: 'r129', splitSign: 'C' } } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.rows[0].cells[0].result, { onTheFly: 40, posted: 60, sly: { onTheFly: 20, posted: 30 }, prev: { onTheFly: 0, posted: 0 } });
  });
});
