/**
 * @covers cli/src/report-db.js
 *
 * ETP-6146 — shared pool reuse, statement timeout mapping, cancel on client
 * disconnect and the per-tenant concurrency cap.
 */
import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { getSharedPool, resetSharedPool, getPoolLimits, withReportClient, acquireTenantSlot, ReportTimeoutError, ReportCancelledError } from '../src/report-db.js';

function fakeClient({ onQuery } = {}) {
  const c = { processID: 4242, released: [], query: async (sql) => onQuery?.(sql) ?? { rows: [] }, release: (arg) => c.released.push(arg) };
  return c;
}
function fakePool(client) {
  const p = { cancels: [], connect: async () => client, query: async (sql, args) => { p.cancels.push([sql, args]); return { rows: [] }; } };
  return p;
}
const pgError = (message) => Object.assign(new Error(message), { code: '57014' });

describe('shared pool', () => {
  beforeEach(resetSharedPool);

  it('is created once with the explicit limits and reused', () => {
    const created = [];
    class P { constructor(cfg) { created.push(cfg); } }
    const a = getSharedPool(P, { host: 'h' });
    const b = getSharedPool(P, { host: 'h' });
    assert.equal(a, b);
    assert.equal(created.length, 1);
    assert.deepEqual(created[0], { host: 'h', ...getPoolLimits() });
    assert.ok(created[0].max > 0 && created[0].statement_timeout > 0 && created[0].connectionTimeoutMillis > 0 && created[0].idleTimeoutMillis > 0);
  });
});

describe('withReportClient', () => {
  it('releases the connection normally', async () => {
    const client = fakeClient();
    assert.equal(await withReportClient(fakePool(client), undefined, async () => 'ok'), 'ok');
    assert.deepEqual(client.released, [undefined]);
  });

  it('maps a statement timeout to ReportTimeoutError', async () => {
    const client = fakeClient();
    await assert.rejects(
      withReportClient(fakePool(client), undefined, async () => { throw pgError('canceling statement due to statement timeout'); }),
      ReportTimeoutError,
    );
  });

  it('cancels the backend query when the signal aborts and drops the connection', async () => {
    const client = fakeClient();
    const pool = fakePool(client);
    const ac = new AbortController();
    await assert.rejects(
      withReportClient(pool, ac.signal, async () => {
        ac.abort();
        throw pgError('canceling statement due to user request');
      }),
      ReportCancelledError,
    );
    assert.deepEqual(pool.cancels, [['SELECT pg_cancel_backend($1)', [4242]]]);
    assert.deepEqual(client.released, [true]);
  });

  it('does not connect when already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await assert.rejects(withReportClient({ connect: () => assert.fail('connected') }, ac.signal, async () => {}), ReportCancelledError);
  });
});

describe('acquireTenantSlot', () => {
  it('lets at most `limit` run per tenant; the next waits for a release', async () => {
    const r1 = await acquireTenantSlot('T', undefined, 2);
    await acquireTenantSlot('T', undefined, 2);
    let third = false;
    const p3 = acquireTenantSlot('T', undefined, 2).then((r) => { third = true; return r; });
    await new Promise((r) => setImmediate(r));
    assert.equal(third, false);
    r1();
    (await p3)();
  });

  it('other tenants are not held back', async () => {
    await acquireTenantSlot('A', undefined, 1);
    const rb = await acquireTenantSlot('B', undefined, 1);
    rb();
  });

  it('a waiter that aborts leaves the queue', async () => {
    const r1 = await acquireTenantSlot('Q', undefined, 1);
    const ac = new AbortController();
    const waiting = acquireTenantSlot('Q', ac.signal, 1);
    ac.abort();
    await assert.rejects(waiting, ReportCancelledError);
    r1();
  });
});
