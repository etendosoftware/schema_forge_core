#!/usr/bin/env node
// Fails when a source path present in both schema_forge_core and schema_forge differs
// and is not a recorded, known divergence (ETP-4980).
//
// Usage: node scripts/check-cross-repo-duplicates.mjs <path-to-schema_forge-checkout>
//
// Rules (registry: scripts/cross-repo-duplicates.json):
//   - a path in both repos that differs and is not under `divergent`  -> fail (new drift)
//   - a path in both repos that is identical and is not under `identical` -> fail
//     (a new hand-made copy: move it into a published package instead)
//   - a registry entry that no longer matches its state                -> fail (stale)
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = /\.(js|cjs|mjs|ts|tsx)$/;
const here = dirname(fileURLToPath(import.meta.url));
const coreRoot = resolve(here, '..');
const otherRoot = resolve(process.argv[2] ?? '');
if (!process.argv[2] || !existsSync(otherRoot)) {
  console.error('usage: check-cross-repo-duplicates.mjs <path-to-schema_forge-checkout>');
  process.exit(2);
}
const registry = JSON.parse(readFileSync(join(here, 'cross-repo-duplicates.json'), 'utf8'));

const tracked = (root) =>
  new Set(
    execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 1 << 28 })
      .split('\0')
      .filter((f) => SOURCE.test(f) && existsSync(join(root, f))),
  );
const a = tracked(coreRoot);
const b = tracked(otherRoot);
const problems = [];
const seen = new Set();
for (const f of a) {
  if (!b.has(f)) continue;
  seen.add(f);
  const same = readFileSync(join(coreRoot, f)).equals(readFileSync(join(otherRoot, f)));
  const kind = same ? 'identical' : 'divergent';
  if (registry[kind][f]) continue;
  const other = same ? 'divergent' : 'identical';
  problems.push(
    registry[other][f]
      ? `${f}: now ${kind}, but registered as ${other} — update scripts/cross-repo-duplicates.json`
      : same
        ? `${f}: new hand-made copy in both repos — move it into a published package`
        : `${f}: differs between the two repos — port the missing hunk or consolidate it`,
  );
}
for (const kind of ['identical', 'divergent']) {
  for (const f of Object.keys(registry[kind])) {
    if (!seen.has(f)) problems.push(`${f}: registered as ${kind} but no longer present in both repos — remove the entry`);
  }
}
if (problems.length) {
  console.error(`Cross-repo duplicate check failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`Cross-repo duplicate check passed (${seen.size} shared paths, all registered).`);
