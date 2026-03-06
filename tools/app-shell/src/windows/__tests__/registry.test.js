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
  it('includes the contract window as first item', () => {
    const items = buildMenuFromContract(sampleContract);
    assert.equal(items[0].name, 'sales-order');
    assert.equal(items[0].label, 'Sales Order');
  });

  it('includes all 10 reference windows', () => {
    const items = buildMenuFromContract(sampleContract);
    // 1 contract window + 10 reference windows = 11
    assert.equal(items.length, 11);
    const refNames = items.slice(1).map(i => i.name);
    assert.ok(refNames.includes('business-partner'));
    assert.ok(refNames.includes('product'));
    assert.ok(refNames.includes('warehouse'));
    assert.ok(refNames.includes('uom'));
  });

  it('returns only reference windows for empty contract', () => {
    const items = buildMenuFromContract({});
    assert.equal(items.length, 10);
  });
});

describe('buildWindowMap', () => {
  it('creates window map keyed by slug including contract window', () => {
    const map = buildWindowMap(sampleContract);
    assert.ok(map['sales-order']);
    assert.equal(map['sales-order'].name, 'sales-order');
    assert.equal(map['sales-order'].label, 'Sales Order');
    assert.ok(map['sales-order'].loader);
  });

  it('passes the full frontend contract for the primary window', () => {
    const map = buildWindowMap(sampleContract);
    assert.deepEqual(map['sales-order'].contract, sampleContract.frontendContract);
  });

  it('includes reference windows in the map', () => {
    const map = buildWindowMap(sampleContract);
    assert.ok(map['business-partner']);
    assert.ok(map['product']);
    assert.ok(map['warehouse']);
    assert.equal(map['business-partner'].label, 'Business Partner');
  });

  it('returns reference windows even for empty contract', () => {
    const map = buildWindowMap({});
    assert.equal(Object.keys(map).length, 10);
    assert.ok(map['business-partner']);
  });
});
