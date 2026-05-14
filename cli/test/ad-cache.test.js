import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cacheKey, readCache, writeCache, mergeCache } from '../src/lib/ad-cache.js';

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

describe('ad-cache.readCache', () => {
  it('returns {} when the file does not exist', () => {
    const result = readCache(join(tmpdir(), 'definitely-not-here-' + Date.now() + '.json'));
    assert.deepEqual(result, {});
  });

  it('returns {} for an empty file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ad-cache-test-'));
    try {
      const path = join(dir, 'empty.json');
      writeFileSync(path, '', 'utf-8');
      assert.deepEqual(readCache(path), {});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('parses an existing cache file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ad-cache-test-'));
    try {
      const path = join(dir, 'snap.json');
      writeFileSync(path, JSON.stringify({ k1: { rows: [{ a: 1 }] } }), 'utf-8');
      const result = readCache(path);
      assert.deepEqual(result, { k1: { rows: [{ a: 1 }] } });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws on malformed JSON (loud, not silent)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ad-cache-test-'));
    try {
      const path = join(dir, 'bad.json');
      writeFileSync(path, '{not json', 'utf-8');
      assert.throws(() => readCache(path), /JSON/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('ad-cache.writeCache', () => {
  it('writes pretty-printed JSON with sorted top-level keys', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ad-cache-test-'));
    try {
      const path = join(dir, 'out.json');
      writeCache(path, { zeta: 1, alpha: 2, mike: 3 });
      const text = readFileSync(path, 'utf-8');
      const keysInOrder = text.match(/"[a-z]+":/g);
      assert.deepEqual(keysInOrder, ['"alpha":', '"mike":', '"zeta":']);
      assert.ok(text.endsWith('\n'), 'file must end with newline');
      assert.ok(text.includes('\n  '), 'file must be 2-space indented');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('creates the parent directory if missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ad-cache-test-'));
    try {
      const path = join(dir, 'nested', 'deeper', 'snap.json');
      writeCache(path, { a: 1 });
      assert.ok(readFileSync(path, 'utf-8').includes('"a"'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('ad-cache.mergeCache', () => {
  it('fresh entries overwrite existing keys', () => {
    const existing = { k1: 'old', k2: 'keep' };
    const fresh = { k1: 'new' };
    assert.deepEqual(mergeCache(existing, fresh), { k1: 'new', k2: 'keep' });
  });

  it('preserves existing entries not present in fresh', () => {
    const existing = { a: 1, b: 2, c: 3 };
    const fresh = { b: 99 };
    assert.deepEqual(mergeCache(existing, fresh), { a: 1, b: 99, c: 3 });
  });

  it('returns a new object (does not mutate inputs)', () => {
    const existing = { a: 1 };
    const fresh = { b: 2 };
    const merged = mergeCache(existing, fresh);
    assert.deepEqual(existing, { a: 1 });
    assert.deepEqual(fresh, { b: 2 });
    assert.notEqual(merged, existing);
  });
});
