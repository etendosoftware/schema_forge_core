/**
 * @covers cli/src/report-db.js
 *
 * ETP-6146 — shared pool reuse, statement timeout mapping, cancel on client
 * disconnect and the per-tenant concurrency cap.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { EventEmitter } from 'node:events';
import {
  getSharedPool, resetSharedPool, closeSharedPool, getPoolLimits, withReportClient, abortOnClose,
  acquireTenantSlot, activeTenantSlots, resetTenantSlots, isStatementTimeout, ReportTimeoutError, ReportCancelledError,
} from '../src/report-db.js';

function fakeClient({ onQuery } = {}) {
  const c = { processID: 4242, queries: [], released: [], query: async (sql) => { c.queries.push(sql); return onQuery ? onQuery(sql) : { rows: [] }; }, release: (arg) => c.released.push(arg) };
  return c;
}
function fakePool(client) {
  const p = { cancels: [], connect: async () => client, query: async (sql, args) => { p.cancels.push([sql, args]); return { rows: [] }; } };
  return p;
}
const pgError = (message) => Object.assign(new Error(message), { code: '57014' });
const tick = () => new Promise((r) => setImmediate(r));

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

  it('logs an idle client error instead of crashing the process', () => {
    class P extends EventEmitter {}
    const pool = getSharedPool(P, {});
    const seen = [];
    const orig = console.error;
    console.error = (...a) => seen.push(a.join(' '));
    try {
      assert.doesNotThrow(() => pool.emit('error', new Error('terminating connection due to administrator command')));
    } finally { console.error = orig; }
    assert.match(seen[0], /administrator command/);
  });

  it('closeSharedPool ends the pool, and is safe with none', async () => {
    let ended = 0;
    class P { end() { ended++; } }
    getSharedPool(P, {});
    await closeSharedPool();
    await closeSharedPool();
    assert.equal(ended, 1);
  });
});

describe('withReportClient', () => {
  beforeEach(resetSharedPool);

  it('releases the connection normally', async () => {
    const client = fakeClient();
    assert.equal(await withReportClient(fakePool(client), undefined, async () => 'ok'), 'ok');
    assert.deepEqual(client.released, [undefined]);
  });

  it('maps a statement timeout to ReportTimeoutError, whatever language the message is in', async () => {
    for (const message of ['canceling statement due to statement timeout', 'cancelando la sentencia debido a que se agotó el tiempo de espera']) {
      const client = fakeClient();
      await assert.rejects(withReportClient(fakePool(client), undefined, async () => { throw pgError(message); }), ReportTimeoutError);
      assert.deepEqual(client.released, [true]);
    }
    assert.equal(isStatementTimeout(pgError('x')), true);
    assert.equal(isStatementTimeout(new Error('x')), false);
  });

  it('cancels the backend query when the signal aborts and drops the connection', async () => {
    const client = fakeClient();
    const pool = fakePool(client);
    const ac = new AbortController();
    await assert.rejects(
      withReportClient(pool, ac.signal, async () => { ac.abort(); throw pgError('canceling statement due to user request'); }),
      ReportCancelledError,
    );
    await tick();
    assert.deepEqual(pool.cancels, [['SELECT pg_cancel_backend($1)', [4242]]]);
    assert.deepEqual(client.released, [true]);
  });

  it('an abort followed by a 57014 whose message says "statement timeout" is still a cancel', async () => {
    const ac = new AbortController();
    await assert.rejects(
      withReportClient(fakePool(fakeClient()), ac.signal, async () => { ac.abort(); throw pgError('canceling statement due to statement timeout'); }),
      ReportCancelledError,
    );
  });

  it('sends the cancel over a dedicated client, even when the pool is saturated', async () => {
    const events = [];
    class C {
      constructor(cfg) { this.cfg = cfg; }
      async connect() { events.push('connect'); }
      async query(sql, args) { events.push([sql, args]); }
      async end() { events.push('end'); }
    }
    const client = fakeClient();
    const pool = { connect: async () => client, query: () => new Promise(() => {}) }; // a pool query would never answer
    class P extends EventEmitter { constructor() { super(); return pool; } }
    getSharedPool(P, { host: 'h' }, C);
    const ac = new AbortController();
    await assert.rejects(
      withReportClient(pool, ac.signal, async () => { ac.abort(); await tick(); throw pgError('canceled'); }),
      ReportCancelledError,
    );
    assert.deepEqual(events, ['connect', ['SELECT pg_cancel_backend($1)', [4242]], 'end']);
  });

  it('does not connect when already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await assert.rejects(withReportClient({ connect: () => assert.fail('connected') }, ac.signal, async () => {}), ReportCancelledError);
  });

  it('holds the checked-out connection until its dedicated cancel has finished', async () => {
    let finishCancel;
    let cancelEnded = false;
    let config;
    class C {
      constructor(cfg) { config = cfg; }
      async connect() {}
      query() { return new Promise((resolve) => { finishCancel = resolve; }); }
      async end() { cancelEnded = true; }
    }
    const client = fakeClient();
    const pool = fakePool(client);
    class P { constructor() { return pool; } }
    getSharedPool(P, {}, C);
    const ac = new AbortController();
    const work = withReportClient(pool, ac.signal, async () => { ac.abort(); throw pgError('canceled'); });
    const rejected = assert.rejects(work, ReportCancelledError);
    await tick();
    assert.deepEqual(client.released, [], 'releasing early permits another request and another cancel connection');
    finishCancel({ rows: [] });
    await rejected;
    assert.equal(cancelEnded, true);
    assert.deepEqual(client.released, [true]);
    assert.equal(config.statement_timeout, getPoolLimits().connectionTimeoutMillis);
    assert.equal(config.query_timeout, getPoolLimits().connectionTimeoutMillis);
  });

  it('releases a saturated pool slot before waiting for a cancel sent through the pool fallback', async () => {
    let finishCancel;
    let cancelFinished = false;
    const client = fakeClient();
    client.release = (arg) => { client.released.push(arg); finishCancel(); };
    const pool = {
      connect: async () => client,
      query: () => new Promise((resolve) => { finishCancel = () => { cancelFinished = true; resolve({ rows: [] }); }; }),
    };
    const ac = new AbortController();
    await assert.rejects(withReportClient(pool, ac.signal, async () => {
      ac.abort();
      throw pgError('canceled');
    }), ReportCancelledError);
    assert.equal(cancelFinished, true);
    assert.deepEqual(client.released, [true]);
  });

  for (const stage of ['connect', 'query']) {
    it(`destroys the pooled connection and closes the dedicated client when cancel ${stage} fails`, async (t) => {
      const logged = t.mock.method(console, 'error', () => {});
      let ended = false;
      class C {
        async connect() { if (stage === 'connect') throw new Error('connect timeout'); }
        async query() { throw new Error('Query read timeout'); }
        async end() { ended = true; }
      }
      const client = fakeClient();
      const pool = fakePool(client);
      class P { constructor() { return pool; } }
      getSharedPool(P, {}, C);
      const ac = new AbortController();
      await assert.rejects(withReportClient(pool, ac.signal, async () => {
        ac.abort();
        throw pgError('canceled');
      }), ReportCancelledError);
      assert.equal(ended, true);
      assert.deepEqual(client.released, [true]);
      assert.equal(logged.mock.callCount(), 1);
    });
  }

  it('an abort while waiting for the connection runs no SQL and releases the client', async () => {
    const client = fakeClient();
    const ac = new AbortController();
    const pool = { connect: async () => { ac.abort(); return client; } };
    await assert.rejects(withReportClient(pool, ac.signal, async () => assert.fail('ran')), ReportCancelledError);
    assert.deepEqual(client.queries, []);
    assert.deepEqual(client.released, [undefined]); // no cancel was sent: the clean connection is reused
  });

  it('an abort between two statements stops the second one', async () => {
    const client = fakeClient();
    const ac = new AbortController();
    await assert.rejects(
      withReportClient(fakePool(client), ac.signal, async (db) => {
        await db.query('first');
        ac.abort();
        await db.query('second');
      }),
      ReportCancelledError,
    );
    assert.deepEqual(client.queries, ['first']);
  });

  it('a statement timeout override is set, then reset before the connection goes back', async () => {
    const client = fakeClient();
    await withReportClient(fakePool(client), undefined, async (db) => { await db.query('work'); }, { statementTimeoutMs: 120000 });
    assert.deepEqual(client.queries, ['SET statement_timeout = 120000', 'work', 'RESET statement_timeout']);
    assert.deepEqual(client.released, [undefined]);
  });
});

describe('abortOnClose', () => {
  it('aborts when the response closes unfinished', () => {
    const res = new EventEmitter();
    res.writableFinished = false;
    const { signal } = abortOnClose(res);
    res.emit('close');
    assert.equal(signal.aborted, true);
  });

  it('does not abort after a finished response, and dispose removes the listener', () => {
    const res = new EventEmitter();
    res.writableFinished = true;
    const a = abortOnClose(res);
    res.emit('close');
    assert.equal(a.signal.aborted, false);
    const res2 = new EventEmitter();
    res2.writableFinished = false;
    const b = abortOnClose(res2);
    b.dispose();
    assert.equal(res2.listenerCount('close'), 0);
    res2.emit('close');
    assert.equal(b.signal.aborted, false);
  });
});

describe('acquireTenantSlot', () => {
  beforeEach(resetTenantSlots);
  afterEach(() => assert.equal(activeTenantSlots(), 0, 'a slot leaked'));

  it('lets at most `limit` run per tenant; a release hands the slot to the next waiter', async () => {
    const r1 = await acquireTenantSlot('T', undefined, 2);
    const r2 = await acquireTenantSlot('T', undefined, 2);
    let third = false;
    const p3 = acquireTenantSlot('T', undefined, 2).then((r) => { third = true; return r; });
    await tick();
    assert.equal(third, false);
    r1();
    const r3 = await p3;
    assert.equal(activeTenantSlots(), 2);
    r2();
    r3();
  });

  it('other tenants are not held back', async () => {
    const ra = await acquireTenantSlot('A', undefined, 1);
    const rb = await acquireTenantSlot('B', undefined, 1);
    ra();
    rb();
  });

  it('a waiter that aborts leaves the queue without taking a slot', async () => {
    const r1 = await acquireTenantSlot('Q', undefined, 1);
    const ac = new AbortController();
    const waiting = acquireTenantSlot('Q', ac.signal, 1);
    ac.abort();
    await assert.rejects(waiting, ReportCancelledError);
    r1();
  });

  it('a pre-aborted signal rejects without touching another waiter in the queue', async () => {
    const r1 = await acquireTenantSlot('P', undefined, 1);
    let got = false;
    const other = acquireTenantSlot('P', undefined, 1).then((r) => { got = true; return r; });
    const ac = new AbortController();
    ac.abort();
    await assert.rejects(acquireTenantSlot('P', ac.signal, 1), ReportCancelledError);
    r1();
    const r2 = await other;
    assert.equal(got, true);
    r2();
  });

  it('times out a queued request without taking a slot or blocking the next waiter', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const previous = process.env.REPORT_TENANT_WAIT_TIMEOUT_MS;
    process.env.REPORT_TENANT_WAIT_TIMEOUT_MS = '50';
    const release = await acquireTenantSlot('slow', undefined, 1);
    const ac = new AbortController();
    try {
      const timedOut = assert.rejects(acquireTenantSlot('slow', ac.signal, 1), ReportTimeoutError);
      t.mock.timers.tick(50);
      await timedOut;
      let nextStarted = false;
      const next = acquireTenantSlot('slow', undefined, 1).then((r) => { nextStarted = true; return r; });
      await tick();
      assert.equal(nextStarted, false);
      ac.abort(); // a late abort of the timed-out request must not remove the next waiter
      release();
      (await next)();
    } finally {
      if (previous === undefined) delete process.env.REPORT_TENANT_WAIT_TIMEOUT_MS;
      else process.env.REPORT_TENANT_WAIT_TIMEOUT_MS = previous;
    }
  });

  it('the slot count returns to 0 after success, error, timeout and abort', async () => {
    const pool = fakePool(fakeClient());
    const outcomes = [
      async () => 'ok',
      async () => { throw new Error('boom'); },
      async () => { throw pgError('timeout'); },
    ];
    for (const fn of outcomes) {
      const release = await acquireTenantSlot('Z', undefined, 2);
      try { await withReportClient(pool, undefined, fn); } catch { /* expected */ } finally { release(); }
    }
    const ac = new AbortController();
    const release = await acquireTenantSlot('Z', ac.signal, 2);
    try { await withReportClient(pool, ac.signal, async () => { ac.abort(); throw pgError('x'); }); } catch { /* expected */ } finally { release(); }
    assert.equal(activeTenantSlots(), 0);
  });
});
