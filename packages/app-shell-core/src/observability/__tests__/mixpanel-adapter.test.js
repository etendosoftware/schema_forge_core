import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMixpanelAdapter,
  sanitizeMixpanelEvent,
  sanitizeMixpanelPeople,
  sanitizeMixpanelGroup,
  MIXPANEL_PROPERTY_BLACKLIST,
} from '../adapters/mixpanel.js';
import {
  SECRET_TOKEN,
  SECRET_EMAIL,
  SECRET_QUERY_CODE,
  findLeakedFixtureSecrets,
} from '../nestedSecretFixtures.js';

// ETP-4578 C5 (Mixpanel). The SDK module is injected through a loader, so these tests
// drive the adapter with a fake one; real serialized requests are captured in the host
// (H4b), where mixpanel-browser is installed.

const HEX32 = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const PROJECT_TOKEN = 'fake-mixpanel-project-token';

function fakeMixpanel({ trackReturns = { queued: true }, persisted = {}, loadDelayMs = 0, failFirstLoad = false } = {}) {
  const calls = [];
  const state = { config: undefined };
  const superProps = { ...persisted };
  const client = {
    init: (token, config) => { calls.push(['init', token]); state.config = config; },
    persistence: { properties: () => ({ ...superProps }) },
    unregister: (key) => { calls.push(['unregister', key]); delete superProps[key]; },
    track: (name, props, options, callback) => {
      calls.push(['track', name, props]);
      if (trackReturns) callback?.(1);
      return trackReturns;
    },
    identify: (id) => calls.push(['identify', id]),
    people: { set: (traits) => calls.push(['people.set', traits]) },
    set_group: (key, id) => calls.push(['set_group', key, id]),
    register: (props) => calls.push(['register', props]),
    get_group: (key, id) => ({ set: (props) => calls.push(['group.set', key, id, props]) }),
    reset: () => calls.push(['reset']),
    flush: () => calls.push(['flush']),
  };
  let loads = 0;
  return {
    loadSdk: async () => {
      loads += 1;
      if (loadDelayMs) await new Promise((resolve) => { setTimeout(resolve, loadDelayMs); });
      if (failFirstLoad && loads === 1) throw new Error('chunk failed to load');
      return { default: client };
    },
    calls,
    loads: () => loads,
    config: () => state.config,
    hook: (name, payload) => state.config.hooks[name](payload),
  };
}

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = String(v); }, data };
}

const LOCATION = `https://go.etendo.cloud/go/sales-order/${HEX32}?token=${SECRET_TOKEN}#lines`;

function adapterWith(overrides = {}) {
  const fake = fakeMixpanel(overrides.fake);
  const logger = { warnings: [], warn(message) { this.warnings.push(message); } };
  const adapter = createMixpanelAdapter({
    loadSdk: fake.loadSdk,
    enabled: true,
    token: PROJECT_TOKEN,
    allowedKeys: ['action', 'account_id', 'app', 'environment'],
    storage: memoryStorage({ sf_mixpanel_identity_reset_v1: '1' }),
    currentUrl: () => LOCATION,
    referrer: () => `https://go.etendo.cloud/go/portal/tok-abcdef0123456789?code=${SECRET_QUERY_CODE}`,
    logger,
    ...overrides.adapter,
  });
  return { adapter, fake, logger };
}

/** What `before_send_events` receives: the SDK has merged its defaults and super-props. */
function buildEventData() {
  return {
    event: 'button_clicked',
    properties: {
      action: 'save',
      account_id: HEX32,
      email: SECRET_EMAIL,
      apiToken: SECRET_TOKEN,
      token: PROJECT_TOKEN,
      distinct_id: '$device:5f0c2e7a-1d7b-4c3a-9a55-2f9d1c0e8b11',
      $device_id: '5f0c2e7a-1d7b-4c3a-9a55-2f9d1c0e8b11',
      $insert_id: 'insert-1',
      time: 1_700_000_000,
      mp_lib: 'web',
      $lib_version: '2.83.0',
      $os: 'Linux',
      $browser: 'Chrome',
      $browser_version: 130,
      $device: 'Desktop',
      $screen_height: 1080,
      $screen_width: 1920,
      $current_url: LOCATION,
      $referrer: `https://www.google.com/search?q=${SECRET_EMAIL}`,
      $initial_referrer: `https://mail.example.com/?t=${SECRET_TOKEN}`,
      utm_source: SECRET_EMAIL,
      gclid: SECRET_TOKEN,
    },
  };
}

