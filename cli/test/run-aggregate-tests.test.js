import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { runAggregateTests } from '../src/run-aggregate-tests.js';

/**
 * Valid aggregate contract fixture with all section types covered.
 */
const validContract = {
  sections: [
    {
      id: 'kpi-revenue',
      type: 'kpi',
      kpis: [
        { key: 'totalRevenue', label: 'Total Revenue', format: 'currency' },
        { key: 'orderCount', label: 'Order Count', format: 'number' },
      ],
    },
    {
      id: 'table-orders',
      type: 'data-table',
      columns: [
        { key: 'documentNo', label: 'Document No' },
        { key: 'total', label: 'Total' },
      ],
    },
    {
      id: 'alerts-section',
      type: 'alerts',
      severities: ['info', 'warning', 'error'],
    },
    {
      id: 'quick-actions',
      type: 'quick-actions',
    },
  ],
  layout: {
    areas: [
      { section: 'kpi-revenue' },
      { section: 'table-orders' },
      { section: 'alerts-section' },
      { section: 'quick-actions' },
    ],
  },
  mockData: {
    'kpi-revenue': { totalRevenue: 50000, orderCount: 120 },
    'table-orders': [
      { documentNo: 'SO-001', total: 1500 },
      { documentNo: 'SO-002', total: 2300 },
    ],
    'alerts-section': [
      { message: 'Low stock', severity: 'warning' },
    ],
    'quick-actions': [
      { label: 'New Order', route: '/orders/new' },
    ],
  },
  actions: [
    { label: 'New Order', route: '/orders/new' },
  ],
};

const menuItems = ['/orders/new', '/orders', '/dashboard'];

describe('runAggregateTests', () => {
  it('passes all checks on a valid contract', () => {
    const result = runAggregateTests(validContract, menuItems);
    assert.equal(result.failed, 0, `Failed tests: ${JSON.stringify(result.results.filter(r => !r.passed), null, 2)}`);
    assert.ok(result.total > 0);
    assert.equal(result.total, result.passed);
  });

  it('fails section-presence when mockData is missing for a section', () => {
    const contract = structuredClone(validContract);
    delete contract.mockData['table-orders'];
    const result = runAggregateTests(contract, menuItems);
    const fail = result.results.find(r => r.category === 'section-presence' && !r.passed);
    assert.ok(fail, 'Expected a section-presence failure');
    assert.ok(fail.reason.includes('table-orders'));
  });

  it('fails kpi-integrity on invalid format', () => {
    const contract = structuredClone(validContract);
    contract.sections[0].kpis[0].format = 'money';
    const result = runAggregateTests(contract, menuItems);
    const fail = result.results.find(r => r.category === 'kpi-integrity' && !r.passed);
    assert.ok(fail, 'Expected a kpi-integrity failure for invalid format');
    assert.ok(fail.reason.includes('money'));
  });

  it('fails kpi-integrity when mockData value is missing for a KPI key', () => {
    const contract = structuredClone(validContract);
    delete contract.mockData['kpi-revenue'].orderCount;
    const result = runAggregateTests(contract, menuItems);
    const fail = result.results.find(r => r.category === 'kpi-integrity' && !r.passed && r.reason.includes('orderCount'));
    assert.ok(fail, 'Expected a kpi-integrity failure for missing mockData value');
  });

  it('fails table-column-match when row misses a column key', () => {
    const contract = structuredClone(validContract);
    contract.mockData['table-orders'] = [{ documentNo: 'SO-001' }]; // missing 'total'
    const result = runAggregateTests(contract, menuItems);
    const fail = result.results.find(r => r.category === 'table-column-match' && !r.passed);
    assert.ok(fail, 'Expected a table-column-match failure');
    assert.ok(fail.reason.includes('total'));
  });

  it('fails link-validity when route is not in menu items', () => {
    const contract = structuredClone(validContract);
    contract.actions = [{ label: 'Go Nowhere', route: '/nowhere' }];
    const result = runAggregateTests(contract, menuItems);
    const fail = result.results.find(r => r.category === 'link-validity' && !r.passed);
    assert.ok(fail, 'Expected a link-validity failure');
    assert.ok(fail.reason.includes('/nowhere'));
  });

  it('fails layout-coverage when a section is not in layout', () => {
    const contract = structuredClone(validContract);
    contract.layout.areas = contract.layout.areas.filter(a => a.section !== 'alerts-section');
    const result = runAggregateTests(contract, menuItems);
    const fail = result.results.find(r => r.category === 'layout-coverage' && !r.passed);
    assert.ok(fail, 'Expected a layout-coverage failure');
    assert.ok(fail.reason.includes('alerts-section'));
  });

  it('fails mockData-shape on empty array', () => {
    const contract = structuredClone(validContract);
    contract.mockData['table-orders'] = [];
    const result = runAggregateTests(contract, menuItems);
    const fail = result.results.find(r => r.category === 'mockData-shape' && !r.passed);
    assert.ok(fail, 'Expected a mockData-shape failure for empty array');
    assert.ok(fail.reason.includes('table-orders'));
  });

  it('skips kanban-column-match when no kanban sections exist', () => {
    const result = runAggregateTests(validContract, menuItems);
    const kanbanResults = result.results.filter(r => r.category === 'kanban-column-match');
    assert.equal(kanbanResults.length, 0, 'Should produce no kanban checks when no kanban sections');
  });

  it('fails alert-severity on invalid severity', () => {
    const contract = structuredClone(validContract);
    contract.mockData['alerts-section'] = [{ message: 'Bad', severity: 'critical' }];
    const result = runAggregateTests(contract, menuItems);
    const fail = result.results.find(r => r.category === 'alert-severity' && !r.passed);
    assert.ok(fail, 'Expected an alert-severity failure');
    assert.ok(fail.reason.includes('critical'));
  });

  it('fails kanban-column-match when card has invalid columnId', () => {
    const contract = structuredClone(validContract);
    contract.sections.push({
      id: 'kanban-pipeline',
      type: 'kanban',
      columns: [
        { id: 'open', label: 'Open' },
        { id: 'closed', label: 'Closed' },
      ],
    });
    contract.layout.areas.push({ section: 'kanban-pipeline' });
    contract.mockData['kanban-pipeline'] = [
      { title: 'Deal A', columnId: 'open' },
      { title: 'Deal B', columnId: 'invalid-col' },
    ];
    const result = runAggregateTests(contract, menuItems);
    const fail = result.results.find(r => r.category === 'kanban-column-match' && !r.passed);
    assert.ok(fail, 'Expected a kanban-column-match failure');
    assert.ok(fail.reason.includes('invalid-col'));
  });
});
