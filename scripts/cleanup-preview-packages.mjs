#!/usr/bin/env node
// Delete preview (prerelease) package versions from GitHub Packages, in one of
// two modes (see docs/plans/2026-07-14-preview-package-publishing.md, D5):
//
//   MODE=same-branch  (D5a) — after publishing a preview from a branch, delete
//     the OLDER previews of that SAME branch, keeping only the just-published one.
//     Requires BRANCH_NAME (to derive the branch id) and KEEP_VERSION (the version
//     just published, which must be preserved).
//
//   MODE=stale-feature (D5b) — sweep previews of `feature/*` branches older than
//     MAX_AGE_DAYS (default 7). Runs on the real release (main) and by manual
//     dispatch. Non-feature previews (epic-*, hotfix-*) are left to D5a.
//
// SAFETY: a version is NEVER deleted unless its name contains "-preview." — real
// releases (plain semver, `latest`) can never be touched by this script.
//
// The script is FAIL-SOFT: per-package / per-version errors are logged and
// skipped; it exits 0 so it can never block a publish. Only a missing/invalid
// config (env) exits non-zero.
//
// Env:
//   GITHUB_TOKEN   required — token with read + delete on org packages.
//   ORG            default "etendosoftware".
//   MODE           required — "same-branch" | "stale-feature".
//   BRANCH_NAME    required for same-branch — raw ref, e.g. "feature/ETP-4394".
//   KEEP_VERSION   required for same-branch — the version to preserve.
//   MAX_AGE_DAYS   stale-feature only — default 7.
//   DRY_RUN        "1"/"true" → log what would be deleted, delete nothing.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PACKAGE_FILES, REPO_ROOT } from './release-version.mjs';
import { sanitizeBranchId } from './preview-version.mjs';

const ORG = process.env.ORG || 'etendosoftware';
const TOKEN = process.env.GITHUB_TOKEN;
const MODE = process.env.MODE;
const DRY_RUN = /^(1|true)$/i.test(process.env.DRY_RUN || '');
const API = 'https://api.github.com';

const PREVIEW_MARKER = '-preview.'; // hard safety marker

function die(msg) {
  console.error(`::error::${msg}`);
  process.exit(1);
}

function ourPackageNames() {
  // Full scoped names + their unscoped last segment, to match however GitHub
  // labels the package in the org packages listing.
  const full = PACKAGE_FILES.map(
    (rel) => JSON.parse(readFileSync(join(REPO_ROOT, rel), 'utf8')).name,
  );
  const map = new Map(); // matchKey -> canonical full name (for logging)
  for (const name of full) {
    map.set(name, name);
    map.set(name.split('/').pop(), name);
  }
  return map;
}

async function gh(method, path) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  return res;
}

