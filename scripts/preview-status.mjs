#!/usr/bin/env node
// Report which PREVIEW package version CI published for the CURRENT branch HEAD,
// without opening GitHub. Run this locally in the core repo AFTER pushing.
//
// The "Publish preview packages" workflow (.github/workflows/publish-preview.yml)
// pins a COMMIT STATUS to every pushed feature SHA:
//   context     = "preview-package"
//   state       = "success"
//   description  = "alpha: <version>"
//   target_url   = the workflow run URL
// That status is the canonical, PR-independent signal — this script reads it back.
//
// Behavior:
//   1. Resolve SHA + BRANCH from git.
//   2. Resolve the "owner/repo" slug from the `origin` remote.
//   3. `gh api repos/<slug>/commits/<SHA>/statuses`, pick context "preview-package"
//      (most recent if several).
//   4a. Found (success) → print the version (parsed from the description), short
//       sha, run URL and the exact pin command for the FUNCTIONAL repo. Exit 0.
//   4b. Not found → friendly "no preview yet" message + latest run for context.
//       Exit 1 (scriptable).
//
// Env:
//   WAIT=1   poll every ~15s up to ~5min until the status appears (optional).
//
// Preconditions: `gh` installed + authenticated. If not, prints a hint and exits
// non-zero.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FALLBACK_SLUG = 'etendosoftware/schema_forge_core';
const STATUS_CONTEXT = 'preview-package';
const WAIT_INTERVAL_MS = 15_000;
const WAIT_TIMEOUT_MS = 5 * 60_000;

/** Run a command, return trimmed stdout. Throws on non-zero exit. */
function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** Run a command, return trimmed stdout or null on any failure (fail-soft). */
function runSoft(cmd, args) {
  try {
    return run(cmd, args);
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parse a git remote URL (ssh or https) into an "owner/repo" slug. */
export function parseSlug(remoteUrl) {
  if (!remoteUrl) return null;
  const url = remoteUrl.trim();
  // git@github.com:owner/repo.git  OR  ssh://git@github.com/owner/repo.git
  // https://github.com/owner/repo.git  OR  https://github.com/owner/repo
  const m = url.match(/[/:]([^/:]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (!m) return null;
  return `${m[1]}/${m[2]}`;
}

function resolveSlug() {
  const remote = runSoft('git', ['remote', 'get-url', 'origin']);
  return parseSlug(remote) || FALLBACK_SLUG;
}

/** Ensure `gh` is installed and authenticated; exit non-zero with a hint if not. */
function ensureGh() {
  if (!runSoft('gh', ['--version'])) {
    console.error('❌ GitHub CLI (`gh`) is not installed or not on PATH.');
    console.error('   Install it from https://cli.github.com/ and run `gh auth login`.');
    process.exit(2);
  }
  try {
    execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' });
  } catch {
    console.error('❌ GitHub CLI is not authenticated.');
    console.error('   Run `gh auth status` to check, then `gh auth login`.');
    process.exit(2);
  }
}

/**
 * Fetch the most-recent "preview-package" commit status for a SHA.
 * Returns the status object, or null if there is none.
 */
function fetchPreviewStatus(slug, sha) {
  const raw = runSoft('gh', ['api', `repos/${slug}/commits/${sha}/statuses`]);
  if (!raw) return null;
  let statuses;
  try {
    statuses = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(statuses)) return null;
  // The API returns statuses newest-first; keep only ours and take the first.
  const ours = statuses.filter((s) => s && s.context === STATUS_CONTEXT);
  if (!ours.length) return null;
  // Be defensive about ordering: sort by updated_at desc.
  ours.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
  return ours[0];
}

/** Strip the "alpha: " prefix from the status description to get the version. */
export function parseVersion(description) {
  if (!description) return null;
  return description.replace(/^alpha:\s*/i, '').trim() || null;
}

function printPublished(status, shortSha) {
  const version = parseVersion(status.description);
  console.log('');
  console.log('✅ Preview published for this HEAD');
  console.log('   ────────────────────────────────────────────────');
  console.log(`   version : ${version || '(could not parse from description)'}`);
  console.log(`   commit  : ${shortSha}`);
  console.log(`   dist-tag: alpha`);
  if (status.target_url) console.log(`   run     : ${status.target_url}`);
  console.log('');
  console.log('   Pin it in the FUNCTIONAL repo (etendo_schema_forge):');
  console.log('');
  if (version) console.log(`     make bump-core-version VERSION=${version}`);
  console.log('');
}

function printNotYet(slug, branch, shortSha) {
  console.log('');
  console.log(
    `⏳ HEAD ${shortSha} has no preview yet — the 'Publish preview packages' ` +
      `workflow is still running or failed.`,
  );
  console.log('   (If you have not pushed this commit yet, push it first.)');
  console.log('');
  console.log(`   Latest run on branch ${branch} for context:`);
  const runList = runSoft('gh', [
    'run',
    'list',
    '--workflow',
    'publish-preview.yml',
    '--branch',
    branch,
    '-L',
    '1',
  ]);
  if (runList) {
    for (const line of runList.split('\n')) console.log(`     ${line}`);
  } else {
    console.log('     (could not fetch run list — check `gh run list` manually)');
  }
  console.log('');
  console.log(`   Re-run with WAIT=1 to poll until the preview appears.`);
  console.log('');
}

async function main() {
  ensureGh();

  const sha = run('git', ['rev-parse', 'HEAD']);
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  const shortSha = sha.slice(0, 7);
  const slug = resolveSlug();

  console.log(`Checking preview status for ${slug} @ ${shortSha} (${branch})...`);

  const wait = /^(1|true)$/i.test(process.env.WAIT || '');
  const deadline = Date.now() + WAIT_TIMEOUT_MS;

  let status = fetchPreviewStatus(slug, sha);
  while (!status && wait && Date.now() < deadline) {
    process.stdout.write('  … no preview yet, waiting 15s\n');
    await sleep(WAIT_INTERVAL_MS);
    status = fetchPreviewStatus(slug, sha);
  }

  if (status && status.state === 'success') {
    printPublished(status, shortSha);
    process.exit(0);
  }

  printNotYet(slug, branch, shortSha);
  process.exit(1);
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`❌ preview-status failed: ${e.message}`);
    process.exit(2);
  });
}
