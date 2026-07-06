import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createDbPool,
  setCacheMode,
  getCacheMode,
  flushCacheWrites,
  sweepCache,
  wrapPoolWithCache,
} from '../src/db.js';
import { sqlKey, listSqlKeys, listVersions, readVersion } from '../src/lib/ad-cache.js';

/**
 * These tests exercise the grouped-by-SQL file cache wiring in cli/src/db.js
 * end-to-end without opening a real PostgreSQL connection. We use the cache
 * 'read' path (a pure stub pool) and the cache 'write' wrapper on a fake pool.
 *
 * Why not run the actual extractors? They issue DB queries; integration tests
 * for them would require a live AD database, which CI does not have. The cache
 * layer is the contract we care about — once it round-trips correctly, every
 * extractor benefits transparently.
 */

let tmp;
let cacheDir;

function fakePool(handler) {
  return {
    query: async (sql, params = []) => ({ rows: handler(sql, params), rowCount: 0 }),
    end: async () => {},
  };
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'extract-cache-test-'));
  cacheDir = join(tmp, 'ad-snapshot');
});

afterEach(() => {
  setCacheMode({ mode: 'off' });
  rmSync(tmp, { recursive: true, force: true });
});

describe('extract cache: write mode produces grouped files', () => {
  it('records every query and flushes one file per distinct SQL', async () => {
    setCacheMode({ mode: 'write', path: cacheDir });
    const pool = wrapPoolWithCache(fakePool((sql, params) => {
      if (sql.includes('AD_Window')) return [{ id: params[0], name: 'Sales Order' }];
      if (sql.includes('AD_Tab')) return [{ tab: 'Header' }, { tab: 'Lines' }];
      return [];
    }));

    await pool.query('SELECT * FROM AD_Window WHERE AD_Window_ID = $1', ['143']);
    await pool.query('SELECT * FROM AD_Tab WHERE AD_Window_ID = $1', ['143']);

    const { written, path, pruned } = flushCacheWrites();
    assert.equal(written, 2, 'two versions written');
    assert.equal(path, cacheDir);
    assert.equal(pruned, 0, 'sweep is off by default');
    assert.equal(listSqlKeys(cacheDir).length, 2, 'two distinct SQL → two files');

    assert.deepEqual(
      readVersion(cacheDir, 'SELECT * FROM AD_Window WHERE AD_Window_ID = $1', ['143']).rows,
      [{ id: '143', name: 'Sales Order' }],
    );
  });

  it('groups many param versions of the SAME SQL into ONE file', async () => {
    setCacheMode({ mode: 'write', path: cacheDir });
    const pool = wrapPoolWithCache(fakePool((sql, params) => [{ w: params[0] }]));
    const SQL = 'SELECT * FROM AD_Tab WHERE AD_Window_ID = $1';
    await pool.query(SQL, ['143']);
    await pool.query(SQL, ['800']);
    await pool.query(SQL, ['259']);
    const { written } = flushCacheWrites();

    assert.equal(written, 3, 'three versions written');
    assert.equal(listSqlKeys(cacheDir).length, 1, 'same SQL → single file');
    assert.equal(listVersions(cacheDir, sqlKey(SQL)).length, 3, 'three versions inside');
    assert.deepEqual(readVersion(cacheDir, SQL, ['800']).rows, [{ w: '800' }]);
  });

  it('merge-write preserves versions from a previous run in the same file', async () => {
    const SQL = 'SELECT * FROM AD_Tab WHERE AD_Window_ID = $1';
    setCacheMode({ mode: 'write', path: cacheDir });
    let pool = wrapPoolWithCache(fakePool((sql, params) => [{ w: params[0] }]));
    await pool.query(SQL, ['143']);
    flushCacheWrites();

    // Second run touches a different param version of the SAME SQL.
    setCacheMode({ mode: 'write', path: cacheDir });
    pool = wrapPoolWithCache(fakePool((sql, params) => [{ w: params[0] }]));
    await pool.query(SQL, ['800']);
    flushCacheWrites();

    // Both versions coexist in the one file (no drop).
    assert.equal(listVersions(cacheDir, sqlKey(SQL)).length, 2);
    assert.deepEqual(readVersion(cacheDir, SQL, ['143']).rows, [{ w: '143' }]);
    assert.deepEqual(readVersion(cacheDir, SQL, ['800']).rows, [{ w: '800' }]);
  });

  it('maps a legacy .json SF_CACHE_PATH to its directory', async () => {
    const legacyPath = join(tmp, 'ad-snapshot.json');
    setCacheMode({ mode: 'write', path: legacyPath });
    assert.equal(getCacheMode().path, cacheDir, '.json path resolves to the sibling dir');
    const pool = wrapPoolWithCache(fakePool(() => [{ x: 1 }]));
    await pool.query('SELECT 1', []);
    flushCacheWrites();
    assert.equal(existsSync(legacyPath), false, 'no monolithic file is created');
    assert.equal(listSqlKeys(cacheDir).length, 1);
  });
});

