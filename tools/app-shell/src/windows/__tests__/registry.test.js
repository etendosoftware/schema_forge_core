import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildMenuFromContract, buildWindowMap } from '../registry.js';

const sampleContract = {
  frontendContract: {
    window: { name: 'Sales Order' },
    entities: {
      order: {
        fields: [
          { name: 'documentNo', tsType: 'string', visibility: 'readOnly' },
        ],
        searchableFields: ['documentNo'],
      },
      orderLine: {
        fields: [
          { name: 'product', tsType: 'string', visibility: 'editable' },
        ],
        searchableFields: ['product'],
      },
    },
  },
};

describe('buildMenuFromContract', () => {
  it('creates menu items from contract entities', () => {
    const items = buildMenuFromContract(sampleContract);
    assert.equal(items.length, 2);
    assert.equal(items[0].name, 'order');
    assert.equal(items[1].name, 'orderLine');
  });

  it('generates labels from entity names', () => {
    const items = buildMenuFromContract(sampleContract);
    assert.equal(items[0].label, 'Order');
    assert.equal(items[1].label, 'Order Line');
  });

  it('returns empty array for empty contract', () => {
    const items = buildMenuFromContract({});
    assert.deepEqual(items, []);
  });
});

describe('buildWindowMap', () => {
  it('creates window map with loaders', () => {
    const loaders = { order: () => Promise.resolve({ default: () => null }) };
    const map = buildWindowMap(sampleContract, loaders);
    assert.ok(map.order);
    assert.ok(map.order.loader);
    assert.equal(map.order.name, 'order');
  });

  it('uses placeholder loader when no loader provided', () => {
    const map = buildWindowMap(sampleContract, {});
    assert.ok(map.order);
    assert.ok(map.order.loader);
  });
});
