import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runI18nCheck } from '../src/quality-gate/checks/i18n.js';

function makeFixture({
  missingColumn = false,
  hardcoded = false,
  allowlisted = false,
  sharedHardcoded = false,
  aliasHardcoded = false,
  onboardingPageHardcoded = false,
  onboardingModuleHardcoded = false,
  appPageHardcoded = false,
} = {}) {
  const rootDir = mkdtempSync(join(tmpdir(), 'quality-gate-i18n-'));
  const windowDir = join(rootDir, 'artifacts', 'sales-order');
  const appCustomDir = join(rootDir, 'tools', 'app-shell', 'src', 'windows', 'custom');
  mkdirSync(join(windowDir, 'custom'), { recursive: true });
  mkdirSync(join(appCustomDir, 'sales-order'), { recursive: true });
  mkdirSync(join(appCustomDir, 'shared'), { recursive: true });
  mkdirSync(join(appCustomDir, 'businessPartner'), { recursive: true });
  const pagesDir = join(rootDir, 'tools', 'app-shell', 'src', 'pages');
  mkdirSync(join(pagesDir, 'onboarding'), { recursive: true });

  const contract = {
    frontendContract: {
      window: { primaryEntity: 'header' },
      entities: {
        header: {
          fields: [
            {
              name: 'documentNo',
              form: true,
              visibility: 'editable',
              column: missingColumn ? '' : 'DocumentNo',
            },
          ],
        },
      },
    },
  };

  const customComponent = hardcoded
    ? `${allowlisted ? '// i18n-allowlist: ["Move to warehouse"]\n' : ''}export default function Sidebar() { return <button title="Move to warehouse">Move to warehouse</button>; }`
    : `import { useUI } from '@/i18n';\nexport default function Sidebar() { const ui = useUI(); return <button title={ui('save')}>{ui('save')}</button>; }`;

  writeFileSync(join(windowDir, 'contract.json'), JSON.stringify(contract, null, 2));
  writeFileSync(join(windowDir, 'custom', 'Sidebar.jsx'), customComponent);

  if (onboardingPageHardcoded) {
    writeFileSync(join(pagesDir, 'OnboardingPage.jsx'), 'export default function OnboardingPage() { return <button title="Crear cuenta">Crear cuenta</button>; }');
  }

  if (onboardingModuleHardcoded) {
    writeFileSync(join(pagesDir, 'onboarding', 'onboardingState.js'), `export const SETUP_STEP_DEFINITIONS = [
  { name: 'setup', label: 'Preparando contexto', description: 'Crear empresa' },
];`);
  }

  if (appPageHardcoded) {
    writeFileSync(join(pagesDir, 'SalesPage.jsx'), 'export default function SalesPage() { return <h1>Sales Orders</h1>; }');
  }

  if (sharedHardcoded) {
    writeFileSync(join(appCustomDir, 'shared', 'SharedModal.jsx'), 'export default function SharedModal() { return <span>Shared warning</span>; }');
  }
  if (aliasHardcoded) {
    writeFileSync(join(appCustomDir, 'businessPartner', 'BusinessPartnerSidebar.jsx'), 'export default function BusinessPartnerSidebar() { return <span>Business partner note</span>; }');
  }

  return { rootDir, windowDir };
}

