import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { explodeSnapshot } from '../src/migrations/explode-ad-snapshot.js';
import { listKeys, readEntry } from '../src/lib/ad-cache.js';

function withTmpDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'explode-snap-test-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('explode-ad-snapshot', () => {
  it('splits a monolith into per-query files and deletes the monolith', () => {
    withTmpDir((dir) => {
      const monolith = join(dir, 'ad-snapshot.json');
      const targetDir = join(dir, 'ad-snapshot');
      writeFileSync(monolith, JSON.stringify({
        k1: { sql: 'SELECT 1', params: [], rows: [{ a: 1 }] },
        k2: { sql: 'SELECT 2', params: ['x'], rows: [{ b: 2 }] },
      }), 'utf-8');

      const result = explodeSnapshot(monolith);
      assert.equal(result.exploded, 2);
      assert.equal(result.dir, targetDir);
      assert.equal(result.alreadyDone, false);
      assert.equal(existsSync(monolith), false, 'monolith must be deleted');
      assert.deepEqual(listKeys(targetDir), ['k1', 'k2']);
      assert.deepEqual(readEntry(targetDir, 'k2'), { sql: 'SELECT 2', params: ['x'], rows: [{ b: 2 }] });
    });
  });

  it('is idempotent: reports alreadyDone when the monolith is gone', () => {
    withTmpDir((dir) => {
      const monolith = join(dir, 'ad-snapshot.json');
      const result = explodeSnapshot(monolith);
      assert.equal(result.alreadyDone, true);
      assert.equal(result.exploded, 0);
    });
  });

  it('handles an empty monolith', () => {
    withTmpDir((dir) => {
      const monolith = join(dir, 'ad-snapshot.json');
      writeFileSync(monolith, '', 'utf-8');
      const result = explodeSnapshot(monolith);
      assert.equal(result.exploded, 0);
      assert.equal(result.alreadyDone, false);
      assert.equal(existsSync(monolith), false);
    });
  });

  it('rejects a non-.json path', () => {
    assert.throws(() => explodeSnapshot('/tmp/ad-snapshot'), /expected a \.json path/);
  });
});
