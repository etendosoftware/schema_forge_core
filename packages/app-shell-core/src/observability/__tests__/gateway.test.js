import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTelemetryGateway, DEFAULT_ADAPTER_TIMEOUT_MS } from '../gateway.js';
import { REDACTED } from '../sanitize.js';
import {
  SECRET_TOKEN,
  SECRET_EMAIL,
  SECRET_QUERY_CODE,
  FAKE_JWT,
  buildNestedSecretFixture,
  NESTED_SECRET_FIXTURE_ALLOWED_KEYS,
  findLeakedFixtureSecrets,
} from '../nestedSecretFixtures.js';

function mockAdapter(name) {
  const calls = [];
  return {
    adapter: {
      name,
      track: (...args) => calls.push(['track', ...args]),
      page: (...args) => calls.push(['page', ...args]),
      identify: (...args) => calls.push(['identify', ...args]),
      group: (...args) => calls.push(['group', ...args]),
      groupSet: (...args) => calls.push(['groupSet', ...args]),
      captureException: (...args) => calls.push(['captureException', ...args]),
      breadcrumb: (...args) => calls.push(['breadcrumb', ...args]),
      setContext: (...args) => calls.push(['setContext', ...args]),
      flush: (...args) => calls.push(['flush', ...args]),
    },
    calls,
  };
}

function recordingLogger() {
  const warnings = [];
  const calls = [];
  return {
    logger: {
      warn: (...args) => {
        calls.push(args);
        warnings.push(args[0]);
      },
    },
    warnings,
    calls,
  };
}

function assertNoLeak(calls, ...secrets) {
  const serialized = JSON.stringify(calls);
  for (const secret of secrets) {
    assert.ok(!serialized.includes(secret), `leaked secret "${secret}" reached a provider: ${serialized}`);
  }
}

const EMPTY_ENVELOPE = { context: {} };

