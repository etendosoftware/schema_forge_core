import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSentryAdapter,
  sanitizeSentryEvent,
  sanitizeSentryBreadcrumb,
  sanitizeSentrySpan,
} from '../adapters/sentry.js';
import { REDACTED } from '../sanitize.js';
import {
  SECRET_TOKEN,
  SECRET_EMAIL,
  SECRET_PASSWORD,
  SECRET_QUERY_CODE,
  FAKE_JWT,
  findLeakedFixtureSecrets,
} from '../nestedSecretFixtures.js';

// ETP-4578 C5 (Sentry). The SDK is injected, so these tests drive the adapter with a fake
// one; the real SDK's serialized envelopes are captured in the host (H4a), where
// @sentry/react is installed.

const HEX32 = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const CHUNK = 'https://go.etendo.cloud/go/assets/index-B3kd9Fq2.js';

function fakeSentry() {
  const calls = [];
  const record = (name) => (...args) => { calls.push([name, ...args]); };
  return {
    sdk: {
      init: record('init'),
      captureException: record('captureException'),
      setContext: record('setContext'),
      addBreadcrumb: record('addBreadcrumb'),
      setUser: record('setUser'),
      close: async (...args) => { calls.push(['close', ...args]); return true; },
      flush: async (...args) => { calls.push(['flush', ...args]); return true; },
      browserTracingIntegration: () => ({ name: 'BrowserTracing' }),
    },
    calls,
    initOptions: () => calls.find(([name]) => name === 'init')?.[1],
  };
}

const POLICY = { allowedKeys: ['plan', 'reason', 'app', 'environment'] };

/** Everything the browser SDK can put in an error event, with a planted secret in each. */
function buildErrorEvent() {
  return {
    event_id: 'e1',
    timestamp: 1_700_000_000,
    level: 'error',
    platform: 'javascript',
    environment: 'staging',
    release: 'app-shell@1.2.3',
    logger: 'javascript',
    sdk: { name: 'sentry.javascript.react', version: '10.74.0', integrations: ['Dedupe'], packages: [{ name: 'npm:@sentry/react' }] },
    message: `Login failed for ${SECRET_EMAIL}`,
    logentry: { message: `Token ${SECRET_TOKEN} rejected`, params: [SECRET_PASSWORD] },
    exception: {
      values: [{
        type: 'TypeError',
        value: `Cannot read ${FAKE_JWT}`,
        module: 'app',
        mechanism: { type: 'onerror', handled: false, data: { secret: SECRET_TOKEN } },
        stacktrace: {
          frames: [{
            filename: `${CHUNK}?session=${SECRET_QUERY_CODE}`,
            abs_path: `${CHUNK}?session=${SECRET_QUERY_CODE}`,
            function: 'save',
            lineno: 12,
            colno: 345,
            in_app: true,
            context_line: `const token = "${SECRET_TOKEN}";`,
            pre_context: [`// ${SECRET_PASSWORD}`],
            post_context: [SECRET_EMAIL],
            vars: { password: SECRET_PASSWORD },
          }],
        },
      }],
    },
    breadcrumbs: [
      { type: 'default', category: 'console', level: 'log', message: `token ${SECRET_TOKEN}`, data: { arguments: [SECRET_TOKEN], logger: 'console' } },
      { type: 'http', category: 'fetch', data: { method: 'GET', url: `https://core.etendo.cloud/sws/neo/session?code=${SECRET_QUERY_CODE}`, status_code: 401 } },
      { category: 'navigation', data: { from: '/login', to: `/reset/${HEX32}` } },
    ],
    request: {
      url: `https://go.etendo.cloud/go/portal/tok-abcdef0123456789?code=${SECRET_QUERY_CODE}`,
      headers: { Authorization: `Bearer ${SECRET_TOKEN}`, Cookie: `sid=${SECRET_TOKEN}`, 'User-Agent': 'Mozilla/5.0', Referer: `https://go.etendo.cloud/reset/${HEX32}` },
      cookies: { sid: SECRET_TOKEN },
      query_string: { code: SECRET_QUERY_CODE },
      data: { password: SECRET_PASSWORD },
    },
    user: { id: 'u1', email: SECRET_EMAIL, ip_address: '203.0.113.7' },
    tags: { plan: 'pro', token: SECRET_TOKEN },
    extra: { reason: 'network', body: { raw: SECRET_TOKEN } },
    contexts: {
      app: { app: 'app-shell', dbPassword: SECRET_PASSWORD },
      trace: { trace_id: 't1', span_id: 's1', op: 'pageload', data: { secret: SECRET_TOKEN } },
      device: { name: SECRET_EMAIL },
    },
    modules: { lodash: '4.17.21' },
    debug_meta: { images: [{ type: 'sourcemap', code_file: `${CHUNK}?session=${SECRET_QUERY_CODE}`, debug_id: 'dbg-1' }] },
    fingerprint: ['{{ default }}', SECRET_EMAIL],
  };
}

