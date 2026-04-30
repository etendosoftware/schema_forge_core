import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectDecisionWindows, detectAffectedWindows, detectAffectedWindowsDetailed } from '../src/quality-gate/detect.js';

const SAMPLE_CONFIG = {
  blastRadius: [
    { pattern: 'artifacts/*/decisions.json', scope: 'touched-window' },
    { pattern: 'artifacts/*/contract.json', scope: 'touched-window' },
    { pattern: 'artifacts/*/custom/**', scope: 'touched-window' },
    { pattern: 'artifacts/*/generated/**', scope: 'touched-window' },
    { pattern: 'tools/app-shell/src/windows/custom/*/**', scope: 'touched-window' },
    { pattern: 'cli/src/generate-frontend.js', scope: 'all-windows' },
    { pattern: 'tools/app-shell/src/components/contract-ui/**', scope: 'all-windows' },
    { pattern: 'tools/app-shell/src/i18n/*.js', scope: 'all-windows' },
    { pattern: 'tools/app-shell/src/i18n/*.jsx', scope: 'all-windows' },
    { pattern: 'tools/app-shell/src/windows/registry.js', scope: 'all-windows' },
    { pattern: 'tools/app-shell/src/pages/**', scope: 'named-target', target: 'app-shell:pages', excludePatterns: ['tools/app-shell/src/pages/OnboardingPage.jsx', 'tools/app-shell/src/pages/onboarding/**'] },
    { pattern: 'tools/app-shell/src/pages/OnboardingPage.jsx', scope: 'named-target', target: 'app-shell:onboarding' },
    { pattern: 'tools/app-shell/src/pages/onboarding/**', scope: 'named-target', target: 'app-shell:onboarding' },
    { pattern: 'schemas/contract.schema.json', scope: 'all-windows' },
  ],
};

describe('collectDecisionWindows', () => {
  it('collects tracked windows from artifacts directories', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'quality-gate-detect-'));

    try {
      mkdirSync(join(rootDir, 'artifacts', 'sales-order'), { recursive: true });
      mkdirSync(join(rootDir, 'artifacts', 'purchase-order'), { recursive: true });
      mkdirSync(join(rootDir, 'artifacts', 'ignore-me'), { recursive: true });
      writeFileSync(join(rootDir, 'artifacts', 'sales-order', 'decisions.json'), '{}');
      writeFileSync(join(rootDir, 'artifacts', 'purchase-order', 'decisions.json'), '{}');
      writeFileSync(join(rootDir, 'artifacts', 'ignore-me', 'schema-raw.json'), '{}');

      assert.deepEqual(collectDecisionWindows(rootDir), ['purchase-order', 'sales-order']);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});