describe('createTelemetryGateway — sanitizes before dispatch', () => {
  it('track() strips unapproved and sensitive properties before calling adapters', async () => {
    const { adapter, calls } = mockAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: ['action'] });

    await gw.track('button_clicked', { action: 'save', token: SECRET_TOKEN, email: SECRET_EMAIL });

    assertNoLeak(calls, SECRET_TOKEN, SECRET_EMAIL);
    assert.equal(calls[0][1], 'button_clicked');
    assert.deepEqual(calls[0][2], { action: 'save' });
  });

  it('page() strips query/fragment from the route before dispatch', async () => {
    const { adapter, calls } = mockAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [] });

    await gw.page(`/orders/123?token=${SECRET_TOKEN}#panel`);

    assertNoLeak(calls, SECRET_TOKEN);
    assert.equal(calls[0][1], '/orders/:recordId');
  });

  const ROUTES = {
    '/sales-order/FF8080818A1234567890ABCDEF123456': '/sales-order/:recordId',
    '/sales-order/FF8080818A1234567890ABCDEF123456?tab=lines': '/sales-order/:recordId',
    '/purchase-order-lines/configuration-settings': '/purchase-order-lines/configuration-settings',
    '/settings/organization/fiscal-configuration/new': '/settings/organization/fiscal-configuration/new',
    '/#/sales-order/123': '/#/sales-order/:id',
    // The host's public invoice portal route is portal/:token.
    '/portal/tok-abcdef0123456789': '/portal/:recordId',
  };

  for (const [route, expected] of Object.entries(ROUTES)) {
    it(`page(${route}) reaches the adapter as ${expected}`, async () => {
      const { adapter, calls } = mockAdapter('test');
      const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [] });

      await gw.page(route);

      assert.deepEqual(calls, [['page', expected, {}, EMPTY_ENVELOPE]]);
    });
  }

  it('identify() sanitizes traits and never forwards a raw traits object', async () => {
    const { adapter, calls } = mockAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: ['plan'] });

    await gw.identify('user-1', { plan: 'pro', ssn: '123-45-6789', password: 'hunter2' });

    assertNoLeak(calls, '123-45-6789', 'hunter2');
    assert.deepEqual(calls, [['identify', 'user-1', { plan: 'pro' }, EMPTY_ENVELOPE]]);
  });

  it('group()/groupSet() sanitize their properties the same way', async () => {
    const { adapter, calls } = mockAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: ['tier'] });

    await gw.group('org', 'org-1', { tier: 'gold', apiKey: SECRET_TOKEN });
    await gw.groupSet('org', 'org-1', { tier: 'gold', apiKey: SECRET_TOKEN });

    assertNoLeak(calls, SECRET_TOKEN);
    assert.deepEqual(calls, [
      ['group', 'org', 'org-1', { tier: 'gold' }, EMPTY_ENVELOPE],
      ['groupSet', 'org', 'org-1', { tier: 'gold' }, EMPTY_ENVELOPE],
    ]);
  });

  it('captureException() never forwards the raw Error object or an unsanitized stack', async () => {
    const { adapter, calls } = mockAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: ['reason'] });

    const error = new Error(`Auth failed for ${SECRET_EMAIL} using ${SECRET_TOKEN}`);
    error.stack = `Error: boom\n    at fetch (https://go.etendo.cloud/api?access_token=${SECRET_TOKEN}:1:1)`;

    await gw.captureException(error, { reason: 'network', body: { raw: SECRET_TOKEN } });

    assertNoLeak(calls, SECRET_TOKEN, SECRET_EMAIL);
    const [, sanitizedError] = calls[0];
    assert.notEqual(sanitizedError, error);
  });

  it('captureException() strips a short secret from URLs in the message and in the stack', async () => {
    // A short, low-entropy secret: only query stripping can catch it, not the opaque-token heuristic.
    const { adapter, calls } = mockAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [] });

    const error = new Error(`GET https://go.etendo.cloud/sws/login?code=${SECRET_QUERY_CODE} failed`);
    error.stack = `Error: x\n    at f (https://go.etendo.cloud/app.js?session=${SECRET_QUERY_CODE}:1:1)`;
    await gw.captureException(error);

    assertNoLeak(calls, SECRET_QUERY_CODE);
    assert.deepEqual(calls[0][1], {
      name: 'Error',
      message: 'GET https://go.etendo.cloud/sws/login failed',
      stack: 'Error: x\n    at f (https://go.etendo.cloud/app.js)',
    });
  });

  it('captureException() keeps every frame of a stack whose chunk names mix case and digits', async () => {
    const { adapter, calls } = mockAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [] });
    const error = new Error('save failed');
    error.stack = [
      'Error: save failed',
      '    at OrderGrid (https://go.etendo.cloud/go/assets/index-B3kd9Fq2.js:12:345)',
      '    at https://go.etendo.cloud/go/assets/SalesOrderEditor-DkP09aZq.js:1:2',
    ].join('\n');

    await gw.captureException(error);

    assert.equal(calls[0][1].stack, error.stack);
  });

  describe('a token in a path segment is collapsed on every channel, not only page()', () => {
    const HEX32 = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
    const MIXED32 = 'Ab3dEf9hIjKlMnOpQrStUvWxYz012345';

    it('captureException() collapses it in the message and in the stack', async () => {
      const { adapter, calls } = mockAdapter('test');
      const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [] });
      const error = new Error(`Failed on https://go.etendo.cloud/reset/${HEX32}`);
      error.stack = `Error: Failed on https://go.etendo.cloud/reset/${HEX32}\n    at f (https://go.etendo.cloud/go/assets/index-B3kd9Fq2.js:1:2)`;

      await gw.captureException(error);

      assertNoLeak(calls, HEX32);
      assert.equal(calls[0][1].message, 'Failed on https://go.etendo.cloud/reset/:id');
      assert.equal(
        calls[0][1].stack,
        'Error: Failed on https://go.etendo.cloud/reset/:id\n    at f (https://go.etendo.cloud/go/assets/index-B3kd9Fq2.js:1:2)',
      );
    });

    it('track() collapses it in a route property', async () => {
      const { adapter, calls } = mockAdapter('test');
      const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: ['route'] });

      await gw.track('x', { route: `/reset/${MIXED32}` });

      assert.deepEqual(calls, [['track', 'x', { route: '/reset/:id' }, EMPTY_ENVELOPE]]);
    });

    it('breadcrumb() collapses it in a message and a nested URL', async () => {
      const { adapter, calls } = mockAdapter('test');
      const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: ['message', 'data', 'url'] });

      await gw.breadcrumb({
        message: 'navigated to /portal/tok-abcdef0123456789',
        data: { url: 'https://go.etendo.cloud/invite/k3j4h5g6f7d8s9a0q1w2e3r4' },
      });

      assert.deepEqual(calls, [['breadcrumb', {
        message: 'navigated to /portal/:id',
        data: { url: 'https://go.etendo.cloud/invite/:id' },
      }]]);
    });
  });

  it('captureException() redacts only the stack frame that carries a secret', async () => {
    const { adapter, calls } = mockAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [] });
    const error = new Error('save failed');
    error.stack = [
      'Error: save failed',
      `    at login (${SECRET_EMAIL})`,
      '    at f (https://go.etendo.cloud/go/assets/index-B3kd9Fq2.js:12:345)',
    ].join('\n');

    await gw.captureException(error);

    assertNoLeak(calls, SECRET_EMAIL);
    assert.equal(
      calls[0][1].stack,
      ['Error: save failed', REDACTED, '    at f (https://go.etendo.cloud/go/assets/index-B3kd9Fq2.js:12:345)'].join('\n'),
    );
  });

  it('the shared nested-secret fixture never reaches an adapter through track() (Jira AC #1)', async () => {
    const { adapter, calls } = mockAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: NESTED_SECRET_FIXTURE_ALLOWED_KEYS });

    await gw.track('debug_dump', buildNestedSecretFixture());

    assert.equal(calls.length, 1);
    assert.deepEqual(findLeakedFixtureSecrets(calls), []);
  });

  it('breadcrumb() sanitizes its data payload', async () => {
    const { adapter, calls } = mockAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: ['category', 'message', 'data'] });

    await gw.breadcrumb({
      category: 'nav',
      message: `/api/session?password=${SECRET_QUERY_CODE}`,
      data: { token: SECRET_TOKEN },
    });

    assertNoLeak(calls, SECRET_TOKEN, SECRET_QUERY_CODE);
    assert.deepEqual(calls, [['breadcrumb', { category: 'nav', message: '/api/session', data: {} }]]);
  });

  it('setContext() sanitizes context and every later call carries only the sanitized version', async () => {
    const { adapter, calls } = mockAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: ['env', 'action'] });

    await gw.setContext({ env: 'staging', dbPassword: SECRET_TOKEN });
    await gw.track('ping', { action: 'x' });

    assertNoLeak(calls, SECRET_TOKEN);
    const trackCall = calls.find((c) => c[0] === 'track');
    assert.deepEqual(trackCall[3], { context: { env: 'staging' } });
  });

  it('an adapter mutating the context it receives cannot change the gateway context', async () => {
    const mutating = { name: 'mut', setContext: (ctx) => { ctx.injected = `Bearer ${SECRET_TOKEN}`; } };
    const gw = createTelemetryGateway({ adapters: [mutating], allowedKeys: ['env'] });

    await gw.setContext({ env: 'a' });

    assert.deepEqual(gw.getContext(), { env: 'a' });
  });
});

