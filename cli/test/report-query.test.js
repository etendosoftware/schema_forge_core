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

import { handleReportQuery, buildQueryResponse } from '../src/report-query.js';
import { buildAccountReportTree, ELEMENT_LEVEL_RANK } from '../src/report-grouping.js';

const COOKIE = '__Host-go_session=abc';
const CSRF = 'csrf-ok';

function sessionFetch({ roleOrgs = ['0'] } = {}) {
  return async () => ({
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
