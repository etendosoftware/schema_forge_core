import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTelemetryGateway } from '../gateway.js';
import {
  SECRET_TOKEN,
  SECRET_EMAIL,
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

function assertNoLeak(calls, ...secrets) {
  const serialized = JSON.stringify(calls);
  for (const secret of secrets) {
    assert.ok(!serialized.includes(secret), `leaked secret "${secret}" reached a provider: ${serialized}`);
  }
}

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
    assert.deepEqual(calls[0][2], { plan: 'pro' });
  });

  it('group()/groupSet() sanitize their properties the same way', async () => {
    const { adapter, calls } = mockAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: ['tier'] });

    await gw.group('org', 'org-1', { tier: 'gold', apiKey: SECRET_TOKEN });
    await gw.groupSet('org', 'org-1', { tier: 'gold', apiKey: SECRET_TOKEN });

    assertNoLeak(calls, SECRET_TOKEN);
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

  it('the shared nested-secret fixture never reaches an adapter through track() (Jira AC #1)', async () => {
    const { adapter, calls } = mockAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: NESTED_SECRET_FIXTURE_ALLOWED_KEYS });

    await gw.track('debug_dump', buildNestedSecretFixture());

    assert.deepEqual(findLeakedFixtureSecrets(calls), []);
  });

  it('breadcrumb() sanitizes its data payload', async () => {
    const { adapter, calls } = mockAdapter('test');
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: ['category', 'message', 'data'] });

    await gw.breadcrumb({ category: 'nav', message: 'clicked', data: { token: SECRET_TOKEN } });

    assertNoLeak(calls, SECRET_TOKEN);
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
});

describe('createTelemetryGateway — resilience', () => {
  it('never calls a disabled adapter', async () => {
    const { adapter, calls } = mockAdapter('disabled');
    adapter.enabled = false;
    const gw = createTelemetryGateway({ adapters: [adapter], allowedKeys: [] });

    await gw.track('event', {});

    assert.equal(calls.length, 0);
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
});
