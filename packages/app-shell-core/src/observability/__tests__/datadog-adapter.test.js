import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDatadogAdapter,
  resolveTracingUrls,
  sanitizeDatadogEvent,
  toDatadogFlagKey,
} from '../adapters/datadog.js';
import { createTelemetryGateway } from '../gateway.js';
import { SECRET_TOKEN, SECRET_EMAIL, SECRET_QUERY_CODE, FAKE_JWT } from '../nestedSecretFixtures.js';

// ETP-4578 (Datadog RUM, from ETP-5605). The RUM SDK collects views, resources, actions, long
// tasks and errors on its own, so its only pre-send hook — beforeSend — is where that egress
// is closed. The SDK applies a beforeSend change only to a fixed list of fields per event type
// (MODIFIABLE_FIELD_PATHS_BY_EVENT, rum-core 7.15) and cannot drop a view event; the fake
// below applies the same two rules, so a test cannot pass by editing a field the real SDK
// would revert.

const silent = { warn() {} };
const HEX32 = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

const COMMON = ['view.name', 'view.url', 'view.referrer', 'context', 'service', 'version'];
const MODIFIABLE = {
  view: [...COMMON, 'view.performance.lcp.resource_url'],
  error: [...COMMON, 'error.message', 'error.stack', 'error.handling_stack', 'error.resource.url', 'error.fingerprint'],
  resource: [...COMMON, 'resource.url', 'resource.graphql.variables', 'resource.request.headers', 'resource.response.headers'],
  action: [...COMMON, 'action.target.name'],
  long_task: [...COMMON, 'long_task.scripts[].source_url', 'long_task.scripts[].invoker'],
  vital: COMMON,
};

function getPath(object, path) {
  return path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), object);
}

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const parent = keys.reduce((node, key) => (node == null ? undefined : node[key]), object);
  if (parent && typeof parent === 'object') parent[last] = value;
}

/** Runs beforeSend the way rum-core's limitModification does: only modifiable fields stick. */
function runBeforeSend(beforeSend, event) {
  const original = structuredClone(event);
  const clone = structuredClone(event);
  const result = beforeSend(clone);
  const out = structuredClone(original);
  for (const path of MODIFIABLE[event.type] ?? []) {
    if (path.includes('[]')) {
      const [arrayPath, field] = path.split('[].');
      const items = getPath(clone, arrayPath);
      const target = getPath(out, arrayPath);
      if (Array.isArray(items) && Array.isArray(target)) items.forEach((item, i) => { target[i][field] = item?.[field]; });
    } else if (getPath(clone, path) !== getPath(original, path)) {
      setPath(out, path, getPath(clone, path));
    }
  }
  const dropped = result === false && event.type !== 'view';
  return { dropped, event: out };
}

function fakeSdk() {
  const calls = [];
  const datadogRum = new Proxy({}, {
    get(_, method) {
      return (...args) => { calls.push([method, ...args]); };
    },
  });
  return { calls, datadogRum, initOptions: () => calls.find(([m]) => m === 'init')?.[1] };
}

function configured(overrides = {}) {
  const sdk = fakeSdk();
  let loads = 0;
  const adapter = createDatadogAdapter({
    loadSdk: async () => { loads += 1; return { datadogRum: sdk.datadogRum }; },
    enabled: 'true',
    applicationId: 'app-id',
    clientToken: 'pub-token',
    site: 'datadoghq.eu',
    env: 'production',
    version: 'abc123',
    allowedKeys: ['app', 'route', 'flagKey'],
    currentPath: () => `/go/sales-order/${HEX32}`,
    logger: silent,
    ...overrides,
  });
  return { adapter, sdk, loads: () => loads };
}

