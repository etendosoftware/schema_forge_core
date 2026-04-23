import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInvariantsCheck } from '../src/quality-gate/checks/invariants.js';

function buildFixture({ withViolations = false } = {}) {
  const rootDir = mkdtempSync(join(tmpdir(), 'quality-gate-invariants-'));
  const windowDir = join(rootDir, 'artifacts', 'sales-order');
  const generatedDir = join(windowDir, 'generated', 'web', 'sales-order');
  mkdirSync(generatedDir, { recursive: true });
  mkdirSync(join(rootDir, 'tools', 'app-shell', 'src', 'windows', 'custom', 'sales-order'), { recursive: true });

  const contract = {
    frontendContract: {
      window: {
        primaryEntity: 'header',
        headerExtra: {
          customForm: withViolations ? 'MissingPanel' : 'ExistingPanel',
        },
      },
      entities: {
        header: {
          draftMode: { enabled: true },
          fields: [
            {
              name: 'documentNo',
              form: true,
              visibility: 'editable',
              required: true,
              sourceRequired: true,
              readOnlyLogic: withViolations ? undefined : { raw: "@Processed@='Y'" },
            },
          ],
        },
        lines: {
          fields: [
            {
              name: 'product',
              required: true,
              lookup: withViolations ? false : true,
              sourceRequired: true,
            },
            {
              name: 'priceList',
              required: withViolations ? false : true,
              sourceRequired: true,
              derivation: withViolations ? undefined : { type: 'fromParent', source: 'header.priceList' },
            },
          ],
        },
      },
    },
  };

  const addLineFieldsBlock = withViolations
    ? `const addLineFields = {\n  entry: [\n    { key: 'product', lookup: false },\n    { key: 'quantity' },\n  ],\n  hidden: ['grossUnitPrice'],\n};\n`
    : `const addLineFields = {\n  entry: [\n    { key: 'product', lookup: true },\n    { key: 'quantity', defaultValue: 1 },\n  ],\n  hidden: ['grossUnitPrice', 'priceList'],\n};\n`;

  writeFileSync(join(windowDir, 'contract.json'), JSON.stringify(contract, null, 2));
  writeFileSync(join(generatedDir, 'SalesOrderPage.jsx'), addLineFieldsBlock);
  if (!withViolations) {
    writeFileSync(
      join(rootDir, 'tools', 'app-shell', 'src', 'windows', 'custom', 'sales-order', 'ExistingPanel.jsx'),
      'export default function ExistingPanel() { return null; }',
    );
  }

  return { rootDir, windowDir };
}

describe('runInvariantsCheck', () => {
  it('passes when contract and generated page satisfy the invariants', async () => {
    const { rootDir, windowDir } = buildFixture();

    try {
      const result = await runInvariantsCheck('sales-order', {
        rootDir,
        windowDir,
        config: {
          invariants: {
            addLineFields: {
              requiredProductLookup: true,
              quantityDefaultOne: true,
              hiddenContainsGrossUnitPriceAndPriceList: true,
            },
            draftModeReadOnlyLogic: true,
            notNullRequiresRequired: true,
            customFormPathRoot: '@/windows/custom/',
          },
        },
      });

      assert.deepEqual(result, { status: 'pass', detail: 'All invariants satisfied.' });
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('fails and enumerates invariant violations', async () => {
    const { rootDir, windowDir } = buildFixture({ withViolations: true });

    try {
      const result = await runInvariantsCheck('sales-order', {
        rootDir,
        windowDir,
        config: {
          invariants: {
            addLineFields: {
              requiredProductLookup: true,
              quantityDefaultOne: true,
              hiddenContainsGrossUnitPriceAndPriceList: true,
            },
            draftModeReadOnlyLogic: true,
            notNullRequiresRequired: true,
            customFormPathRoot: '@/windows/custom/',
          },
        },
      });

      assert.equal(result.status, 'fail');
      assert.match(result.detail, /documentNo/);
      assert.match(result.detail, /product/);
      assert.match(result.detail, /quantity/);
      assert.match(result.detail, /priceList/);
      assert.match(result.detail, /MissingPanel/);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
