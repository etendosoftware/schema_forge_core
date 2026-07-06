import pg from 'pg';
import { readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cacheKey, readEntry, writeEntry, listKeys, entryPath } from './lib/ad-cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Global, repo-wide AD query cache. Single source of truth so that all
 * three extractors (extract-from-db, extract-fields, extract-rules) share
 * the same directory and one CACHE_DB=1 refresh covers all of them.
 *
 * The cache is a DIRECTORY of one file per query (cache/ad-snapshot/<key>.json),
 * not a single monolithic JSON — see cli/src/lib/ad-cache.js.
 */
export const DEFAULT_CACHE_DIR = join(__dirname, '..', 'cache', 'ad-snapshot');

/**
 * Back-compat: SF_CACHE_PATH historically pointed at the monolithic
 * `ad-snapshot.json`. The cache is now a directory. If a `.json` path is
 * given (env or explicit arg), map it to the directory obtained by dropping the
 * `.json` extension (`.../ad-snapshot.json` → `.../ad-snapshot/`). This is the
 * least-surprising mapping: an unchanged SF_CACHE_PATH config resolves to the
 * new per-query directory that the migration script produces from that file.
 */
export function resolveCacheDir(p) {
  if (!p) return null;
  return p.endsWith('.json') ? p.slice(0, -'.json'.length) : p;
}

/**
 * Module-level cache mode. Set by setCacheMode() before any createDbPool()
 * call. The pool returned by createDbPool() reads this state and either
 * (a) records every query into a buffer flushed by flushCacheWrites(), or
 * (b) serves results from the cache file and throws on miss.
 *
 * Modes:
 *   - 'off'       → no cache interaction (current default behavior).
 *   - 'write'     → run against DB, record (sql, params, rows) for later flush.
 *   - 'read'      → never open DB; resolve from cache or throw with refresh hint.
 */
// Honor SF_CACHE_MODE env var at module load. Lets the Makefile (or a parent
// process) opt the entire chain into cache read/write without every CLI
// knowing the flag. setCacheMode() calls still override this.
function initialCacheModeFromEnv() {
  const v = process.env.SF_CACHE_MODE;
  return (v === 'read' || v === 'write' || v === 'off') ? v : 'off';
}

function initialSweepFromEnv() {
  return process.env.SF_CACHE_SWEEP === '1';
}

let cacheMode = initialCacheModeFromEnv();
let cacheDir = resolveCacheDir(process.env.SF_CACHE_PATH) || DEFAULT_CACHE_DIR;
let writeBuffer = {};       // accumulates fresh entries during a 'write' run
let sweepEnabled = initialSweepFromEnv();
let touchedKeys = new Set(); // keys read OR written this run (for the gated sweep)

/**
 * Configure cache behavior for the rest of the process. Must be called
 * BEFORE createDbPool(). Pass mode='off' to reset.
 *
 * @param {object} opts
 * @param {'off'|'write'|'read'} [opts.mode='off']
 * @param {string} [opts.path] - Cache directory (a legacy `.json` path is mapped
 *   to its extension-stripped directory). Falls back to SF_CACHE_PATH, then
 *   DEFAULT_CACHE_DIR.
 * @param {boolean} [opts.sweep] - Enable the gated orphan sweep on flush.
 *   Defaults to the SF_CACHE_SWEEP env var. See sweepCache() for the safety
 *   contract — this must NEVER be enabled on a scoped (single-window) run.
 */
export function setCacheMode({ mode = 'off', path, sweep } = {}) {
  if (!['off', 'write', 'read'].includes(mode)) {
    throw new Error(`setCacheMode: invalid mode "${mode}" (expected off|write|read)`);
  }
  cacheMode = mode;
  // When no explicit path is passed (the common case — every CLI entrypoint
  // omits it), honor SF_CACHE_PATH so a consuming repo's tracked cache dir is
  // used instead of the package's bundled DEFAULT_CACHE_DIR inside node_modules.
  cacheDir = resolveCacheDir(path) || resolveCacheDir(process.env.SF_CACHE_PATH) || DEFAULT_CACHE_DIR;
  sweepEnabled = sweep === undefined ? initialSweepFromEnv() : Boolean(sweep);
  writeBuffer = {};
  touchedKeys = new Set();
}