describe('createDatadogAdapter — opt-in and configuration', () => {
  it('is off by default and when any required setting is missing', () => {
    assert.equal(createDatadogAdapter({ logger: silent }).enabled, false);
    assert.equal(configured({ enabled: false }).adapter.enabled, false);
    assert.equal(configured({ clientToken: '' }).adapter.enabled, false);
    assert.equal(configured({ env: undefined }).adapter.enabled, false);
    assert.equal(configured().adapter.enabled, true);
  });

  it('starts the SDK with privacy on, manual views, headers off and its own beforeSend', async () => {
    const { adapter, sdk } = configured({ sessionSampleRate: '250', traceSampleRate: 'x' });
    await adapter.init();
    const options = sdk.initOptions();
    assert.equal(options.defaultPrivacyLevel, 'mask');
    assert.equal(options.enablePrivacyForActionName, true);
    assert.equal(options.trackViewsManually, true);
    assert.equal(options.trackingConsent, 'granted');
    assert.equal(options.trackResourceHeaders, undefined);
    assert.equal(options.remoteConfigurationId, undefined, 'remote configuration is off unless configured');
    assert.equal(options.sessionSampleRate, 100, 'sample rates are bounded to 0–100');
    assert.equal(options.traceSampleRate, 20, 'an unparseable rate falls back to the default');
    assert.equal(options.service, 'etendo-go-web');
    assert.equal(typeof options.beforeSend, 'function');
  });

  it('opens the first view on the normalized current route, never the record id', async () => {
    const { adapter, sdk } = configured();
    await adapter.init();
    const view = sdk.calls.find(([m]) => m === 'startView');
    assert.deepEqual(view[1], { name: '/go/sales-order/:id' });
  });

  it('does not load the SDK when init() is called on a disabled adapter', async () => {
    const { adapter, loads } = configured({ enabled: false });
    await adapter.init();
    adapter.track('x');
    assert.equal(loads(), 0);
  });

  it('loads the SDK once across retried and revived starts', async () => {
    const { adapter, loads } = configured();
    await Promise.all([adapter.init(), adapter.init()]);
    adapter.shutdown();
    await adapter.init();
    assert.equal(loads(), 1);
  });

  it('retries the load when it failed', async () => {
    const sdk = fakeSdk();
    let attempts = 0;
    const adapter = createDatadogAdapter({
      ...{ enabled: true, applicationId: 'a', clientToken: 't', site: 's', env: 'e', logger: silent },
      loadSdk: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('chunk failed');
        return { datadogRum: sdk.datadogRum };
      },
    });
    await assert.rejects(adapter.init());
    await adapter.init();
    assert.equal(attempts, 2);
    assert.ok(sdk.initOptions());
  });
});