describe('createTelemetryGateway — positional arguments', () => {
  const PII = { email: SECRET_EMAIL, jwt: FAKE_JWT };

  for (const [kind, secret] of Object.entries(PII)) {
    it(`track() scrubs an event name carrying a ${kind}`, async () => {
      const { adapter, calls } = mockAdapter('test');
      const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [] });

      await gw.track(`login_failed ${secret}`);

      assertNoLeak(calls, secret);
      assert.deepEqual(calls, [['track', REDACTED, {}, EMPTY_ENVELOPE]]);
    });

    it(`page() scrubs a route carrying a ${kind}`, async () => {
      const { adapter, calls } = mockAdapter('test');
      const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [] });

      await gw.page(`/users/${secret}/reset`);

      assertNoLeak(calls, secret);
      assert.deepEqual(calls, [['page', REDACTED, {}, EMPTY_ENVELOPE]]);
    });

    it(`identify() drops the call instead of sending a redacted ${kind} id`, async () => {
      const { adapter, calls } = mockAdapter('test');
      const { logger, warnings } = recordingLogger();
      const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [], logger });

      await gw.identify(secret, { plan: 'pro' });

      assert.equal(calls.length, 0);
      assert.equal(warnings.length, 1);
      assertNoLeak(warnings, secret);
    });

    it(`identify() warns about a dropped ${kind} id with the message alone`, async () => {
      const { adapter } = mockAdapter('test');
      const recorder = recordingLogger();
      const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [], logger: recorder.logger });

      await gw.identify(secret);

      assert.equal(recorder.calls.length, 1);
      assert.equal(recorder.calls[0].length, 1);
    });

    for (const method of ['group', 'groupSet']) {
      it(`${method}() drops the call when the group key carries a ${kind}`, async () => {
        const { adapter, calls } = mockAdapter('test');
        const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [], logger: recordingLogger().logger });

        await gw[method](secret, 'org-1', {});

        assert.equal(calls.length, 0);
      });

      it(`${method}() drops the call when the group id carries a ${kind}`, async () => {
        const { adapter, calls } = mockAdapter('test');
        const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [], logger: recordingLogger().logger });

        await gw[method]('org', secret, {});

        assert.equal(calls.length, 0);
      });
    }
  }

  it('identify() sends a clean id exactly as given', async () => {
    const { adapter, calls } = mockAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [] });

    await gw.identify(12345);

    assert.deepEqual(calls, [['identify', '12345', {}, EMPTY_ENVELOPE]]);
  });
});

