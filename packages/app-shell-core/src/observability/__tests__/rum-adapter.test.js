import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRumAdapter, sanitizeRumRequest } from '../adapters/rum.js';
import {
  SECRET_TOKEN,
  SECRET_EMAIL,
  SECRET_QUERY_CODE,
  findLeakedFixtureSecrets,
} from '../nestedSecretFixtures.js';

// ETP-4578 C5 (AWS RUM). aws-rum-web has no generic beforeSend: the only pre-signing
// interception point is the public `clientBuilder` option. The spike on the real SDK
// (1.25) showed Dispatch calls it as a method, so `this.defaultClientBuilder` yields the
// real data-plane client to wrap — sanitizing the PutRumEventsRequest BEFORE it is
// serialized and SigV4-signed. These tests drive that contract with fakes; the real SDK is
// exercised in the host (H4c).

const HEX32 = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const TITLE = 'Pedido de venta 1234 - Cliente Acme';

function fakeAwsRum() {
  const instances = [];
  class AwsRum {
    constructor(appMonitorId, version, region, config) {
      this.args = { appMonitorId, version, region, config };
      this.calls = [];
      instances.push(this);
    }
    disable() { this.calls.push(['disable']); }
    enable() { this.calls.push(['enable']); }
    recordError(error) { this.calls.push(['recordError', error]); }
  }
  return { sdk: { AwsRum }, instances };
}

/** A stand-in for aws-rum-web's Dispatch: `defaultClientBuilder` builds the real client. */
function fakeDispatch() {
  const sent = [];
  const client = {
    sendFetch: async (request) => { sent.push(['fetch', request]); return { response: { statusCode: 200 } }; },
    sendBeacon: async (request) => { sent.push(['beacon', request]); return { response: { statusCode: 200 } }; },
  };
  return { dispatch: { defaultClientBuilder: () => client }, sent };
}

const metadata = (extra = {}) => JSON.stringify({
  version: '1.0.0',
  browserLanguage: 'es-AR',
  browserName: 'Chrome',
  browserVersion: '130',
  osName: 'Linux',
  osVersion: '6.8',
  deviceType: 'desktop',
  platformType: 'web',
  domain: 'go.etendo.cloud',
  title: TITLE,
  pageTitle: TITLE,
  url: `https://go.etendo.cloud/go/sales-order/${HEX32}?code=${SECRET_QUERY_CODE}`,
  pageUrl: `https://go.etendo.cloud/go/sales-order/${HEX32}?code=${SECRET_QUERY_CODE}`,
  referrerUrl: `https://mail.example.com/?t=${SECRET_TOKEN}`,
  pageId: `/sales-order/${HEX32}`,
  'aws:client': 'arw-module',
  'aws:clientVersion': '1.25.0',
  customerName: 'Acme',
  ...extra,
});

function buildRequest() {
  return {
    BatchId: 'batch-1',
    AppMonitorDetails: { id: 'monitor-1', version: '1.0.0' },
    UserDetails: { userId: 'u-anon', sessionId: 's-1' },
    RumEvents: [
      { id: 'e1', timestamp: new Date(0), type: 'com.amazon.rum.session_start_event', metadata: metadata(), details: JSON.stringify({ version: '1.0.0' }) },
      {
        id: 'e2', timestamp: new Date(0), type: 'com.amazon.rum.page_view_event', metadata: metadata(),
        details: JSON.stringify({
          version: '1.0.0', pageId: `/sales-order/${HEX32}`, interaction: 1,
          pageInteractionId: `/sales-order/${HEX32}-1`, referrer: `https://mail.example.com/?t=${SECRET_TOKEN}`, referrerDomain: 'mail.example.com',
        }),
      },
      {
        id: 'e3', timestamp: new Date(0), type: 'com.amazon.rum.js_error_event', metadata: metadata(),
        details: JSON.stringify({
          version: '1.0.0', type: 'Error', message: `Login failed for ${SECRET_EMAIL}`, filename: 'https://go.etendo.cloud/go/assets/index-B3kd9Fq2.js', lineno: 1, colno: 2,
          stack: `Error: Login failed for ${SECRET_EMAIL}\n    at f (https://go.etendo.cloud/go/assets/index-B3kd9Fq2.js:1:2)`,
        }),
      },
      {
        id: 'e4', timestamp: new Date(0), type: 'com.amazon.rum.http_event', metadata: metadata(),
        details: JSON.stringify({
          version: '1.0.0', request: { method: 'GET', url: `https://core.etendo.cloud/sws/neo/session?code=${SECRET_QUERY_CODE}` },
          response: { status: 401, statusText: 'Unauthorized' },
        }),
      },
      {
        id: 'e5', timestamp: new Date(0), type: 'com.amazon.rum.largest_contentful_paint_event', metadata: metadata(),
        details: JSON.stringify({ version: '1.0.0', value: 1200, attribution: { element: `#customer-${SECRET_EMAIL}`, timeToFirstByte: 100 } }),
      },
    ],
  };
}

