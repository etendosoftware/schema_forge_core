import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  analyzeBoundary,
  classifyPath,
  renderBoundaryReport,
  verticalForWindows,
} from '../src/domain-boundary/classifier.js';

const WINDOWS = [
  'purchase-invoice',
  'purchase-order',
  'sales-invoice',
  'sales-order',
  'sales-quotation',
];

describe('domain boundary classification', () => {
  it('maps a complete window slice across artifacts, custom UI, docs, and e2e', () => {
    const report = analyzeBoundary({
      knownWindows: WINDOWS,
      changedFiles: [
        'artifacts/sales-order/contract.json',
        'tools/app-shell/src/windows/custom/sales-order/OrderConfirmModal.jsx',
        'docs/generated-custom-windows/sales-order.md',
        'e2e/tests/flows/sales-order-crud.spec.js',
      ],
    });

    assert.equal(report.decision, 'pass');
    assert.deepEqual(report.windows, ['sales-order']);
    assert.deepEqual(report.blockers, []);
    assert.deepEqual(report.scopes.map((entry) => entry.scope), ['window:sales-order']);
  });

  it('blocks unrelated windows without a vertical or cross-domain exception', () => {
    const report = analyzeBoundary({
      knownWindows: WINDOWS,
      changedFiles: [
        'artifacts/sales-order/contract.json',
        'artifacts/purchase-order/contract.json',
      ],
    });

    assert.equal(report.decision, 'fail');
    assert.ok(report.blockers.some((blocker) => blocker.code === 'MULTIPLE_WINDOWS'));
  });

  it('allows a declared vertical slice with checklist text', () => {
    const report = analyzeBoundary({
      knownWindows: WINDOWS,
      labels: ['scope:vertical-slice'],
      prBody: 'Vertical: sales\nVentanas: sales-order, sales-invoice\nTest plan: e2e sales flow',
      changedFiles: [
        'artifacts/sales-order/contract.json',
        'artifacts/sales-invoice/contract.json',
      ],
    });

    assert.equal(report.decision, 'pass');
    assert.equal(report.vertical, 'sales');
    assert.ok(report.warnings.some((warning) => warning.code === 'VERTICAL_SLICE'));
  });

  it('blocks generator changes mixed with manual custom window code', () => {
    const report = analyzeBoundary({
      knownWindows: WINDOWS,
      changedFiles: [
        'cli/src/generate-frontend.js',
        'tools/app-shell/src/windows/custom/sales-order/OrderConfirmModal.jsx',
      ],
    });

    assert.equal(report.decision, 'fail');
    assert.ok(report.blockers.some((blocker) => blocker.code === 'GENERATOR_WITH_MANUAL_CUSTOM'));
  });

  it('allows generator changes with generated outputs only', () => {
    const report = analyzeBoundary({
      knownWindows: WINDOWS,
      changedFiles: [
        'cli/src/generate-frontend.js',
        'artifacts/sales-order/generated/web/sales-order/HeaderPage.jsx',
        'artifacts/purchase-order/generated/web/purchase-order/HeaderPage.jsx',
      ],
    });

    assert.equal(report.decision, 'pass');
  });

  it('blocks platform changes mixed with a window unless explicitly scoped', () => {
    const report = analyzeBoundary({
      knownWindows: WINDOWS,
      changedFiles: [
        'tools/app-shell/src/components/contract-ui/DetailView.jsx',
        'artifacts/sales-order/contract.json',
      ],
    });

    assert.equal(report.decision, 'fail');
    assert.ok(report.blockers.some((blocker) => blocker.code === 'PLATFORM_WITH_WINDOW'));
  });

  it('allows registry registration with a single window slice', () => {
    const report = analyzeBoundary({
      knownWindows: WINDOWS,
      changedFiles: [
        'tools/app-shell/src/windows/registry.js',
        'artifacts/sales-order/contract.json',
      ],
    });

    assert.equal(report.decision, 'pass');
  });

  it('requires a plan in addition to cross-domain-approved label', () => {
    const report = analyzeBoundary({
      knownWindows: WINDOWS,
      labels: ['cross-domain-approved'],
      changedFiles: [
        'tools/app-shell/src/components/contract-ui/DetailView.jsx',
        'artifacts/sales-order/contract.json',
      ],
    });

    assert.equal(report.decision, 'fail');
    assert.ok(report.blockers.some((blocker) => blocker.code === 'CROSS_DOMAIN_PLAN_MISSING'));
  });

  it('accepts a cross-domain plan file with the exception label', () => {
    const report = analyzeBoundary({
      knownWindows: WINDOWS,
      labels: ['cross-domain-approved'],
      changedFiles: [
        'tools/app-shell/src/components/contract-ui/DetailView.jsx',
        'artifacts/sales-order/contract.json',
        'docs/plans/ETP-4100-cross-domain.md',
      ],
    });

    assert.equal(report.decision, 'pass');
    assert.ok(report.warnings.some((warning) => warning.code === 'CROSS_DOMAIN_APPROVED'));
  });

  it('does not treat root lockfiles as neutral when multiple domains are changed', () => {
    const report = analyzeBoundary({
      knownWindows: WINDOWS,
      changedFiles: [
        'package-lock.json',
        'cli/package.json',
        'tools/app-shell/package.json',
      ],
    });

    assert.equal(report.decision, 'fail');
    assert.ok(report.blockers.some((blocker) => blocker.code === 'ROOT_SENSITIVE_FILES'));
  });

  it('allows a root lockfile with one mechanically related domain', () => {
    const report = analyzeBoundary({
      knownWindows: WINDOWS,
      changedFiles: [
        'package-lock.json',
        'cli/package.json',
      ],
    });

    assert.equal(report.decision, 'pass');
  });
});

describe('domain boundary helpers', () => {
  it('classifies shared custom helpers as shared-custom-capability', () => {
    assert.deepEqual(
      classifyPath('tools/app-shell/src/windows/custom/shared/InvoicePaymentModal.jsx', { knownWindows: WINDOWS }),
      { kind: 'shared-custom-capability', scope: 'shared-custom-capability' },
    );
  });

  it('detects verticals from touched windows', () => {
    assert.equal(verticalForWindows([]), null);
    assert.equal(verticalForWindows(['sales-order', 'sales-invoice']), 'sales');
    assert.equal(verticalForWindows(['sales-order', 'purchase-order']), null);
  });

  it('renders a markdown report with the marker used by the workflow comment', () => {
    const report = analyzeBoundary({
      knownWindows: WINDOWS,
      changedFiles: ['artifacts/sales-order/contract.json'],
    });

    assert.match(renderBoundaryReport(report), /<!-- domain-boundary-check -->/);
    assert.match(renderBoundaryReport(report), /Decision: \*\*PASS\*\*/);
  });
});
