import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runImportsCheck } from '../src/quality-gate/checks/imports.js';

function makeWindowDir() {
  const rootDir = mkdtempSync(join(tmpdir(), 'quality-gate-imports-'));
  const windowDir = join(rootDir, 'artifacts', 'sales-order');
  const sourceDir = join(windowDir, 'generated', 'web', 'sales-order');
  mkdirSync(sourceDir, { recursive: true });
  return { rootDir, windowDir, sourceDir };
}

describe('runImportsCheck', () => {
  it('passes when every relative import resolves to a real file', async () => {
    const { rootDir, windowDir, sourceDir } = makeWindowDir();

    try {
      writeFileSync(join(sourceDir, 'helpers.js'), 'export const answer = 42;');
      writeFileSync(
        join(sourceDir, 'SalesOrderPage.jsx'),
        "import { answer } from './helpers';\nexport default function SalesOrderPage() { return <div>{answer}</div>; }",
      );

      const result = await runImportsCheck('sales-order', { rootDir, windowDir });
      assert.deepEqual(result, { status: 'pass', detail: 'Resolved 1 relative import(s).' });
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('fails when a relative import cannot be resolved', async () => {
    const { rootDir, windowDir, sourceDir } = makeWindowDir();

    try {
      writeFileSync(
        join(sourceDir, 'Broken.jsx'),
        "import MissingThing from './missing';\nexport default function Broken() { return <div />; }",
      );

      const result = await runImportsCheck('sales-order', { rootDir, windowDir });
      assert.equal(result.status, 'fail');
      assert.match(result.detail, /\.\/missing/);
      assert.match(result.detail, /Broken\.jsx:1/);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('ignores bare specifiers', async () => {
    const { rootDir, windowDir, sourceDir } = makeWindowDir();

    try {
      writeFileSync(
        join(sourceDir, 'SalesOrderPage.jsx'),
        "import React from 'react';\nimport { Button } from '@/components/ui/button';\nexport default function SalesOrderPage() { return <Button />; }",
      );

      const result = await runImportsCheck('sales-order', { rootDir, windowDir });
      assert.deepEqual(result, { status: 'pass', detail: 'Resolved 0 relative import(s).' });
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('checks onboarding target relative imports outside generated artifacts', async () => {
    const { rootDir, windowDir } = makeWindowDir();
    const onboardingDir = join(rootDir, 'tools', 'app-shell', 'src', 'pages', 'onboarding');

    try {
      mkdirSync(onboardingDir, { recursive: true });
      writeFileSync(join(onboardingDir, 'helpers.js'), 'export const answer = 42;');
      writeFileSync(
        join(onboardingDir, 'onboardingState.js'),
        "import { answer } from './helpers';\nexport const STEP = answer;",
      );

      const result = await runImportsCheck('app-shell:onboarding', { rootDir, windowDir });
      assert.deepEqual(result, { status: 'pass', detail: 'Resolved 1 relative import(s).' });
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});