describe('createMixpanelAdapter — enablement and loading', () => {
  it('is disabled by default and needs both an explicit opt-in and a token (D3)', () => {
    const fake = fakeMixpanel();
    assert.equal(createMixpanelAdapter({ loadSdk: fake.loadSdk, token: PROJECT_TOKEN }).enabled, false);
    assert.equal(createMixpanelAdapter({ loadSdk: fake.loadSdk, enabled: true, logger: { warn() {} } }).enabled, false);
    assert.equal(createMixpanelAdapter({ loadSdk: fake.loadSdk, enabled: 'true', token: PROJECT_TOKEN }).enabled, true);
  });

  it('warns when the opt-in is on but the token is missing', () => {
    const warnings = [];
    createMixpanelAdapter({ loadSdk: fakeMixpanel().loadSdk, enabled: true, logger: { warn: (m) => warnings.push(m) } });
    assert.equal(warnings.length, 1);
  });

  it('loads the SDK lazily, once, on the first use', async () => {
    const { adapter, fake } = adapterWith();
    assert.equal(fake.loads(), 0);

    await adapter.init({ context: {} });
    await adapter.track('a', {}, { context: {} });

    assert.equal(fake.loads(), 1);
  });
});

describe('createMixpanelAdapter — SDK configuration', () => {
  it('turns off everything that collects on its own, and IP geolocation by default (D7)', async () => {
    const { adapter, fake } = adapterWith();
    await adapter.init({ context: {} });
    const config = fake.config();

    assert.equal(config.ip, false);
    assert.equal(config.track_pageview, false);
    assert.equal(config.autocapture, false);
    assert.equal(config.record_sessions_percent, 0);
    assert.equal(config.record_heatmap_data, false);
    assert.equal(config.track_marketing, false);
    assert.equal(config.save_referrer, false);
    assert.equal(config.batch_requests, false);
  });

  it('lets the host turn IP geolocation back on and set the API host', async () => {
    const { adapter, fake } = adapterWith({ adapter: { trackIp: true, apiHost: 'https://api-eu.mixpanel.com' } });
    await adapter.init({ context: {} });
    assert.equal(fake.config().ip, true);
    assert.equal(fake.config().api_host, 'https://api-eu.mixpanel.com');
  });

  it('blacklists raw URLs, referrers and marketing parameters, also for SDK events that skip hooks', async () => {
    const { adapter, fake } = adapterWith();
    await adapter.init({ context: {} });
    for (const prop of ['$current_url', '$referrer', '$initial_referrer', '$initial_referring_domain', 'utm_source', 'gclid']) {
      assert.ok(fake.config().property_blacklist.includes(prop), `${prop} must be blacklisted`);
    }
    assert.deepEqual(fake.config().property_blacklist, MIXPANEL_PROPERTY_BLACKLIST);
  });

  it('installs the events, people and groups hooks', async () => {
    const { adapter, fake } = adapterWith();
    await adapter.init({ context: {} });
    for (const hook of ['before_send_events', 'before_send_people', 'before_send_groups']) {
      assert.equal(typeof fake.config().hooks[hook], 'function');
    }
  });
});

