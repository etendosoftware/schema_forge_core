/**
 * regroup-ad-snapshot.js
 *
 * Migrate an AD cache to the GROUPED-BY-SQL layout: one file per distinct SQL
 * statement (`ad-snapshot/<sqlKey>.json`), each holding every param "version"
 * inside a `versions` map. Accepts EITHER input:
 *
 *   1. The old monolith  `ad-snapshot.json`  → `{ <key>: {sql,params,rows}, ... }`
 *   2. A per-(sql,params) directory `ad-snapshot/` → many `<cacheKey>.json`,
 *      each `{sql,params,rows}` (the previous layout).
 *
 * Both collapse to the grouped layout; old per-query files and the monolith are
 * deleted. Already-grouped files are read and rewritten in place, so the script
 * is IDEMPOTENT: re-running on a grouped directory changes nothing.
 *
 * Usage:
 *   node cli/src/migrations/regroup-ad-snapshot.js <path>
 *
 *   <path> may be either the monolith `.../ad-snapshot.json` or the directory
 *   `.../ad-snapshot`. A `.json` path with no file behind it is mapped to its
 *   extension-stripped directory (matching resolveCacheDir() in cli/src/db.js).
 *   Run once against the functional repo's committed cache:
 *     node cli/src/migrations/regroup-ad-snapshot.js \
 *       ../etendo_schema_forge/cli/cache/ad-snapshot
 */

import { readFileSync, rmSync, existsSync, statSync, readdirSync } from 'node:fs';
import {
  sqlKey,
  paramsKey,
  normalizeSql,
  writeSqlFile,
  listSqlKeys,
} from '../lib/ad-cache.js';
import { isMainModule } from '../utils.js';

/**
 * Resolve the input path into a { dir, monolithPath } pair.
 *   - A `.json` file that exists → monolith mode (dir = path minus `.json`).
 *   - A `.json` path with no file → legacy cache-path mapping to its directory.
 *   - Anything else → treated as the cache directory itself.
 */
function resolveInput(inputPath) {
  if (!inputPath) throw new Error('regroup-ad-snapshot: a path is required');
  if (inputPath.endsWith('.json')) {
    const dir = inputPath.slice(0, -'.json'.length);
    if (existsSync(inputPath) && statSync(inputPath).isFile()) {
      return { dir, monolithPath: inputPath };
    }
    return { dir, monolithPath: null };
  }
  return { dir: inputPath, monolithPath: null };
}

/**
 * @param {string} inputPath - the monolith `.json` OR the cache directory.
 * @returns {{ files: number, versions: number, removedOldFiles: number,
 *             monolithRemoved: boolean, dir: string, alreadyDone: boolean }}
 */
export function regroupSnapshot(inputPath) {
  const { dir, monolithPath } = resolveInput(inputPath);

  const grouped = new Map(); // sqlKey -> { sql, versions }
  const oldPerQueryFiles = []; // per-(sql,params) files to remove
  let sourceVersions = 0;

  function addTriple(sql, params = [], rows = []) {
    const sk = sqlKey(sql);
    if (!grouped.has(sk)) grouped.set(sk, { sql: normalizeSql(sql), versions: {} });
    grouped.get(sk).versions[paramsKey(params)] = { params, rows };
    sourceVersions += 1;
  }

  // Source 1: monolith.
  if (monolithPath && existsSync(monolithPath)) {
    const raw = readFileSync(monolithPath, 'utf-8');
    const entries = raw.trim() ? JSON.parse(raw) : {};
    for (const e of Object.values(entries)) addTriple(e.sql, e.params || [], e.rows || []);
  }

  // Source 2: files already in the directory (old per-query OR already grouped).
  let alreadyGroupedFiles = 0;
  if (existsSync(dir)) {
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
      const fp = `${dir}/${name}`;
      const parsed = JSON.parse(readFileSync(fp, 'utf-8'));
      if (parsed.versions && typeof parsed.versions === 'object') {
        alreadyGroupedFiles += 1;
        for (const v of Object.values(parsed.versions)) {
          addTriple(parsed.sql, v.params || [], v.rows || []);
        }
      } else if ('rows' in parsed || 'sql' in parsed) {
        addTriple(parsed.sql, parsed.params || [], parsed.rows || []);
        oldPerQueryFiles.push(fp);
      }
    }
  }

  // Nothing to do: no monolith, no old per-query files, and the dir is already
  // fully grouped.
  const alreadyDone =
    !monolithPath && oldPerQueryFiles.length === 0 && alreadyGroupedFiles > 0;

  // Delete old per-query files first (their names are cacheKeys, distinct from
  // the sqlKey filenames we are about to write, so order is not strictly
  // required — but keep the directory clean regardless).
  for (const fp of oldPerQueryFiles) rmSync(fp, { force: true });

  // Write the grouped files (existing grouped files are overwritten in place).
  for (const [sk, file] of grouped) writeSqlFile(dir, sk, file);

  // Drop the monolith once its contents are safely regrouped.
  let monolithRemoved = false;
  if (monolithPath && existsSync(monolithPath)) {
    rmSync(monolithPath, { force: true });
    monolithRemoved = true;
  }

  return {
    files: grouped.size,
    versions: sourceVersions,
    removedOldFiles: oldPerQueryFiles.length,
    monolithRemoved,
    dir,
    alreadyDone,
  };
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node cli/src/migrations/regroup-ad-snapshot.js <path-to-ad-snapshot[.json]>');
    process.exit(1);
  }
  const r = regroupSnapshot(inputPath);
  if (r.alreadyDone) {
    console.log(`Already grouped: ${r.dir} holds ${listSqlKeys(r.dir).length} SQL file(s).`);
    return;
  }
  console.log(`Regrouped ${r.versions} version(s) → ${r.files} SQL file(s) in ${r.dir}/`);
  if (r.removedOldFiles > 0) console.log(`Deleted ${r.removedOldFiles} old per-query file(s).`);
  if (r.monolithRemoved) console.log(`Deleted monolith: ${inputPath}`);
  console.log(`Directory now holds ${listSqlKeys(r.dir).length} file(s).`);
}

if (isMainModule(import.meta.url)) {
  main();
}
