import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAppShellConfig,
  createMenuGroup,
  createMenuItem,
  createReportDescriptor,
  createRuntimeRoute,
} from '../contracts.js';

test('runtime contracts normalize standalone menu, report and route descriptors', () => {
  const config = createAppShellConfig({
    menuGroups: [
      createMenuGroup({
        id: 'main',
        title: 'Main',
        items: [createMenuItem({ label: 'Dashboard', path: 'dashboard' })],
      }),
    ],
    reports: [createReportDescriptor({ id: 'sales-summary', title: 'Sales summary' })],
    routes: [createRuntimeRoute({ path: 'dashboard', element: 'dashboard-element' })],
  });

  assert.equal(config.menuGroups[0].items[0].path, '/dashboard');
  assert.equal(config.reports[0].format, 'pdf');
  assert.equal(config.routes[0].path, 'dashboard');
});

test('runtime contracts fail fast for incomplete standalone descriptors', () => {
  assert.throws(() => createMenuItem({ label: 'Broken' }), /path or id/);
  assert.throws(() => createReportDescriptor({ title: 'Broken' }), /Reports require an id/);
  assert.throws(() => createRuntimeRoute({ path: '/broken' }), /Routes require an element/);
});
