import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildMenuGroups } from '../registry.js';

describe('buildMenuGroups + installed apps', () => {
  it('does not expose SDK app entries by default', () => {
    const groups = buildMenuGroups([]);
    const allNames = groups.flatMap(g => g.items.map(i => i.name));
    assert.ok(!allNames.includes('quick-order-sales'),
      'quick-order-sales should be hidden when quick-order is not installed');
    assert.ok(!allNames.includes('spike-hello-app'),
      'spike-hello-app should be hidden when not installed');
  });

  it('injects menu entries for installed apps into the Marketplace group', () => {
    const groups = buildMenuGroups(['quick-order']);
    const marketplace = groups.find(g => g.group === 'Marketplace');
    assert.ok(marketplace, 'Marketplace group missing');
    const names = marketplace.items.map(i => i.name);
    assert.ok(names.includes('app-store'), 'App Store entry should always be present');
    assert.ok(names.includes('quick-order-sales'), 'quick-order-sales should appear when installed');
    assert.ok(names.includes('quick-order-purchase'), 'quick-order-purchase should appear when installed');
  });

  it('handles multiple installed apps', () => {
    const groups = buildMenuGroups(['quick-order', 'spike-hello-app']);
    const marketplace = groups.find(g => g.group === 'Marketplace');
    const names = marketplace.items.map(i => i.name);
    assert.ok(names.includes('spike-hello-app'));
    assert.ok(names.includes('quick-order-sales'));
  });
});
