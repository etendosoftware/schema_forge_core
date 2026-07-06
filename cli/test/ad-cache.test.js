import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  cacheKey,
  sqlKey,
  paramsKey,
  sqlFilePath,
  readSqlFile,
  writeSqlFile,
  readVersion,
  upsertVersion,
  listSqlKeys,
  listVersions,
  rowsChecksum,
} from '../src/lib/ad-cache.js';

function withTmpDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'ad-cache-test-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('ad-cache.cacheKey', () => {
  it('produces identical keys for identical (sql, params)', () => {
    const a = cacheKey('SELECT * FROM AD_Window WHERE AD_Window_ID = $1', ['143']);
    const b = cacheKey('SELECT * FROM AD_Window WHERE AD_Window_ID = $1', ['143']);
    assert.equal(a, b);
  });

  it('ignores whitespace differences in SQL', () => {
    const a = cacheKey('SELECT  *  FROM   AD_Window\nWHERE  AD_Window_ID  =  $1', ['143']);
    const b = cacheKey('SELECT * FROM AD_Window WHERE AD_Window_ID = $1', ['143']);
    assert.equal(a, b, 'whitespace-only differences must collapse to the same key');
  });

  it('distinguishes different params', () => {
    const a = cacheKey('SELECT $1', ['143']);
    const b = cacheKey('SELECT $1', ['144']);
    assert.notEqual(a, b);
  });

  it('respects param array order (positional placeholders)', () => {
    const a = cacheKey('SELECT $1, $2', ['x', 'y']);
    const b = cacheKey('SELECT $1, $2', ['y', 'x']);
    assert.notEqual(a, b);
  });
});

describe('ad-cache.sqlKey / paramsKey', () => {
  it('sqlKey depends on SQL only, not params', () => {
    assert.equal(
      sqlKey('SELECT * FROM AD_Window WHERE AD_Window_ID = $1'),
      sqlKey('SELECT  *  FROM AD_Window\nWHERE AD_Window_ID = $1'),
    );
    // Same SQL, different params → same file key.
    const q = 'SELECT $1';
    assert.equal(sqlKey(q), sqlKey(q));
  });

  it('paramsKey is order-sensitive but object-key-order-insensitive', () => {
    assert.notEqual(paramsKey(['x', 'y']), paramsKey(['y', 'x']));
    assert.equal(paramsKey([{ a: 1, b: 2 }]), paramsKey([{ b: 2, a: 1 }]));
    assert.equal(paramsKey(), paramsKey([]), 'missing params == empty array');
  });
});

describe('ad-cache.rowsChecksum', () => {
  it('is stable across key-order permutations of row objects', () => {
    const a = rowsChecksum([{ id: '1', name: 'Sales Order' }]);
    const b = rowsChecksum([{ name: 'Sales Order', id: '1' }]);
    assert.equal(a, b);
  });

  it('is stable across repeated calls with the same rows', () => {
    const rows = [{ id: '1' }, { id: '2' }];
    assert.equal(rowsChecksum(rows), rowsChecksum(rows));
  });

  it('changes when a value changes', () => {
    const a = rowsChecksum([{ id: '1', name: 'Sales Order' }]);
    const b = rowsChecksum([{ id: '1', name: 'Sales Invoice' }]);
    assert.notEqual(a, b);
  });

  it('changes when row order changes', () => {
    const a = rowsChecksum([{ id: '1' }, { id: '2' }]);
    const b = rowsChecksum([{ id: '2' }, { id: '1' }]);
    assert.notEqual(a, b, 'row order is meaningful data, checksum must not ignore it');
  });

  it('treats missing rows as an empty array', () => {
    assert.equal(rowsChecksum(), rowsChecksum([]));
  });
});

describe('ad-cache.sqlFilePath', () => {
  it('joins the dir and the sqlKey with a .json suffix', () => {
    assert.equal(sqlFilePath('/tmp/snap', 'abc123'), join('/tmp/snap', 'abc123.json'));
  });
});