describe('sanitizeMixpanelEvent', () => {
  const policy = {
    allowedKeys: ['action', 'account_id'],
    currentUrl: () => LOCATION,
    referrer: () => `https://www.google.com/search?q=${SECRET_EMAIL}`,
  };

  it('lets no planted secret through', () => {
    const out = sanitizeMixpanelEvent(buildEventData(), policy);
    assert.deepEqual(findLeakedFixtureSecrets(out), []);
    // The record id in the URL collapses; account_id is an approved identifier and stays.
    assert.ok(!out.properties.$current_url.includes(HEX32));
  });

  it('keeps approved host properties, SDK identity and approved SDK defaults only', () => {
    const { properties } = sanitizeMixpanelEvent(buildEventData(), policy);
    assert.deepEqual(properties, {
      action: 'save',
      account_id: HEX32,
      token: PROJECT_TOKEN,
      distinct_id: '$device:5f0c2e7a-1d7b-4c3a-9a55-2f9d1c0e8b11',
      $device_id: '5f0c2e7a-1d7b-4c3a-9a55-2f9d1c0e8b11',
      $insert_id: 'insert-1',
      time: 1_700_000_000,
      mp_lib: 'web',
      $lib_version: '2.83.0',
      $os: 'Linux',
      $browser: 'Chrome',
      $browser_version: 130,
      $device: 'Desktop',
      $screen_height: 1080,
      $screen_width: 1920,
      $current_url: '/go/sales-order/:id',
    });
    // The policy's referrer is external (a search engine), so it is not sent at all.
  });

  it('sends URL properties as a normalized path only, or not at all (D7, configurable)', () => {
    const dropped = sanitizeMixpanelEvent(buildEventData(), { ...policy, urlPropertyMode: 'drop' });
    assert.equal(dropped.properties.$current_url, undefined);
    assert.equal(dropped.properties.$referrer, undefined);
  });

  it('never redacts the SDK project token the endpoint needs to route the event', () => {
    assert.equal(sanitizeMixpanelEvent(buildEventData(), policy).properties.token, PROJECT_TOKEN);
  });

  it('lets the host approve a different set of SDK defaults', () => {
    const { properties } = sanitizeMixpanelEvent(buildEventData(), { ...policy, approvedSdkProperties: ['$os'] });
    assert.equal(properties.$os, 'Linux');
    assert.equal(properties.$browser, undefined);
  });

  it('scrubs the event name', () => {
    assert.equal(sanitizeMixpanelEvent({ event: `login ${SECRET_EMAIL}`, properties: {} }, policy).event, '[REDACTED]');
  });
});

describe('sanitizeMixpanelPeople / sanitizeMixpanelGroup', () => {
  it('a people update keeps SDK identity and allowlisted $set traits only', () => {
    const out = sanitizeMixpanelPeople({
      $token: PROJECT_TOKEN,
      $distinct_id: 'd1',
      $device_id: 'dev1',
      $set: { plan: 'pro', $email: SECRET_EMAIL, $os: 'Linux' },
      $append: { history: SECRET_TOKEN },
    }, { allowedKeys: ['plan'] });
    assert.deepEqual(out, { $token: PROJECT_TOKEN, $distinct_id: 'd1', $device_id: 'dev1', $set: { plan: 'pro', $os: 'Linux' } });
  });

  it('a group update does not send the organization name unless the host approves it (D6)', () => {
    const data = { $token: PROJECT_TOKEN, $group_key: 'account_id', $group_id: HEX32, $set: { $name: 'Acme Corp' } };
    assert.deepEqual(sanitizeMixpanelGroup(data, { allowedKeys: [] }), {
      $token: PROJECT_TOKEN, $group_key: 'account_id', $group_id: HEX32, $set: {},
    });
    assert.deepEqual(sanitizeMixpanelGroup(data, { allowedKeys: ['$name'] }).$set, { $name: 'Acme Corp' });
  });
});