describe('createTelemetryGateway — lifecycle (init / reset)', () => {
  function lifecycleAdapter(name) {
    const calls = [];
    return {
      adapter: {
        name,
        init: (...args) => calls.push(['init', ...args]),
        reset: (...args) => calls.push(['reset', ...args]),
        track: (...args) => calls.push(['track', ...args]),
      },
      calls,
    };
  }

  it('init() dispatches to every enabled adapter with the sanitized initial context', async () => {
    const first = lifecycleAdapter('first');
    const disabled = lifecycleAdapter('disabled');
    disabled.adapter.enabled = false;
    const gw = createTelemetryGateway({
      adapters: [first.adapter, disabled.adapter],
      allowedKeys: ['app', 'environment'],
    });

    await gw.init({ app: 'app-shell', environment: 'staging', apiToken: SECRET_TOKEN });

    assert.deepEqual(first.calls, [['init', { context: { app: 'app-shell', environment: 'staging' } }]]);
    assert.equal(disabled.calls.length, 0);
    assertNoLeak(first.calls, SECRET_TOKEN);
  });

  it('the context given to init() travels with later calls', async () => {
    const { adapter, calls } = lifecycleAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: ['app'] });

    await gw.init({ app: 'app-shell' });
    await gw.track('ping');

    assert.deepEqual(calls.at(-1), ['track', 'ping', {}, { context: { app: 'app-shell' } }]);
  });

  it('init() works with no initial context', async () => {
    const { adapter, calls } = lifecycleAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [] });

    await gw.init();

    assert.deepEqual(calls, [['init', EMPTY_ENVELOPE]]);
  });

  it('reset() dispatches to every enabled adapter', async () => {
    const { adapter, calls } = lifecycleAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: ['app'] });

    await gw.init({ app: 'app-shell' });
    await gw.reset();

    assert.deepEqual(calls.at(-1), ['reset', { context: { app: 'app-shell' } }]);
  });

  it('init() and reset() never reject when an adapter throws, and still reach the others', async () => {
    const brokenReset = {
      name: 'broken-reset',
      reset: async () => { throw new Error('reset down'); },
    };
    const healthy = lifecycleAdapter('healthy');
    const { logger, warnings } = recordingLogger();
    const gw = createTelemetryGateway({ adapters: [brokenReset, healthy.adapter], allowedKeys: [], logger });

    await assert.doesNotReject(() => gw.init());
    await assert.doesNotReject(() => gw.reset());

    assert.deepEqual(healthy.calls.map(([method]) => method), ['init', 'reset']);
    assert.deepEqual(warnings, ['[observability] broken-reset.reset failed']);
  });

  it('an adapter whose init() throws receives no later call; its init is retried instead', async () => {
    const received = [];
    const brokenInit = {
      name: 'broken-init',
      init: () => { throw new Error('init down'); },
      reset: () => { received.push('reset'); },
    };
    const { logger, warnings } = recordingLogger();
    const gw = createTelemetryGateway({ adapters: [brokenInit], allowedKeys: [], logger });

    await assert.doesNotReject(() => gw.init());
    await assert.doesNotReject(() => gw.reset());

    assert.deepEqual(received, []);
    assert.deepEqual(warnings, ['[observability] broken-init.init failed', '[observability] broken-init.init failed']);
  });

  it('an adapter without init/reset is skipped silently', async () => {
    const { adapter, calls } = mockAdapter('no-lifecycle');
    const { logger, warnings } = recordingLogger();
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [], logger });

    await gw.init();
    await gw.reset();

    assert.equal(calls.length, 0);
    assert.deepEqual(warnings, []);
  });
});

