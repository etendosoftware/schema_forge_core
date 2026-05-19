import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createObservability } from '../observability.js';

function createProvider(name, calls) {
  return {
    name,
    async init(payload) {
      calls.push([name, 'init', payload]);
    },
    async track(eventName, properties, meta) {
      calls.push([name, 'track', eventName, properties, meta]);
    },
    async page(path, properties, meta) {
      calls.push([name, 'page', path, properties, meta]);
    },
    async identify(userId, traits, meta) {
      calls.push([name, 'identify', userId, traits, meta]);
    },
    async captureException(error, details, meta) {
      calls.push([name, 'captureException', error.message, details, meta]);
    },
    async setContext(context) {
      calls.push([name, 'setContext', context]);
    },
    async flush(meta) {
      calls.push([name, 'flush', meta]);
    },
  };
}

describe('observability core', () => {
  it('works as a no-op when no providers are enabled', async () => {
    const client = createObservability({ logger: { warn() {} } });

    await client.initObservability();
    await client.track('event');
    await client.page('/dashboard');
    await client.identify('user-1');
    await client.captureException(new Error('boom'));
    await client.flush();

    assert.deepEqual(client.getProviders(), []);
  });

  it('dispatches supported calls to each enabled provider', async () => {
    const calls = [];
    const client = createObservability({ logger: { warn() {} } });

    await client.initObservability({
      context: { app: 'app-shell' },
      providers: [
        createProvider('first', calls),
        { ...createProvider('disabled', calls), enabled: false },
        createProvider('second', calls),
      ],
    });
    await client.track('app_started', { mockMode: false });
    await client.page('/dashboard', { route: '/dashboard' });
    await client.identify('user-1', { role: 'admin' });
    await client.captureException(new Error('boom'), { handled: true });
    await client.flush();

    assert.deepEqual(
      calls.map(call => `${call[0]}:${call[1]}`),
      [
        'first:init',
        'second:init',
        'first:track',
        'second:track',
        'first:page',
        'second:page',
        'first:identify',
        'second:identify',
        'first:captureException',
        'second:captureException',
        'first:flush',
        'second:flush',
      ]
    );
    assert.deepEqual(calls[2][4].context, { app: 'app-shell' });
  });

  it('merges context and notifies providers when context changes', async () => {
    const calls = [];
    const client = createObservability({ logger: { warn() {} } });

    await client.initObservability({
      context: { app: 'app-shell', environment: 'development' },
      providers: [createProvider('provider', calls)],
    });
    await client.setContext({ environment: 'staging', locale: 'en_US' });
    await client.track('event');

    assert.deepEqual(calls[1], [
      'provider',
      'setContext',
      { app: 'app-shell', environment: 'staging', locale: 'en_US' },
    ]);
    assert.deepEqual(calls[2][4].context, {
      app: 'app-shell',
      environment: 'staging',
      locale: 'en_US',
    });
  });

  it('continues dispatching when one provider throws', async () => {
    const calls = [];
    const warnings = [];
    const client = createObservability({
      logger: {
        warn(message, error) {
          warnings.push([message, error.message]);
        },
      },
    });

    await client.initObservability({
      providers: [
        {
          name: 'broken',
          track() {
            throw new Error('provider down');
          },
        },
        createProvider('healthy', calls),
      ],
    });
    await client.track('event');

    assert.deepEqual(calls.map(call => `${call[0]}:${call[1]}`), ['healthy:init', 'healthy:track']);
    assert.deepEqual(warnings, [
      ['[observability] broken.track failed', 'provider down'],
    ]);
  });

  it('awaits async flush handlers', async () => {
    const calls = [];
    const client = createObservability({ logger: { warn() {} } });

    await client.initObservability({
      providers: [
        {
          name: 'async-provider',
          async flush() {
            await new Promise(resolve => setTimeout(resolve, 5));
            calls.push('flushed');
          },
        },
      ],
    });
    await client.flush();

    assert.deepEqual(calls, ['flushed']);
  });
});
