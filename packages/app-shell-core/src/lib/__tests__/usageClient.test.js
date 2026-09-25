import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  KEEPALIVE_MAX_BYTES,
  USAGE_ENDPOINT,
  createUsageClient,
  getUsageClient,
  resetUsageClientForTests,
  resolveAppVersion,
  sanitizeUsageProperties,
} from '../usage/usageClient.js';
import { buildUsageCatalog, defineUsageEvent } from '../usage/usageEvents.js';

const NOW = Date.UTC(2026, 8, 23, 10, 0, 0);

const CATALOG = buildUsageCatalog([
  defineUsageEvent('ui.table.only', { destinations: ['table'] }),
  defineUsageEvent('ui.mixpanel.only', { destinations: ['mixpanel'] }),
  defineUsageEvent('ui.both', { destinations: ['table', 'mixpanel'] }),
]);

/** Fake timers: records every schedule/cancel; `fire()` runs the pending callbacks. */
function fakeTimers() {
  let nextId = 1;
  const pending = new Map();
  const scheduled = [];
  const cleared = [];
  return {
    scheduled,
    cleared,
    pending,
    setTimer: (fn, ms) => {
      const id = nextId++;
      pending.set(id, fn);
      scheduled.push({ id, ms });
      return id;
    },
    clearTimer: (id) => {
      cleared.push(id);
      pending.delete(id);
    },
    fire() {
      const fns = [...pending.values()];
      pending.clear();
      fns.forEach((fn) => fn());
    },
  };
}

/** Fake EventTarget for doc/win. */
function fakeTarget(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    listeners,
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type, fn) => {
      if (listeners.get(type) === fn) listeners.delete(type);
    },
    dispatch: (type) => listeners.get(type)?.(),
  };
}

function setup(overrides = {}) {
  const timers = fakeTimers();
  const calls = [];
  const request = overrides.request ?? ((path, init) => {
    calls.push({ path, init, body: JSON.parse(init.body) });
    return Promise.resolve({ ok: true });
  });
  const warnings = [];
  const client = createUsageClient({
    catalog: CATALOG,
    now: () => NOW,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    doc: null,
    win: null,
    appVersion: '',
    warn: (m) => warnings.push(m),
    request,
    ...overrides,
  });
  return { client, timers, calls, warnings };
}

const sentEvents = (calls) => calls.flatMap((c) => c.body.events);

describe('createUsageClient — catalog routing', () => {
  it('ignores an unknown type: nothing buffered, no sink, one warning per type', async () => {
    const mixpanel = [];
    const { client, calls, warnings, timers } = setup();
    client.setMixpanel((t, p) => mixpanel.push([t, p]));
    client.track('ui.unknown');
    client.track('ui.unknown');
    client.track('ui.other.unknown');
    assert.equal(client.pendingCount(), 0);
    assert.equal(timers.scheduled.length, 0);
    await client.flush();
    assert.equal(calls.length, 0);
    assert.equal(mixpanel.length, 0);
    assert.equal(warnings.length, 2);
    assert.match(warnings[0], /ui\.unknown/);
    assert.match(warnings[1], /ui\.other\.unknown/);
  });

  it('sends a mixpanel-only event to the sink and leaves the buffer empty', async () => {
    const mixpanel = [];
    const { client, calls } = setup({ mixpanel: (t, p) => mixpanel.push([t, p]) });
    client.track('ui.mixpanel.only', { target: 'btn' });
    assert.deepEqual(mixpanel, [['ui.mixpanel.only', { target: 'btn' }]]);
    assert.equal(client.pendingCount(), 0);
    await client.flush();
    assert.equal(calls.length, 0);
  });

  it('fans a table+mixpanel event to both, with flat mixpanel props and no sessionKey', async () => {
    const mixpanel = [];
    const { client, calls } = setup({ mixpanel: (t, p) => mixpanel.push([t, p]) });
    client.track('ui.both', {
      target: 't', action: 'a', outcome: 'ok', errorCode: 'E1', durationMs: 12.6,
      sessionKey: 'sess-1', properties: { window: 'sales-order', count: 3, nested: { x: 1 } },
    });
    assert.equal(mixpanel.length, 1);
    assert.deepEqual(mixpanel[0], ['ui.both', {
      target: 't', action: 'a', outcome: 'ok', errorCode: 'E1', durationMs: 13,
      window: 'sales-order', count: 3,
    }]);
    assert.equal(client.pendingCount(), 1);
    await client.flush();
    const [event] = sentEvents(calls);
    assert.equal(event.sessionKey, 'sess-1');
    assert.equal(event.eventType, 'ui.both');
  });

  it('skips the mixpanel side when no sink is set', () => {
    const { client } = setup();
    assert.doesNotThrow(() => client.track('ui.both'));
    assert.equal(client.pendingCount(), 1);
  });

  it('setMixpanel with a non-function clears the sink', () => {
    const mixpanel = [];
    const { client } = setup({ mixpanel: (t) => mixpanel.push(t) });
    client.setMixpanel('nope');
    client.track('ui.mixpanel.only');
    assert.equal(mixpanel.length, 0);
  });
});