export function getCacheMode() {
  return { mode: cacheMode, path: cacheDir, sweep: sweepEnabled };
}

/**
 * Apply cache mode from a {writeCache, fromCache} CLI-flag pair, forwarding
 * SF_CACHE_PATH so the cache file lands where the caller specified instead of
 * silently falling back to DEFAULT_CACHE_PATH.
 */
export function applyCacheModeFromEnv({ writeCache, fromCache } = {}) {
  if (writeCache) return setCacheMode({ mode: 'write', path: process.env.SF_CACHE_PATH });
  if (fromCache) return setCacheMode({ mode: 'read', path: process.env.SF_CACHE_PATH });
}

/**
 * Persist any queries recorded during 'write' mode into the on-disk cache,
 * one file per query. Entries with the same (sql, params) key captured during
 * this run overwrite the stale file; every other file is left untouched.
 * No-op outside 'write'.
 *
 * If the gated sweep is enabled (SF_CACHE_SWEEP / setCacheMode({sweep:true}))
 * the sweep runs after the writes — see sweepCache() for the safety contract.
 *
 * Call this once at the end of an extraction run (after closePool).
 */
export function flushCacheWrites() {
  if (cacheMode !== 'write') return { written: 0, path: cacheDir, pruned: 0 };
  for (const [key, entry] of Object.entries(writeBuffer)) {
    writeEntry(cacheDir, key, entry);
  }
  const written = Object.keys(writeBuffer).length;
  writeBuffer = {};
  let pruned = 0;
  if (sweepEnabled) pruned = sweepCache().pruned;
  return { written, path: cacheDir, pruned };
}

/**
 * Gated sweep: delete cache files for queries no longer emitted this run.
 *
 * A cache file is an "orphan" if its key was NOT touched (written or read)
 * during the current process. Sweeping keeps the committed cache from growing
 * unbounded as queries are removed.
 *
 * ⚠️ SAFETY CONTRACT — this MUST only be invoked by a FULL-repo refresh that
 * exercises EVERY window's queries. A scoped run (e.g. `make regen ONLY=<w>`)
 * only touches one window's keys, so sweeping would delete every OTHER window's
 * cache. It is therefore off by default and gated behind SF_CACHE_SWEEP=1 /
 * setCacheMode({sweep:true}); the consuming Makefile must set it ONLY on the
 * all-windows refresh target, never when ONLY= is present. regen-all.js also
 * refuses to enable it when --only is passed (defense in depth).
 *
 * Every prune is logged (never silent).
 */
export function sweepCache() {
  const orphans = listKeys(cacheDir).filter((k) => !touchedKeys.has(k));
  for (const key of orphans) {
    rmSync(entryPath(cacheDir, key), { force: true });
  }
  if (orphans.length > 0) {
    console.log(`[ad-cache] sweep: pruned ${orphans.length} orphan cache file(s) in ${cacheDir}`);
    for (const key of orphans) console.log(`  - ${key}.json`);
  } else {
    console.log(`[ad-cache] sweep: no orphan cache files in ${cacheDir}`);
  }
  return { pruned: orphans.length, prunedKeys: orphans };
}

class CacheMissError extends Error {
  constructor(key, sql, params) {
    super(
      `AD cache miss for query.\n` +
      `  key:    ${key}\n` +
      `  sql:    ${String(sql).replace(/\s+/g, ' ').trim().slice(0, 200)}\n` +
      `  params: ${JSON.stringify(params)}\n` +
      `Run with CACHE_DB=1 to refresh the cache for this window.\n` +
      `(The cache is now a directory of per-query files.)`
    );
    this.name = 'CacheMissError';
    this.code = 'AD_CACHE_MISS';
  }
}

/**
 * Wrap a pg.Pool so that .query() honors the active cacheMode.
 *   - 'off'   → passthrough to the real pool.
 *   - 'write' → run the real query, store result in writeBuffer, return as-is.
 *   - 'read'  → look up in readSnapshot, return a pg-shaped { rows } object,
 *               throw CacheMissError if absent.
 */