describe('ad-cache.readSqlFile', () => {
  it('returns null when the file does not exist', () => {
    withTmpDir((dir) => {
      assert.equal(readSqlFile(dir, 'missing'), null);
    });
  });

  it('returns null when the directory does not exist', () => {
    const dir = join(tmpdir(), 'definitely-not-here-' + Date.now());
    assert.equal(readSqlFile(dir, 'k'), null);
  });

  it('returns null for an empty file', () => {
    withTmpDir((dir) => {
      writeFileSync(sqlFilePath(dir, 'empty'), '', 'utf-8');
      assert.equal(readSqlFile(dir, 'empty'), null);
    });
  });

  it('normalizes a file missing the versions map to an empty one', () => {
    withTmpDir((dir) => {
      writeFileSync(sqlFilePath(dir, 'noversions'), JSON.stringify({ sql: 'x' }), 'utf-8');
      assert.deepEqual(readSqlFile(dir, 'noversions'), { sql: 'x', versions: {} });
    });
  });

  it('throws on malformed JSON (loud, not silent)', () => {
    withTmpDir((dir) => {
      writeFileSync(sqlFilePath(dir, 'bad'), '{not json', 'utf-8');
      assert.throws(() => readSqlFile(dir, 'bad'), /JSON/);
    });
  });
});

describe('ad-cache.upsertVersion / readVersion', () => {
  it('round-trips a single version', () => {
    withTmpDir((dir) => {
      const sql = 'SELECT $1';
      const rows = [{ id: '9', name: 'X' }];
      upsertVersion(dir, sql, ['9'], rows);
      assert.deepEqual(readVersion(dir, sql, ['9']), {
        sql: 'SELECT $1',
        params: ['9'],
        rows,
        checksum: rowsChecksum(rows),
      });
    });
  });

  it('persists a checksum matching rowsChecksum(rows)', () => {
    withTmpDir((dir) => {
      const sql = 'SELECT $1';
      const rows = [{ id: '1', name: 'Sales Order' }, { id: '2', name: 'Sales Invoice' }];
      upsertVersion(dir, sql, ['w'], rows);
      const version = readVersion(dir, sql, ['w']);
      assert.equal(version.checksum, rowsChecksum(rows));
    });
  });

  it('groups many param versions into ONE file (per distinct SQL)', () => {
    withTmpDir((dir) => {
      const sql = 'SELECT * FROM AD_Tab WHERE AD_Window_ID = $1';
      upsertVersion(dir, sql, ['143'], [{ t: 'Order' }]);
      upsertVersion(dir, sql, ['800'], [{ t: 'Invoice' }]);
      upsertVersion(dir, sql, ['259'], [{ t: 'Product' }]);
      // Three versions, ONE file.
      assert.equal(listSqlKeys(dir).length, 1);
      assert.equal(listVersions(dir, sqlKey(sql)).length, 3);
    });
  });

  it('MERGE semantics: upserting one version never drops the others', () => {
    withTmpDir((dir) => {
      const sql = 'SELECT $1';
      upsertVersion(dir, sql, ['a'], [{ v: 'a' }]);
      upsertVersion(dir, sql, ['b'], [{ v: 'b' }]);
      // Re-write version 'a' with new rows; 'b' must survive.
      upsertVersion(dir, sql, ['a'], [{ v: 'a2' }]);
      assert.deepEqual(readVersion(dir, sql, ['a']).rows, [{ v: 'a2' }]);
      assert.deepEqual(readVersion(dir, sql, ['b']).rows, [{ v: 'b' }]);
    });
  });

  it('readVersion returns null when the file exists but the version is missing', () => {
    withTmpDir((dir) => {
      const sql = 'SELECT $1';
      upsertVersion(dir, sql, ['a'], [{ v: 'a' }]);
      assert.equal(readVersion(dir, sql, ['MISSING']), null);
    });
  });

  it('readVersion returns null when the file is missing entirely', () => {
    withTmpDir((dir) => {
      assert.equal(readVersion(dir, 'SELECT 1', []), null);
    });
  });

  it('serves the same file across whitespace-different SQL', () => {
    withTmpDir((dir) => {
      upsertVersion(dir, 'SELECT  *  FROM\n AD_Window WHERE id = $1', ['9'], [{ x: 1 }]);
      assert.deepEqual(
        readVersion(dir, 'SELECT * FROM AD_Window WHERE id = $1', ['9']).rows,
        [{ x: 1 }],
      );
    });
  });
});