describe('extract cache: read mode reproduces results without DB', () => {
  it('produces identical row data from cache (golden compare)', async () => {
    setCacheMode({ mode: 'write', path: cacheDir });
    const writer = wrapPoolWithCache(fakePool((sql) => {
      if (sql.includes('AD_Window')) return [{ name: 'Sales Order' }];
      return [];
    }));
    const dbResult = await writer.query('SELECT * FROM AD_Window WHERE AD_Window_ID = $1', ['143']);
    flushCacheWrites();

    setCacheMode({ mode: 'read', path: cacheDir });
    const reader = createDbPool(); // returns the stub pool because mode=read
    const cachedResult = await reader.query(
      'SELECT * FROM AD_Window WHERE AD_Window_ID = $1',
      ['143'],
    );

    assert.deepEqual(cachedResult.rows, dbResult.rows);
    assert.equal(cachedResult.rowCount, dbResult.rows.length);
  });

  it('serves the same file across whitespace-different SQL', async () => {
    setCacheMode({ mode: 'write', path: cacheDir });
    const writer = wrapPoolWithCache(fakePool(() => [{ x: 1 }]));
    await writer.query('SELECT  *  FROM   AD_Window\nWHERE AD_Window_ID = $1', ['9']);
    flushCacheWrites();

    setCacheMode({ mode: 'read', path: cacheDir });
    const reader = createDbPool();
    const result = await reader.query('SELECT * FROM AD_Window WHERE AD_Window_ID = $1', ['9']);
    assert.deepEqual(result.rows, [{ x: 1 }]);
  });
});

describe('extract cache: read mode with empty cache fails hard', () => {
  it('throws CacheMissError with the failing key and refresh instruction', async () => {
    setCacheMode({ mode: 'read', path: cacheDir });
    const pool = createDbPool();
    await assert.rejects(
      () => pool.query('SELECT 1 FROM AD_Window', []),
      (err) => {
        assert.equal(err.name, 'CacheMissError');
        assert.equal(err.code, 'AD_CACHE_MISS');
        assert.match(err.message, /AD cache miss/);
        assert.match(err.message, /CACHE_DB=1/, 'message must hint at the refresh command');
        assert.match(err.message, /key:/);
        return true;
      },
    );
  });

  it('misses when the SQL file exists but the param version is absent', async () => {
    setCacheMode({ mode: 'write', path: cacheDir });
    const writer = wrapPoolWithCache(fakePool(() => [{ x: 1 }]));
    await writer.query('SELECT $1', ['known']);
    flushCacheWrites();

    setCacheMode({ mode: 'read', path: cacheDir });
    const reader = createDbPool();
    await assert.rejects(
      () => reader.query('SELECT $1', ['unknown-param']),
      (err) => err.code === 'AD_CACHE_MISS',
    );
  });
});

