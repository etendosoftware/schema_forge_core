#!/usr/bin/env node
// Resolve a PREVIEW (prerelease) version for all publishable packages and write
// it into their package.json files (in the runner working tree only), reusing the
// exact same lockstep write logic as the real release (release-version.mjs) so the
// two never drift.
//
// Preview version shape (see docs/plans/2026-07-14-preview-package-publishing.md):
//   <base>-preview.<branchid>.<timestamp>.<shortsha>
//   e.g.  0.3.7-preview.feature-ETP-4394.20260714153045.a1b2c3d
//
//   - <base>      = resolveNextVersion() — the plain x.y.z this branch would
//                   release (auto-patch of the last tag, or the manual floor).
//   - <branchid>  = full branch name, sanitized to SemVer prerelease charset
//                   ([0-9A-Za-z-]); anything else becomes '-'. This is NOT
//                   cosmetic: it is the key the cleanup uses to match "previews of
//                   the same branch" (D5a) and "feature-* previews" (D5b).
//   - <timestamp> = UTC yyyymmddHHMMSS.
//   - <shortsha>  = the commit being published.
//
// Inputs (env, provided by the workflow):
//   BRANCH_NAME  required — raw ref name, e.g. "feature/ETP-4394".
//   SHORT_SHA    required — short commit sha.
//   (timestamp is generated here so the run time, not the commit time, is used.)
//
// Output (stdout, ready for `>> "$GITHUB_OUTPUT"`):
//   version=<base>-preview.<branchid>.<timestamp>.<shortsha>

import { fileURLToPath } from 'node:url';
import { resolveNextVersion, writeVersionEverywhere } from './release-version.mjs';

/** Sanitize a branch name to a valid SemVer prerelease identifier. */
export function sanitizeBranchId(raw) {
  const id = String(raw)
    .replace(/[^0-9A-Za-z-]/g, '-') // '/', '.', '_', etc. → '-'
    .replace(/-+/g, '-') // collapse runs of '-'
    .replace(/^-+|-+$/g, ''); // trim leading/trailing '-'
  if (!id) throw new Error(`Branch name "${raw}" sanitizes to an empty id`);
  return id;
}

/** Build the full preview version string. */
export function buildPreviewVersion({ base, branchId, timestamp, shortSha }) {
  return `${base}-preview.${branchId}.${timestamp}.${shortSha}`;
}

function utcTimestamp(d = new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  );
}

function main() {
  const branchRaw = process.env.BRANCH_NAME;
  const shortSha = process.env.SHORT_SHA;
  if (!branchRaw) throw new Error('BRANCH_NAME env is required');
  if (!shortSha) throw new Error('SHORT_SHA env is required');

  const version = buildPreviewVersion({
    base: resolveNextVersion(),
    branchId: sanitizeBranchId(branchRaw),
    timestamp: utcTimestamp(),
    shortSha: shortSha.trim().slice(0, 7), // github.sha is the full 40-char sha; keep 7 (git short-sha)
  });

  writeVersionEverywhere(version);
  process.stdout.write(`version=${version}\n`);
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
