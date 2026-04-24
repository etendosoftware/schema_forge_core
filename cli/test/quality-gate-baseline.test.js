import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveBaseline } from '../src/quality-gate/baseline.js';

describe('resolveBaseline', () => {
  it('reuses a cached baseline when present', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'quality-gate-baseline-'));
    const cacheDir = join(rootDir, '.quality-gate-cache');
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(
      join(cacheDir, 'main-sha123-config-hash456.json'),
      JSON.stringify({ windows: [{ window: 'sales-order', score: { passed: 2, total: 2 } }] }, null, 2),
    );

    let computed = false;

    try {
      const result = await resolveBaseline({
        baselineRef: 'origin/main',
        cacheDir,
        configHash: 'config-hash456',
        resolveRefSha: async () => 'main-sha123',
        computeBaseline: async () => {
          computed = true;
          return { windows: [] };
        },
      });

      assert.equal(computed, false);
      assert.equal(result.source, 'cache');
      assert.equal(result.data.windows[0].window, 'sales-order');
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('falls back gracefully when baseline computation fails', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'quality-gate-baseline-'));

    try {
      const result = await resolveBaseline({
        baselineRef: 'origin/main',
        cacheDir: join(rootDir, '.quality-gate-cache'),
        configHash: 'config-hash456',
        resolveRefSha: async () => 'main-sha123',
        computeBaseline: async () => {
          throw new Error('worktree add failed');
        },
      });

      assert.equal(result.data, null);
      assert.equal(result.source, 'unavailable');
      assert.match(result.warning, /worktree add failed/);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