describe('extract cache: gated two-level sweep', () => {
  it('is disabled by default: orphan files survive a flush', async () => {
    setCacheMode({ mode: 'write', path: cacheDir });
    let writer = wrapPoolWithCache(fakePool(() => [{ v: 'a' }]));
    await writer.query('SELECT 1', []);
    await writer.query('SELECT 2', []);
    flushCacheWrites();
    assert.equal(listSqlKeys(cacheDir).length, 2);

    setCacheMode({ mode: 'write', path: cacheDir }); // sweep NOT enabled
    writer = wrapPoolWithCache(fakePool(() => [{ v: 'b' }]));
    await writer.query('SELECT 1', []);
    const { pruned } = flushCacheWrites();
    assert.equal(pruned, 0);
    assert.equal(listSqlKeys(cacheDir).length, 2, 'orphan must survive without sweep');
  });

  it('FILE level: deletes untouched SQL files, keeps touched ones', async () => {
    setCacheMode({ mode: 'write', path: cacheDir });
    let writer = wrapPoolWithCache(fakePool(() => [{ v: 1 }]));
    await writer.query('SELECT 1', []);
    await writer.query('SELECT 2', []);
    await writer.query('SELECT 3', []);
    flushCacheWrites();
    assert.equal(listSqlKeys(cacheDir).length, 3);

    setCacheMode({ mode: 'write', path: cacheDir, sweep: true });
    writer = wrapPoolWithCache(fakePool(() => [{ v: 2 }]));
    await writer.query('SELECT 1', []);
    await writer.query('SELECT 2', []);
    const { pruned } = flushCacheWrites();

    assert.equal(pruned, 1, 'the untouched SQL file must be pruned');
    const remaining = listSqlKeys(cacheDir);
    assert.equal(remaining.length, 2);
    assert.ok(remaining.includes(sqlKey('SELECT 1')));
    assert.ok(remaining.includes(sqlKey('SELECT 2')));
    assert.ok(!remaining.includes(sqlKey('SELECT 3')));
  });

  it('VERSION level: drops stale versions inside a touched file', async () => {
    const SQL = 'SELECT * FROM AD_Tab WHERE AD_Window_ID = $1';
    setCacheMode({ mode: 'write', path: cacheDir });
    let writer = wrapPoolWithCache(fakePool((sql, params) => [{ w: params[0] }]));
    await writer.query(SQL, ['143']);
    await writer.query(SQL, ['800']);
    await writer.query(SQL, ['259']);
    flushCacheWrites();
    assert.equal(listVersions(cacheDir, sqlKey(SQL)).length, 3);

    // Fresh run touches only two of the three versions.
    setCacheMode({ mode: 'write', path: cacheDir, sweep: true });
    writer = wrapPoolWithCache(fakePool((sql, params) => [{ w: params[0] }]));
    await writer.query(SQL, ['143']);
    await writer.query(SQL, ['800']);
    const { pruned } = flushCacheWrites();

    assert.equal(pruned, 1, 'one stale version pruned');
    const versions = listVersions(cacheDir, sqlKey(SQL));
    assert.equal(versions.length, 2);
    assert.equal(readVersion(cacheDir, SQL, ['259']), null, 'stale version gone');
    assert.ok(readVersion(cacheDir, SQL, ['143']), 'touched version kept');
  });

  it('deletes a file whose every version became stale', async () => {
    const SQL = 'SELECT $1';
    setCacheMode({ mode: 'write', path: cacheDir });
    let writer = wrapPoolWithCache(fakePool(() => [{ v: 1 }]));
    await writer.query(SQL, ['a']);
    await writer.query('SELECT keep', []);
    flushCacheWrites();

    // A run touches only 'SELECT keep'; the whole 'SELECT $1' file is emptied.
    setCacheMode({ mode: 'read', path: cacheDir, sweep: true });
    const reader = createDbPool();
    await reader.query('SELECT keep', []);
    const { pruned, prunedFiles } = sweepCache();
    assert.equal(pruned, 1);
    assert.equal(prunedFiles, 1);
    assert.deepEqual(listSqlKeys(cacheDir), [sqlKey('SELECT keep')]);
  });

  it('read-mode touches count toward the swept set', async () => {
    setCacheMode({ mode: 'write', path: cacheDir });
    let writer = wrapPoolWithCache(fakePool(() => [{ v: 1 }]));
    await writer.query('SELECT 1', []);
    await writer.query('SELECT 2', []);
    flushCacheWrites();

    setCacheMode({ mode: 'read', path: cacheDir, sweep: true });
    const reader = createDbPool();
    await reader.query('SELECT 1', []);
    const { pruned, prunedFileKeys } = sweepCache();
    assert.equal(pruned, 1);
    assert.deepEqual(prunedFileKeys, [sqlKey('SELECT 2')]);
    assert.deepEqual(listSqlKeys(cacheDir), [sqlKey('SELECT 1')]);
  });

  it('SF_CACHE_SWEEP=1 env enables the sweep by default', async () => {
    const prev = process.env.SF_CACHE_SWEEP;
    process.env.SF_CACHE_SWEEP = '1';
    try {
      setCacheMode({ mode: 'write', path: cacheDir });
      assert.equal(getCacheMode().sweep, true);
      const writer = wrapPoolWithCache(fakePool(() => [{ v: 1 }]));
      await writer.query('SELECT keep', []);
      // Pre-seed an orphan file directly (grouped layout).
      const { upsertVersion } = await import('../src/lib/ad-cache.js');
      upsertVersion(cacheDir, 'SELECT gone', [], []);
      const { pruned } = flushCacheWrites();
      assert.equal(pruned, 1);
      assert.ok(!listSqlKeys(cacheDir).includes(sqlKey('SELECT gone')));
    } finally {
      if (prev === undefined) delete process.env.SF_CACHE_SWEEP;
      else process.env.SF_CACHE_SWEEP = prev;
    }
  });
});

describe('extract cache: default behavior is untouched', () => {
  it('does not read or write the cache when no flag is set', async () => {
    setCacheMode({ mode: 'off' });
    assert.equal(existsSync(cacheDir), false, 'no cache dir pre-test');

    const pool = wrapPoolWithCache(fakePool(() => [{ id: 1 }]));
    const result = await pool.query('SELECT 1', []);
    assert.deepEqual(result.rows, [{ id: 1 }]);

    const flushResult = flushCacheWrites();
    assert.equal(flushResult.written, 0);
    assert.equal(existsSync(cacheDir), false, 'no cache dir post-test');
  });

  it('createDbPool with config returns a real pg.Pool (not the read stub) when mode=off', () => {
    setCacheMode({ mode: 'off' });
    const pool = createDbPool({
      host: 'localhost', port: 5432,
      user: 'u', password: 'p', database: 'd',
    });
    assert.equal(pool.__cacheRead, undefined, 'must NOT be the cache stub');
    assert.equal(typeof pool.query, 'function');
    pool.end();
  });
});

describe('extract cache: write+read are mutually exclusive at the CLI level', () => {
  it('setCacheMode rejects unknown modes', () => {
    assert.throws(() => setCacheMode({ mode: 'both' }), /invalid mode/);
  });
});