describe('detectAffectedWindows', () => {
  it('returns only the touched window for artifact-local changes', () => {
    const affected = detectAffectedWindows({
      changedFiles: ['artifacts/purchase-order/decisions.json'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: ['purchase-order', 'sales-order'],
    });

    assert.deepEqual(affected, ['purchase-order']);
  });

  it('returns all windows for shared generator changes', () => {
    const affected = detectAffectedWindows({
      changedFiles: ['cli/src/generate-frontend.js'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: ['purchase-order', 'sales-order'],
    });

    assert.deepEqual(affected, ['purchase-order', 'sales-order']);
  });

  it('returns the touched window for artifact custom code changes', () => {
    const affected = detectAffectedWindows({
      changedFiles: ['artifacts/purchase-order/custom/Sidebar.jsx'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: ['purchase-order', 'sales-order'],
    });

    assert.deepEqual(affected, ['purchase-order']);
  });

  it('returns the touched window for app-shell custom window changes', () => {
    const affected = detectAffectedWindows({
      changedFiles: ['tools/app-shell/src/windows/custom/sales-order/Sidebar.jsx'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: ['purchase-order', 'sales-order'],
    });

    assert.deepEqual(affected, ['sales-order']);
  });

  it('returns the touched window for generated artifact changes', () => {
    const affected = detectAffectedWindows({
      changedFiles: ['artifacts/sales-order/generated/web/sales-order/HeaderPage.jsx'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: ['purchase-order', 'sales-order'],
    });

    assert.deepEqual(affected, ['sales-order']);
  });

  it('returns all windows for shared i18n runtime javascript changes', () => {
    const affected = detectAffectedWindows({
      changedFiles: ['tools/app-shell/src/i18n/useLabel.js'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: ['purchase-order', 'sales-order'],
    });

    assert.deepEqual(affected, ['purchase-order', 'sales-order']);
  });

  it('returns all windows for shared i18n runtime jsx changes', () => {
    const affected = detectAffectedWindows({
      changedFiles: ['tools/app-shell/src/i18n/LocaleProvider.jsx'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: ['purchase-order', 'sales-order'],
    });

    assert.deepEqual(affected, ['purchase-order', 'sales-order']);
  });

  it('returns all windows for registry changes', () => {
    const affected = detectAffectedWindows({
      changedFiles: ['tools/app-shell/src/windows/registry.js'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: ['purchase-order', 'sales-order'],
    });

    assert.deepEqual(affected, ['purchase-order', 'sales-order']);
  });

  it('returns all windows for contract schema changes', () => {
    const affected = detectAffectedWindows({
      changedFiles: ['schemas/contract.schema.json'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: ['purchase-order', 'sales-order'],
    });

    assert.deepEqual(affected, ['purchase-order', 'sales-order']);
  });

  it('returns the onboarding app-shell target for top-level onboarding page changes', () => {
    const affected = detectAffectedWindows({
      changedFiles: ['tools/app-shell/src/pages/OnboardingPage.jsx'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: ['purchase-order', 'sales-order'],
    });

    assert.deepEqual(affected, ['app-shell:onboarding']);
  });

  it('returns the onboarding app-shell target for onboarding helper changes', () => {
    const affected = detectAffectedWindows({
      changedFiles: ['tools/app-shell/src/pages/onboarding/onboardingState.js'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: ['purchase-order', 'sales-order'],
    });

    assert.deepEqual(affected, ['app-shell:onboarding']);
  });

  it('maps businessPartner shared custom code back to contacts', () => {
    const affected = detectAffectedWindows({
      changedFiles: ['tools/app-shell/src/windows/custom/businessPartner/BusinessPartnerSidebar.jsx'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: ['contacts', 'purchase-order'],
    });

    assert.deepEqual(affected, ['contacts']);
  });

  it('treats shared custom helpers as affecting every window', () => {
    const affected = detectAffectedWindows({
      changedFiles: ['tools/app-shell/src/windows/custom/shared/InvoicePaymentModal.jsx'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: ['contacts', 'purchase-order'],
    });

    assert.deepEqual(affected, ['contacts', 'purchase-order']);
  });

  it('returns no windows for unrelated changes', () => {
    const affected = detectAffectedWindows({
      changedFiles: ['README.md'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: ['purchase-order', 'sales-order'],
    });

    assert.deepEqual(affected, []);
  });
});

describe('detectAffectedWindowsDetailed', () => {
  it('marks artifact-local changes as direct', () => {
    const affected = detectAffectedWindowsDetailed({
      changedFiles: ['artifacts/purchase-order/custom/Sidebar.jsx'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: ['purchase-order', 'sales-order'],
    });

    assert.deepEqual(affected, [
      { window: 'purchase-order', source: 'direct' },
    ]);
  });

  it('marks shared blast radius changes as global', () => {
    const affected = detectAffectedWindowsDetailed({
      changedFiles: ['cli/src/generate-frontend.js'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: ['purchase-order', 'sales-order'],
    });

    assert.deepEqual(affected, [
      { window: 'purchase-order', source: 'global' },
      { window: 'sales-order', source: 'global' },
    ]);
  });

  it('marks shared custom helpers as global', () => {
    const affected = detectAffectedWindowsDetailed({
      changedFiles: ['tools/app-shell/src/windows/custom/shared/InvoicePaymentModal.jsx'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: ['contacts', 'purchase-order'],
    });

    assert.deepEqual(affected, [
      { window: 'contacts', source: 'global' },
      { window: 'purchase-order', source: 'global' },
    ]);
  });

  it('marks onboarding app-shell targets as direct', () => {
    const affected = detectAffectedWindowsDetailed({
      changedFiles: ['tools/app-shell/src/pages/OnboardingPage.jsx'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: ['purchase-order', 'sales-order'],
    });

    assert.deepEqual(affected, [
      { window: 'app-shell:onboarding', source: 'direct' },
    ]);
  });

  it('excludePatterns prevents onboarding files from triggering app-shell:pages', () => {
    const onboardingPage = detectAffectedWindowsDetailed({
      changedFiles: ['tools/app-shell/src/pages/OnboardingPage.jsx'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: [],
    });
    assert.ok(!onboardingPage.some((e) => e.window === 'app-shell:pages'), 'OnboardingPage.jsx must not trigger app-shell:pages');

    const onboardingModule = detectAffectedWindowsDetailed({
      changedFiles: ['tools/app-shell/src/pages/onboarding/onboardingState.js'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: [],
    });
    assert.ok(!onboardingModule.some((e) => e.window === 'app-shell:pages'), 'onboarding/** must not trigger app-shell:pages');

    const regularPage = detectAffectedWindowsDetailed({
      changedFiles: ['tools/app-shell/src/pages/SalesPage.jsx'],
      blastRadius: SAMPLE_CONFIG.blastRadius,
      availableWindows: [],
    });
    assert.ok(regularPage.some((e) => e.window === 'app-shell:pages'), 'regular pages must still trigger app-shell:pages');
  });
});