const parsed = (request) => request.RumEvents.map((event) => ({
  ...event, metadata: JSON.parse(event.metadata), details: JSON.parse(event.details),
}));

describe('sanitizeRumRequest', () => {
  const out = sanitizeRumRequest(buildRequest(), {});
  const events = parsed(out);

  it('lets no planted secret, record id or page title through', () => {
    assert.deepEqual(findLeakedFixtureSecrets(out), []);
    const serialized = JSON.stringify(out);
    assert.ok(!serialized.includes(HEX32), 'record id leaked');
    assert.ok(!serialized.includes('Acme'), 'customer name leaked');
  });

  it('keeps the batch, monitor and anonymous session identity', () => {
    assert.equal(out.BatchId, 'batch-1');
    assert.deepEqual(out.AppMonitorDetails, { id: 'monitor-1', version: '1.0.0' });
    assert.deepEqual(out.UserDetails, { userId: 'u-anon', sessionId: 's-1' });
  });

  it('keeps event ids, timestamps and types untouched', () => {
    assert.deepEqual(out.RumEvents.map(({ id, type }) => [id, type]), buildRequest().RumEvents.map(({ id, type }) => [id, type]));
    assert.ok(out.RumEvents.every((event) => event.timestamp instanceof Date));
  });

  it('keeps approved metadata only, with the page id normalized; title and URLs are dropped', () => {
    assert.deepEqual(events[0].metadata, {
      version: '1.0.0',
      browserLanguage: 'es-AR',
      browserName: 'Chrome',
      browserVersion: '130',
      osName: 'Linux',
      osVersion: '6.8',
      deviceType: 'desktop',
      platformType: 'web',
      domain: 'go.etendo.cloud',
      pageId: '/sales-order/:recordId',
      'aws:client': 'arw-module',
      'aws:clientVersion': '1.25.0',
    });
  });

  it('normalizes page-view ids and drops the referrer', () => {
    assert.deepEqual(events[1].details, {
      version: '1.0.0', pageId: '/sales-order/:recordId', interaction: 1, pageInteractionId: '/sales-order/:recordId-1',
    });
  });

  it('scrubs error details and redacts the stack frame by frame', () => {
    assert.deepEqual(events[2].details, {
      version: '1.0.0', type: 'Error', message: '[REDACTED]',
      filename: 'https://go.etendo.cloud/go/assets/index-B3kd9Fq2.js', lineno: 1, colno: 2,
      stack: '[REDACTED]\n    at f (https://go.etendo.cloud/go/assets/index-B3kd9Fq2.js:1:2)',
    });
  });

  it('strips the query of an HTTP event URL', () => {
    assert.deepEqual(events[3].details, {
      version: '1.0.0',
      request: { method: 'GET', url: 'https://core.etendo.cloud/sws/neo/session' },
      response: { status: 401, statusText: 'Unauthorized' },
    });
  });

  it('keeps web-vital timings but not the element selector', () => {
    assert.deepEqual(events[4].details, { version: '1.0.0', value: 1200, attribution: { timeToFirstByte: 100 } });
  });

  it('lets the host approve extra metadata or detail keys', () => {
    const withTitle = parsed(sanitizeRumRequest(buildRequest(), { approvedMetadataKeys: ['title'] }));
    assert.equal(withTitle[0].metadata.title, TITLE);
  });

  it('drops an event whose payload is not valid JSON rather than forwarding it', () => {
    const request = buildRequest();
    request.RumEvents[0].details = `{not json ${SECRET_TOKEN}`;
    const sanitized = sanitizeRumRequest(request, {});
    assert.equal(sanitized.RumEvents.length, 4);
    assert.deepEqual(findLeakedFixtureSecrets(sanitized), []);
  });
});