function buildTransactionEvent() {
  return {
    type: 'transaction',
    event_id: 't-1',
    transaction: `/sales-order/FF8080818A1234567890ABCDEF123456?tab=${SECRET_QUERY_CODE}`,
    transaction_info: { source: 'url' },
    start_timestamp: 1,
    timestamp: 2,
    contexts: { trace: { trace_id: 't1', span_id: 's1', op: 'navigation' } },
    measurements: { lcp: { value: 1200, unit: 'millisecond' }, bogus: { value: SECRET_TOKEN } },
    spans: [{
      span_id: 'sp1',
      trace_id: 't1',
      parent_span_id: 's1',
      op: 'http.client',
      description: `GET https://core.etendo.cloud/sws/neo/session?code=${SECRET_QUERY_CODE}`,
      start_timestamp: 1,
      timestamp: 2,
      status: 'ok',
      origin: 'auto.http.browser',
      data: {
        'http.method': 'GET',
        'http.response.status_code': 200,
        url: `https://core.etendo.cloud/sws/neo/session?code=${SECRET_QUERY_CODE}`,
        'http.query': `?code=${SECRET_QUERY_CODE}`,
        'http.fragment': `#${SECRET_TOKEN}`,
        'user.email': SECRET_EMAIL,
      },
      links: [{ trace_id: 'x', attributes: { secret: SECRET_TOKEN } }],
    }],
  };
}

describe('createSentryAdapter — init', () => {
  it('is enabled only when a DSN is configured', () => {
    assert.equal(createSentryAdapter({ sdk: fakeSentry().sdk, ...POLICY }).enabled, false);
    assert.equal(createSentryAdapter({ sdk: fakeSentry().sdk, dsn: 'https://k@glitchtip.example/1', ...POLICY }).enabled, true);
  });

  it('pins sendDefaultPii to false even when a caller asks for true (D4)', async () => {
    const fake = fakeSentry();
    const adapter = createSentryAdapter({ sdk: fake.sdk, dsn: 'https://k@glitchtip.example/1', sendDefaultPii: true, ...POLICY });

    await adapter.init({ context: {} });

    assert.equal(fake.initOptions().sendDefaultPii, false);
  });

  it('sends every error and 10% of traces', async () => {
    const fake = fakeSentry();
    await createSentryAdapter({ sdk: fake.sdk, dsn: 'https://k@glitchtip.example/1', ...POLICY }).init({ context: {} });

    assert.equal(fake.initOptions().sampleRate, 1);
    assert.equal(fake.initOptions().tracesSampleRate, 0.1);
  });

  it('installs every egress hook and forwards the environment configuration', async () => {
    const fake = fakeSentry();
    const adapter = createSentryAdapter({
      sdk: fake.sdk,
      dsn: 'https://k@glitchtip.example/1',
      environment: 'staging',
      release: 'app-shell@1.2.3',
      tracePropagationTargets: ['core.etendo.cloud'],
      ...POLICY,
    });

    await adapter.init({ context: { app: 'app-shell' } });
    const options = fake.initOptions();

    assert.equal(options.dsn, 'https://k@glitchtip.example/1');
    assert.equal(options.environment, 'staging');
    assert.equal(options.release, 'app-shell@1.2.3');
    assert.deepEqual(options.tracePropagationTargets, ['core.etendo.cloud']);
    for (const hook of ['beforeSend', 'beforeSendTransaction', 'beforeSendSpan', 'beforeBreadcrumb']) {
      assert.equal(typeof options[hook], 'function', `${hook} must be installed`);
    }
    assert.deepEqual(options.integrations, [{ name: 'BrowserTracing' }]);
    assert.deepEqual(fake.calls.find(([name]) => name === 'setContext'), ['setContext', 'app', { app: 'app-shell' }]);
  });
});

