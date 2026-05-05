import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

/**
 * Pure-logic mirror of PageMetaContext behavior.
 * Tests the setMeta / cleanup contracts without loading React.
 */

function createMetaStore() {
  let state = {};
  const setMeta = (m) => { state = m ?? {}; };
  const getMeta = () => state;
  return { setMeta, getMeta };
}

function simulateSetPageMeta(store, meta) {
  store.setMeta(meta);
  return () => store.setMeta({});
}

describe('PageMetaContext — meta store', () => {
  it('starts with empty meta', () => {
    const store = createMetaStore();
    assert.deepEqual(store.getMeta(), {});
  });

  it('stores title and breadcrumb', () => {
    const store = createMetaStore();
    store.setMeta({ title: 'Products', breadcrumb: 'Inventory / Products' });
    assert.equal(store.getMeta().title, 'Products');
    assert.equal(store.getMeta().breadcrumb, 'Inventory / Products');
  });

  it('stores recordCount', () => {
    const store = createMetaStore();
    store.setMeta({ title: 'Invoices', recordCount: 3 });
    assert.equal(store.getMeta().recordCount, 3);
  });

  it('replaces meta on update', () => {
    const store = createMetaStore();
    store.setMeta({ title: 'Old' });
    store.setMeta({ title: 'New', recordCount: 5 });
    assert.equal(store.getMeta().title, 'New');
    assert.equal(store.getMeta().recordCount, 5);
  });

  it('setMeta(null) resets to empty object', () => {
    const store = createMetaStore();
    store.setMeta({ title: 'Something' });
    store.setMeta(null);
    assert.deepEqual(store.getMeta(), {});
  });

  it('setMeta({}) clears all fields', () => {
    const store = createMetaStore();
    store.setMeta({ title: 'X', breadcrumb: 'Y', recordCount: 10 });
    store.setMeta({});
    assert.deepEqual(store.getMeta(), {});
  });
});

describe('PageMetaContext — useSetPageMeta lifecycle', () => {
  it('publishes meta on mount', () => {
    const store = createMetaStore();
    simulateSetPageMeta(store, { title: 'Dashboard' });
    assert.equal(store.getMeta().title, 'Dashboard');
  });

  it('cleanup resets meta to empty on unmount', () => {
    const store = createMetaStore();
    const cleanup = simulateSetPageMeta(store, { title: 'Dashboard' });
    cleanup();
    assert.deepEqual(store.getMeta(), {});
  });

  it('re-publishing with new meta replaces previous values', () => {
    const store = createMetaStore();
    simulateSetPageMeta(store, { title: 'List', recordCount: 2 });
    simulateSetPageMeta(store, { title: 'List', recordCount: 7 });
    assert.equal(store.getMeta().recordCount, 7);
  });

  it('isFavorite flag is included in meta', () => {
    const store = createMetaStore();
    simulateSetPageMeta(store, { title: 'Products', isFavorite: true });
    assert.equal(store.getMeta().isFavorite, true);
  });

  it('onAddToFavorites callback is preserved in meta', () => {
    const store = createMetaStore();
    const handler = () => {};
    simulateSetPageMeta(store, { title: 'Products', onAddToFavorites: handler });
    assert.equal(store.getMeta().onAddToFavorites, handler);
  });
});
