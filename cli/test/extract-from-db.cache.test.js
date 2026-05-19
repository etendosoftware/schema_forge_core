import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createDbPool,
  setCacheMode,
  flushCacheWrites,
  wrapPoolWithCache,
} from '../src/db.js';
import { cacheKey } from '../src/lib/ad-cache.js';

/**
 * These tests exercise the cache wiring in cli/src/db.js end-to-end without
 * opening a real PostgreSQL connection. We use the cache 'read' path
 * (a pure stub pool) and the cache 'write' wrapper applied to a fake pool.
 *
 * Why not run the actual extractors? They issue DB queries; integration tests
 * for them would require a live AD database, which CI does not have. The
 * cache layer is the contract we care about — once it round-trips correctly,
 * every extractor benefits transparently.
 */

let tmp;
let cachePath;

function fakePool(handler) {
  return {
    query: async (sql, params = []) => ({ rows: handler(sql, params), rowCount: 0 }),
    end: async () => {},
  };
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'extract-cache-test-'));
  cachePath = join(tmp, 'ad-snapshot.json');
});

afterEach(() => {
  setCacheMode({ mode: 'off' });
  rmSync(tmp, { recursive: true, force: true });
});

describe('extract cache: write mode produces a non-empty snapshot', () => {
  it('records every query and flushes a deterministic file', async () => {
    setCacheMode({ mode: 'write', path: cachePath });
    const pool = wrapPoolWithCache(fakePool((sql, params) => {
      if (sql.includes('AD_Window')) return [{ id: params[0], name: 'Sales Order' }];
      if (sql.includes('AD_Tab')) return [{ tab: 'Header' }, { tab: 'Lines' }];
      return [];
    }));

    await pool.query('SELECT * FROM AD_Window WHERE AD_Window_ID = $1', ['143']);
    await pool.query('SELECT * FROM AD_Tab WHERE AD_Window_ID = $1', ['143']);

    const { written, path } = flushCacheWrites();
    assert.equal(written, 2);
    assert.equal(path, cachePath);
    assert.ok(existsSync(path), 'cache file must exist');
    const snap = JSON.parse(readFileSync(path, 'utf-8'));
    assert.equal(Object.keys(snap).length, 2);

    // Verify the keys match what cacheKey() would produce for the same inputs.
    const k1 = cacheKey('SELECT * FROM AD_Window WHERE AD_Window_ID = $1', ['143']);
    assert.ok(snap[k1], 'window query key must be present');
    assert.deepEqual(snap[k1].rows, [{ id: '143', name: 'Sales Order' }]);
  });
});

describe('extract cache: read mode reproduces results without DB', () => {
  it('produces identical row data from cache (golden compare)', async () => {
    // Phase 1: write
    setCacheMode({ mode: 'write', path: cachePath });
    const writer = wrapPoolWithCache(fakePool((sql) => {
      if (sql.includes('AD_Window')) return [{ name: 'Sales Order' }];
      return [];
    }));
    const dbResult = await writer.query('SELECT * FROM AD_Window WHERE AD_Window_ID = $1', ['143']);
    flushCacheWrites();

    // Phase 2: read — fresh pool, no underlying DB connection at all
    setCacheMode({ mode: 'read', path: cachePath });
    const reader = createDbPool(); // returns the stub pool because mode=read
    const cachedResult = await reader.query(
      'SELECT * FROM AD_Window WHERE AD_Window_ID = $1',
      ['143'],
    );

    assert.deepEqual(cachedResult.rows, dbResult.rows);
    assert.equal(cachedResult.rowCount, dbResult.rows.length);
  });

  it('serves the same key across whitespace-different SQL', async () => {
    setCacheMode({ mode: 'write', path: cachePath });
    const writer = wrapPoolWithCache(fakePool(() => [{ x: 1 }]));
    await writer.query('SELECT  *  FROM   AD_Window\nWHERE AD_Window_ID = $1', ['9']);
    flushCacheWrites();

    setCacheMode({ mode: 'read', path: cachePath });
    const reader = createDbPool();
    // Same query, different formatting — must still hit the cache.
    const result = await reader.query('SELECT * FROM AD_Window WHERE AD_Window_ID = $1', ['9']);
    assert.deepEqual(result.rows, [{ x: 1 }]);
  });
});

describe('extract cache: read mode with empty cache fails hard', () => {
  it('throws CacheMissError with the failing key and refresh instruction', async () => {
    setCacheMode({ mode: 'read', path: cachePath });
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

describe('extract cache: default behavior is untouched', () => {
  it('does not read or write the cache file when no flag is set', async () => {
    // Make sure mode is off (afterEach resets it; explicit here for safety).
    setCacheMode({ mode: 'off' });
    assert.equal(existsSync(cachePath), false, 'no cache file pre-test');

    const pool = wrapPoolWithCache(fakePool(() => [{ id: 1 }]));
    // Even though we wrapped, mode='off' makes the wrapper passthrough.
    const result = await pool.query('SELECT 1', []);
    assert.deepEqual(result.rows, [{ id: 1 }]);

    // flushCacheWrites is a no-op when mode is off
    const flushResult = flushCacheWrites();
    assert.equal(flushResult.written, 0);
    assert.equal(existsSync(cachePath), false, 'no cache file post-test');
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
  // The CLI parsers reject both flags together; here we verify the underlying
  // setCacheMode rejects invalid modes.
  it('setCacheMode rejects unknown modes', () => {
    assert.throws(() => setCacheMode({ mode: 'both' }), /invalid mode/);
  });
});