describe('createUsageClient — table payload', () => {
  it('builds the minimal event: eventType, source ui, occurredAt from now; empty fields omitted', async () => {
    const { client, calls } = setup();
    client.track('ui.table.only', { target: '', action: undefined, outcome: 42, errorCode: null });
    await client.flush();
    assert.deepEqual(sentEvents(calls), [{
      eventType: 'ui.table.only', source: 'ui', occurredAt: new Date(NOW).toISOString(),
    }]);
  });

  it('includes every non-empty string field', async () => {
    const { client, calls } = setup();
    client.track('ui.table.only', { target: 't', action: 'a', outcome: 'o', errorCode: 'e', sessionKey: 's' });
    await client.flush();
    const [event] = sentEvents(calls);
    assert.deepEqual(
      { target: event.target, action: event.action, outcome: event.outcome, errorCode: event.errorCode, sessionKey: event.sessionKey },
      { target: 't', action: 'a', outcome: 'o', errorCode: 'e', sessionKey: 's' },
    );
  });

  it('adds appVersion only when set', async () => {
    const without = setup();
    without.client.track('ui.table.only');
    await without.client.flush();
    assert.equal('appVersion' in sentEvents(without.calls)[0], false);

    const withVersion = setup({ appVersion: '1.2.3' });
    withVersion.client.track('ui.table.only');
    await withVersion.client.flush();
    assert.equal(sentEvents(withVersion.calls)[0].appVersion, '1.2.3');
  });

  it('drops non-primitive / non-finite properties and omits an empty properties bag', async () => {
    const { client, calls } = setup();
    client.track('ui.table.only', {
      properties: { s: 'x', n: 1, b: false, o: {}, a: [1], nul: null, nan: NaN, inf: Infinity, u: undefined },
    });
    client.track('ui.table.only', { properties: { o: {}, a: [], nul: null, nan: NaN } });
    client.track('ui.table.only', { properties: {} });
    await client.flush();
    const [first, second, third] = sentEvents(calls);
    assert.deepEqual(first.properties, { s: 'x', n: 1, b: false });
    assert.equal('properties' in second, false);
    assert.equal('properties' in third, false);
  });

  it('rounds durationMs and drops negative / non-finite values', async () => {
    const { client, calls } = setup();
    for (const durationMs of [12.4, 12.5, 0, -1, NaN, Infinity, '5']) {
      client.track('ui.table.only', { durationMs });
    }
    await client.flush();
    assert.deepEqual(sentEvents(calls).map((e) => e.durationMs), [12, 13, 0, undefined, undefined, undefined, undefined]);
  });

  it('treats non-object fields as empty', async () => {
    const { client, calls } = setup();
    client.track('ui.table.only', 'garbage');
    client.track('ui.table.only', null);
    await client.flush();
    assert.equal(sentEvents(calls).length, 2);
  });
});

describe('sanitizeUsageProperties', () => {
  it('returns undefined for non-object input', () => {
    for (const input of [null, undefined, 'x', 3, [1, 2]]) {
      assert.equal(sanitizeUsageProperties(input), undefined);
    }
  });
});