describe('createTelemetryGateway — kill switch', () => {
  function switchAdapter(name, extra = {}) {
    const calls = [];
    return {
      adapter: {
        name,
        init: (...args) => calls.push(['init', ...args]),
        shutdown: (...args) => calls.push(['shutdown', ...args]),
        track: (...args) => calls.push(['track', ...args]),
        ...extra,
      },
      calls,
      methods: () => calls.map(([method]) => method),
    };
  }

  it('re-evaluates adapter.enabled on every dispatch, not once at creation', async () => {
    const toggled = switchAdapter('toggled');
    let flag = true;
    const fn = switchAdapter('fn', { enabled: () => flag });
    const gw = createTelemetryGateway({ adapters: [toggled.adapter, fn.adapter], allowedKeys: [] });

    await gw.track('a');
    toggled.adapter.enabled = false;
    flag = false;
    await gw.track('b');
    toggled.adapter.enabled = true;
    flag = true;
    await gw.track('c');

    assert.deepEqual(toggled.calls.map((c) => c[1]), ['a', 'c']);
    assert.deepEqual(fn.calls.map((c) => c[1]), ['a', 'c']);
  });

  it('an adapter disabled before init() never receives init, so its SDK never starts', async () => {
    const killed = switchAdapter('killed');
    const live = switchAdapter('live');
    const gw = createTelemetryGateway({ adapters: [killed.adapter, live.adapter], allowedKeys: [] });

    await gw.disable('killed');
    await gw.init();
    await gw.track('x');

    assert.deepEqual(killed.calls, []);
    assert.deepEqual(live.methods(), ['init', 'track']);
  });

  it('the global switch before init() means zero calls to any adapter', async () => {
    const first = switchAdapter('first');
    const second = switchAdapter('second');
    const gw = createTelemetryGateway({ adapters: [first.adapter, second.adapter], allowedKeys: [] });

    await gw.disable();
    await gw.init();
    await gw.track('x');
    await gw.page('/orders/1');
    await gw.captureException(new Error('boom'));

    assert.deepEqual(first.calls, []);
    assert.deepEqual(second.calls, []);
  });

  it('the initial `disabled` option works like calling disable() before init()', async () => {
    const byName = switchAdapter('mixpanel');
    const other = switchAdapter('sentry');
    const gwByName = createTelemetryGateway({ adapters: [byName.adapter, other.adapter], allowedKeys: [], disabled: ['mixpanel'] });
    await gwByName.init();
    assert.deepEqual(byName.calls, []);
    assert.deepEqual(other.methods(), ['init']);

    const all = switchAdapter('all');
    const gwGlobal = createTelemetryGateway({ adapters: [all.adapter], allowedKeys: [], disabled: true });
    await gwGlobal.init();
    await gwGlobal.track('x');
    assert.deepEqual(all.calls, []);
  });

  it('a hot kill shuts the running adapter down once and stops every later call to it', async () => {
    const killed = switchAdapter('killed');
    const live = switchAdapter('live');
    const gw = createTelemetryGateway({ adapters: [killed.adapter, live.adapter], allowedKeys: [] });

    await gw.init();
    await gw.disable('killed');
    await gw.disable('killed');
    await gw.track('after');

    assert.deepEqual(killed.methods(), ['init', 'shutdown']);
    assert.deepEqual(live.methods(), ['init', 'track']);
  });

  it('a global hot kill shuts every running adapter down', async () => {
    const first = switchAdapter('first');
    const second = switchAdapter('second');
    const gw = createTelemetryGateway({ adapters: [first.adapter, second.adapter], allowedKeys: [] });

    await gw.init();
    await gw.disable();
    await gw.track('after');

    assert.deepEqual(first.methods(), ['init', 'shutdown']);
    assert.deepEqual(second.methods(), ['init', 'shutdown']);
  });

  it('re-enabling a killed adapter re-initializes it with the current context', async () => {
    const { adapter, methods, calls } = switchAdapter('back');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: ['app'] });

    await gw.init({ app: 'app-shell' });
    await gw.disable('back');
    await gw.enable('back');
    await gw.track('again');

    assert.deepEqual(methods(), ['init', 'shutdown', 'init', 'track']);
    assert.deepEqual(calls[2], ['init', { context: { app: 'app-shell' } }]);
  });

  it('enabling before the gateway was initialized does not start the adapter early', async () => {
    const { adapter, methods } = switchAdapter('late');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [], disabled: ['late'] });

    await gw.enable('late');
    assert.deepEqual(methods(), []);

    await gw.init();
    assert.deepEqual(methods(), ['init']);
  });

  it('lifting the global switch does not revive an adapter killed by name', async () => {
    const byName = switchAdapter('byName');
    const other = switchAdapter('other');
    const gw = createTelemetryGateway({ adapters: [byName.adapter, other.adapter], allowedKeys: [] });

    await gw.init();
    await gw.disable('byName');
    await gw.disable();
    await gw.enable();
    await gw.track('x');

    assert.deepEqual(byName.methods(), ['init', 'shutdown']);
    assert.deepEqual(other.methods(), ['init', 'shutdown', 'init', 'track']);
    assert.equal(gw.isEnabled('byName'), false);
    assert.equal(gw.isEnabled('other'), true);
  });

  it('isEnabled() reflects both the global switch and the per-adapter one', async () => {
    const { adapter } = switchAdapter('a');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [] });

    assert.equal(gw.isEnabled('a'), true);
    await gw.disable();
    assert.equal(gw.isEnabled('a'), false);
    await gw.enable();
    await gw.disable('a');
    assert.equal(gw.isEnabled('a'), false);
    assert.equal(gw.isEnabled('unknown'), false);
  });

  it('an adapter switched on after init() is initialized before its first call', async () => {
    let optedIn = false;
    const { adapter, methods } = switchAdapter('late-opt-in', { enabled: () => optedIn });
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [] });

    await gw.init();
    await gw.track('before');
    optedIn = true;
    await gw.track('after');

    assert.deepEqual(methods(), ['init', 'track']);
  });

  it('a shutdown that throws never rejects disable(), and the adapter stays killed', async () => {
    const { adapter, calls } = switchAdapter('broken', { shutdown: () => { throw new Error('close failed'); } });
    const { logger, warnings } = recordingLogger();
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [], logger });

    await gw.init();
    await assert.doesNotReject(() => gw.disable('broken'));
    await gw.track('after');

    assert.deepEqual(calls.map(([method]) => method), ['init']);
    assert.deepEqual(warnings, ['[observability] broken.shutdown failed']);
  });
});

