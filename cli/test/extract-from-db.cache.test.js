import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
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
import { cacheKey, entryPath, listKeys, readEntry } from '../src/lib/ad-cache.js';

/**
 * These tests exercise the per-query file cache wiring in cli/src/db.js
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

describe('extract cache: write mode produces per-query files', () => {
  it('records every query and flushes one deterministic file per key', async () => {
    setCacheMode({ mode: 'write', path: cacheDir });
    const pool = wrapPoolWithCache(fakePool((sql, params) => {
      if (sql.includes('AD_Window')) return [{ id: params[0], name: 'Sales Order' }];
      if (sql.includes('AD_Tab')) return [{ tab: 'Header' }, { tab: 'Lines' }];
      return [];
    }));

    await pool.query('SELECT * FROM AD_Window WHERE AD_Window_ID = $1', ['143']);
    await pool.query('SELECT * FROM AD_Tab WHERE AD_Window_ID = $1', ['143']);

    const { written, path, pruned } = flushCacheWrites();
    assert.equal(written, 2);
    assert.equal(path, cacheDir);
    assert.equal(pruned, 0, 'sweep is off by default');
    assert.equal(listKeys(cacheDir).length, 2);

    // Verify one file per key, named after cacheKey().
    const k1 = cacheKey('SELECT * FROM AD_Window WHERE AD_Window_ID = $1', ['143']);
    assert.ok(existsSync(entryPath(cacheDir, k1)), 'window query file must exist');
    assert.deepEqual(readEntry(cacheDir, k1).rows, [{ id: '143', name: 'Sales Order' }]);
  });

  it('maps a legacy .json SF_CACHE_PATH to its directory', async () => {
    const legacyPath = join(tmp, 'ad-snapshot.json');
    setCacheMode({ mode: 'write', path: legacyPath });
    assert.equal(getCacheMode().path, cacheDir, '.json path resolves to the sibling dir');
    const pool = wrapPoolWithCache(fakePool(() => [{ x: 1 }]));
    await pool.query('SELECT 1', []);
    flushCacheWrites();
    assert.equal(existsSync(legacyPath), false, 'no monolithic file is created');
    assert.equal(listKeys(cacheDir).length, 1);
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

  it('serves the same key across whitespace-different SQL', async () => {
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
});

describe('extract cache: gated sweep', () => {
  it('is disabled by default: orphan files survive a flush', async () => {
    // Seed two files, then a fresh write run touches only one; without sweep,
    // the untouched file must remain.
    setCacheMode({ mode: 'write', path: cacheDir });
    let writer = wrapPoolWithCache(fakePool(() => [{ v: 'a' }]));
    await writer.query('SELECT 1', []);
    await writer.query('SELECT 2', []);
    flushCacheWrites();
    assert.equal(listKeys(cacheDir).length, 2);

    setCacheMode({ mode: 'write', path: cacheDir }); // sweep NOT enabled
    writer = wrapPoolWithCache(fakePool(() => [{ v: 'b' }]));
    await writer.query('SELECT 1', []);
    const { pruned } = flushCacheWrites();
    assert.equal(pruned, 0);
    assert.equal(listKeys(cacheDir).length, 2, 'orphan must survive without sweep');
  });

  it('when enabled, deletes only untouched keys and keeps touched ones', async () => {
    // Seed three files.
    setCacheMode({ mode: 'write', path: cacheDir });
    let writer = wrapPoolWithCache(fakePool(() => [{ v: 1 }]));
    await writer.query('SELECT 1', []);
    await writer.query('SELECT 2', []);
    await writer.query('SELECT 3', []);
    flushCacheWrites();
    assert.equal(listKeys(cacheDir).length, 3);

    // Fresh run with sweep on touches only two of the three.
    setCacheMode({ mode: 'write', path: cacheDir, sweep: true });
    writer = wrapPoolWithCache(fakePool(() => [{ v: 2 }]));
    await writer.query('SELECT 1', []);
    await writer.query('SELECT 2', []);
    const { pruned } = flushCacheWrites();

    assert.equal(pruned, 1, 'the untouched key must be pruned');
    const remaining = listKeys(cacheDir);
    assert.equal(remaining.length, 2);
    assert.ok(remaining.includes(cacheKey('SELECT 1', [])));
    assert.ok(remaining.includes(cacheKey('SELECT 2', [])));
    assert.ok(!remaining.includes(cacheKey('SELECT 3', [])));
  });

  it('read-mode touches count toward the swept set', async () => {
    setCacheMode({ mode: 'write', path: cacheDir });
    let writer = wrapPoolWithCache(fakePool(() => [{ v: 1 }]));
    await writer.query('SELECT 1', []);
    await writer.query('SELECT 2', []);
    flushCacheWrites();

    // A read run that reads only key 1, then an explicit sweepCache().
    setCacheMode({ mode: 'read', path: cacheDir, sweep: true });
    const reader = createDbPool();
    await reader.query('SELECT 1', []);
    const { pruned, prunedKeys } = sweepCache();
    assert.equal(pruned, 1);
    assert.deepEqual(prunedKeys, [cacheKey('SELECT 2', [])]);
    assert.deepEqual(listKeys(cacheDir), [cacheKey('SELECT 1', [])]);
  });

  it('SF_CACHE_SWEEP=1 env enables the sweep by default', async () => {
    const prev = process.env.SF_CACHE_SWEEP;
    process.env.SF_CACHE_SWEEP = '1';
    try {
      setCacheMode({ mode: 'write', path: cacheDir });
      assert.equal(getCacheMode().sweep, true);
      const writer = wrapPoolWithCache(fakePool(() => [{ v: 1 }]));
      await writer.query('SELECT keep', []);
      // Pre-seed an orphan file directly.
      const orphanKey = cacheKey('SELECT gone', []);
      const { writeEntry } = await import('../src/lib/ad-cache.js');
      writeEntry(cacheDir, orphanKey, { sql: 'SELECT gone', params: [], rows: [] });
      const { pruned } = flushCacheWrites();
      assert.equal(pruned, 1);
      assert.ok(!listKeys(cacheDir).includes(orphanKey));
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
