/**
 * ad-cache.js — Grouped-by-SQL file cache for AD (Application Dictionary) snapshots.
 *
 * This module is intentionally agnostic of SQL, DB drivers, and business logic.
 * The cache is a DIRECTORY of one file per DISTINCT SQL statement, not a single
 * monolithic JSON and not one file per (sql, params) pair. The same SQL runs with
 * many different param sets (one per window), so grouping by SQL collapses
 * hundreds of near-duplicate files (that each repeated the full SQL text) into a
 * handful of files that store the SQL text ONCE and hold every param "version"
 * inside:
 *
 *   cache/ad-snapshot/<sqlKey>.json
 *     {
 *       "sql": "<normalizeSql(sql)>",
 *       "versions": {
 *         "<paramsKey>": { "params": [...], "checksum": "<sha256>", "rows": [...] },
 *         "<paramsKey>": { "params": [...], "checksum": "<sha256>", "rows": [...] }
 *       }
 *     }
 *
 *   - sqlKey    = sha256(normalizeSql(sql))       → the file name (SQL only).
 *   - paramsKey = sha256(stableStringify(params)) → the key inside "versions".
 *   - checksum  = sha256(stableStringify(rows))   → fingerprint of the result set at
 *     write time. Consumers (see cli/src/db.js) recompute this on the fresh result
 *     of an 'off'-mode (real DB) run and compare it to the stored value to detect a
 *     STALE cache — a query whose real-DB rows no longer match the snapshot. This
 *     is deterministic ONLY because extractor queries carry an ORDER BY with a
 *     unique tiebreaker; an unordered result set would make the checksum flap
 *     between identical runs. May be `undefined` on versions written before this
 *     field existed — callers must fall back to `rowsChecksum(rows)` for those.
 *
 * Grouping keeps diffs small AND saves space: a refresh touches only the files
 * whose SQL ran, and each big SQL body is stored once per file instead of once
 * per version.
 *
 * Public API:
 *   - normalizeSql(sql)            → whitespace-collapsed, trimmed SQL
 *   - cacheKey(sql, params)        → logical id for a (sql, params) pair (whitespace-
 *                                    insensitive, param-order-sensitive)
 *   - sqlKey(sql)                  → file key (sha256 of normalized SQL)
 *   - paramsKey(params)            → version key (sha256 of stable params)
 *   - rowsChecksum(rows)           → sha256 fingerprint of a result set (deep-sorted)
 *   - sqlFilePath(dir, sqlKey)     → absolute path of the file for a sqlKey
 *   - readSqlFile(dir, sqlKey)     → parsed { sql, versions } or null if missing
 *   - writeSqlFile(dir, sqlKey, f) → write one pretty, deterministically-ordered file
 *   - readVersion(dir, sql, p)     → { sql, params, rows, checksum } for that version,
 *                                    or null (checksum may be undefined for legacy files)
 *   - upsertVersion(dir, sql,p,r)  → merge one version into its file (never drops others)
 *   - listSqlKeys(dir)             → sqlKeys present in the directory ([] if missing)
 *   - listVersions(dir, sqlKey)    → paramsKeys inside one file ([] if file missing)
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Normalize whitespace in a SQL string so that semantically identical
 * queries with different formatting yield the same key.
 *   - Collapses any whitespace run (spaces, tabs, newlines) to a single space.
 *   - Trims leading/trailing whitespace.
 */
export function normalizeSql(sql) {
  return String(sql).replace(/\s+/g, ' ').trim();
}

/**
 * Deep-copy a value with every object's keys sorted alphabetically at every
 * depth. Arrays keep their order (positional data such as SQL params and result
 * rows must not be reordered). Used to make per-file JSON output stable across
 * runs regardless of the insertion order of columns in a result row or of
 * versions within a file.
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

function sha256(payload) {
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Compute a logical cache key for a (sql, params) pair. Kept as a stable id for
 * callers that need to name a query independent of its storage location.
 * Different whitespace → same key. Different param order within an object
 * (e.g. `{a:1,b:2}` vs `{b:2,a:1}`) → same key. Different param ORDER in an array
 * (positional $1, $2 placeholders) → different key, as it should.
 */
export function cacheKey(sql, params = []) {
  return sha256(stableStringify({ sql: normalizeSql(sql), params }));
}

/**
 * File key: identifies the on-disk file that groups every version of one SQL
 * statement. Depends on the SQL text ONLY (not params).
 */