describe('sanitizeSentryEvent — error events', () => {
  const out = sanitizeSentryEvent(buildErrorEvent(), POLICY);

  it('lets no planted secret through', () => {
    assert.deepEqual(findLeakedFixtureSecrets(out), []);
    assert.ok(!JSON.stringify(out).includes(HEX32));
  });

  it('keeps the SDK scalars and only the name/version of the SDK', () => {
    assert.equal(out.event_id, 'e1');
    assert.equal(out.level, 'error');
    assert.equal(out.environment, 'staging');
    assert.equal(out.release, 'app-shell@1.2.3');
    assert.deepEqual(out.sdk, { name: 'sentry.javascript.react', version: '10.74.0' });
  });

  it('drops user, modules and every request field but a scrubbed URL', () => {
    assert.equal(out.user, undefined);
    assert.equal(out.modules, undefined);
    assert.deepEqual(out.request, { url: 'https://go.etendo.cloud/go/portal/:id' });
  });

  it('keeps an approved request header only when the host approves it', () => {
    const withUa = sanitizeSentryEvent(buildErrorEvent(), { ...POLICY, approvedRequestHeaders: ['User-Agent'] });
    assert.deepEqual(withUa.request.headers, { 'User-Agent': 'Mozilla/5.0' });
  });

  it('keeps exception frames without source context or local variables', () => {
    const [exception] = out.exception.values;
    assert.equal(exception.type, 'TypeError');
    assert.equal(exception.value, REDACTED);
    assert.deepEqual(exception.mechanism, { type: 'onerror', handled: false });
    assert.deepEqual(exception.stacktrace.frames, [{
      filename: CHUNK, abs_path: CHUNK, function: 'save', lineno: 12, colno: 345, in_app: true,
    }]);
  });

  it('filters tags, extra and the app context through the allowlist', () => {
    assert.deepEqual(out.tags, { plan: 'pro' });
    assert.deepEqual(out.extra, { reason: 'network' });
    assert.deepEqual(out.contexts, { app: { app: 'app-shell' }, trace: { trace_id: 't1', span_id: 's1', op: 'pageload' } });
  });

  it('sanitizes breadcrumbs: no console arguments, URLs without query, routes with ids collapsed', () => {
    assert.deepEqual(out.breadcrumbs, [
      { type: 'default', category: 'console', level: 'log', message: REDACTED, data: {} },
      { type: 'http', category: 'fetch', data: { method: 'GET', url: 'https://core.etendo.cloud/sws/neo/session', status_code: 401 } },
      { category: 'navigation', data: { from: '/login', to: '/reset/:id' } },
    ]);
  });

  it('keeps source-map debug images with scrubbed file URLs', () => {
    assert.deepEqual(out.debug_meta, { images: [{ type: 'sourcemap', code_file: CHUNK, debug_id: 'dbg-1' }] });
  });

  it('scrubs the fingerprint and the message', () => {
    assert.deepEqual(out.fingerprint, ['{{ default }}', REDACTED]);
    assert.equal(out.message, REDACTED);
    assert.deepEqual(out.logentry, { message: REDACTED });
  });
});

describe('sanitizeSentryEvent — transaction events', () => {
  const out = sanitizeSentryEvent(buildTransactionEvent(), POLICY);

  it('lets no planted secret through', () => {
    assert.deepEqual(findLeakedFixtureSecrets(out), []);
  });

  it('normalizes the transaction name like a page route', () => {
    assert.equal(out.transaction, '/sales-order/:id');
    assert.deepEqual(out.transaction_info, { source: 'url' });
  });

  it('keeps numeric measurements only', () => {
    assert.deepEqual(out.measurements, { lcp: { value: 1200, unit: 'millisecond' } });
  });

  it('keeps span ids and timing, scrubs the description and filters span data', () => {
    assert.deepEqual(out.spans, [{
      span_id: 'sp1',
      trace_id: 't1',
      parent_span_id: 's1',
      op: 'http.client',
      description: 'GET https://core.etendo.cloud/sws/neo/session',
      start_timestamp: 1,
      timestamp: 2,
      status: 'ok',
      origin: 'auto.http.browser',
      data: { 'http.method': 'GET', 'http.response.status_code': 200, url: 'https://core.etendo.cloud/sws/neo/session' },
    }]);
  });
});