describe('ad-cache.writeSqlFile determinism', () => {
  it('sorts versions and deep-sorts row keys; pretty + trailing newline', () => {
    withTmpDir((dir) => {
      const sk = 'file1';
      writeSqlFile(dir, sk, {
        sql: 'q',
        versions: {
          zzz: { params: ['z'], rows: [{ zeta: 1, alpha: 2 }] },
          aaa: { params: ['a'], rows: [{ beta: 3, alpha: 4 }] },
        },
      });
      const first = readFileSync(sqlFilePath(dir, sk), 'utf-8');

      // Reordered input must serialize to identical bytes.
      writeSqlFile(dir, sk, {
        sql: 'q',
        versions: {
          aaa: { rows: [{ alpha: 4, beta: 3 }], params: ['a'] },
          zzz: { rows: [{ alpha: 2, zeta: 1 }], params: ['z'] },
        },
      });
      const second = readFileSync(sqlFilePath(dir, sk), 'utf-8');

      assert.equal(first, second, 'insertion order must not affect serialized bytes');
      assert.ok(second.endsWith('\n'), 'file must end with newline');
      assert.ok(second.includes('\n  '), 'file must be 2-space indented');
      // Version keys serialize in sorted order: aaa before zzz.
      assert.ok(second.indexOf('"aaa"') < second.indexOf('"zzz"'));
      // Top-level keys sorted: sql before versions.
      assert.ok(second.indexOf('"sql"') < second.indexOf('"versions"'));
    });
  });

  it('normalizes the stored sql text', () => {
    withTmpDir((dir) => {
      writeSqlFile(dir, 'f', { sql: 'SELECT   1\n  FROM t', versions: {} });
      assert.equal(readSqlFile(dir, 'f').sql, 'SELECT 1 FROM t');
    });
  });

  it('creates the directory if missing', () => {
    withTmpDir((base) => {
      const dir = join(base, 'nested', 'deeper');
      upsertVersion(dir, 'SELECT 1', [], []);
      assert.ok(existsSync(dir));
    });
  });
});

describe('ad-cache.listSqlKeys / listVersions', () => {
  it('listSqlKeys returns [] when the directory does not exist', () => {
    const dir = join(tmpdir(), 'definitely-not-here-' + Date.now());
    assert.deepEqual(listSqlKeys(dir), []);
  });

  it('listSqlKeys lists file keys, sorted, ignoring non-json', () => {
    withTmpDir((dir) => {
      writeSqlFile(dir, 'zeta', { sql: 'a', versions: {} });
      writeSqlFile(dir, 'alpha', { sql: 'b', versions: {} });
      writeFileSync(join(dir, 'README.txt'), 'not a cache file', 'utf-8');
      mkdirSync(join(dir, 'subdir'));
      assert.deepEqual(listSqlKeys(dir), ['alpha', 'zeta']);
    });
  });

  it('listVersions returns sorted paramsKeys, [] when file is missing', () => {
    withTmpDir((dir) => {
      const sql = 'SELECT $1';
      assert.deepEqual(listVersions(dir, sqlKey(sql)), []);
      upsertVersion(dir, sql, ['a'], []);
      upsertVersion(dir, sql, ['b'], []);
      const keys = listVersions(dir, sqlKey(sql));
      assert.equal(keys.length, 2);
      assert.deepEqual(keys, [...keys].sort((x, y) => x.localeCompare(y)));
    });
  });
});
