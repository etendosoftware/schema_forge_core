import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { initBrowserObservability } from '../observability/browser.js';

describe('browser observability startup', () => {
  it('emits app_started once after initializing providers', async () => {
    const calls = [];
    const client = {
      async initObservability(config) {
        calls.push(['initObservability', config.context.app]);
      },
      async track(eventName) {
        calls.push(['track', eventName]);
      },
    };

    await initBrowserObservability(
      {
        env: {},
        location: { hostname: 'localhost' },
        logger: { warn() {} },
      },
      client
    );

    assert.deepEqual(calls, [
      ['initObservability', 'app-shell'],
      ['track', 'app_started'],
    ]);
  });
});