describe('createTelemetryGateway — kill switch under concurrency', () => {
  const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

  /** An adapter whose init takes time or fails, logging the state each call sees. */
  function slowAdapter(name, { initMs = 0, initRejects = false } = {}) {
    const log = [];
    let state = 'new';
    return {
      log,
      adapter: {
        name,
        async init() {
          log.push('init:start');
          await sleep(initMs);
          if (initRejects) throw new Error('init failed');
          state = 'ready';
          log.push('init:done');
        },
        shutdown() { state = 'closed'; log.push('shutdown'); },
        track(event) { log.push(`track(${event})@${state}`); },
        identify(id) { log.push(`identify(${id})@${state}`); },
      },
    };
  }
  const silent = { warn() {} };

  it('a call in flight when disable() lands in the same tick never reaches the adapter', async () => {
    const { adapter, log } = slowAdapter('x');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [], logger: silent });
    await gw.init();

    await Promise.all([gw.identify('user-1'), gw.disable('x')]);
    await Promise.all([gw.track('evt'), gw.disable('x')]);

    assert.deepEqual(log, ['init:start', 'init:done', 'shutdown']);
  });

  it('calls racing a late start() wait for init to finish (never reach a half-initialized adapter)', async () => {
    const { adapter, log } = slowAdapter('x', { initMs: 60 });
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [], logger: silent, disabled: ['x'] });
    await gw.init();

    await Promise.all([gw.enable('x'), gw.identify('user-1'), gw.track('second')]);

    assert.deepEqual(log, ['init:start', 'init:done', 'identify(user-1)@ready', 'track(second)@ready']);
  });

  it('an init that times out leaves the adapter not running, so calls skip it', async () => {
    const { adapter, log } = slowAdapter('x', { initMs: 200 });
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [], logger: silent, adapterTimeoutMs: 20 });

    await gw.init();
    await gw.track('after-timeout');

    assert.equal(log.some((entry) => entry.startsWith('track(after-timeout)@new')), false, log.join(' -> '));
    await sleep(220);
  });

  it('an init that rejects is retried on the next call instead of leaving a dead adapter "running"', async () => {
    let attempts = 0;
    const calls = [];
    const flaky = {
      name: 'flaky',
      async init() { attempts += 1; if (attempts === 1) throw new Error('first init fails'); },
      track(event) { calls.push(event); },
    };
    const gw = createTelemetryGateway({ adapters: [flaky], allowedKeys: [], logger: silent });

    await gw.init();
    await gw.track('a');

    assert.equal(attempts, 2);
    assert.deepEqual(calls, ['a']);
  });

  it('disable() during a pending init shuts the adapter down once init settles, and later calls skip it', async () => {
    const { adapter, log } = slowAdapter('x', { initMs: 40 });
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [], logger: silent });

    const initializing = gw.init();
    await sleep(5);
    await gw.disable('x');
    await initializing;
    await gw.track('after-kill');

    assert.equal(log.includes('track(after-kill)@ready'), false);
    assert.equal(log.at(-1), 'shutdown');
    assert.ok(log.lastIndexOf('shutdown') > log.indexOf('init:done'), 'the adapter must end shut down, after its init');
  });
});

describe('createTelemetryGateway — per-adapter timeout', () => {
  const never = () => new Promise(() => {});
  const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

  it('an adapter that never settles does not hang the caller, and the others still receive', async () => {
    const hanging = { name: 'hanging', track: never };
    const { adapter: healthy, calls } = mockAdapter('healthy');
    const { logger, warnings } = recordingLogger();
    const gw = createTelemetryGateway({ adapters: [hanging, healthy], allowedKeys: [], logger, adapterTimeoutMs: 20 });

    const started = performance.now();
    await gw.track('event');

    assert.ok(performance.now() - started < 1000, 'track waited far longer than the timeout');
    assert.equal(calls.length, 1);
    assert.deepEqual(warnings, ['[observability] hanging.track timed out after 20ms']);
  });

  it('applies to lifecycle calls too, so a stuck init() cannot block the app start', async () => {
    const hanging = { name: 'hanging', init: never };
    const { logger, warnings } = recordingLogger();
    const gw = createTelemetryGateway({ adapters: [hanging], allowedKeys: [], logger, adapterTimeoutMs: 20 });

    await gw.init();

    assert.deepEqual(warnings, ['[observability] hanging.init timed out after 20ms']);
  });

  it('does not warn when the adapter settles in time', async () => {
    const quick = { name: 'quick', track: async () => { await wait(1); } };
    const { logger, warnings } = recordingLogger();
    const gw = createTelemetryGateway({ adapters: [quick], allowedKeys: [], logger, adapterTimeoutMs: 50 });

    await gw.track('event');
    await wait(80);

    assert.deepEqual(warnings, []);
  });

  it('a rejection arriving after the timeout is swallowed, not left unhandled', async () => {
    const unhandled = [];
    const onUnhandled = (reason) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const late = {
        name: 'late',
        track: () => new Promise((_, reject) => { setTimeout(() => reject(new Error('too late')), 40); }),
      };
      const gw = createTelemetryGateway({ adapters: [late], allowedKeys: [], logger: { warn() {} }, adapterTimeoutMs: 10 });

      await gw.track('event');
      await wait(80);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
    assert.deepEqual(unhandled, []);
  });

  it('defaults to a bounded timeout and can be turned off with a non-finite value', async () => {
    assert.ok(Number.isFinite(DEFAULT_ADAPTER_TIMEOUT_MS) && DEFAULT_ADAPTER_TIMEOUT_MS > 0);

    const slow = { name: 'slow', track: () => wait(40) };
    const { logger, warnings } = recordingLogger();
    const gw = createTelemetryGateway({ adapters: [slow], allowedKeys: [], logger, adapterTimeoutMs: Infinity });

    await gw.track('event');

    assert.deepEqual(warnings, []);
  });
});

