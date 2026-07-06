import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import pg from 'pg';
import {
  setCacheMode,
  getCacheMode,
  createDbPool,
  wrapPoolWithCache,
  getCacheDrift,
  reportCacheDrift,
} from '../src/db.js';
import { upsertVersion, rowsChecksum } from '../src/lib/ad-cache.js';

/**
 * Stale-cache detection (ETP-4439): on an 'off'-mode (real DB) run, every
 * query result whose (sql, params) also exists in the on-disk cache gets its
 * fresh checksum compared against the cached one. A mismatch means the
 * on-disk snapshot no longer reflects the real DB — flagged as "drift" and
 * reported once via a lazily-installed `process.once('exit', ...)` handler.
 *
 * These tests exercise the passive comparison + accumulator directly
 * (getCacheDrift()/reportCacheDrift()) rather than relying on the actual
 * process exit event, since triggering a real process exit inside a test
 * runner is impractical. The exit-handler wiring itself is a thin,
 * side-effect-free registration (see installExitDriftReporter in db.js) — the
 * comparison logic it defers to is what these tests verify.
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
  tmp = mkdtempSync(join(tmpdir(), 'cache-drift-test-'));
  cacheDir = join(tmp, 'ad-snapshot');
});

afterEach(() => {
  setCacheMode({ mode: 'off' });
  rmSync(tmp, { recursive: true, force: true });
});

const SQL = 'SELECT * FROM AD_Window WHERE AD_Window_ID = $1';

describe('cache drift: detects a stale cache on a real-DB (off-mode) run', () => {
  it('flags drift when the fresh result differs from the cached checksum', async () => {
    // Seed the cache with rows A.
    upsertVersion(cacheDir, SQL, ['143'], [{ id: '143', name: 'Sales Order' }]);

    // Real DB (fakePool) now returns different rows B for the same (sql, params).
    setCacheMode({ mode: 'off', path: cacheDir });
    const pool = wrapPoolWithCache(fakePool(() => [{ id: '143', name: 'Sales Order RENAMED' }]));
    await pool.query(SQL, ['143']);

    assert.equal(getCacheDrift().length, 1);
    assert.equal(getCacheDrift()[0].sql, SQL);
    assert.equal(reportCacheDrift(), 1);
  });

  it('reports no drift when the fresh result matches the cached rows', async () => {
    const rows = [{ id: '143', name: 'Sales Order' }];
    upsertVersion(cacheDir, SQL, ['143'], rows);

    setCacheMode({ mode: 'off', path: cacheDir });
    const pool = wrapPoolWithCache(fakePool(() => [{ id: '143', name: 'Sales Order' }]));
    await pool.query(SQL, ['143']);

    assert.equal(getCacheDrift().length, 0);
    assert.equal(reportCacheDrift(), 0);
  });

  it('is order-insensitive to row-object key order but detects real changes', async () => {
    // Cached rows had keys in a different order than the fresh result — must NOT
    // be flagged as drift (rowsChecksum sorts object keys deeply).
    upsertVersion(cacheDir, SQL, ['143'], [{ name: 'Sales Order', id: '143' }]);

    setCacheMode({ mode: 'off', path: cacheDir });
    const pool = wrapPoolWithCache(fakePool(() => [{ id: '143', name: 'Sales Order' }]));
    await pool.query(SQL, ['143']);

    assert.equal(getCacheDrift().length, 0, 'key-order differences alone are not drift');
  });

  it('does not flag a query that has no cached version (a MISS, not a stale hit)', async () => {
    setCacheMode({ mode: 'off', path: cacheDir });
    const pool = wrapPoolWithCache(fakePool(() => [{ id: '999' }]));
    await pool.query('SELECT * FROM AD_Tab WHERE AD_Window_ID = $1', ['999']);

    assert.equal(getCacheDrift().length, 0);
  });

  it('never throws even when the cache directory does not exist at all', async () => {
    setCacheMode({ mode: 'off', path: join(tmp, 'does-not-exist') });
    const pool = wrapPoolWithCache(fakePool(() => [{ id: '1' }]));
    await assert.doesNotReject(() => pool.query(SQL, ['1']));
    assert.equal(getCacheDrift().length, 0);
  });

  it('handles a legacy cached version with no stored checksum', async () => {
    // Simulate a pre-checksum cache file by seeding one, then stripping the
    // checksum field the way an older cache write would have left it.
    const rows = [{ id: '143', name: 'Sales Order' }];
    upsertVersion(cacheDir, SQL, ['143'], rows);
    const { readSqlFile, writeSqlFile, sqlKey, paramsKey } = await import('../src/lib/ad-cache.js');
    const file = readSqlFile(cacheDir, sqlKey(SQL));
    delete file.versions[paramsKey(['143'])].checksum;
    writeSqlFile(cacheDir, sqlKey(SQL), file);

    // Same rows → no drift, computed on the fly via rowsChecksum(version.rows).
    setCacheMode({ mode: 'off', path: cacheDir });
    let pool = wrapPoolWithCache(fakePool(() => [{ id: '143', name: 'Sales Order' }]));
    await pool.query(SQL, ['143']);
    assert.equal(getCacheDrift().length, 0, 'legacy version with matching rows: no drift');

    // Different rows → drift, still computed on the fly.
    setCacheMode({ mode: 'off', path: cacheDir });
    pool = wrapPoolWithCache(fakePool(() => [{ id: '143', name: 'Sales Order CHANGED' }]));
    await pool.query(SQL, ['143']);
    assert.equal(getCacheDrift().length, 1, 'legacy version with different rows: drift');
  });

  it('SF_CACHE_VERIFY=0 disables detection even when results differ', async () => {
    upsertVersion(cacheDir, SQL, ['143'], [{ id: '143', name: 'Sales Order' }]);

    const prev = process.env.SF_CACHE_VERIFY;
    process.env.SF_CACHE_VERIFY = '0';
    try {
      setCacheMode({ mode: 'off', path: cacheDir });
      assert.equal(getCacheMode().verify, false);
      const pool = wrapPoolWithCache(fakePool(() => [{ id: '143', name: 'Sales Order RENAMED' }]));
      await pool.query(SQL, ['143']);
      assert.equal(getCacheDrift().length, 0);
    } finally {
      if (prev === undefined) delete process.env.SF_CACHE_VERIFY;
      else process.env.SF_CACHE_VERIFY = prev;
    }
  });

  it('verify defaults to enabled (SF_CACHE_VERIFY unset)', () => {
    const prev = process.env.SF_CACHE_VERIFY;
    delete process.env.SF_CACHE_VERIFY;
    try {
      setCacheMode({ mode: 'off', path: cacheDir });
      assert.equal(getCacheMode().verify, true);
    } finally {
      if (prev === undefined) delete process.env.SF_CACHE_VERIFY;
      else process.env.SF_CACHE_VERIFY = prev;
    }
  });

  it('setCacheMode resets the drift accumulator', async () => {
    upsertVersion(cacheDir, SQL, ['143'], [{ id: '143', name: 'A' }]);
    setCacheMode({ mode: 'off', path: cacheDir });
    const pool = wrapPoolWithCache(fakePool(() => [{ id: '143', name: 'B' }]));
    await pool.query(SQL, ['143']);
    assert.equal(getCacheDrift().length, 1);

    setCacheMode({ mode: 'off', path: cacheDir }); // fresh run
    assert.equal(getCacheDrift().length, 0, 'drift must not leak across setCacheMode() calls');
  });

  it('reportCacheDrift is a no-op returning 0 when nothing drifted', () => {
    setCacheMode({ mode: 'off' });
    assert.equal(reportCacheDrift(), 0);
  });

  it('does not verify in write or read mode (only off-mode hits the real DB)', async () => {
    const rows = [{ id: '143', name: 'Sales Order' }];
    upsertVersion(cacheDir, SQL, ['143'], rows);

    // 'write' mode: overwrites the cache with fresh rows; drift check is
    // irrelevant there (flushCacheWrites already updates the checksum).
    setCacheMode({ mode: 'write', path: cacheDir });
    const writer = wrapPoolWithCache(fakePool(() => [{ id: '143', name: 'Sales Order CHANGED' }]));
    await writer.query(SQL, ['143']);
    assert.equal(getCacheDrift().length, 0, 'write mode does not run drift detection');
  });
});

describe('cache drift: rowsChecksum sanity used by the comparison', () => {
  it('two structurally-equal row sets checksum identically regardless of key order', () => {
    const a = rowsChecksum([{ id: '1', name: 'X' }]);
    const b = rowsChecksum([{ name: 'X', id: '1' }]);
    assert.equal(a, b);
  });
});

/**
 * Integration-style: prove the REAL entrypoint (createDbPool) wires up drift
 * detection in 'off' mode — not just the hand-wrapped fake pool used above.
 *
 * pg.Pool's constructor does NOT open a connection, so `new pg.Pool(config)` is
 * safe offline. We mock pg.Pool.prototype.query so the "real" query returns
 * controlled rows without a database. wrapPoolWithCache binds originalQuery from
 * the pool's query at wrap time, so the mock is what the off-branch calls.
 *
 * This is the regression guard for the bug where createDbPool only wrapped the
 * pool in 'write' mode, so 'off'-mode drift detection never fired in real use.
 */
