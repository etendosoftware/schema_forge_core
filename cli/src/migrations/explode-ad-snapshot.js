/**
 * explode-ad-snapshot.js
 *
 * One-shot migration: split a monolithic AD cache (`ad-snapshot.json`) into a
 * directory of per-query files (`ad-snapshot/<key>.json`), then delete the
 * monolith. Each entry keeps its shape ({ sql, params, rows }) and is written
 * via writeEntry() so the on-disk output matches what the live cache produces.
 *
 * Idempotent: if the monolith is already gone, it reports and exits cleanly.
 *
 * Usage:
 *   node cli/src/migrations/explode-ad-snapshot.js <path-to-ad-snapshot.json>
 *
 * The target directory is the monolith path with the `.json` extension dropped
 * (`.../ad-snapshot.json` → `.../ad-snapshot/`), matching resolveCacheDir() in
 * cli/src/db.js. Run once against the functional repo's committed cache:
 *   node cli/src/migrations/explode-ad-snapshot.js \
 *     ../etendo_schema_forge/cli/cache/ad-snapshot.json
 */

import { readFileSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writeEntry, listKeys } from '../lib/ad-cache.js';
import { isMainModule } from '../utils.js';

/**
 * @param {string} monolithPath - path to the existing ad-snapshot.json
 * @returns {{ exploded: number, dir: string, alreadyDone: boolean }}
 */
export function explodeSnapshot(monolithPath) {
  if (!monolithPath || !monolithPath.endsWith('.json')) {
    throw new Error(`explode-ad-snapshot: expected a .json path, got "${monolithPath}"`);
  }
  const dir = monolithPath.slice(0, -'.json'.length);

  if (!existsSync(monolithPath)) {
    return { exploded: 0, dir, alreadyDone: true };
  }

  const raw = readFileSync(monolithPath, 'utf-8');
  const entries = raw.trim() ? JSON.parse(raw) : {};
  const keys = Object.keys(entries);
  for (const key of keys) {
    writeEntry(dir, key, entries[key]);
  }

  rmSync(monolithPath, { force: true });
  return { exploded: keys.length, dir, alreadyDone: false };
}

function main() {
  const monolithPath = process.argv[2];
  if (!monolithPath) {
    console.error('Usage: node cli/src/migrations/explode-ad-snapshot.js <path-to-ad-snapshot.json>');
    process.exit(1);
  }
  const { exploded, dir, alreadyDone } = explodeSnapshot(monolithPath);
  if (alreadyDone) {
    console.log(`Nothing to do: ${monolithPath} does not exist.`);
    console.log(`Per-query directory holds ${listKeys(dir).length} entrie(s): ${dir}`);
    return;
  }
  console.log(`Exploded ${exploded} entrie(s) → ${dir}/`);
  console.log(`Deleted monolith: ${monolithPath}`);
  console.log(`Directory now holds ${listKeys(dir).length} file(s).`);
}

if (isMainModule(import.meta.url)) {
  main();
}