describe('createMixpanelAdapter — hooks', () => {
  it('the events hook returns the sanitized payload', async () => {
    const { adapter, fake } = adapterWith();
    await adapter.init({ context: {} });
    const out = fake.hook('before_send_events', buildEventData());
    assert.deepEqual(findLeakedFixtureSecrets(out), []);
    assert.equal(out.properties.$current_url, '/go/sales-order/:id');
  });

  it('a payload that cannot be sanitized is dropped (null), never sent raw', async () => {
    const { adapter, fake, logger } = adapterWith();
    await adapter.init({ context: {} });
    const hostile = { event: 'x', get properties() { throw new Error('boom'); } };
    assert.equal(fake.hook('before_send_events', hostile), null);
    assert.equal(logger.warnings.length, 1);
  });

  it('after a hot kill every hook drops everything, so nothing goes out (zero outbound)', async () => {
    const { adapter, fake } = adapterWith();
    await adapter.init({ context: {} });
    await adapter.shutdown();

    assert.equal(fake.hook('before_send_events', buildEventData()), null);
    assert.equal(fake.hook('before_send_people', { $token: PROJECT_TOKEN, $set: {} }), null);
    assert.equal(fake.hook('before_send_groups', { $token: PROJECT_TOKEN, $set: {} }), null);
  });

  it('re-initializing after a kill lets payloads through again', async () => {
    const { adapter, fake } = adapterWith();
    await adapter.init({ context: {} });
    await adapter.shutdown();
    await adapter.init({ context: {} });

    assert.notEqual(fake.hook('before_send_events', buildEventData()), null);
    assert.equal(fake.loads(), 1);
  });
});

describe('createMixpanelAdapter — gateway operations', () => {
  it('track merges the gateway context under the event properties', async () => {
    const { adapter, fake } = adapterWith();
    await adapter.track('button_clicked', { action: 'save' }, { context: { app: 'app-shell', action: 'ignored' } });
    assert.deepEqual(fake.calls.find(([n]) => n === 'track'), ['track', 'button_clicked', { app: 'app-shell', action: 'save' }]);
  });

  it('track resolves at once when the SDK drops the event and never calls back', async () => {
    const { adapter } = adapterWith({ fake: { trackReturns: null } });
    const started = performance.now();
    await adapter.track('dropped', {}, { context: {} });
    assert.ok(performance.now() - started < 500);
  });

  it('page is tracked as page_view with the route', async () => {
    const { adapter, fake } = adapterWith();
    await adapter.page('/sales-order/:id', {}, { context: {} });
    assert.deepEqual(fake.calls.find(([n]) => n === 'track'), ['track', 'page_view', { route: '/sales-order/:id', routePattern: '/sales-order/:id' }]);
  });

  it('identify, group, groupSet and reset map to the SDK calls the host provider used', async () => {
    const { adapter, fake } = adapterWith();
    await adapter.identify('user-1', { plan: 'pro' });
    await adapter.group('account_id', HEX32);
    await adapter.groupSet('account_id', HEX32, { tier: 'gold' });
    await adapter.reset();
    const sdkCalls = fake.calls.filter(([n]) => n !== 'init');
    assert.deepEqual(sdkCalls, [
      ['identify', 'user-1'],
      ['people.set', { plan: 'pro' }],
      ['set_group', 'account_id', HEX32],
      ['register', { account_id: HEX32 }],
      ['group.set', 'account_id', HEX32, { tier: 'gold' }],
      ['reset'],
    ]);
  });

  it('does nothing and loads nothing when disabled', async () => {
    const fake = fakeMixpanel();
    const adapter = createMixpanelAdapter({ loadSdk: fake.loadSdk, token: PROJECT_TOKEN });
    await adapter.track('x', {}, { context: {} });
    assert.equal(fake.loads(), 0);
  });
});

describe('createMixpanelAdapter — kill switch races and load failures (Crisol B2, N2)', () => {
  it('an identify in flight when the kill lands never reaches the SDK ($identify skips the hooks)', async () => {
    const { adapter, fake } = adapterWith({ fake: { loadDelayMs: 30 } });

    const identifying = adapter.identify('user-2', { plan: 'pro' });
    await adapter.shutdown();
    await identifying;

    assert.equal(fake.calls.some(([n]) => n === 'identify' || n === 'people.set'), false);
  });

  it('no gateway operation reaches the SDK after a kill, whatever was in flight', async () => {
    const { adapter, fake } = adapterWith({ fake: { loadDelayMs: 30 } });

    const inFlight = [
      adapter.track('a', {}, { context: {} }),
      adapter.page('/x', {}, { context: {} }),
      adapter.group('account_id', HEX32),
      adapter.groupSet('account_id', HEX32, {}),
      adapter.reset(),
    ];
    await adapter.shutdown();
    await Promise.all(inFlight);

    assert.deepEqual(fake.calls.filter(([n]) => n !== 'init').map(([n]) => n), []);
  });

  it('a failed SDK load is not cached: the next use loads it again', async () => {
    const { adapter, fake } = adapterWith({ fake: { failFirstLoad: true } });

    await assert.rejects(() => adapter.init({ context: {} }));
    await adapter.track('after-retry', {}, { context: {} });

    assert.equal(fake.loads(), 2);
    assert.ok(fake.calls.some(([n, name]) => n === 'track' && name === 'after-retry'));
  });
});

