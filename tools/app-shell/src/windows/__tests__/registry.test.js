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
  it('creates one menu item per window', () => {
    const items = buildMenuFromContract(sampleContract);
    assert.equal(items.length, 1);
    assert.equal(items[0].name, 'sales-order');
    assert.equal(items[0].label, 'Sales Order');
  });

  it('returns empty array for empty contract', () => {
    const items = buildMenuFromContract({});
    assert.deepEqual(items, []);
  });
});

describe('buildWindowMap', () => {
  it('creates window map keyed by slug', () => {
    const map = buildWindowMap(sampleContract);
    assert.ok(map['sales-order']);
    assert.equal(map['sales-order'].name, 'sales-order');
    assert.equal(map['sales-order'].label, 'Sales Order');
    assert.ok(map['sales-order'].loader);
  });

  it('passes the full frontend contract', () => {
    const map = buildWindowMap(sampleContract);
    assert.deepEqual(map['sales-order'].contract, sampleContract.frontendContract);
  });

  it('returns empty object for empty contract', () => {
    const map = buildWindowMap({});
    assert.deepEqual(map, {});
  });
});
