import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runI18nCheck } from '../src/quality-gate/checks/i18n.js';

function makeFixture({ missingColumn = false, hardcoded = false, allowlisted = false, sharedHardcoded = false, aliasHardcoded = false } = {}) {
  const rootDir = mkdtempSync(join(tmpdir(), 'quality-gate-i18n-'));
  const windowDir = join(rootDir, 'artifacts', 'sales-order');
  const appCustomDir = join(rootDir, 'tools', 'app-shell', 'src', 'windows', 'custom');
  mkdirSync(join(windowDir, 'custom'), { recursive: true });
  mkdirSync(join(appCustomDir, 'sales-order'), { recursive: true });
  mkdirSync(join(appCustomDir, 'shared'), { recursive: true });
  mkdirSync(join(appCustomDir, 'businessPartner'), { recursive: true });

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
});
