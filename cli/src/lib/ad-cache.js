/**
 * ad-cache.js — Per-query file cache for AD (Application Dictionary) snapshots.
 *
 * This module is intentionally agnostic of SQL, DB drivers, and business logic.
 * The cache is a DIRECTORY of one file per query, not a single monolithic JSON.
 * Each file is named <cacheKey>.json and holds a single entry:
 *
 *   cache/ad-snapshot/<sha256key>.json
 *     { "sql": "...", "params": [...], "rows": [...] }
 *
 * Identical (sql, params) pairs across different call sites map to the same key,
 * so they naturally deduplicate to a single file. Splitting the old monolith
 * into per-query files keeps diffs small and reviewable: a refresh touches only
 * the files whose queries changed instead of rewriting one 50MB blob.
 *
 * Public API:
 *   - cacheKey(sql, params)   → deterministic string key (UNCHANGED)
 *   - entryPath(dir, key)     → absolute path of the file for a key
 *   - readEntry(dir, key)     → parsed { sql, params, rows } or null if missing
 *   - writeEntry(dir, key, e) → write one pretty, deterministically-ordered file
 *   - listKeys(dir)           → keys present in the directory ([] if dir missing)
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Normalize whitespace in a SQL string so that semantically identical
 * queries with different formatting yield the same cache key.
 *   - Collapses any whitespace run (spaces, tabs, newlines) to a single space.
 *   - Trims leading/trailing whitespace.
 */
function normalizeSql(sql) {
  return String(sql).replace(/\s+/g, ' ').trim();
}

/**
 * Deep-copy a value with every object's keys sorted alphabetically at every
 * depth. Arrays keep their order (positional data such as SQL params and result
 * rows must not be reordered). Used to make per-file JSON output stable across
 * runs regardless of the insertion order of columns in a result row.
 */
function sortKeysDeep(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const out = {};
  for (const k of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    out[k] = sortKeysDeep(value[k]);
  }
  return out;
}

/**
 * Deterministic JSON.stringify with sorted object keys at every depth.
 * Arrays preserve their order (param order matters for SQL placeholders).
 */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

/**
 * Compute a deterministic cache key for a (sql, params) pair.
 * Different whitespace → same key. Different param order within an object
 * (e.g. `{a:1,b:2}` vs `{b:2,a:1}`) → same key. Different param ORDER in
 * an array (positional $1, $2 placeholders) → different key, as it should.
 */
export function cacheKey(sql, params = []) {
  const payload = stableStringify({ sql: normalizeSql(sql), params });
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Absolute path of the cache file backing a given key.
 */
export function entryPath(dir, key) {
  return join(dir, key + '.json');
}

/**
 * Read a single cache entry. Returns null when the file does not exist so that
 * callers can distinguish "not cached" from a corrupt cache. Parse errors are
 * NOT swallowed — a malformed cache file surfaces as an exception so it is loud,
 * not silent.
 */
export function readEntry(dir, key) {
  let raw;
  try {
    raw = readFileSync(entryPath(dir, key), 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}

/**
 * Write a single cache entry to its own file with deterministic key ordering
 * and pretty-printed JSON (2-space indent) so per-file diffs are reviewable.
 * Ensures the cache directory exists. Overwrites any existing same-key file.
 */
export function writeEntry(dir, key, entry) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(entryPath(dir, key), JSON.stringify(sortKeysDeep(entry), null, 2) + '\n', 'utf-8');
}

/**
 * List the keys present in the cache directory (filenames minus the `.json`
 * extension). Returns [] when the directory does not exist. Sorted for stable
 * iteration order.
 */
export function listKeys(dir) {
  let names;
  try {
    names = readdirSync(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return names
    .filter((n) => n.endsWith('.json'))
    .map((n) => n.slice(0, -'.json'.length))
    .sort((a, b) => a.localeCompare(b));
}
