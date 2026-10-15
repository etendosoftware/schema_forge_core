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
// is closed. The SDK applies a beforeSend change only to a fixed list of fields per event type,
// and only when the new value keeps the field's type (MODIFIABLE_FIELD_PATHS_BY_EVENT and
// limitModification, rum-core 7.15), and it cannot drop a view event; the fake below ports
// those rules, so a test cannot pass by editing a field the real SDK would revert.

const silent = { warn() {} };
const HEX32 = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

const COMMON = { 'view.name': 'string', 'view.url': 'string', 'view.referrer': 'string', context: 'object', service: 'string', version: 'string' };
const MODIFIABLE = {
  view: { ...COMMON, 'view.performance.lcp.resource_url': 'string' },
  error: {
    ...COMMON, 'error.message': 'string', 'error.stack': 'string', 'error.handling_stack': 'string',
    'error.resource.url': 'string', 'error.fingerprint': 'string', '_dd.debug_ids': 'array',
  },
  resource: {
    ...COMMON, 'resource.url': 'string', 'resource.graphql.variables': 'string', 'resource.request.headers': 'object',
    'resource.response.headers': 'object', 'resource.websocket.close_reason': 'string', 'resource.websocket.protocol': 'string',
  },
  action: { ...COMMON, 'action.target.name': 'string' },
  long_task: { ...COMMON, 'long_task.scripts[].source_url': 'string', 'long_task.scripts[].invoker': 'string', '_dd.debug_ids': 'array' },
  vital: COMMON,
};

function typeOf(value) {
  if (value === null) return 'null';
  return Array.isArray(value) ? 'array' : typeof value;
}

function setValueAtPath(object, clone, segments, fieldType) {
  const [field, ...rest] = segments;
  if (field === '[]') {
    if (Array.isArray(object) && Array.isArray(clone)) object.forEach((item, i) => setValueAtPath(item, clone[i], rest, fieldType));
    return;
  }
  if (typeOf(object) !== 'object' || typeOf(clone) !== 'object') return;
  if (rest.length > 0) {
    setValueAtPath(object[field], clone[field], rest, fieldType);
    return;
  }
  const value = clone[field];
  if (object[field] === value) return;
  const newType = typeOf(value);
  if (newType === fieldType) object[field] = value;
  else if (fieldType === 'object' && (newType === 'undefined' || newType === 'null')) object[field] = {};
  else if (fieldType === 'array' && (newType === 'undefined' || newType === 'null')) object[field] = [];
}