export function wrapPoolWithCache(realPool) {
  const originalQuery = realPool.query.bind(realPool);

  realPool.query = async function cachedQuery(sql, params = []) {
    // pg.Pool.query supports many signatures. We only need to handle
    // (sql, paramsArray) — the only form used by Schema Forge extractors.
    const key = cacheKey(sql, params);

    if (cacheMode === 'write') {
      const result = await originalQuery(sql, params);
      writeBuffer[key] = {
        sql: String(sql).replace(/\s+/g, ' ').trim(),
        params,
        rows: result.rows,
      };
      touchedKeys.add(key);
      return result;
    }

    if (cacheMode === 'read') {
      const entry = readEntry(cacheDir, key);
      if (!entry) throw new CacheMissError(key, sql, params);
      touchedKeys.add(key);
      return { rows: entry.rows, rowCount: entry.rows.length };
    }

    return originalQuery(sql, params);
  };

  return realPool;
}

/**
 * Stub pool used in 'read' mode. Never opens a real connection. Its
 * .query() resolves from the cache (or throws). .end() is a no-op.
 */
function createCacheReadPool() {
  const pool = {
    async query(sql, params = []) {
      const key = cacheKey(sql, params);
      const entry = readEntry(cacheDir, key);
      if (!entry) throw new CacheMissError(key, sql, params);
      touchedKeys.add(key);
      return { rows: entry.rows, rowCount: entry.rows.length };
    },
    async connect() {
      return {
        query: (sql, params) => pool.query(sql, params),
        release: () => {},
      };
    },
    async end() { /* no-op */ },
    __cacheRead: true,
  };
  return pool;
}

/**
 * Parse a gradle.properties file into a key-value object.
 * Skips comments (#) and empty lines.
 */