describe('sanitizeSentryBreadcrumb / sanitizeSentrySpan', () => {
  it('a breadcrumb keeps only approved data keys, configurable by the host', () => {
    const crumb = { category: 'ui.click', message: 'button#save', data: { method: 'POST', note: 'x' } };
    assert.deepEqual(sanitizeSentryBreadcrumb(crumb, POLICY), { category: 'ui.click', message: 'button#save', data: { method: 'POST' } });
    assert.deepEqual(
      sanitizeSentryBreadcrumb(crumb, { ...POLICY, approvedBreadcrumbDataKeys: ['note'] }),
      { category: 'ui.click', message: 'button#save', data: { note: 'x' } },
    );
  });

  it('a standalone span is sanitized like a span inside a transaction', () => {
    const [span] = buildTransactionEvent().spans;
    const out = sanitizeSentrySpan(span, POLICY);
    assert.deepEqual(findLeakedFixtureSecrets(out), []);
    assert.equal(out.description, 'GET https://core.etendo.cloud/sws/neo/session');
    assert.equal(out.links, undefined);
  });
});

describe('createSentryAdapter — hooks never send raw data', () => {
  async function hooksOf(overrides = {}) {
    const fake = fakeSentry();
    const logger = { warnings: [], warn(message) { this.warnings.push(message); } };
    await createSentryAdapter({ sdk: fake.sdk, dsn: 'https://k@glitchtip.example/1', logger, ...POLICY, ...overrides }).init({ context: {} });
    return { options: fake.initOptions(), logger };
  }

  it('beforeSend and beforeSendTransaction return the sanitized event', async () => {
    const { options } = await hooksOf();
    assert.deepEqual(findLeakedFixtureSecrets(options.beforeSend(buildErrorEvent(), {})), []);
    assert.equal(options.beforeSendTransaction(buildTransactionEvent(), {}).transaction, '/sales-order/:id');
  });

  it('beforeBreadcrumb returns the sanitized breadcrumb', async () => {
    const { options } = await hooksOf();
    const crumb = options.beforeBreadcrumb({ category: 'console', message: `token ${SECRET_TOKEN}`, data: { arguments: [SECRET_TOKEN] } }, {});
    assert.deepEqual(findLeakedFixtureSecrets(crumb), []);
  });

  it('drops the event rather than sending it raw when sanitization fails', async () => {
    const { options, logger } = await hooksOf();
    const hostile = { get exception() { throw new Error('boom'); } };
    assert.equal(options.beforeSend(hostile, {}), null);
    assert.equal(options.beforeBreadcrumb({ get data() { throw new Error('boom'); } }, {}), null);
    assert.ok(logger.warnings.length >= 2);
  });

  it('a span that fails to sanitize is reduced to its ids, never sent raw', async () => {
    const { options } = await hooksOf();
    const hostile = { span_id: 'sp1', trace_id: 't1', start_timestamp: 1, get description() { throw new Error('boom'); } };
    assert.deepEqual(options.beforeSendSpan(hostile), { span_id: 'sp1', trace_id: 't1', start_timestamp: 1, data: {} });
  });
});

describe('createSentryAdapter — gateway operations', () => {
  function adapterWith() {
    const fake = fakeSentry();
    const adapter = createSentryAdapter({ sdk: fake.sdk, dsn: 'https://k@glitchtip.example/1', ...POLICY });
    return { adapter, calls: fake.calls };
  }

  it('captureException rebuilds an Error from the gateway summary so Sentry can group it', async () => {
    const { adapter, calls } = adapterWith();
    await adapter.captureException({ name: 'TypeError', message: 'save failed', stack: 'TypeError: save failed\n    at f (app.js:1:1)' }, { reason: 'x' });

    const [, error, hint] = calls.find(([name]) => name === 'captureException');
    assert.ok(error instanceof Error);
    assert.equal(error.name, 'TypeError');
    assert.equal(error.message, 'save failed');
    assert.equal(error.stack, 'TypeError: save failed\n    at f (app.js:1:1)');
    assert.deepEqual(hint, { extra: { reason: 'x' } });
  });

  it('shutdown closes the SDK so its auto-instrumentation stops (hot kill)', async () => {
    const { adapter, calls } = adapterWith();
    await adapter.shutdown();
    assert.ok(calls.some(([name]) => name === 'close'));
  });

  it('reset clears the SDK user; breadcrumb, setContext and flush are forwarded', async () => {
    const { adapter, calls } = adapterWith();
    await adapter.reset();
    await adapter.breadcrumb({ category: 'nav', message: 'x' });
    await adapter.setContext({ app: 'app-shell' });
    await adapter.flush();
    assert.deepEqual(calls.map(([name]) => name), ['setUser', 'addBreadcrumb', 'setContext', 'flush']);
    assert.deepEqual(calls[0], ['setUser', null]);
  });

  it('has no analytics surface: track and page are not implemented', () => {
    const { adapter } = adapterWith();
    assert.equal(adapter.track, undefined);
    assert.equal(adapter.page, undefined);
  });
});