describe('cache drift: createDbPool wires detection in off mode (integration)', () => {
  const DB_CONFIG = { host: 'localhost', port: 5432, user: 'u', password: 'p', database: 'd' };

  afterEach(() => {
    mock.restoreAll();
  });

  function mockRealQuery(rows) {
    mock.method(pg.Pool.prototype, 'query', async () => ({ rows, rowCount: rows.length }));
  }

  it('off + verify:true → createDbPool returns a WRAPPED pool that records drift', async () => {
    upsertVersion(cacheDir, SQL, ['143'], [{ id: '143', name: 'Sales Order' }]);
    mockRealQuery([{ id: '143', name: 'Sales Order RENAMED' }]);

    setCacheMode({ mode: 'off', path: cacheDir, verify: true });
    const pool = createDbPool(DB_CONFIG);
    assert.equal(pool.query.name, 'cachedQuery', 'pool must be wrapped in off+verify');

    await pool.query(SQL, ['143']);
    assert.equal(getCacheDrift().length, 1, 'real entrypoint must detect the stale cache');
    await pool.end();
  });

  it('off + verify:false → createDbPool returns a RAW pool (no wrapper, no drift)', async () => {
    upsertVersion(cacheDir, SQL, ['143'], [{ id: '143', name: 'Sales Order' }]);
    mockRealQuery([{ id: '143', name: 'Sales Order RENAMED' }]);

    setCacheMode({ mode: 'off', path: cacheDir, verify: false });
    const pool = createDbPool(DB_CONFIG);
    assert.notEqual(pool.query.name, 'cachedQuery', 'pool must NOT be wrapped when verify is off');

    await pool.query(SQL, ['143']);
    assert.equal(getCacheDrift().length, 0, 'no drift recorded when verification disabled');
    await pool.end();
  });

  it('off + verify:true with matching rows → wrapped pool records NO drift', async () => {
    upsertVersion(cacheDir, SQL, ['143'], [{ id: '143', name: 'Sales Order' }]);
    mockRealQuery([{ id: '143', name: 'Sales Order' }]);

    setCacheMode({ mode: 'off', path: cacheDir, verify: true });
    const pool = createDbPool(DB_CONFIG);
    await pool.query(SQL, ['143']);
    assert.equal(getCacheDrift().length, 0, 'matching fresh result is not drift');
    await pool.end();
  });

  it('write mode → createDbPool returns a wrapped pool regardless of verify', () => {
    setCacheMode({ mode: 'write', path: cacheDir, verify: false });
    const pool = createDbPool(DB_CONFIG);
    assert.equal(pool.query.name, 'cachedQuery', 'write mode always wraps');
    pool.end();
  });
});