describe('createDatadogAdapter — beforeSend closes what the SDK collects on its own', () => {
  async function hook() {
    const { adapter, sdk } = configured();
    await adapter.init();
    return { adapter, beforeSend: sdk.initOptions().beforeSend };
  }

  it('normalizes view URLs and strips their query', async () => {
    const { beforeSend } = await hook();
    const { event } = runBeforeSend(beforeSend, {
      type: 'view',
      view: {
        url: `https://app.etendo.software/go/contacts/${HEX32}?code=${SECRET_QUERY_CODE}`,
        referrer: `https://app.etendo.software/go/reset?token=${SECRET_TOKEN}`,
        name: `/contacts/${HEX32}`,
        performance: { lcp: { resource_url: `https://cdn.example.com/a.png?sig=${SECRET_TOKEN}` } },
      },
    });
    assert.equal(event.view.url, 'https://app.etendo.software/go/contacts/:id');
    assert.equal(event.view.referrer, 'https://app.etendo.software/go/reset');
    assert.equal(event.view.name, '/contacts/:recordId');
    assert.equal(event.view.performance.lcp.resource_url, 'https://cdn.example.com/a.png');
  });

  it('scrubs error messages and stacks, including the handling stack', async () => {
    const { beforeSend } = await hook();
    const { event, dropped } = runBeforeSend(beforeSend, {
      type: 'error',
      error: {
        message: `Request failed for ${SECRET_EMAIL}`,
        stack: `Error: x\n    at f (https://app.etendo.software/assets/a.js?token=${SECRET_TOKEN}:1:2)`,
        handling_stack: `Error\n    at g (https://app.etendo.software/go/invite/${FAKE_JWT})`,
        resource: { url: `https://app.etendo.software/etendo/sws/neo/sales-order/${HEX32}?q=1` },
      },
    });
    assert.equal(dropped, false);
    const serialized = JSON.stringify(event);
    for (const secret of [SECRET_EMAIL, SECRET_TOKEN, FAKE_JWT]) assert.ok(!serialized.includes(secret), secret);
    assert.equal(event.error.resource.url, 'https://app.etendo.software/etendo/sws/neo/sales-order/:id');
  });

  it('normalizes resource URLs and empties headers', async () => {
    const { beforeSend } = await hook();
    const { event } = runBeforeSend(beforeSend, {
      type: 'resource',
      resource: {
        url: `https://app.etendo.software/etendo/sws/neo/contacts/${HEX32}?email=${SECRET_EMAIL}`,
        request: { headers: { authorization: `Bearer ${SECRET_TOKEN}` } },
        response: { headers: { 'set-cookie': 'sid=1' } },
      },
    });
    assert.equal(event.resource.url, 'https://app.etendo.software/etendo/sws/neo/contacts/:id');
    assert.deepEqual(event.resource.request.headers, {});
    assert.deepEqual(event.resource.response.headers, {});
  });

  it('scrubs action names and long-task script URLs', async () => {
    const { beforeSend } = await hook();
    const action = runBeforeSend(beforeSend, { type: 'action', action: { target: { name: `Enviar a ${SECRET_EMAIL}` } } });
    assert.ok(!JSON.stringify(action.event).includes(SECRET_EMAIL));
    const task = runBeforeSend(beforeSend, {
      type: 'long_task',
      long_task: { scripts: [{ source_url: `https://app.etendo.software/x.js?token=${SECRET_TOKEN}`, invoker: 'click' }] },
    });
    assert.equal(task.event.long_task.scripts[0].source_url, 'https://app.etendo.software/x.js');
  });

  it('keeps only approved context keys, whoever set them', async () => {
    const { beforeSend } = await hook();
    const { event } = runBeforeSend(beforeSend, {
      type: 'action',
      context: { app: 'app-shell', username: 'jane', email: SECRET_EMAIL, route: `/contacts/${HEX32}` },
    });
    assert.deepEqual(Object.keys(event.context).sort(), ['app', 'route']);
  });

  it('drops events after a kill; a view cannot be dropped, so consent is withdrawn too', async () => {
    const { adapter, sdk } = configured();
    await adapter.init();
    const { beforeSend } = sdk.initOptions();
    adapter.shutdown();
    assert.equal(runBeforeSend(beforeSend, { type: 'error', error: { message: 'x' } }).dropped, true);
    assert.deepEqual(sdk.calls.at(-1), ['setTrackingConsent', 'not-granted']);
    await adapter.init();
    assert.deepEqual(sdk.calls.at(-1), ['setTrackingConsent', 'granted']);
    assert.equal(runBeforeSend(beforeSend, { type: 'error', error: { message: 'x' } }).dropped, false);
  });

  it('drops an event it cannot sanitize instead of sending it as is', async () => {
    const { beforeSend } = await hook();
    const hostile = { type: 'error', get error() { throw new Error('boom'); } };
    assert.equal(beforeSend(hostile), false);
  });

  it('sanitizeDatadogEvent leaves fields it does not know untouched', () => {
    const event = { type: 'vital', vital: { name: 'x', value: 1 } };
    assert.deepEqual(sanitizeDatadogEvent(event).vital, { name: 'x', value: 1 });
  });
});

describe('createDatadogAdapter — what the gateway hands over', () => {
  it('maps the gateway operations onto the RUM API', async () => {
    const { adapter, sdk } = configured();
    await adapter.init();
    sdk.calls.length = 0;
    adapter.track('order_saved', { app: 'app-shell' });
    adapter.page('/sales-order/:recordId');
    adapter.page('/sales-order/:recordId');
    adapter.identify('acc-1');
    adapter.setContext({ app: 'app-shell' });
    adapter.captureException({ name: 'TypeError', message: 'x is undefined', stack: 'TypeError: x' }, { app: 'app-shell' });
    const names = sdk.calls.map(([m]) => m);
    assert.deepEqual(names, ['addAction', 'startView', 'setUser', 'setGlobalContext', 'addError']);
    assert.deepEqual(sdk.calls[2][1], { id: 'acc-1' }, 'only the id, never a name or an email');
    const error = sdk.calls[4][1];
    assert.ok(error instanceof Error);
    assert.equal(error.name, 'TypeError');
  });

  it('starts a new view on a tenant switch, not on the first assignment', async () => {
    const { adapter, sdk } = configured();
    await adapter.init();
    sdk.calls.length = 0;
    adapter.group('account_id', 'C1');
    adapter.group('account_id', 'C1');
    adapter.group('account_id', 'C2');
    adapter.group('other_key', 'X');
    assert.deepEqual(sdk.calls.map(([m]) => m), ['setAccount', 'setAccount', 'setAccount', 'startView']);
  });

  it('starts a new view for the next tenant after a logout, not on the logout itself', async () => {
    const { adapter, sdk } = configured();
    await adapter.init();
    sdk.calls.length = 0;
    adapter.group('account_id', 'C1');
    adapter.reset();
    adapter.group('account_id', 'C2');
    assert.deepEqual(sdk.calls.map(([m]) => m),
      ['setAccount', 'stopSession', 'clearUser', 'clearAccount', 'setGlobalContext', 'setAccount', 'startView']);
  });

  it('clears identity and context on reset', async () => {
    const { adapter, sdk } = configured();
    await adapter.init();
    sdk.calls.length = 0;
    adapter.reset();
    assert.deepEqual(sdk.calls.map(([m]) => m), ['stopSession', 'clearUser', 'clearAccount', 'setGlobalContext']);
  });

  it('replays flag evaluations made before init, with Datadog-safe keys', async () => {
    const { adapter, sdk } = configured();
    adapter.addFeatureFlagEvaluation('page-help-suggestions', false);
    adapter.addFeatureFlagEvaluation('page-help-suggestions', true);
    await adapter.init();
    adapter.addFeatureFlagEvaluation('public-api-keys', true);
    const flags = sdk.calls.filter(([m]) => m === 'addFeatureFlagEvaluation').map(([, k, v]) => [k, v]);
    assert.deepEqual(flags, [['page_help_suggestions', true], ['public_api_keys', true]]);
  });

  it('does not queue flag evaluations after a kill', async () => {
    const { adapter, sdk } = configured();
    await adapter.init();
    adapter.shutdown();
    adapter.addFeatureFlagEvaluation('x', true);
    assert.equal(sdk.calls.filter(([m]) => m === 'addFeatureFlagEvaluation').length, 0);
  });
});

