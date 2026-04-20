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

  it('injects quick-order entries into Sales and Purchases groups', () => {
    const groups = buildMenuGroups(['quick-order']);
    const sales = groups.find(g => g.group === 'Sales');
    const purchases = groups.find(g => g.group === 'Purchases');
    const marketplace = groups.find(g => g.group === 'Marketplace');

    assert.ok(sales, 'Sales group missing');
    assert.ok(purchases, 'Purchases group missing');
    assert.ok(marketplace, 'Marketplace group missing');

    assert.ok(sales.items.map(i => i.name).includes('quick-order-sales'),
      'quick-order-sales should land under Sales');
    assert.ok(purchases.items.map(i => i.name).includes('quick-order-purchase'),
      'quick-order-purchase should land under Purchases');
    assert.ok(marketplace.items.map(i => i.name).includes('app-store'),
      'App Store entry should always be present in Marketplace');
  });

  it('falls back to app-level menuGroup when entry has none', () => {
    const groups = buildMenuGroups(['spike-hello-app']);
    const marketplace = groups.find(g => g.group === 'Marketplace');
    assert.ok(marketplace.items.map(i => i.name).includes('spike-hello-app'),
      'spike-hello-app should land under Marketplace (app-level fallback)');
  });

  it('handles multiple installed apps across different groups', () => {
    const groups = buildMenuGroups(['quick-order', 'spike-hello-app']);
    const sales = groups.find(g => g.group === 'Sales');
    const marketplace = groups.find(g => g.group === 'Marketplace');
    assert.ok(sales.items.map(i => i.name).includes('quick-order-sales'));
    assert.ok(marketplace.items.map(i => i.name).includes('spike-hello-app'));
  });
});
