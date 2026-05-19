import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildBrowserObservabilityConfig } from '../observability/browser.js';
import { createRumProvider, resolveRumConfig } from '../rum.js';
import { createSentryProvider, resolveSentryEnvironment } from '../sentry.js';

describe('sentry observability adapter', () => {
  it('preserves hostname to environment mapping', () => {
    assert.equal(resolveSentryEnvironment('go.staging.etendo.cloud'), 'staging');
    assert.equal(resolveSentryEnvironment('go.experimental.etendo.cloud'), 'experimental');
    assert.equal(resolveSentryEnvironment('go.etendo.cloud'), 'production');
    assert.equal(resolveSentryEnvironment('localhost'), 'development');
  });

  it('initializes Sentry with the existing tracing and PII config', () => {
    const calls = [];
    const fakeSentry = {
      browserTracingIntegration() {
        return 'browser-tracing';
      },
      init(options) {
        calls.push(options);
      },
    };

    const provider = createSentryProvider({
      dsn: 'dsn-123',
      hostname: 'go.staging.etendo.cloud',
      sentry: fakeSentry,
    });
    provider.init();

    assert.equal(provider.name, 'sentry');
    assert.equal(provider.enabled, true);
    assert.equal(calls[0].dsn, 'dsn-123');
    assert.equal(calls[0].environment, 'staging');
    assert.deepEqual(calls[0].integrations, ['browser-tracing']);
    assert.equal(calls[0].tracesSampleRate, 0.1);
    assert.equal(calls[0].sendDefaultPii, true);
    assert.deepEqual(calls[0].tracePropagationTargets, [/core\..+\.etendo\.cloud/, 'core.etendo.cloud']);
  });

  it('can be disabled when no DSN is configured', () => {
    const provider = createSentryProvider({ dsn: '' });

    assert.equal(provider.enabled, false);
  });
});

describe('AWS RUM observability adapter', () => {
  it('preserves hostname-gated RUM config mapping', () => {
    const env = {
      VITE_RUM_APP_MONITOR_ID_STAGING: 'staging-monitor',
      VITE_RUM_IDENTITY_POOL_ID_STAGING: 'staging-pool',
      VITE_RUM_APP_MONITOR_ID_EXPERIMENTAL: 'experimental-monitor',
      VITE_RUM_IDENTITY_POOL_ID_EXPERIMENTAL: 'experimental-pool',
    };

    assert.deepEqual(resolveRumConfig('go.staging.etendo.cloud', env), {
      appMonitorId: 'staging-monitor',
      identityPoolId: 'staging-pool',
    });
    assert.deepEqual(resolveRumConfig('go.experimental.etendo.cloud', env), {
      appMonitorId: 'experimental-monitor',
      identityPoolId: 'experimental-pool',
    });
    assert.equal(resolveRumConfig('go.etendo.cloud', env), undefined);
  });

  it('initializes AWS RUM with the existing region, endpoint, and telemetries', () => {
    const calls = [];
    class FakeAwsRum {
      constructor(...args) {
        calls.push(args);
      }
    }

    const provider = createRumProvider({
      hostname: 'go.experimental.etendo.cloud',
      env: {
        VITE_RUM_APP_MONITOR_ID_EXPERIMENTAL: 'monitor-id',
        VITE_RUM_IDENTITY_POOL_ID_EXPERIMENTAL: 'pool-id',
      },
      AwsRumCtor: FakeAwsRum,
      logger: { warn() {} },
    });
    provider.init();

    assert.equal(provider.name, 'aws-rum');
    assert.equal(provider.enabled, true);
    assert.deepEqual(calls[0], [
      'monitor-id',
      '1.0.0',
      'eu-west-3',
      {
        sessionSampleRate: 1,
        identityPoolId: 'pool-id',
        endpoint: 'https://dataplane.rum.eu-west-3.amazonaws.com',
        telemetries: ['performance', 'errors', 'http'],
        allowCookies: true,
        enableXRay: false,
      },
    ]);
  });

  it('logs and contains AWS RUM init failures', () => {
    const warnings = [];
    class BrokenAwsRum {
      constructor() {
        throw new Error('rum unavailable');
      }
    }

    const provider = createRumProvider({
      hostname: 'go.staging.etendo.cloud',
      env: {
        VITE_RUM_APP_MONITOR_ID_STAGING: 'monitor-id',
        VITE_RUM_IDENTITY_POOL_ID_STAGING: 'pool-id',
      },
      AwsRumCtor: BrokenAwsRum,
      logger: {
        warn(message, error) {
          warnings.push([message, error.message]);
        },
      },
    });

    assert.doesNotThrow(() => provider.init());
    assert.deepEqual(warnings, [['CloudWatch RUM init failed', 'rum unavailable']]);
  });

  it('keeps legacy no-op behavior when no hostname config matches', () => {
    const calls = [];
    class FakeAwsRum {
      constructor(...args) {
        calls.push(args);
      }
    }

    const provider = createRumProvider({
      hostname: 'localhost',
      env: {},
      AwsRumCtor: FakeAwsRum,
      logger: { warn() {} },
    });

    assert.equal(provider.enabled, false);
    assert.doesNotThrow(() => provider.init());
    assert.deepEqual(calls, []);
  });
});

describe('browser observability config', () => {
  it('registers Sentry and AWS RUM providers behind the shared config', () => {
    const config = buildBrowserObservabilityConfig({
      env: {
        VITE_SENTRY_DSN: 'dsn-123',
        VITE_RUM_APP_MONITOR_ID_STAGING: 'monitor-id',
        VITE_RUM_IDENTITY_POOL_ID_STAGING: 'pool-id',
      },
      location: { hostname: 'go.staging.etendo.cloud' },
      logger: { warn() {} },
    });

    assert.deepEqual(config.context, {
      app: 'app-shell',
      environment: 'go.staging.etendo.cloud',
      hostname: 'go.staging.etendo.cloud',
      mockMode: false,
    });
    assert.deepEqual(config.providers.map(provider => provider.name), ['sentry', 'aws-rum']);
    assert.deepEqual(config.providers.map(provider => provider.enabled), [true, true]);
  });
});
