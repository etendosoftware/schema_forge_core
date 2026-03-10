import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateAggregateFiles } from '../src/generate-aggregate.js';

const sampleContract = {
  meta: {
    module: 'inventory',
    label: 'Inventory Overview',
    icon: 'Package',
    route: '/inventory',
  },
  sections: [
    {
      id: 'kpi-header',
      type: 'kpi',
      title: 'Key Metrics',
      kpis: [
        { key: 'totalItems', label: 'Total Items', format: 'number' },
        { key: 'totalValue', label: 'Total Value', format: 'currency' },
        { key: 'lowStockPct', label: 'Low Stock %', format: 'percent' },
      ],
    },
    {
      id: 'stock-levels',
      type: 'data-table',
      title: 'Stock Levels',
      columns: [
        { key: 'product', label: 'Product' },
        { key: 'warehouse', label: 'Warehouse' },
        { key: 'quantity', label: 'Qty', type: 'number' },
      ],
    },
    {
      id: 'quick-actions',
      type: 'quick-actions',
      title: 'Actions',
    },
    {
      id: 'recent-movements',
      type: 'data-table',
      title: 'Recent Movements',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'product', label: 'Product' },
        { key: 'qty', label: 'Qty', type: 'number' },
      ],
    },
  ],
  layout: {
    areas: [
      { section: 'kpi-header', span: 'full' },
      { section: 'stock-levels', span: 'half' },
      { section: 'recent-movements', span: 'half' },
      { section: 'quick-actions', span: 'sidebar' },
    ],
  },
  actions: [
    { label: 'New Receipt', route: '/goods-receipt', icon: 'Plus' },
    { label: 'New Shipment', route: '/goods-shipment', icon: 'Truck' },
  ],
  mockData: {
    'kpi-header': {
      totalItems: 1245,
      totalValue: 328500,
      lowStockPct: 12.3,
    },
    'stock-levels': [
      { product: 'Laptop Pro 15', warehouse: 'Main Warehouse', quantity: 42 },
      { product: 'USB-C Cable', warehouse: 'East DC', quantity: 350 },
    ],
    'recent-movements': [
      { date: '2026-03-01', product: 'Laptop Pro 15', qty: 10 },
      { date: '2026-03-02', product: 'USB-C Cable', qty: -25 },
    ],
  },
};

describe('generateAggregateFiles', () => {
  const result = generateAggregateFiles(sampleContract);

  it('returns config.js and mockData.js (2 files)', () => {
    const keys = Object.keys(result);
    assert.ok(keys.includes('config.js'), 'should have config.js');
    assert.ok(keys.includes('mockData.js'), 'should have mockData.js');
    assert.equal(keys.length, 2, 'should return exactly 2 files');
  });

  it('config.js exports meta with module, label, icon, route', () => {
    const config = result['config.js'];
    assert.ok(config.includes('export const meta'), 'should export meta');
    assert.ok(config.includes('"module": "inventory"'), 'should include module');
    assert.ok(config.includes('"label": "Inventory Overview"'), 'should include label');
    assert.ok(config.includes('"icon": "Package"'), 'should include icon');
    assert.ok(config.includes('"route": "/inventory"'), 'should include route');
  });

  it('config.js exports kpisConfig array from kpi-header section', () => {
    const config = result['config.js'];
    assert.ok(config.includes('export const kpisConfig'), 'should export kpisConfig');
    assert.ok(config.includes('"key": "totalItems"'), 'should include totalItems kpi');
    assert.ok(config.includes('"key": "totalValue"'), 'should include totalValue kpi');
    assert.ok(config.includes('"key": "lowStockPct"'), 'should include lowStockPct kpi');
  });

  it('config.js exports sections object keyed by section id, excluding kpi-header', () => {
    const config = result['config.js'];
    assert.ok(config.includes('export const sections'), 'should export sections');
    assert.ok(config.includes('"stock-levels"'), 'should include stock-levels section');
    assert.ok(config.includes('"recent-movements"'), 'should include recent-movements section');
    assert.ok(config.includes('"quick-actions"'), 'should include quick-actions section');
    // kpi-header should NOT appear as a section key
    // It should be in kpisConfig, not in sections
    // We check that it's not a top-level key in the sections object
    const sectionsMatch = config.match(/export const sections\s*=\s*(\{[\s\S]*?\n\};)/);
    if (sectionsMatch) {
      assert.ok(!sectionsMatch[1].includes('"kpi-header":'), 'should NOT include kpi-header in sections');
    }
  });

  it('config.js exports layout array', () => {
    const config = result['config.js'];
    assert.ok(config.includes('export const layout'), 'should export layout');
    assert.ok(config.includes('"section": "kpi-header"'), 'should include kpi-header area');
    assert.ok(config.includes('"span": "full"'), 'should include span');
  });

  it('config.js exports actions array', () => {
    const config = result['config.js'];
    assert.ok(config.includes('export const actions'), 'should export actions');
    assert.ok(config.includes('"label": "New Receipt"'), 'should include New Receipt action');
    assert.ok(config.includes('"route": "/goods-shipment"'), 'should include shipment route');
  });

  it('mockData.js exports one named export per section (skips quick-actions)', () => {
    const mock = result['mockData.js'];
    assert.ok(mock.includes('export const kpis'), 'should export kpis (from kpi-header)');
    assert.ok(mock.includes('export const stockLevels'), 'should export stockLevels');
    assert.ok(mock.includes('export const recentMovements'), 'should export recentMovements');
    // quick-actions should be skipped
    assert.ok(!mock.includes('quickActions'), 'should NOT export quickActions');
  });

  it('mockData.js contains actual data values', () => {
    const mock = result['mockData.js'];
    assert.ok(mock.includes('1245'), 'should include totalItems value');
    assert.ok(mock.includes('328500'), 'should include totalValue value');
    assert.ok(mock.includes('Laptop Pro 15'), 'should include product name');
    assert.ok(mock.includes('Main Warehouse'), 'should include warehouse name');
  });

  it('generated files have "DO NOT EDIT" header', () => {
    const config = result['config.js'];
    const mock = result['mockData.js'];
    assert.ok(config.includes('DO NOT EDIT'), 'config.js should have DO NOT EDIT header');
    assert.ok(mock.includes('DO NOT EDIT'), 'mockData.js should have DO NOT EDIT header');
  });
});