describe('createTelemetryGateway — resilience', () => {
  it('never calls a disabled adapter', async () => {
    const { adapter, calls } = mockAdapter('disabled');
    adapter.enabled = false;
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [] });

    await gw.track('event', {});

    assert.equal(calls.length, 0);
  });

  it('calls every enabled adapter and skips only the disabled one', async () => {
    const first = mockAdapter('first');
    const disabled = mockAdapter('disabled');
    const last = mockAdapter('last');
    disabled.adapter.enabled = false;
    const gw = createTelemetryGateway({ adapters: [first.adapter, disabled.adapter, last.adapter], allowedKeys: [] });

    await gw.track('event', {});

    assert.deepEqual(first.calls, [['track', 'event', {}, EMPTY_ENVELOPE]]);
    assert.equal(disabled.calls.length, 0);
    assert.deepEqual(last.calls, [['track', 'event', {}, EMPTY_ENVELOPE]]);
  });

  it('one adapter throwing never blocks the others or the caller', async () => {
    const broken = { name: 'broken', track: () => { throw new Error('provider down'); } };
    const { adapter: healthy, calls } = mockAdapter('healthy');
    const gw = createTelemetryGateway({
      adapters: [broken, healthy],
      allowedKeys: [],
      logger: { warn: () => {} },
    });

    await assert.doesNotReject(() => gw.track('event', {}));
    assert.equal(calls.length, 1);
  });

  it('an async adapter that rejects never blocks the others or the caller', async () => {
    const rejecting = { name: 'rejecting', track: async () => { throw new Error('provider down'); } };
    const { adapter: healthy, calls } = mockAdapter('healthy');
    const { logger, warnings } = recordingLogger();
    const gw = createTelemetryGateway({ adapters: [rejecting, healthy], allowedKeys: [], logger });

    await assert.doesNotReject(() => gw.track('event', {}));
    assert.equal(calls.length, 1);
    assert.deepEqual(warnings, ['[observability] rejecting.track failed']);
  });

  it('a logger that throws does not turn a swallowed failure into a rejection', async () => {
    const broken = { name: 'broken', track: () => { throw new Error('provider down'); } };
    const gw = createTelemetryGateway({
      adapters: [broken],
      allowedKeys: [],
      logger: { warn: () => { throw new Error('logger down'); } },
    });

    await assert.doesNotReject(() => gw.track('event', {}));
  });
});

describe('createTelemetryGateway — never rejects', () => {
  it('track() resolves when a property getter throws, redacting that value', async () => {
    const { adapter, calls } = mockAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: ['a'] });

    await assert.doesNotReject(() => gw.track('e', { get a() { throw new Error('getter boom'); } }));
    assert.deepEqual(calls, [['track', 'e', { a: REDACTED }, EMPTY_ENVELOPE]]);
  });

  it('track() resolves when the properties are a Proxy whose getPrototypeOf trap throws', async () => {
    const { adapter, calls } = mockAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [] });
    const hostile = new Proxy({}, { getPrototypeOf() { throw new Error('proxy boom'); } });

    await assert.doesNotReject(() => gw.track('e', hostile));
    assert.deepEqual(calls, [['track', 'e', REDACTED, EMPTY_ENVELOPE]]);
  });

  it('track() resolves when the event name cannot be converted to a string', async () => {
    const { adapter, calls } = mockAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [] });
    const unprintable = { toString() { throw new Error('no string'); } };

    await assert.doesNotReject(() => gw.track(unprintable));
    assert.deepEqual(calls, [['track', REDACTED, {}, EMPTY_ENVELOPE]]);
  });

  it('warns when sanitization itself fails as a whole, instead of degrading in silence', async () => {
    const { adapter, calls } = mockAdapter('test');
    const { logger, warnings } = recordingLogger();
    // An option that throws when read is the one input that reaches sanitizeValue's
    // global guard rather than a per-key one.
    const gw = createTelemetryGateway({
      adapters: [adapter],
      allowedKeys: [],
      logger,
      maxNodes: { valueOf() { throw new Error('bad option'); } },
    });

    await assert.doesNotReject(() => gw.track('e', {}));
    assert.equal(calls.length, 1);
    assert.ok(warnings.some((w) => w.includes('sanitizeValue failed')), JSON.stringify(warnings));
  });

  it('captureException() resolves when the error message getter throws', async () => {
    const { adapter, calls } = mockAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [] });

    await assert.doesNotReject(() => gw.captureException({ get message() { throw new Error('msg getter'); } }));
    assert.deepEqual(calls, [['captureException', { name: undefined, message: undefined, stack: undefined }, {}, EMPTY_ENVELOPE]]);
  });
});