describe('runI18nCheck', () => {
  it('passes when fields have column keys and custom code uses translators', async () => {
    const { rootDir, windowDir } = makeFixture();

    try {
      const result = await runI18nCheck('sales-order', { rootDir, windowDir });
      assert.deepEqual(result, { status: 'pass', detail: 'i18n coverage and custom code checks passed.' });
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('fails when a form field lacks a column key', async () => {
    const { rootDir, windowDir } = makeFixture({ missingColumn: true });

    try {
      const result = await runI18nCheck('sales-order', { rootDir, windowDir });
      assert.equal(result.status, 'fail');
      assert.match(result.detail, /documentNo/);
      assert.match(result.detail, /column/i);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('fails on hardcoded user-facing strings unless allowlisted', async () => {
    const failing = makeFixture({ hardcoded: true });
    try {
      const result = await runI18nCheck('sales-order', { rootDir: failing.rootDir, windowDir: failing.windowDir });
      assert.equal(result.status, 'fail');
      assert.match(result.detail, /Move to warehouse/);
    } finally {
      rmSync(failing.rootDir, { recursive: true, force: true });
    }

    const passing = makeFixture({ hardcoded: true, allowlisted: true });
    try {
      const result = await runI18nCheck('sales-order', { rootDir: passing.rootDir, windowDir: passing.windowDir });
      assert.equal(result.status, 'pass');
    } finally {
      rmSync(passing.rootDir, { recursive: true, force: true });
    }
  });

  it('scans shared and aliased custom files for contacts', async () => {
    const fixture = makeFixture({ sharedHardcoded: true, aliasHardcoded: true });
    try {
      const result = await runI18nCheck('contacts', { rootDir: fixture.rootDir, windowDir: fixture.windowDir });
      assert.equal(result.status, 'fail');
      assert.match(result.detail, /Shared warning/);
      assert.match(result.detail, /Business partner note/);
    } finally {
      rmSync(fixture.rootDir, { recursive: true, force: true });
    }
  });

  it('artifact window is not polluted by hardcoded strings in app shell pages', async () => {
    const fixture = makeFixture({ appPageHardcoded: true });
    try {
      const result = await runI18nCheck('sales-order', { rootDir: fixture.rootDir, windowDir: fixture.windowDir });
      assert.equal(result.status, 'pass', 'pages violations must not bleed into artifact window checks');
    } finally {
      rmSync(fixture.rootDir, { recursive: true, force: true });
    }
  });

  it('artifact window is not polluted by hardcoded strings in onboarding page', async () => {
    const fixture = makeFixture({ onboardingPageHardcoded: true });
    try {
      const result = await runI18nCheck('sales-order', { rootDir: fixture.rootDir, windowDir: fixture.windowDir });
      assert.equal(result.status, 'pass', 'onboarding page violations must not bleed into artifact window checks');
    } finally {
      rmSync(fixture.rootDir, { recursive: true, force: true });
    }
  });

  it('app-shell:pages target catches hardcoded strings in app pages', async () => {
    const fixture = makeFixture({ appPageHardcoded: true });
    try {
      const result = await runI18nCheck('app-shell:pages', { rootDir: fixture.rootDir, windowDir: fixture.rootDir });
      assert.equal(result.status, 'fail');
      assert.match(result.detail, /SalesPage.jsx/);
      assert.match(result.detail, /Sales Orders/);
    } finally {
      rmSync(fixture.rootDir, { recursive: true, force: true });
    }
  });

  it('app-shell:pages target does not scan onboarding files (those belong to app-shell:onboarding)', async () => {
    const fixture = makeFixture({ onboardingPageHardcoded: true });
    try {
      const result = await runI18nCheck('app-shell:pages', { rootDir: fixture.rootDir, windowDir: fixture.rootDir });
      assert.equal(result.status, 'pass', 'OnboardingPage.jsx must not appear in app-shell:pages scan');
    } finally {
      rmSync(fixture.rootDir, { recursive: true, force: true });
    }
  });

  it('app-shell:onboarding target catches hardcoded strings in OnboardingPage', async () => {
    const fixture = makeFixture({ onboardingPageHardcoded: true });
    try {
      const result = await runI18nCheck('app-shell:onboarding', { rootDir: fixture.rootDir, windowDir: fixture.rootDir });
      assert.equal(result.status, 'fail');
      assert.match(result.detail, /OnboardingPage.jsx/);
      assert.match(result.detail, /Crear cuenta/);
    } finally {
      rmSync(fixture.rootDir, { recursive: true, force: true });
    }
  });

  it('app-shell:onboarding target catches hardcoded strings in onboarding helper modules', async () => {
    const fixture = makeFixture({ onboardingModuleHardcoded: true });
    try {
      const result = await runI18nCheck('app-shell:onboarding', { rootDir: fixture.rootDir, windowDir: fixture.rootDir });
      assert.equal(result.status, 'fail');
      assert.match(result.detail, /onboardingState.js/);
      assert.match(result.detail, /Preparando contexto/);
    } finally {
      rmSync(fixture.rootDir, { recursive: true, force: true });
    }
  });
});