describe('createDatadogAdapter — behind the gateway', () => {
  it('never loads the SDK when killed before init', async () => {
    const { adapter, loads } = configured();
    const gateway = createTelemetryGateway({ adapters: [adapter], disabled: ['datadog'], logger: silent });
    await gateway.init({});
    await gateway.track('x');
    assert.equal(loads(), 0);
  });

  it('receives sanitized payloads only', async () => {
    const { adapter, sdk } = configured();
    const gateway = createTelemetryGateway({ adapters: [adapter], allowedKeys: ['app'], logger: silent });
    await gateway.init({});
    await gateway.track('saved', { app: 'app-shell', email: SECRET_EMAIL });
    await gateway.identify(SECRET_EMAIL);
    await gateway.captureException(new Error(`failed for ${SECRET_EMAIL}`));
    await gateway.addFeatureFlagEvaluation('public-api-keys', true);
    assert.ok(!JSON.stringify(sdk.calls.map(([m, ...a]) => [m, a.map(String), a])).includes(SECRET_EMAIL));
    assert.equal(sdk.calls.some(([m]) => m === 'setUser'), false, 'an identifier that does not survive the scrub is dropped');
    assert.ok(sdk.calls.some(([m, k, v]) => m === 'addFeatureFlagEvaluation' && k === 'public_api_keys' && v === true));
  });
});

describe('resolveTracingUrls', () => {
  it('matches only the exact origin under /sws/neo', () => {
    const [rule] = resolveTracingUrls('["https://app.etendo.software/etendo"]', silent);
    assert.equal(rule.match('https://app.etendo.software/etendo/sws/neo/sales-order'), true);
    assert.equal(rule.match('https://app.etendo.software/etendo/sws/go/session'), false);
    assert.equal(rule.match('https://app.etendo.software.evil.com/etendo/sws/neo/x'), false);
    assert.equal(rule.match('https://user:pw@app.etendo.software/etendo/sws/neo/x'), false);
    assert.deepEqual(rule.propagatorTypes, ['tracecontext', 'datadog']);
  });

  it('accepts an array, and disables propagation on anything invalid', () => {
    assert.equal(resolveTracingUrls(['https://a.example.com']).length, 1);
    assert.deepEqual(resolveTracingUrls('not json', silent), []);
    assert.deepEqual(resolveTracingUrls('["https://*.example.com"]', silent), []);
    assert.deepEqual(resolveTracingUrls('["https://a.example.com/?q=1"]', silent), []);
    assert.deepEqual(resolveTracingUrls(undefined), []);
  });
});

describe('toDatadogFlagKey', () => {
  it('keeps identifier characters only', () => {
    assert.equal(toDatadogFlagKey('page-help-suggestions'), 'page_help_suggestions');
    assert.equal(toDatadogFlagKey('--x--'), 'x');
    assert.equal(toDatadogFlagKey(''), 'flag');
    assert.equal(toDatadogFlagKey('a'.repeat(150)).length, 100);
  });
});