function parseGradleProperties(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const props = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    props[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return props;
}

/**
 * Resolve DB config from (in priority order):
 * 1. Explicit config object passed as argument
 * 2. Explicit gradle.properties path passed as argument
 * 3. gradle.properties file (auto-discovered or via ETENDO_GRADLE_PROPERTIES env var)
 * 4. Environment variables (ETENDO_DB_HOST, etc.)
 *
 * @param {object} [config] - Explicit DB config (host, port, user, password, database)
 * @param {string} [gradlePropertiesPath] - Path to gradle.properties. When provided,
 * it is used ahead of env vars and a missing file falls back to defaults.
 */
function loadGradleConfig(gradlePropertiesPath) {
  if (gradlePropertiesPath) {
    try {
      return { gradle: parseGradleProperties(gradlePropertiesPath), explicit: true };
    } catch {
      return { gradle: null, explicit: true };
    }
  }

  const gradlePath = process.env.ETENDO_GRADLE_PROPERTIES || findGradleProperties();
  if (!gradlePath) return { gradle: null, explicit: false };
  try {
    return { gradle: parseGradleProperties(gradlePath), explicit: false };
  } catch {
    // File not found or unreadable — caller falls through to env vars / defaults
    return { gradle: null, explicit: false };
  }
}

function extractGradleHostPort(gradle) {
  if (!gradle) return { host: null, port: null };
  let host = null;
  let port = null;
  if (gradle['bbdd.url']) {
    const urlMatch = gradle['bbdd.url'].match(/postgresql:\/\/([^:/]+)(?::(\d+))?/);
    if (urlMatch) {
      host = urlMatch[1];
      if (urlMatch[2]) port = parseInt(urlMatch[2], 10);
    }
  }
  // bbdd.port overrides URL port if present
  if (gradle['bbdd.port']) {
    port = parseInt(gradle['bbdd.port'], 10);
  }
  return { host, port };
}

/**
 * Resolve the default DB connection values from gradle.properties (or env vars)
 * without opening a pool. Used by the interactive TUI to pre-fill prompts.
 * Returns { host, port, user, password, database, source } where source is
 * 'gradle' | 'env' | 'defaults'.
 */
export function resolveDbDefaults(gradlePropertiesPath) {
  const { gradle, explicit } = loadGradleConfig(gradlePropertiesPath);
  const { host: gradleHost, port: gradlePort } = extractGradleHostPort(gradle);
  const envHost = explicit ? null : process.env.ETENDO_DB_HOST;
  const envPort = explicit ? null : parseInt(process.env.ETENDO_DB_PORT, 10);
  const envUser = explicit ? null : process.env.ETENDO_DB_USER;
  const envPassword = explicit ? null : process.env.ETENDO_DB_PASSWORD;
  const envDatabase = explicit ? null : process.env.ETENDO_DB_NAME;

  let source = 'defaults';
  if (gradle) {
    source = 'gradle';
  } else if (envHost) {
    source = 'env';
  }
  return {
    host: (gradleHost === 'db' ? 'localhost' : gradleHost) || envHost || 'localhost',
    port: gradlePort || envPort || 5432,
    user: gradle?.['bbdd.user'] || envUser || 'etendo',
    password: gradle?.['bbdd.password'] || envPassword || '',
    database: gradle?.['bbdd.sid'] || envDatabase || 'etendo_dev',
    source,
  };
}

export function createDbPool(config, gradlePropertiesPath) {
  // 'read' mode never opens a real connection — return the stub pool.
  if (cacheMode === 'read') {
    return createCacheReadPool();
  }

  if (config && config.host) {
    const pool = new pg.Pool(config);
    return cacheMode === 'write' ? wrapPoolWithCache(pool) : pool;
  }

  const { gradle, explicit } = loadGradleConfig(gradlePropertiesPath);
  const { host: gradleHost, port: gradlePort } = extractGradleHostPort(gradle);
  const envHost = explicit ? null : process.env.ETENDO_DB_HOST;
  const envPort = explicit ? null : parseInt(process.env.ETENDO_DB_PORT, 10);
  const envUser = explicit ? null : process.env.ETENDO_DB_USER;
  const envPassword = explicit ? null : process.env.ETENDO_DB_PASSWORD;
  const envDatabase = explicit ? null : process.env.ETENDO_DB_NAME;

  const pool = new pg.Pool({
    host: (gradleHost === 'db' ? 'localhost' : gradleHost) || envHost || 'localhost',
    port: gradlePort || envPort || 5432,
    user: gradle?.['bbdd.user'] || envUser || 'etendo',
    password: gradle?.['bbdd.password'] || envPassword || '',
    database: gradle?.['bbdd.sid'] || envDatabase || 'etendo_dev',
    max: 5,
  });
  return cacheMode === 'write' ? wrapPoolWithCache(pool) : pool;
}

/**
 * Auto-discover gradle.properties relative to the consuming repo's root, not
 * this package's own install location. In local dev (this repo, cli/src/db.js)
 * that root is 2 levels up (schema_forge_core/); once installed as
 * node_modules/@etendosoftware/schema-forge-cli/src/db.js, __dirname's own
 * directory depth no longer means anything — SF_ROOT (set by the consuming
 * repo's Makefile/CI) must be used instead.
 *
 * Two real layouts exist for where gradle.properties actually lives relative
 * to that root, matching the two conventions already in use elsewhere in the
 * consuming repo (see tools/app-shell/vite-plugins/report-api.js's own
 * findGradleProps()):
 *   - CI / the documented convention: one level ABOVE the consumer root
 *     ("Etendo root: parent directory of this repo").
 *   - A local dev layout some machines use: an `etendo_core/` checkout
 *     nested INSIDE the consumer root, matching CI's own
 *     `working-directory: etendo_core/etendo_schema_forge` path shape.
 * Check both; ETENDO_GRADLE_PROPERTIES (handled by the caller) always wins.
 */
function findGradleProperties() {
  const consumerRoot = process.env.SF_ROOT || join(__dirname, '..', '..');
  const candidates = [
    join(consumerRoot, 'etendo_core', 'gradle.properties'),
    join(consumerRoot, '..', 'gradle.properties'),
  ];
  for (const candidate of candidates) {
    try {
      readFileSync(candidate, 'utf-8');
      return candidate;
    } catch { /* try next candidate */ }
  }
  return null;
}

export async function closePool(pool) {
  await pool.end();
}
