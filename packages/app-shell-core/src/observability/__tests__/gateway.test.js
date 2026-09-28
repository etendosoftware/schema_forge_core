import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTelemetryGateway } from '../gateway.js';
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
  return { logger: { warn: (message) => warnings.push(message) }, warnings };
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
    assert.equal(calls[0][1], '/orders/123');
  });

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

  it('captureException() resolves when the error message getter throws', async () => {
    const { adapter, calls } = mockAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [] });

    await assert.doesNotReject(() => gw.captureException({ get message() { throw new Error('msg getter'); } }));
    assert.deepEqual(calls, [['captureException', { name: undefined, message: undefined, stack: undefined }, {}, EMPTY_ENVELOPE]]);
  });
});
