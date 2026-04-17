import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildWindowMap, getAllWindowNames } from '../registry.js';

describe('spike-hello-app wiring', () => {
  it('appears in the menu', () => {
    const names = getAllWindowNames();
    assert.ok(names.includes('spike-hello-app'),
      'spike-hello-app should be listed in menu.json');
  });

  it('has a loader registered', () => {
    const map = buildWindowMap();
    assert.ok(map['spike-hello-app'], 'spike-hello-app missing from window map');
    assert.equal(typeof map['spike-hello-app'].loader, 'function');
  });
});