async function ghJsonPaged(path) {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const res = await gh('GET', `${path}${sep}per_page=100&page=${page}`);
    if (!res.ok) {
      throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
    }
    const batch = await res.json();
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

/** List the org's npm packages that belong to us, mapped to their API name. */
async function listOurPackages() {
  const wanted = ourPackageNames();
  let all;
  try {
    all = await ghJsonPaged(`/orgs/${ORG}/packages?package_type=npm`);
  } catch (e) {
    console.error(`::warning::Could not list org packages: ${e.message}`);
    return [];
  }
  const matched = [];
  for (const pkg of all) {
    // pkg.name may be scoped ("@etendosoftware/app-shell-core") or unscoped.
    if (wanted.has(pkg.name)) matched.push({ apiName: pkg.name, canonical: wanted.get(pkg.name) });
    else if (wanted.has(pkg.name.split('/').pop()))
      matched.push({ apiName: pkg.name, canonical: wanted.get(pkg.name.split('/').pop()) });
  }
  return matched;
}

function shouldDelete(versionName, opts) {
  // Absolute safety: only ever touch preview versions.
  if (!versionName.includes(PREVIEW_MARKER)) return false;

  if (opts.mode === 'same-branch') {
    const prefixNeedle = `${PREVIEW_MARKER}${opts.branchId}.`;
    if (!versionName.includes(prefixNeedle)) return false;
    return versionName !== opts.keepVersion; // keep the just-published one
  }

  if (opts.mode === 'stale-feature') {
    if (!versionName.includes(`${PREVIEW_MARKER}feature-`)) return false;
    return true; // age is checked by the caller (needs created_at)
  }

  return false;
}

async function cleanupPackage(pkg, opts) {
  let versions;
  try {
    versions = await ghJsonPaged(`/orgs/${ORG}/packages/npm/${encodeURIComponent(pkg.apiName)}/versions`);
  } catch (e) {
    console.error(`::warning::${pkg.apiName}: could not list versions — ${e.message}`);
    return { deleted: 0, kept: 0 };
  }

  let deleted = 0;
  let kept = 0;
  for (const v of versions) {
    const name = v.name; // npm version string
    if (!shouldDelete(name, opts)) {
      kept++;
      continue;
    }
    if (opts.mode === 'stale-feature') {
      const ageMs = opts.now - new Date(v.created_at).getTime();
      if (ageMs < opts.maxAgeMs) {
        kept++;
        continue;
      }
    }

    if (DRY_RUN) {
      console.log(`  [dry-run] would delete ${pkg.canonical}@${name} (id ${v.id})`);
      deleted++;
      continue;
    }
    try {
      const res = await gh(
        'DELETE',
        `/orgs/${ORG}/packages/npm/${encodeURIComponent(pkg.apiName)}/versions/${v.id}`,
      );
      if (res.ok || res.status === 204) {
        console.log(`  deleted ${pkg.canonical}@${name}`);
        deleted++;
      } else {
        console.error(`::warning::delete ${pkg.canonical}@${name} → ${res.status} ${await res.text()}`);
        kept++;
      }
    } catch (e) {
      console.error(`::warning::delete ${pkg.canonical}@${name} failed — ${e.message}`);
      kept++;
    }
  }
  return { deleted, kept };
}

async function main() {
  if (!TOKEN) die('GITHUB_TOKEN env is required');
  if (MODE !== 'same-branch' && MODE !== 'stale-feature')
    die(`MODE must be "same-branch" or "stale-feature" (got "${MODE}")`);

  const opts = { mode: MODE };
  if (MODE === 'same-branch') {
    if (!process.env.BRANCH_NAME) die('BRANCH_NAME env is required for same-branch mode');
    if (!process.env.KEEP_VERSION) die('KEEP_VERSION env is required for same-branch mode');
    opts.branchId = sanitizeBranchId(process.env.BRANCH_NAME);
    opts.keepVersion = process.env.KEEP_VERSION.trim();
  } else {
    const days = Number(process.env.MAX_AGE_DAYS || 7);
    opts.maxAgeMs = days * 24 * 60 * 60 * 1000;
    opts.now = Date.now();
  }

  console.log(
    `Cleanup mode=${MODE}${DRY_RUN ? ' (DRY_RUN)' : ''} org=${ORG}` +
      (MODE === 'same-branch' ? ` branchId=${opts.branchId} keep=${opts.keepVersion}` : ` maxAgeDays=${process.env.MAX_AGE_DAYS || 7}`),
  );

  const packages = await listOurPackages();
  if (!packages.length) {
    console.log('No matching packages found in the registry yet — nothing to clean.');
    return;
  }

  let totalDeleted = 0;
  for (const pkg of packages) {
    const { deleted } = await cleanupPackage(pkg, opts);
    totalDeleted += deleted;
  }
  console.log(`Done. ${DRY_RUN ? 'Would delete' : 'Deleted'} ${totalDeleted} preview version(s).`);
}

main().catch((e) => {
  // Fail-soft: never block the caller (publish/release) on cleanup errors.
  console.error(`::warning::cleanup-preview-packages failed softly: ${e.message}`);
  process.exit(0);
});