/** Port of rum-core's shouldSend + limitModification: only modifiable, same-type changes stick. */
function runBeforeSend(beforeSend, event) {
  const out = structuredClone(event);
  const clone = structuredClone(event);
  const result = beforeSend(clone);
  for (const [path, fieldType] of Object.entries(MODIFIABLE[event.type] ?? {})) {
    setValueAtPath(out, clone, path.split(/\.|(?=\[\])/), fieldType);
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
    assert.equal(options.telemetrySampleRate, 0, "the SDK's own telemetry skips beforeSend, so it is off");
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

  it('starts without consent, and without a view, when killed while the SDK was loading', async () => {
    const sdk = fakeSdk();
    let release;
    const adapter = createDatadogAdapter({
      ...{ enabled: true, applicationId: 'a', clientToken: 't', site: 's', env: 'e', logger: silent },
      currentPath: () => '/go/contacts',
      loadSdk: () => new Promise((resolve) => { release = () => resolve({ datadogRum: sdk.datadogRum }); }),
    });
    adapter.addFeatureFlagEvaluation('x', true);
    const starting = adapter.init();
    adapter.shutdown();
    release();
    await starting;
    assert.equal(sdk.initOptions().trackingConsent, 'not-granted');
    assert.deepEqual(sdk.calls.map(([m]) => m), ['init'], 'no view or flag is buffered for a later grant');
    adapter.page('/go/sales-order');
    await adapter.init();
    assert.deepEqual(sdk.calls.slice(1), [['setTrackingConsent', 'granted'], ['startView', { name: '/go/contacts' }]]);
  });

  it('records navigation while killed and opens the current route on revive', async () => {
    let path = '/go/contacts';
    const { adapter, sdk } = configured({ currentPath: () => path });
    await adapter.init();
    adapter.shutdown();
    sdk.calls.length = 0;
    path = `/go/sales-order/${HEX32}`;
    adapter.page('/go/sales-order/:id');
    assert.deepEqual(sdk.calls, [], 'the SDK would buffer it and replay it on the next grant');
    await adapter.init();
    assert.deepEqual(sdk.calls, [['setTrackingConsent', 'granted'], ['startView', { name: '/go/sales-order/:id' }]]);
  });

  it('leaves the revived session on its renewal view when the route did not change', async () => {
    const { adapter, sdk } = configured({ currentPath: () => '/go/contacts' });
    await adapter.init();
    adapter.shutdown();
    sdk.calls.length = 0;
    await adapter.init();
    // The SDK opens a renewal view under the last name on its own; another one would be empty.
    assert.deepEqual(sdk.calls, [['setTrackingConsent', 'granted']]);
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

  it('drops a referrer from another site, on every event type that carries one', async () => {
    const { beforeSend } = await hook();
    for (const type of ['view', 'action', 'error']) {
      const { event } = runBeforeSend(beforeSend, {
        type,
        view: { url: 'https://app.etendo.software/go/contacts', referrer: `https://mail.example.com/inbox?u=${SECRET_EMAIL}`, name: '/contacts' },
      });
      assert.equal(event.view.referrer, '', type);
    }
    const relative = runBeforeSend(beforeSend, { type: 'view', view: { url: '/go/contacts', referrer: `/go/contacts/${HEX32}?code=x` } });
    assert.equal(relative.event.view.referrer, '/go/contacts/:id', 'a relative referrer is this app');
    const unparseable = runBeforeSend(beforeSend, { type: 'view', view: { url: 'not a url', referrer: 'https://app.etendo.software/go' } });
    assert.equal(unparseable.event.view.referrer, '');
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

  it('scrubs action names and long-task script URLs and invokers', async () => {
    const { beforeSend } = await hook();
    const action = runBeforeSend(beforeSend, { type: 'action', action: { target: { name: `Enviar a ${SECRET_EMAIL}` } } });
    assert.equal(action.event.action.target.name, '[REDACTED]');
    const task = runBeforeSend(beforeSend, {
      type: 'long_task',
      long_task: {
        scripts: [
          { source_url: `https://app.etendo.software/x.js?token=${SECRET_TOKEN}`, invoker: 'BUTTON#save.onclick' },
          { source_url: 'https://app.etendo.software/y.js', invoker: `https://app.etendo.software/z.js?token=${SECRET_TOKEN}` },
        ],
      },
    });
    assert.equal(task.event.long_task.scripts[0].source_url, 'https://app.etendo.software/x.js');
    assert.equal(task.event.long_task.scripts[0].invoker, 'BUTTON#save.onclick');
    assert.equal(task.event.long_task.scripts[1].invoker, 'https://app.etendo.software/z.js');
  });

  it('scrubs GraphQL variables, WebSocket close reasons and error fingerprints', async () => {
    const { beforeSend } = await hook();
    const resource = runBeforeSend(beforeSend, {
      type: 'resource',
      resource: {
        url: 'https://app.etendo.software/graphql',
        graphql: { variables: JSON.stringify({ email: SECRET_EMAIL }) },
        websocket: { close_reason: `token ${SECRET_TOKEN} expired`, protocol: `bearer.${FAKE_JWT}` },
      },
    });
    assert.equal(resource.event.resource.graphql.variables, '[REDACTED]');
    assert.equal(resource.event.resource.websocket.close_reason, '[REDACTED]');
    assert.equal(resource.event.resource.websocket.protocol, '[REDACTED]');
    const plain = runBeforeSend(beforeSend, { type: 'resource', resource: { url: 'wss://a.example.com/ws', websocket: { protocol: 'json' } } });
    assert.equal(plain.event.resource.websocket.protocol, 'json');
    const error = runBeforeSend(beforeSend, { type: 'error', error: { message: 'x', fingerprint: `user-${SECRET_EMAIL}` } });
    assert.equal(error.event.error.fingerprint, '[REDACTED]');
  });

  it('drops an error whose causes carry data it cannot rewrite', async () => {
    const { beforeSend } = await hook();
    const unsafe = runBeforeSend(beforeSend, {
      type: 'error',
      error: { message: 'Save failed', causes: [{ message: `rejected for ${SECRET_EMAIL}`, source: 'source' }] },
    });
    assert.equal(unsafe.dropped, true);
    const unsafeStack = runBeforeSend(beforeSend, {
      type: 'error',
      error: { message: 'Save failed', causes: [{ message: 'timeout', stack: `Error\n    at f (https://a.example.com/x.js?token=${SECRET_TOKEN}:1:2)` }] },
    });
    assert.equal(unsafeStack.dropped, true);
    const safe = runBeforeSend(beforeSend, {
      type: 'error',
      error: { message: 'Save failed', causes: [{ message: 'timeout', stack: 'Error: timeout\n    at f (https://a.example.com/x.js:1:2)' }] },
    });
    assert.equal(safe.dropped, false);
    assert.equal(safe.event.error.causes[0].message, 'timeout');
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

  it('still sanitizes the view that ends with a kill (the SDK sends it anyway)', async () => {
    const { adapter, sdk } = configured();
    await adapter.init();
    const { beforeSend } = sdk.initOptions();
    adapter.shutdown();
    const { event } = runBeforeSend(beforeSend, {
      type: 'view',
      view: {
        url: `https://app.etendo.software/go/contacts/${HEX32}?code=${SECRET_QUERY_CODE}`,
        referrer: `https://app.etendo.software/go/reset?token=${SECRET_TOKEN}`,
        name: '/contacts/:recordId',
      },
      context: { email: SECRET_EMAIL },
    });
    assert.equal(event.view.url, 'https://app.etendo.software/go/contacts/:id');
    assert.equal(event.view.referrer, 'https://app.etendo.software/go/reset');
    assert.deepEqual(event.context, {});
  });

  it('drops an event it cannot sanitize instead of sending it as is', async () => {
    const { beforeSend } = await hook();
    const hostile = { type: 'error', get error() { throw new Error('boom'); } };
    assert.equal(beforeSend(hostile), false);
  });

  it('sends a view it cannot sanitize with its URLs emptied', async () => {
    const { beforeSend } = await hook();
    const view = {
      url: `https://app.etendo.software/go/reset?token=${SECRET_TOKEN}`,
      referrer: `https://app.etendo.software/go/reset?token=${SECRET_TOKEN}`,
      name: '/reset',
    };
    view.performance = { lcp: { resource_url: `https://cdn.example.com/a.png?sig=${SECRET_TOKEN}` } };
    let context = { email: SECRET_EMAIL };
    const hostile = {
      type: 'view',
      view,
      get context() {
        if (context.email) throw new Error('boom');
        return context;
      },
      set context(value) { context = value; },
    };
    assert.equal(beforeSend(hostile), false);
    assert.deepEqual(view, { url: '', referrer: '', name: '', performance: { lcp: { resource_url: '' } } });
    assert.deepEqual(context, {});
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

  it('calls nothing on the SDK while killed, even directly (it would buffer and replay it)', async () => {
    const sdk = fakeSdk();
    let release;
    const adapter = createDatadogAdapter({
      ...{ enabled: true, applicationId: 'a', clientToken: 't', site: 's', env: 'e', logger: silent },
      loadSdk: () => new Promise((resolve) => { release = () => resolve({ datadogRum: sdk.datadogRum }); }),
    });
    const starting = adapter.init();
    adapter.shutdown();
    release();
    await starting;
    sdk.calls.length = 0;
    adapter.track('x');
    adapter.identify('u');
    adapter.group('account_id', 'C1');
    adapter.group('account_id', 'C2');
    adapter.captureException({ message: 'x' });
    adapter.setContext({ app: 'a' });
    adapter.reset();
    adapter.page('/b');
    assert.deepEqual(sdk.calls, []);
  });

  it('applies an identity set before the SDK loaded, unless a logout cleared it', async () => {
    const { adapter, sdk } = configured();
    adapter.identify('user-1');
    adapter.group('account_id', 'C1');
    await adapter.init();
    assert.deepEqual(sdk.calls.filter(([m]) => m === 'setUser' || m === 'setAccount'),
      [['setUser', { id: 'user-1' }], ['setAccount', { id: 'C1' }]]);
    adapter.group('account_id', 'C2');
    assert.equal(sdk.calls.filter(([m]) => m === 'startView').length, 2, 'moving on from the replayed tenant is a tenant switch');

    const loggedOut = configured();
    loggedOut.adapter.identify('user-1');
    loggedOut.adapter.group('account_id', 'C1');
    loggedOut.adapter.reset();
    await loggedOut.adapter.init();
    assert.equal(loggedOut.sdk.calls.some(([m]) => m === 'setUser' || m === 'setAccount'), false);
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