describe('addFeatureFlagEvaluation', () => {
  const silent = { warn() {} };

  function flagAdapter(name = 'flags') {
    const calls = [];
    return { calls, adapter: { name, addFeatureFlagEvaluation: (...args) => calls.push(args) } };
  }

  it('hands a clean key and a scalar value to the adapters that implement it', async () => {
    const { adapter, calls } = flagAdapter();
    const other = mockAdapter('no-flags');
    const gw = createTelemetryGateway({ adapters: [adapter, other.adapter], logger: silent });
    await gw.init({});
    await gw.addFeatureFlagEvaluation('page-help-suggestions', true);
    await gw.addFeatureFlagEvaluation('rollout', 25);
    await gw.addFeatureFlagEvaluation('variant', 'blue');
    assert.deepEqual(calls, [['page-help-suggestions', true], ['rollout', 25], ['variant', 'blue']]);
    assert.deepEqual(other.calls, []);
  });

  it('drops a key that does not survive sanitization, and non-scalar values', async () => {
    const { adapter, calls } = flagAdapter();
    const gw = createTelemetryGateway({ adapters: [adapter], logger: silent });
    await gw.init({});
    await gw.addFeatureFlagEvaluation(SECRET_EMAIL, true);
    await gw.addFeatureFlagEvaluation('', true);
    await gw.addFeatureFlagEvaluation('obj', { email: SECRET_EMAIL });
    await gw.addFeatureFlagEvaluation('nan', Number.NaN);
    assert.deepEqual(calls, []);
  });

  it('scrubs a string value', async () => {
    const { adapter, calls } = flagAdapter();
    const gw = createTelemetryGateway({ adapters: [adapter], logger: silent });
    await gw.init({});
    await gw.addFeatureFlagEvaluation('variant', `x ${SECRET_TOKEN}`);
    assert.equal(calls.length, 1);
    assert.ok(!String(calls[0][1]).includes(SECRET_TOKEN));
  });

  it('skips a killed adapter', async () => {
    const { adapter, calls } = flagAdapter('datadog');
    const gw = createTelemetryGateway({ adapters: [adapter], disabled: ['datadog'], logger: silent });
    await gw.init({});
    await gw.addFeatureFlagEvaluation('x', true);
    assert.deepEqual(calls, []);
  });
});

describe('createTelemetryGateway — identity across a kill', () => {
  function identityAdapter(name, extra = {}) {
    const calls = [];
    const record = (method) => (...args) => calls.push([method, ...args.slice(0, -1)]);
    return {
      adapter: {
        name,
        init: () => calls.push(['init']),
        shutdown: () => calls.push(['shutdown']),
        reset: () => calls.push(['reset']),
        identify: record('identify'),
        group: record('group'),
        track: record('track'),
        ...extra,
      },
      calls,
    };
  }

  async function signedIn(adapters) {
    const gw = createTelemetryGateway({ adapters, allowedKeys: ['plan'] });
    await gw.init();
    await gw.identify('user-a', { plan: 'pro' });
    await gw.group('account_id', 'tenant-a');
    return gw;
  }

  it('a revived adapter gets the sign-in that happened while it was killed, after a reset', async () => {
    const rum = identityAdapter('rum');
    const gw = await signedIn([rum.adapter]);
    await gw.disable('rum');
    await gw.reset();
    await gw.identify('user-b', { plan: 'free' });
    await gw.group('account_id', 'tenant-b');
    rum.calls.length = 0;

    await gw.enable('rum');

    assert.deepEqual(rum.calls, [
      ['init'], ['reset'], ['identify', 'user-b', { plan: 'free' }], ['group', 'account_id', 'tenant-b', {}],
    ]);
  });

  it('a logout while killed reaches the adapter as a reset when it comes back', async () => {
    const rum = identityAdapter('rum');
    const gw = await signedIn([rum.adapter]);
    await gw.disable('rum');
    await gw.reset();
    rum.calls.length = 0;

    await gw.enable('rum');

    assert.deepEqual(rum.calls, [['init'], ['reset']]);
  });

  it('nothing is replayed when the identity did not change during the kill', async () => {
    const rum = identityAdapter('rum');
    const gw = await signedIn([rum.adapter]);
    await gw.disable('rum');
    await gw.track('while-killed');
    rum.calls.length = 0;

    await gw.enable('rum');
    await gw.track('after');

    assert.deepEqual(rum.calls, [['init'], ['track', 'after', {}]]);
  });

  it('an adapter switched on late gets the current identity without a reset', async () => {
    let on = false;
    const late = identityAdapter('late', { enabled: () => on });
    const gw = await signedIn([late.adapter]);
    on = true;

    await gw.track('first');

    assert.deepEqual(late.calls, [
      ['init'], ['identify', 'user-a', { plan: 'pro' }], ['group', 'account_id', 'tenant-a', {}], ['track', 'first', {}],
    ]);
  });

  it('an identity dispatched before init() is not sent again by the start', async () => {
    const rum = identityAdapter('rum');
    const gw = createTelemetryGateway({ adapters: [rum.adapter], allowedKeys: [] });
    await gw.identify('user-a');
    await gw.init();

    assert.deepEqual(rum.calls, [['identify', 'user-a', {}], ['init']]);
  });

  it('only sanitized identifiers are remembered and replayed', async () => {
    const rum = identityAdapter('rum');
    const gw = await signedIn([rum.adapter]);
    await gw.disable('rum');
    await gw.reset();
    await gw.identify(SECRET_EMAIL);
    await gw.identify('user-c', { email: SECRET_EMAIL, plan: 'pro' });
    rum.calls.length = 0;

    await gw.enable('rum');

    assertNoLeak(rum.calls, SECRET_EMAIL);
    assert.deepEqual(rum.calls, [['init'], ['reset'], ['identify', 'user-c', { plan: 'pro' }]]);
  });
});
