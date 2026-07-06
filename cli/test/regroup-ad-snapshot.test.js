import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { regroupSnapshot } from '../src/migrations/regroup-ad-snapshot.js';
import {
  sqlKey,
  listSqlKeys,
  listVersions,
  readVersion,
  writeSqlFile,
} from '../src/lib/ad-cache.js';

function withTmpDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'regroup-snap-test-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Write an OLD per-(sql,params) file `<name>.json` = { sql, params, rows }. */
function writeOldEntry(dir, name, entry) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name + '.json'), JSON.stringify(entry, null, 2) + '\n', 'utf-8');
}

describe('regroup-ad-snapshot: from monolith', () => {
  it('groups a monolith by SQL and deletes it', () => {
    withTmpDir((dir) => {
      const monolith = join(dir, 'ad-snapshot.json');
      const targetDir = join(dir, 'ad-snapshot');
      const SQL = 'SELECT * FROM AD_Tab WHERE AD_Window_ID = $1';
      writeFileSync(monolith, JSON.stringify({
        k1: { sql: SQL, params: ['143'], rows: [{ t: 'Order' }] },
        k2: { sql: SQL, params: ['800'], rows: [{ t: 'Invoice' }] },
        k3: { sql: 'SELECT 1', params: [], rows: [{ a: 1 }] },
      }), 'utf-8');

      const r = regroupSnapshot(monolith);
      assert.equal(r.versions, 3);
      assert.equal(r.files, 2, 'two distinct SQL → two files');
      assert.equal(r.monolithRemoved, true);
      assert.equal(r.dir, targetDir);
      assert.equal(existsSync(monolith), false, 'monolith must be deleted');

      assert.equal(listSqlKeys(targetDir).length, 2);
      assert.equal(listVersions(targetDir, sqlKey(SQL)).length, 2, 'two versions grouped');
      assert.deepEqual(readVersion(targetDir, SQL, ['800']).rows, [{ t: 'Invoice' }]);
      assert.deepEqual(readVersion(targetDir, 'SELECT 1', []).rows, [{ a: 1 }]);
    });
  });

  it('handles an empty monolith', () => {
    withTmpDir((dir) => {
      const monolith = join(dir, 'ad-snapshot.json');
      writeFileSync(monolith, '', 'utf-8');
      const r = regroupSnapshot(monolith);
      assert.equal(r.versions, 0);
      assert.equal(r.files, 0);
      assert.equal(existsSync(monolith), false);
    });
  });
});

describe('regroup-ad-snapshot: from per-(sql,params) directory', () => {
  it('collapses many per-query files into grouped files and removes the old ones', () => {
    withTmpDir((base) => {
      const dir = join(base, 'ad-snapshot');
      const SQL = 'SELECT * FROM AD_Tab WHERE AD_Window_ID = $1';
      writeOldEntry(dir, 'aaa', { sql: SQL, params: ['143'], rows: [{ t: 'Order' }] });
      writeOldEntry(dir, 'bbb', { sql: SQL, params: ['800'], rows: [{ t: 'Invoice' }] });
      writeOldEntry(dir, 'ccc', { sql: 'SELECT 1', params: [], rows: [{ a: 1 }] });

      const r = regroupSnapshot(dir);
      assert.equal(r.versions, 3);
      assert.equal(r.files, 2);
      assert.equal(r.removedOldFiles, 3, 'the three old per-query files were removed');

      // Old files gone, grouped files present.
      assert.equal(existsSync(join(dir, 'aaa.json')), false);
      assert.equal(existsSync(join(dir, 'bbb.json')), false);
      assert.equal(listSqlKeys(dir).length, 2);
      assert.equal(listVersions(dir, sqlKey(SQL)).length, 2);
      assert.deepEqual(readVersion(dir, SQL, ['143']).rows, [{ t: 'Order' }]);
    });
  });
});

describe('regroup-ad-snapshot: idempotency', () => {
  it('re-running on an already-grouped directory changes nothing', () => {
    withTmpDir((base) => {
      const dir = join(base, 'ad-snapshot');
      const SQL = 'SELECT $1';
      writeSqlFile(dir, sqlKey(SQL), {
        sql: SQL,
        versions: {
          v1: { params: ['a'], rows: [{ v: 'a' }] },
          v2: { params: ['b'], rows: [{ v: 'b' }] },
        },
      });

      const r = regroupSnapshot(dir);
      assert.equal(r.alreadyDone, true);
      assert.equal(r.removedOldFiles, 0);
      assert.equal(r.monolithRemoved, false);
      // Content preserved.
      assert.equal(listSqlKeys(dir).length, 1);
      assert.deepEqual(readVersion(dir, SQL, ['a']).rows, [{ v: 'a' }]);
      assert.deepEqual(readVersion(dir, SQL, ['b']).rows, [{ v: 'b' }]);
    });
  });

  it('merges a mixed directory (old per-query + already grouped)', () => {
    withTmpDir((base) => {
      const dir = join(base, 'ad-snapshot');
      const SQL = 'SELECT * FROM AD_Tab WHERE AD_Window_ID = $1';
      // Already-grouped file with one version.
      writeSqlFile(dir, sqlKey(SQL), {
        sql: SQL,
        versions: { v1: { params: ['143'], rows: [{ t: 'Order' }] } },
      });
      // An old per-query file for another param of the same SQL.
      writeOldEntry(dir, 'old-800', { sql: SQL, params: ['800'], rows: [{ t: 'Invoice' }] });

      const r = regroupSnapshot(dir);
      assert.equal(r.removedOldFiles, 1);
      assert.equal(listSqlKeys(dir).length, 1, 'both merge into one SQL file');
      assert.equal(listVersions(dir, sqlKey(SQL)).length, 2);
      assert.deepEqual(readVersion(dir, SQL, ['143']).rows, [{ t: 'Order' }]);
      assert.deepEqual(readVersion(dir, SQL, ['800']).rows, [{ t: 'Invoice' }]);
    });
  });
});

describe('regroup-ad-snapshot: path handling', () => {
  it('maps a .json path with no file behind it to its directory', () => {
    withTmpDir((base) => {
      const dir = join(base, 'ad-snapshot');
      writeOldEntry(dir, 'x', { sql: 'SELECT 1', params: [], rows: [] });
      // Pass the ".json" sibling that does not exist as a file.
      const r = regroupSnapshot(join(base, 'ad-snapshot.json'));
      assert.equal(r.dir, dir);
      assert.equal(r.files, 1);
    });
  });

  it('throws without a path', () => {
    assert.throws(() => regroupSnapshot(), /a path is required/);
  });
});
