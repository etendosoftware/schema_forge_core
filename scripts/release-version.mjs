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

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Every workspace that the publish job pushes to the registry, kept in lockstep.
export const PACKAGE_FILES = [
  'packages/schema-forge-core/package.json',
  'packages/app-shell-core/package.json',
  'packages/schema-forge-agent-context/package.json',
  'packages/schema-forge-stack/package.json',
  'packages/etendo-go-core/package.json',
  'cli/package.json',
];

// Extra (non-published) package.json files that consume the internal packages
// and must keep their cross-dependency ranges in lockstep, but whose own
// "version" field must NOT be bumped (e.g. the workspace root).
const DEP_ONLY_FILES = ['package.json'];

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

/**
 * Resolve the next lockstep release version (plain x.y.z), WITHOUT touching any
 * file. This is the auto-patch / manual-floor policy described at the top.
 */
export function resolveNextVersion() {
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

  return next.join('.');
}

/**
 * Write `version` into the `version` field of every publishable package AND into
 * every internal cross-dependency range (in publishable + dep-only files), so the
 * whole workspace stays in lockstep. Preserves formatting / key order.
 *
 * `version` may be a plain semver (release) OR a prerelease string such as
 * `0.3.7-preview.<branch>.<ts>.<sha>` (preview) — the rewrite is identical.
 */
export function writeVersionEverywhere(version) {
  // Names of the packages we manage, so internal cross-dependencies between them
  // stay in lockstep (an internal dep pinned to an old version breaks npm's
  // workspace linking and forces a registry fetch).
  const internalNames = PACKAGE_FILES.map(
    (relPath) => JSON.parse(readFileSync(join(REPO_ROOT, relPath), 'utf8')).name,
  );
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

  // Rewrite the version field AND any internal cross-dependency in every package
  // (preserve formatting / key order).
  for (const relPath of PACKAGE_FILES) {
    const abs = join(REPO_ROOT, relPath);
    const src = readFileSync(abs, 'utf8');
    let updated = src.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${version}"`);
    if (updated === src && !src.includes(`"version": "${version}"`)) {
      throw new Error(`Could not update version field in ${relPath}`);
    }
    // Internal deps appear as key/value pairs ("<name>": "<range>"); the package's
    // own "name" field has the scoped name as the VALUE, so it is not matched.
    for (const name of internalNames) {
      const re = new RegExp(`("${escapeRe(name)}"\\s*:\\s*)"[^"]*"`, 'g');
      updated = updated.replace(re, `$1"${version}"`);
    }
    writeFileSync(abs, updated);
  }

  // Sync internal cross-dependency ranges in non-published files (no version bump).
  for (const relPath of DEP_ONLY_FILES) {
    const abs = join(REPO_ROOT, relPath);
    let src = readFileSync(abs, 'utf8');
    for (const name of internalNames) {
      const re = new RegExp(`("${escapeRe(name)}"\\s*:\\s*)"[^"]*"`, 'g');
      src = src.replace(re, `$1"${version}"`);
    }
    writeFileSync(abs, src);
  }
}

function main() {
  const version = resolveNextVersion();
  writeVersionEverywhere(version);
  process.stdout.write(`version=${version}\n`);
  process.stdout.write(`tag=${version}\n`);
}

// Only run when invoked directly (`node scripts/release-version.mjs`), so this
// module can also be imported by preview-version.mjs without side effects.
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