describe('createRumAdapter — enablement and SDK configuration', () => {
  const base = { appMonitorId: 'monitor-1', identityPoolId: 'eu-west-3:pool', enabled: true };

  it('is disabled by default and needs an explicit opt-in plus both ids (D3)', () => {
    const { sdk } = fakeAwsRum();
    assert.equal(createRumAdapter({ sdk, appMonitorId: 'm', identityPoolId: 'p' }).enabled, false);
    assert.equal(createRumAdapter({ sdk, enabled: true, appMonitorId: 'm' }).enabled, false);
    assert.equal(createRumAdapter({ sdk, ...base }).enabled, true);
  });

  it('constructs the SDK only on init, with a conservative configuration', async () => {
    const { sdk, instances } = fakeAwsRum();
    const adapter = createRumAdapter({ sdk, ...base });
    assert.equal(instances.length, 0);

    await adapter.init({ context: {} });
    const [{ args }] = instances;

    assert.equal(args.appMonitorId, 'monitor-1');
    assert.equal(args.region, 'eu-west-3');
    assert.equal(args.config.identityPoolId, 'eu-west-3:pool');
    assert.equal(args.config.endpoint, 'https://dataplane.rum.eu-west-3.amazonaws.com');
    assert.equal(args.config.sessionSampleRate, 0.1);
    assert.equal(args.config.allowCookies, false);
    assert.equal(args.config.enableXRay, false);
    assert.deepEqual(args.config.telemetries, ['performance', 'errors', 'http']);
    assert.equal(typeof args.config.clientBuilder, 'function');
  });

  it('lets the host set the sample rate, cookies and telemetries', async () => {
    const { sdk, instances } = fakeAwsRum();
    await createRumAdapter({ sdk, ...base, sessionSampleRate: 0.5, allowCookies: true, telemetries: ['errors'] }).init({ context: {} });
    const { config } = instances[0].args;
    assert.equal(config.sessionSampleRate, 0.5);
    assert.equal(config.allowCookies, true);
    assert.deepEqual(config.telemetries, ['errors']);
  });

  it('a construction failure is contained and logged', async () => {
    class Broken { constructor() { throw new Error('bad config'); } }
    const warnings = [];
    const adapter = createRumAdapter({ sdk: { AwsRum: Broken }, ...base, logger: { warn: (m) => warnings.push(m) } });
    await assert.doesNotReject(() => adapter.init({ context: {} }));
    assert.equal(warnings.length, 1);
  });
});

describe('createRumAdapter — the client builder sanitizes before signing', () => {
  async function builderOf() {
    const { sdk, instances } = fakeAwsRum();
    const warnings = [];
    await createRumAdapter({
      sdk, appMonitorId: 'monitor-1', identityPoolId: 'p', enabled: true, logger: { warn: (m) => warnings.push(m) },
    }).init({ context: {} });
    return { clientBuilder: instances[0].args.config.clientBuilder, warnings };
  }

  it('wraps the default data-plane client so fetch and beacon send the sanitized request', async () => {
    const { clientBuilder } = await builderOf();
    const { dispatch, sent } = fakeDispatch();
    const client = clientBuilder.call(dispatch, new URL('https://dataplane.example'), 'eu-west-3', undefined);

    await client.sendFetch(buildRequest());
    await client.sendBeacon(buildRequest());

    assert.equal(sent.length, 2);
    for (const [, request] of sent) {
      assert.deepEqual(findLeakedFixtureSecrets(request), []);
      assert.ok(!JSON.stringify(request).includes(HEX32));
    }
  });

  it('fails closed when the SDK no longer exposes its default builder: nothing is sent', async () => {
    const { clientBuilder, warnings } = await builderOf();
    const client = clientBuilder.call({}, new URL('https://dataplane.example'), 'eu-west-3', undefined);

    const result = await client.sendFetch(buildRequest());
    await client.sendBeacon(buildRequest());

    assert.equal(result.response.statusCode, 200);
    assert.equal(warnings.length, 1);
  });

  it('a request that cannot be sanitized is dropped, never sent raw', async () => {
    const { clientBuilder } = await builderOf();
    const { dispatch, sent } = fakeDispatch();
    const client = clientBuilder.call(dispatch, new URL('https://dataplane.example'), 'eu-west-3', undefined);

    await client.sendFetch({ get RumEvents() { throw new Error('boom'); } });

    assert.equal(sent.length, 0);
  });
});

describe('createRumAdapter — gateway operations', () => {
  const base = { appMonitorId: 'monitor-1', identityPoolId: 'p', enabled: true };

  it('shutdown disables the SDK (hot kill) and a later init re-enables the same instance', async () => {
    const { sdk, instances } = fakeAwsRum();
    const adapter = createRumAdapter({ sdk, ...base });
    await adapter.init({ context: {} });
    await adapter.shutdown();
    await adapter.init({ context: {} });

    assert.equal(instances.length, 1);
    assert.deepEqual(instances[0].calls, [['disable'], ['enable']]);
  });

  it('captureException records an Error rebuilt from the gateway summary', async () => {
    const { sdk, instances } = fakeAwsRum();
    const adapter = createRumAdapter({ sdk, ...base });
    await adapter.init({ context: {} });
    await adapter.captureException({ name: 'TypeError', message: 'save failed', stack: 'TypeError: save failed' });

    const [, error] = instances[0].calls.find(([name]) => name === 'recordError');
    assert.ok(error instanceof Error);
    assert.equal(error.name, 'TypeError');
    assert.equal(error.message, 'save failed');
  });

  it('has no analytics surface', () => {
    const adapter = createRumAdapter({ sdk: fakeAwsRum().sdk, ...base });
    assert.equal(adapter.track, undefined);
    assert.equal(adapter.identify, undefined);
  });
});
