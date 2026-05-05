import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildWindowMap, getAllWindowNames } from '../registry.js';

describe('spike-hello-app wiring', () => {
  it('is registered as a known window slug', () => {
    const names = getAllWindowNames();
    assert.ok(names.includes('spike-hello-app'),
      'spike-hello-app should be reachable via the app catalog');
  });

  it('has a loader registered even when not in menu.json', () => {
    const map = buildWindowMap();
    assert.ok(map['spike-hello-app'], 'spike-hello-app missing from window map');
    assert.equal(typeof map['spike-hello-app'].loader, 'function');
  });
});