describe('createUsageClient — flush triggers', () => {
  it('first event schedules one timer; later events do not reschedule', async () => {
    const { client, timers, calls } = setup();
    client.track('ui.table.only');
    client.track('ui.table.only');
    client.track('ui.table.only');
    assert.equal(timers.scheduled.length, 1);
    assert.equal(timers.scheduled[0].ms, 10_000);
    assert.equal(calls.length, 0);
    timers.fire();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.events.length, 3);
    assert.equal(client.pendingCount(), 0);
    client.track('ui.table.only');
    assert.equal(timers.scheduled.length, 2, 'a new timer after the previous one fired');
  });

  it('honours a custom flushIntervalMs', () => {
    const { client, timers } = setup({ flushIntervalMs: 250 });
    client.track('ui.table.only');
    assert.equal(timers.scheduled[0].ms, 250);
  });

  it('flushes immediately at 20 events and cancels the pending timer', () => {
    const { client, timers, calls } = setup();
    for (let i = 0; i < 19; i++) client.track('ui.table.only');
    assert.equal(calls.length, 0);
    const timerId = timers.scheduled[0].id;
    client.track('ui.table.only');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.events.length, 20);
    assert.ok(timers.cleared.includes(timerId));
    assert.equal(timers.pending.size, 0);
    assert.equal(client.pendingCount(), 0);
  });

  it('chunks a manual flush into requests of at most 50 events', async () => {
    const { client, calls } = setup({ flushAtSize: 1000 });
    for (let i = 0; i < 120; i++) client.track('ui.table.only', { target: `t${i}` });
    assert.equal(calls.length, 0);
    await client.flush();
    assert.deepEqual(calls.map((c) => c.body.events.length), [50, 50, 20]);
    assert.deepEqual(sentEvents(calls).map((e) => e.target), Array.from({ length: 120 }, (_, i) => `t${i}`));
  });

  it('drops the oldest events past maxBuffer and counts them', async () => {
    const { client, calls } = setup({ flushAtSize: 1000, maxBuffer: 5 });
    for (let i = 0; i < 8; i++) client.track('ui.table.only', { target: `t${i}` });
    assert.equal(client.pendingCount(), 5);
    assert.equal(client.droppedCount(), 3);
    await client.flush();
    assert.deepEqual(sentEvents(calls).map((e) => e.target), ['t3', 't4', 't5', 't6', 't7']);
  });

  it('an empty flush sends no request', async () => {
    const { client, calls } = setup();
    await client.flush();
    assert.equal(calls.length, 0);
  });
});

describe('createUsageClient — request options', () => {
  it('POSTs to the usage endpoint with on401 ignore and keepalive for small bodies', async () => {
    const { client, calls } = setup();
    client.track('ui.table.only');
    await client.flush();
    assert.equal(USAGE_ENDPOINT, '/sws/neo/usage');
    assert.equal(calls[0].path, USAGE_ENDPOINT);
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.on401, 'ignore');
    assert.equal(calls[0].init.keepalive, true);
  });

  it('drops keepalive for a body above KEEPALIVE_MAX_BYTES', async () => {
    const { client, calls } = setup();
    client.track('ui.table.only', { properties: { blob: 'x'.repeat(KEEPALIVE_MAX_BYTES + 1) } });
    client.track('ui.table.only', { properties: { blob: 'x'.repeat(KEEPALIVE_MAX_BYTES - 1000) } });
    await client.flush();
    assert.equal(calls.length, 1, 'both events in one chunk');
    assert.equal(calls[0].init.keepalive, false);

    const small = setup();
    small.client.track('ui.table.only', { properties: { blob: 'x'.repeat(KEEPALIVE_MAX_BYTES - 1000) } });
    await small.client.flush();
    assert.ok(small.calls[0].init.body.length <= KEEPALIVE_MAX_BYTES);
    assert.equal(small.calls[0].init.keepalive, true);
  });
});

describe('createUsageClient — failures are swallowed', () => {
  it('a rejected request still resolves flush', async () => {
    const { client } = setup({ request: () => Promise.reject(new Error('offline')) });
    client.track('ui.table.only');
    await assert.doesNotReject(client.flush());
    assert.equal(await client.flush(), undefined);
  });

  it('a request that throws synchronously still resolves flush', async () => {
    const { client } = setup({ request: () => { throw new Error('boom'); } });
    client.track('ui.table.only');
    await assert.doesNotReject(client.flush());
  });

  it('track never throws when the size flush hits a throwing request', () => {
    const { client } = setup({ flushAtSize: 1, request: () => { throw new Error('boom'); } });
    assert.doesNotThrow(() => client.track('ui.table.only'));
  });

  it('a throwing mixpanel sink does not stop the table side', async () => {
    const { client, calls } = setup({ mixpanel: () => { throw new Error('mixpanel down'); } });
    assert.doesNotThrow(() => client.track('ui.both'));
    await client.flush();
    assert.equal(sentEvents(calls).length, 1);
  });

  it('track never throws when the catalog itself throws', () => {
    const { client } = setup({ catalog: { get: () => { throw new Error('bad catalog'); } } });
    assert.doesNotThrow(() => client.track('ui.table.only'));
  });
});