describe('createMixpanelAdapter — super-properties (Crisol N3)', () => {
  it('drops persisted super-properties that are not approved when it initializes', async () => {
    const { adapter, fake } = adapterWith({
      fake: { persisted: { legacy_email: SECRET_EMAIL, account_id: HEX32, distinct_id: 'd1', $device_id: 'dev1' } },
    });

    await adapter.init({ context: {} });

    assert.deepEqual(fake.calls.filter(([n]) => n === 'unregister'), [['unregister', 'legacy_email']]);
  });

  it('filters every register/register_once through the allowlist, keeping SDK identity', async () => {
    const { adapter, fake } = adapterWith();
    await adapter.init({ context: {} });
    const { before_register: beforeRegister, before_register_once: beforeRegisterOnce } = fake.config().hooks;

    assert.deepEqual(beforeRegister({ account_id: HEX32, legacy_email: SECRET_EMAIL }), { account_id: HEX32 });
    assert.deepEqual(
      beforeRegisterOnce({ $device_id: 'dev1', $had_persisted_distinct_id: true, $initial_referrer: `https://mail.example.com/?u=${SECRET_EMAIL}` }),
      { $device_id: 'dev1', $had_persisted_distinct_id: true },
    );
  });
});

describe('createMixpanelAdapter — referrer and persistence', () => {
  it('sends the referrer path only when the referrer is the app itself', () => {
    const base = { allowedKeys: [], currentUrl: () => LOCATION };
    const sameOrigin = sanitizeMixpanelEvent(buildEventData(), { ...base, referrer: () => `https://go.etendo.cloud/go/portal/tok-abcdef0123456789?code=${SECRET_QUERY_CODE}` });
    const external = sanitizeMixpanelEvent(buildEventData(), { ...base, referrer: () => 'https://mail.example.com/inbox' });

    assert.equal(sameOrigin.properties.$referrer, '/go/portal/:id');
    assert.equal(external.properties.$referrer, undefined);
  });

  it('keeps the SDK persistence (cookie) unless the host chooses another', async () => {
    const byDefault = adapterWith();
    await byDefault.adapter.init({ context: {} });
    assert.equal(byDefault.fake.config().persistence, 'cookie');

    const local = adapterWith({ adapter: { persistence: 'localStorage' } });
    await local.adapter.init({ context: {} });
    assert.equal(local.fake.config().persistence, 'localStorage');
  });
});

describe('createMixpanelAdapter — one-time stale identity reset (GDPR, ETP-4352)', () => {
  it('resets once per browser, after init, and remembers it', async () => {
    const storage = memoryStorage();
    const { adapter, fake } = adapterWith({ adapter: { storage } });
    await adapter.init({ context: {} });
    await adapter.track('a', {}, { context: {} });

    assert.deepEqual(fake.calls.map(([n]) => n).slice(0, 2), ['init', 'reset']);
    assert.equal(fake.calls.filter(([n]) => n === 'reset').length, 1);
    assert.equal(storage.data.sf_mixpanel_identity_reset_v1, '1');
  });

  it('does not reset a browser that was already reset', async () => {
    const { adapter, fake } = adapterWith({ adapter: { storage: memoryStorage({ sf_mixpanel_identity_reset_v1: '1' }) } });
    await adapter.init({ context: {} });
    assert.equal(fake.calls.filter(([n]) => n === 'reset').length, 0);
  });

  it('still resets when storage is unavailable', async () => {
    const storage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    const { adapter, fake } = adapterWith({ adapter: { storage } });
    await adapter.init({ context: {} });
    assert.equal(fake.calls.filter(([n]) => n === 'reset').length, 1);
  });
});