export function sqlKey(sql) {
  return sha256(normalizeSql(sql));
}

/**
 * Version key: identifies one param set inside a SQL file. Stable and
 * order-sensitive (positional $1, $2 placeholders), object-key-order-insensitive.
 */
export function paramsKey(params = []) {
  return sha256(stableStringify(params));
}

/**
 * Fingerprint of a query result set. Deterministic across object-key-order
 * permutations of individual rows (thanks to stableStringify's sorted keys),
 * but sensitive to row ORDER and to any value change. Relies on the caller's
 * SQL having a deterministic ORDER BY — this function does not sort rows
 * itself, since row order is meaningful data for some callers.
 */
export function rowsChecksum(rows = []) {
  return sha256(stableStringify(rows));
}

/**
 * Absolute path of the cache file that groups all versions of a given SQL.
 */
export function sqlFilePath(dir, key) {
  return join(dir, key + '.json');
}

/**
 * Read a whole SQL file (all versions). Returns null when the file does not
 * exist so callers can distinguish "not cached" from a corrupt cache. Parse
 * errors are NOT swallowed — a malformed cache file surfaces as an exception so
 * it is loud, not silent. A file missing its `versions` object is normalized to
 * an empty `versions` map.
 */
export function readSqlFile(dir, key) {
  let raw;
  try {
    raw = readFileSync(sqlFilePath(dir, key), 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  if (!raw.trim()) return null;
  const parsed = JSON.parse(raw);
  if (!parsed.versions || typeof parsed.versions !== 'object') parsed.versions = {};
  return parsed;
}

/**
 * Write a whole SQL file with deterministic key ordering (versions sorted by
 * paramsKey, every object's keys sorted at every depth, rows deep-key-sorted)
 * and pretty-printed JSON (2-space indent + trailing newline) so per-file diffs
 * are reviewable. Ensures the cache directory exists.
 */
export function writeSqlFile(dir, key, fileObj) {
  mkdirSync(dir, { recursive: true });
  const normalized = {
    sql: normalizeSql(fileObj.sql),
    versions: fileObj.versions || {},
  };
  writeFileSync(
    sqlFilePath(dir, key),
    JSON.stringify(sortKeysDeep(normalized), null, 2) + '\n',
    'utf-8',
  );
}

/**
 * Read one version out of a SQL file. Returns the classic { sql, params, rows }
 * shape (so callers see the same object a per-query cache used to hand back)
 * PLUS the stored `checksum` (may be `undefined` for versions written before the
 * checksum field existed — callers wanting a checksum for a legacy version must
 * compute it themselves via rowsChecksum(rows)). Returns null when either the
 * file or that specific version is absent.
 */
export function readVersion(dir, sql, params = []) {
  const file = readSqlFile(dir, sqlKey(sql));
  if (!file) return null;
  const version = file.versions[paramsKey(params)];
  if (!version) return null;
  return { sql: file.sql, params: version.params, rows: version.rows, checksum: version.checksum };
}

/**
 * Merge one (params → rows) version into its SQL file, preserving every other
 * version already stored. Reads the existing file (or starts fresh), sets
 * versions[paramsKey] = { params, checksum: rowsChecksum(rows), rows }, and
 * writes back deterministically.
 * MERGE semantics: never drops other versions in the file.
 * Returns { sqlKey, paramsKey } for callers that want to track what was touched.
 */
export function upsertVersion(dir, sql, params = [], rows = []) {
  const sk = sqlKey(sql);
  const pk = paramsKey(params);
  const file = readSqlFile(dir, sk) || { sql: normalizeSql(sql), versions: {} };
  file.versions[pk] = { params, checksum: rowsChecksum(rows), rows };
  writeSqlFile(dir, sk, file);
  return { sqlKey: sk, paramsKey: pk };
}

/**
 * List the SQL keys present in the cache directory (filenames minus the `.json`
 * extension). Returns [] when the directory does not exist. Sorted for stable
 * iteration order.
 */
export function listSqlKeys(dir) {
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

/**
 * List the version keys (paramsKeys) inside one SQL file. Returns [] when the
 * file is missing. Sorted for stable iteration order.
 */
export function listVersions(dir, key) {
  const file = readSqlFile(dir, key);
  if (!file) return [];
  return Object.keys(file.versions).sort((a, b) => a.localeCompare(b));
}