describe('createUsageClient — page lifecycle', () => {
  it('registers listeners on first table event, flushes on hidden and pagehide, not on visible', async () => {
    const doc = fakeTarget({ visibilityState: 'visible' });
    const win = fakeTarget();
    const { client, calls } = setup({ doc, win });
    assert.equal(doc.listeners.size, 0, 'no listener before any event');
    client.track('ui.table.only');
    assert.ok(doc.listeners.has('visibilitychange'));
    assert.ok(win.listeners.has('pagehide'));

    doc.dispatch('visibilitychange');
    assert.equal(calls.length, 0, 'visible does not flush');

    doc.visibilityState = 'hidden';
    doc.dispatch('visibilitychange');
    assert.equal(calls.length, 1);

    client.track('ui.table.only');
    win.dispatch('pagehide');
    assert.equal(calls.length, 2);
  });

  it('does not register listeners for a mixpanel-only event', () => {
    const doc = fakeTarget({ visibilityState: 'visible' });
    const { client } = setup({ doc, mixpanel: () => {} });
    client.track('ui.mixpanel.only');
    assert.equal(doc.listeners.size, 0);
  });

  it('dispose removes listeners, cancels the timer and clears the buffer', async () => {
    const doc = fakeTarget({ visibilityState: 'hidden' });
    const win = fakeTarget();
    const { client, calls, timers } = setup({ doc, win });
    client.track('ui.table.only');
    client.dispose();
    assert.equal(doc.listeners.size, 0);
    assert.equal(win.listeners.size, 0);
    assert.equal(timers.pending.size, 0);
    assert.equal(client.pendingCount(), 0);
    await client.flush();
    assert.equal(calls.length, 0);
  });
});

describe('createUsageClient — setRequest', () => {
  it('flushes buffered events through the OLD request before swapping', async () => {
    const oldCalls = [];
    const newCalls = [];
    const { client } = setup({ request: (p, init) => { oldCalls.push(JSON.parse(init.body)); return Promise.resolve(); } });
    client.track('ui.table.only', { target: 'before' });
    client.setRequest((p, init) => { newCalls.push(JSON.parse(init.body)); return Promise.resolve(); });
    assert.equal(oldCalls.length, 1);
    assert.equal(oldCalls[0].events[0].target, 'before');
    client.track('ui.table.only', { target: 'after' });
    await client.flush();
    assert.equal(oldCalls.length, 1);
    assert.equal(newCalls[0].events[0].target, 'after');
  });

  it('is a no-op for the same function or a non-function', () => {
    const { client, calls, timers } = setup();
    const request = (path, init) => { calls.push(init); return Promise.resolve(); };
    client.setRequest(request);
    client.track('ui.table.only');
    client.setRequest(request);
    client.setRequest('not a function');
    assert.equal(client.pendingCount(), 1);
    assert.equal(timers.pending.size, 1, 'timer untouched');
  });

  it('with an empty buffer swaps without sending', async () => {
    const { client, calls } = setup();
    const next = [];
    client.setRequest((p, init) => { next.push(init); return Promise.resolve(); });
    assert.equal(calls.length, 0);
    client.track('ui.table.only');
    await client.flush();
    assert.equal(next.length, 1);
  });
});

describe('shared client + appVersion', () => {
  it('getUsageClient returns one instance until reset', () => {
    resetUsageClientForTests();
    const a = getUsageClient();
    assert.equal(getUsageClient(), a);
    resetUsageClientForTests();
    assert.notEqual(getUsageClient(), a);
    resetUsageClientForTests();
  });

  it('resolveAppVersion prefers VITE_APP_VERSION, then __APP_VERSION__, else undefined', () => {
    assert.equal(resolveAppVersion({ VITE_APP_VERSION: '2.0' }, { __APP_VERSION__: '1.0' }), '2.0');
    assert.equal(resolveAppVersion({ VITE_APP_VERSION: '' }, { __APP_VERSION__: '1.0' }), '1.0');
    assert.equal(resolveAppVersion(undefined, {}), undefined);
  });
});
