import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  cacheKey,
  entryPath,
  readEntry,
  writeEntry,
  listKeys,
} from '../src/lib/ad-cache.js';

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

  it('ignores object-key order inside params', () => {
    const a = cacheKey('SELECT 1', [{ a: 1, b: 2 }]);
    const b = cacheKey('SELECT 1', [{ b: 2, a: 1 }]);
    assert.equal(a, b);
  });

  it('distinguishes different SQL', () => {
    const a = cacheKey('SELECT * FROM AD_Window', []);
    const b = cacheKey('SELECT * FROM AD_Tab', []);
    assert.notEqual(a, b);
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

  it('treats missing params as empty array', () => {
    const a = cacheKey('SELECT 1');
    const b = cacheKey('SELECT 1', []);
    assert.equal(a, b);
  });
});

function withTmpDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'ad-cache-test-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('ad-cache.entryPath', () => {
  it('joins the dir and the key with a .json suffix', () => {
    assert.equal(entryPath('/tmp/snap', 'abc123'), join('/tmp/snap', 'abc123.json'));
  });
});

describe('ad-cache.readEntry', () => {
  it('returns null when the file does not exist', () => {
    withTmpDir((dir) => {
      assert.equal(readEntry(dir, 'missing-key'), null);
    });
  });

  it('returns null when the directory does not exist', () => {
    const dir = join(tmpdir(), 'definitely-not-here-' + Date.now());
    assert.equal(readEntry(dir, 'k'), null);
  });

  it('returns null for an empty file', () => {
    withTmpDir((dir) => {
      writeFileSync(entryPath(dir, 'empty'), '', 'utf-8');
      assert.equal(readEntry(dir, 'empty'), null);
    });
  });

  it('parses an existing entry file', () => {
    withTmpDir((dir) => {
      writeFileSync(entryPath(dir, 'k1'), JSON.stringify({ sql: 'x', params: [], rows: [{ a: 1 }] }), 'utf-8');
      assert.deepEqual(readEntry(dir, 'k1'), { sql: 'x', params: [], rows: [{ a: 1 }] });
    });
  });

  it('throws on malformed JSON (loud, not silent)', () => {
    withTmpDir((dir) => {
      writeFileSync(entryPath(dir, 'bad'), '{not json', 'utf-8');
      assert.throws(() => readEntry(dir, 'bad'), /JSON/);
    });
  });
});

describe('ad-cache.writeEntry', () => {
  it('writes pretty-printed JSON ending with a newline', () => {
    withTmpDir((dir) => {
      writeEntry(dir, 'k1', { sql: 'SELECT 1', params: [], rows: [{ a: 1 }] });
      const text = readFileSync(entryPath(dir, 'k1'), 'utf-8');
      assert.ok(text.endsWith('\n'), 'file must end with newline');
      assert.ok(text.includes('\n  '), 'file must be 2-space indented');
    });
  });

  it('creates the directory if missing', () => {
    withTmpDir((base) => {
      const dir = join(base, 'nested', 'deeper');
      writeEntry(dir, 'k', { rows: [] });
      assert.ok(readFileSync(entryPath(dir, 'k'), 'utf-8').includes('"rows"'));
    });
  });

  it('round-trips through readEntry', () => {
    withTmpDir((dir) => {
      const entry = { sql: 'SELECT $1', params: ['9'], rows: [{ id: '9', name: 'X' }] };
      writeEntry(dir, 'rt', entry);
      assert.deepEqual(readEntry(dir, 'rt'), entry);
    });
  });

  it('produces deterministic output regardless of key insertion order', () => {
    withTmpDir((dir) => {
      writeEntry(dir, 'a', { rows: [{ zeta: 1, alpha: 2 }], params: [], sql: 'q' });
      const first = readFileSync(entryPath(dir, 'a'), 'utf-8');
      writeEntry(dir, 'a', { sql: 'q', params: [], rows: [{ alpha: 2, zeta: 1 }] });
      const second = readFileSync(entryPath(dir, 'a'), 'utf-8');
      assert.equal(first, second, 'field order must not affect the serialized bytes');
      // Top-level keys are sorted alphabetically: params, rows, sql
      assert.deepEqual(
        [...second.matchAll(/^ {2}"(\w+)":/gm)].map((m) => m[1]),
        ['params', 'rows', 'sql'],
      );
    });
  });

  it('overwrites an existing same-key file', () => {
    withTmpDir((dir) => {
      writeEntry(dir, 'k', { rows: [{ v: 'old' }] });
      writeEntry(dir, 'k', { rows: [{ v: 'new' }] });
      assert.deepEqual(readEntry(dir, 'k').rows, [{ v: 'new' }]);
    });
  });
});

describe('ad-cache.listKeys', () => {
  it('returns [] when the directory does not exist', () => {
    const dir = join(tmpdir(), 'definitely-not-here-' + Date.now());
    assert.deepEqual(listKeys(dir), []);
  });

  it('lists keys (filenames minus .json), sorted, ignoring non-json files', () => {
    withTmpDir((dir) => {
      writeEntry(dir, 'zeta', { rows: [] });
      writeEntry(dir, 'alpha', { rows: [] });
      writeEntry(dir, 'mike', { rows: [] });
      writeFileSync(join(dir, 'README.txt'), 'not a cache file', 'utf-8');
      mkdirSync(join(dir, 'subdir'));
      assert.deepEqual(listKeys(dir), ['alpha', 'mike', 'zeta']);
    });
  });
});
