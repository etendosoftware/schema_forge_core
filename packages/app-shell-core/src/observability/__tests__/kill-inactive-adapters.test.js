import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTelemetryGateway } from '../gateway.js';

// ETP-4578 NB-1: a kill reaches every killed adapter, not only the ones the gateway is
// currently running. An adapter whose init() failed or timed out may have a half-started SDK.

const silent = { warn() {} };

function adapter(name, { failInit = false, enabled } = {}) {
  const calls = [];
  return {
    calls,
    adapter: {
      name,
      ...(enabled === undefined ? {} : { enabled }),
      init: () => { calls.push('init'); if (failInit) throw new Error(`${name} init failed`); },
      shutdown: () => { calls.push('shutdown'); },
      track: () => { calls.push('track'); },
    },
  };
}

describe('a kill reaches adapters that are not running (NB-1)', () => {
  it('shuts down an adapter whose init failed, once', async () => {
    const bad = adapter('bad', { failInit: true });
    const gateway = createTelemetryGateway({ adapters: [bad.adapter], allowedKeys: [], logger: silent });
    await gateway.init({});
    assert.deepEqual(bad.calls, ['init']);

    await gateway.disable('bad');
    await gateway.disable('bad');
    await gateway.disable();
    assert.deepEqual(bad.calls, ['init', 'shutdown'], 'shut down exactly once, not on every kill');
  });

  it('does not touch an adapter that was not killed', async () => {
    const bad = adapter('bad', { failInit: true });
    const other = adapter('other', { failInit: true });
    const gateway = createTelemetryGateway({ adapters: [bad.adapter, other.adapter], allowedKeys: [], logger: silent });
    await gateway.init({});

    await gateway.disable('bad');
    assert.deepEqual(other.calls, ['init']);
  });

  it('shuts down again after the adapter was revived and killed a second time', async () => {
    const flaky = adapter('flaky');
    const gateway = createTelemetryGateway({ adapters: [flaky.adapter], allowedKeys: [], logger: silent });
    await gateway.init({});
    await gateway.disable('flaky');
    await gateway.enable('flaky');
    await gateway.disable('flaky');
    assert.deepEqual(flaky.calls, ['init', 'shutdown', 'init', 'shutdown']);
  });

  it('keeps the before-init contract: a kill followed by init() means zero calls', async () => {
    const quiet = adapter('quiet');
    const gateway = createTelemetryGateway({ adapters: [quiet.adapter], allowedKeys: [], logger: silent });
    await gateway.disable();
    await gateway.init({});
    await gateway.track('x');
    assert.deepEqual(quiet.calls, []);
  });
});
