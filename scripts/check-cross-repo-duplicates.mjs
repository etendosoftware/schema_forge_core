#!/usr/bin/env node
// Fails when a source path present in both schema_forge_core and schema_forge drifts
// without a reviewed registry update (ETP-4980).
//
// Usage: node scripts/check-cross-repo-duplicates.mjs <path-to-schema_forge-checkout>
//
// Registry: scripts/cross-repo-duplicates.json
//   identical  {path: reason}                     both copies must stay byte-equal
//   divergent  {path: {reason, core, schema_forge}} known drift; each side is pinned by sha256,
//                                                 so ANY further change on either side fails
//   moved      {path: {core, reason}}             the module moved to `core` (published package);
//                                                 the copy still at `path` in schema_forge must match it
//                                                 apart from the report-i18n import specifier
// An unregistered shared path, a registered path whose state changed, or a stale entry fails.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = /\.(js|cjs|mjs|ts|tsx)$/;
const PACKAGE_I18N = "'@etendosoftware/schema-forge-cli/src/report-i18n.js'";
const RELATIVE_I18N = "'./report-i18n.js'";
const here = dirname(fileURLToPath(import.meta.url));
const coreRoot = resolve(here, '..');
if (!process.argv[2] || !existsSync(resolve(process.argv[2]))) {
  console.error('usage: check-cross-repo-duplicates.mjs <path-to-schema_forge-checkout>');
  process.exit(2);
}
const otherRoot = resolve(process.argv[2]);
const loaded = JSON.parse(readFileSync(join(here, 'cross-repo-duplicates.json'), 'utf8'));
const registry = { identical: {}, divergent: {}, moved: {}, ...loaded };

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const read = (root, f) => readFileSync(join(root, f));

const tracked = (root) =>
  new Set(
    execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 1 << 28 })
      .split('\0')
      .filter((f) => SOURCE.test(f) && existsSync(join(root, f))),
  );

function classify(f) {
  const coreBuf = read(coreRoot, f);
  const otherBuf = read(otherRoot, f);
  if (coreBuf.equals(otherBuf)) return { kind: 'identical' };
  return { kind: 'divergent', core: sha(coreBuf), other: sha(otherBuf) };
}

function describeMismatch(f, state) {
  if (state.kind === 'identical') {
    if (registry.divergent[f]) return `${f}: now identical, but registered as divergent — update scripts/cross-repo-duplicates.json`;
    return `${f}: new hand-made copy in both repos — move it into a published package`;
  }
  if (registry.identical[f]) return `${f}: no longer identical, registered as identical — port the missing hunk to the other repo`;
  return `${f}: differs between the two repos — port the missing hunk or consolidate it`;
}

function checkShared(f, problems) {
  const state = classify(f);
  const entry = registry[state.kind][f];
  if (!entry) {
    problems.push(describeMismatch(f, state));
    return;
  }
  if (state.kind === 'identical') return;
  if (entry.core !== state.core) {
    problems.push(`${f}: the core side changed since it was registered — review it, then update the sha256 in the registry`);
  }
  if (entry.schema_forge !== state.other) {
    problems.push(`${f}: the schema_forge side changed since it was registered — review it, then update the sha256 in the registry`);
  }
}

function checkMoved(f, entry, problems) {
  if (!existsSync(join(otherRoot, f))) {
    problems.push(`${f}: registered as moved but no longer present in schema_forge — remove the entry`);
    return;
  }
  const remaining = read(otherRoot, f).toString('utf8').replace(PACKAGE_I18N, RELATIVE_I18N);
  if (remaining !== read(coreRoot, entry.core).toString('utf8')) {
    problems.push(`${f}: differs from ${entry.core} in core (only the report-i18n import may differ) — port the hunk, do not copy the file`);
  }
}

const problems = [];
const shared = new Set();
const core = tracked(coreRoot);
const other = tracked(otherRoot);
for (const f of core) {
  if (!other.has(f)) continue;
  shared.add(f);
  checkShared(f, problems);
}
for (const kind of ['identical', 'divergent']) {
  for (const f of Object.keys(registry[kind])) {
    if (!shared.has(f)) problems.push(`${f}: registered as ${kind} but no longer present in both repos — remove the entry`);
  }
}
for (const [f, entry] of Object.entries(registry.moved)) checkMoved(f, entry, problems);

if (problems.length) {
  console.error(`Cross-repo duplicate check failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`Cross-repo duplicate check passed (${shared.size} shared paths, ${Object.keys(registry.moved).length} moved).`);
