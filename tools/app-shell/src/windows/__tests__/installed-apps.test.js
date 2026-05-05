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

  it('hides the Marketplace group until the App Store is unlocked', () => {
    const locked = buildMenuGroups([], { appStoreUnlocked: false });
    assert.equal(locked.find(g => g.group === 'Marketplace'), undefined,
      'Marketplace should be hidden when locked');

    const unlocked = buildMenuGroups([], { appStoreUnlocked: true });
    const marketplace = unlocked.find(g => g.group === 'Marketplace');
    assert.ok(marketplace, 'Marketplace should appear when unlocked');
    assert.ok(marketplace.items.map(i => i.name).includes('app-store'),
      'App Store entry should be inside Marketplace');
  });

  it('injects quick-order entries into Sales and Purchases regardless of unlock state', () => {
    const groups = buildMenuGroups(['quick-order'], { appStoreUnlocked: false });
    const sales = groups.find(g => g.group === 'Sales');
    const purchases = groups.find(g => g.group === 'Purchases');

    assert.ok(sales.items.map(i => i.name).includes('quick-order-sales'),
      'quick-order-sales should land under Sales');
    assert.ok(purchases.items.map(i => i.name).includes('quick-order-purchase'),
      'quick-order-purchase should land under Purchases');
  });

  it('falls back to app-level menuGroup when entry has none', () => {
    const groups = buildMenuGroups(['spike-hello-app'], { appStoreUnlocked: true });
    const marketplace = groups.find(g => g.group === 'Marketplace');
    assert.ok(marketplace.items.map(i => i.name).includes('spike-hello-app'),
      'spike-hello-app should land under Marketplace (app-level fallback)');
  });

  it('handles multiple installed apps across different groups', () => {
    const groups = buildMenuGroups(['quick-order', 'spike-hello-app'], { appStoreUnlocked: true });
    const sales = groups.find(g => g.group === 'Sales');
    const marketplace = groups.find(g => g.group === 'Marketplace');
    assert.ok(sales.items.map(i => i.name).includes('quick-order-sales'));
    assert.ok(marketplace.items.map(i => i.name).includes('spike-hello-app'));
  });
});
