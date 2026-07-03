#!/usr/bin/env node
// Resolve the next lockstep release version for all publishable packages and
// write it into their package.json files (in the runner working tree only).
//
// Versioning policy (see .github/workflows/release.yml):
//   - All publishable packages share ONE version (lockstep).
//   - PATCH is automatic: on every push to main we bump the patch of the last
//     released git tag (v<major>.<minor>.<patch>).
//   - MINOR / MAJOR are manual: bump the version in packages/schema-forge-core/
//     package.json in your PR. When that "floor" is higher than the patch bump
//     of the last tag, we publish that floor as-is (no extra patch on top).
//     The other packages are realigned automatically, so you only edit ONE file.
//
// Output (stdout, ready for `>> "$GITHUB_OUTPUT"`):
//   version=<x.y.z>
//   tag=<x.y.z>          (git tag == plain semver, no "v" prefix)
//
// The reference package for the manual "floor" is schema-forge-core.

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Every workspace that the publish job pushes to the registry, kept in lockstep.
const PACKAGE_FILES = [
  'packages/schema-forge-core/package.json',
  'packages/app-shell-core/package.json',
  'packages/schema-forge-agent-context/package.json',
  'packages/schema-forge-stack/package.json',
  'packages/etendo-go-core/package.json',
  'cli/package.json',
];

// The single file a human edits to force a minor/major bump.
const REFERENCE_FILE = 'packages/schema-forge-core/package.json';

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

function parseSemver(v) {
  const m = SEMVER_RE.exec(v);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Return >0 if a>b, <0 if a<b, 0 if equal. */
function cmp(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function readVersion(relPath) {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, relPath), 'utf8'));
  const parsed = parseSemver(pkg.version);
  if (!parsed) {
    throw new Error(`${relPath} has a non-semver version "${pkg.version}"`);
  }
  return parsed;
}

/** Highest <x.y.z> git tag, or null when there are no release tags yet. */
function lastReleasedTag() {
  let out = '';
  try {
    out = execSync('git tag --list "[0-9]*.[0-9]*.[0-9]*"', { cwd: REPO_ROOT, encoding: 'utf8' });
  } catch {
    return null;
  }
  let best = null;
  for (const line of out.split('\n')) {
    // Tolerate a legacy "v" prefix on older tags just in case.
    const parsed = parseSemver(line.trim().replace(/^v/, ''));
    if (parsed && (best === null || cmp(parsed, best) > 0)) best = parsed;
  }
  return best;
}

function main() {
  const floor = readVersion(REFERENCE_FILE);
  const lastTag = lastReleasedTag();

  let next;
  if (lastTag === null) {
    // No releases yet: publish the current floor as the first release.
    next = floor;
  } else {
    const autoPatch = [lastTag[0], lastTag[1], lastTag[2] + 1];
    // Manual minor/major wins when the floor jumps past the auto patch.
    next = cmp(floor, autoPatch) > 0 ? floor : autoPatch;
  }

  const version = next.join('.');

  // Rewrite the version line in every package (preserve formatting / key order).
  for (const relPath of PACKAGE_FILES) {
    const abs = join(REPO_ROOT, relPath);
    const src = readFileSync(abs, 'utf8');
    const updated = src.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${version}"`);
    if (updated === src && !src.includes(`"version": "${version}"`)) {
      throw new Error(`Could not update version field in ${relPath}`);
    }
    writeFileSync(abs, updated);
  }

  process.stdout.write(`version=${version}\n`);
  process.stdout.write(`tag=${version}\n`);
}

main();
