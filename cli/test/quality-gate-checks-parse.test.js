import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runParseCheck } from '../src/quality-gate/checks/parse.js';

function makeWindowDir() {
  const rootDir = mkdtempSync(join(tmpdir(), 'quality-gate-parse-'));
  const windowDir = join(rootDir, 'artifacts', 'sales-order');
  mkdirSync(join(windowDir, 'generated', 'web', 'sales-order'), { recursive: true });
  return { rootDir, windowDir };
}

describe('runParseCheck', () => {
  it('passes when every generated JSX file parses', async () => {
    const { rootDir, windowDir } = makeWindowDir();

    try {
      writeFileSync(
        join(windowDir, 'generated', 'web', 'sales-order', 'SalesOrderPage.jsx'),
        'export default function SalesOrderPage() { return <section>Ready</section>; }',
      );

      const result = await runParseCheck('sales-order', { rootDir, windowDir });
      assert.deepEqual(result, { status: 'pass', detail: 'Parsed 1 generated source file(s).' });
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('fails with file context when a generated JSX file is invalid', async () => {
    const { rootDir, windowDir } = makeWindowDir();

    try {
      writeFileSync(
        join(windowDir, 'generated', 'web', 'sales-order', 'Broken.jsx'),
        'export default function Broken() { return <section>oops</div>; }',
      );

      const result = await runParseCheck('sales-order', { rootDir, windowDir });
      assert.equal(result.status, 'fail');
      assert.match(result.detail, /Broken\.jsx/);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('skips windows without generated source files', async () => {
    const { rootDir, windowDir } = makeWindowDir();

    try {
      const result = await runParseCheck('sales-order', { rootDir, windowDir });
      assert.deepEqual(result, { status: 'skip', detail: 'No generated .js or .jsx files found.' });
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
