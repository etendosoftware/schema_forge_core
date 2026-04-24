# Pipeline Completeness Validator — Proposal

**Status:** `tbd` (awaiting review)
**Date:** 2026-04-16
**Owner:** sbarrozo
**Type:** plan

## Context

Schema Forge artifacts are produced by a sequential pipeline (see `cli/src/pipeline.js`):

```
extract-fields ──┐
extract-rules ───┤  (raw inputs, gitignored)
                 ▼
          decisions.json   ←── only this is hand-edited / git-tracked input
                 ▼
        resolve-curated   (in-memory, no file)
                 ▼
        contract.json     ←── git-tracked output
                 ▼
        push-to-neo       (DB-side effect, not a file)
                 ▼
        generated/web/<window>/   ←── git-tracked output
                 ▼
        registry.js loader entry  ←── git-tracked output
```

`.gitignore` only tracks **three layers** of artifact data:

- `artifacts/<window>/decisions.json` — the input
- `artifacts/<window>/contract.json` (and `report-contract.json`, `aggregate-contract.json`) — the output of the contract step
- `artifacts/<window>/generated/` — the output of the frontend generator

Everything upstream (`schema-raw.json`, `rules-raw.json`, `processes.json`, `schema-curated.json`) is **gitignored** because it is regenerated from the Etendo DB on every run.

### Snapshot of current artifact health (2026-04-16)

Aggregate count of file-presence patterns across `artifacts/`:

| Pattern              | Count | Likely state                                                               |
| -------------------- | ----- | -------------------------------------------------------------------------- |
| `contract + decisions + generated` | 26    | OK — fully worked window                                                   |
| `contract + generated` (no decisions) | 27    | Suspicious — needs whitelist (reports?) or backfill of `decisions.json`    |
| `generated` only     | 10    | Aggregate/section folders (`accounting`, `crm`, `sales`, …) — separate kind |
| _(empty)_            | 16    | All `print-*` / `aging-*` reports — different artifact shape (`report-contract.json` + `template.hbs`) |

Conclusion: today there is **no enforcement** that `decisions.json`, `contract.json`, and `generated/` are mutually consistent. Anyone can edit `decisions.json` and forget to regenerate, or commit a contract bump without re-running the frontend generator. We need a guard that runs both on the developer's machine (pre-commit) and in CI (PR).

## Objective

Detect **incomplete pipeline runs** before code is merged. The validator must:

1. Run as a **pre-commit Git hook** to stop the developer locally.
2. Run as a **CI check** (GitHub Actions today, optional Jenkinsfile) to stop the PR.
3. Use **only git-tracked files** (no DB access required) so it can run offline / on PRs from forks.
4. Be **fast** — must finish in seconds for an interactive commit.
5. Be **deterministic** — same inputs, same verdict, no flakiness.
6. Cover three artifact shapes: window, process/report, aggregate.

Out of scope (for this proposal):

- Re-running the full pipeline against a live Etendo DB.
- Validating that NEO Headless actually has the spec configured (DB-side check).
- Auto-fixing — this guard only **detects**.

## Failure Modes to Detect

Each failure mode = one validator rule. Numbered for reference in the implementation.

| #   | Failure mode                                                          | Detection signal                                                                                      | Severity |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| F1  | `decisions.json` modified, `contract.json` not modified in same commit/PR | Hash mismatch: `hash(decisions.json) !== contract.sourceHashes.decisions`                              | BLOCK    |
| F2  | `contract.json` modified, `generated/` not regenerated                 | Hash mismatch: `hash(contract.json) !== generated/.manifest.json.contractChecksum`                    | BLOCK    |
| F3  | New window has `contract.json` but no entry in `tools/app-shell/src/windows/registry.js` | `contract.json` exists for window not in `registry.js` (and not in `customLoaders`)                   | BLOCK    |
| F4  | `generated/` exists but `contract.json` missing (orphaned output)      | Folder pattern: `generated/` present, `contract.json` absent, and not on the aggregate whitelist     | WARN     |
| F5  | `decisions.json` schema/version is stale (auto-migration would change it) | Run `migrations/index.js → needsMigration(decisions)` returns true                                    | BLOCK    |
| F6  | `contract.version` in repo is below `prevVersion` baseline (downgrade) | `semver.lt(current.version, prev.version)` for any contract                                            | BLOCK    |
| F7  | Window has `decisions.json` but listed in `excludedEntities` of itself (typo guard) | Trivial structural check                                                                              | WARN     |
| F8  | Report artifact missing one of: `report-contract.json`, `template.hbs`, `helpers.js`, `mock-data.json` | File-presence check, only when at least one of the four exists                                       | BLOCK    |
| F9  | Aggregate artifact missing `aggregate-contract.json` but has `generated/` | File-presence check                                                                                  | BLOCK    |
| F10 | `registry.js` has loader for `<window>` but `artifacts/<window>/generated/web/<window>/index.jsx` is missing | Cross-reference                                                                                       | BLOCK    |

`BLOCK` = exit non-zero, both in pre-commit and CI.
`WARN` = log to stderr, do not fail. Configurable via `--strict` to promote warnings to blocks.

## Proposed Design

### 1. New CLI: `cli/src/validate-pipeline.js`

A single Node script (Node 22 ESM, same stack as the rest of `cli/src/`) with two operating modes:

```bash
# Validate the whole repo (CI mode)
node cli/src/validate-pipeline.js

# Validate only what changed (pre-commit mode)
node cli/src/validate-pipeline.js --staged

# Strict (warnings become errors)
node cli/src/validate-pipeline.js --strict

# JSON output (for CI annotations)
node cli/src/validate-pipeline.js --format=json

# Skip a rule (escape hatch, requires justification in commit body)
node cli/src/validate-pipeline.js --skip=F4,F7
```

Module export so it is testable:

```js
export async function validatePipeline({ scope, strict, skip }) {
  // scope: 'all' | 'staged' | string[] of artifact names
  // returns { violations: [{rule, artifact, severity, message, fix}], summary }
}
```

### 2. Hash Embedding (one-time bootstrap)

To make rules F1 and F2 work without re-running the pipeline, the generators must embed source hashes in their outputs.

**`generate-contract.js` change:**

```js
contract.sourceHashes = {
  decisions: sha256(decisionsJson),     // raw bytes of decisions.json
  schema: sha256(schemaRawJson),        // raw bytes (CI cannot verify but useful locally)
};
```

**`generate-frontend.js` change:** write a manifest file alongside outputs.

```
artifacts/<window>/generated/.manifest.json
{
  "contractChecksum": "42aace64015ae4c3",   // copied from contract.checksum
  "contractVersion": "0.14.0",
  "generatedAt": "2026-04-16T14:00:00Z",
  "generator": "generate-frontend.js",
  "files": ["index.jsx", "HeaderForm.jsx", ...]
}
```

The manifest is git-tracked. The validator just compares `manifest.contractChecksum` against `contract.checksum`.

**Bootstrap migration:** a one-shot script `cli/src/migrations/backfill-pipeline-hashes.js` that walks every artifact, recomputes the hashes for the current files, and writes them. Once committed, the validator becomes enforceable.

### 3. Pre-commit Hook

Replace the current empty `.githooks/pre-push` (or add a new `.githooks/pre-commit`) with:

```bash
#!/usr/bin/env bash
# .githooks/pre-commit
set -e

# Only run when artifact files are staged — fast path for unrelated commits.
if ! git diff --cached --name-only | grep -qE '^(artifacts/|tools/app-shell/src/windows/registry\.js|cli/src/(generate|resolve|push)-)'; then
  exit 0
fi

node cli/src/validate-pipeline.js --staged
```

Activation lives in repo via `git config core.hooksPath .githooks`. Add a one-line bootstrap to `make install` so new developers get it for free:

```make
install: ## Install all workspace dependencies
	npm install
	git config core.hooksPath .githooks
```

Escape hatch: `git commit --no-verify` (already standard). The Etendo Git Police skill doc warns against it; we keep the warning.

### 4. GitHub Action

Add `.github/workflows/pipeline-validate.yml`:

```yaml
name: Pipeline Validation

on:
  pull_request:
    types: [opened, synchronize]
    paths:
      - 'artifacts/**'
      - 'tools/app-shell/src/windows/registry.js'
      - 'cli/src/generate-**'
      - 'cli/src/resolve-**'
      - 'cli/src/push-**'
      - '.github/workflows/pipeline-validate.yml'
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # need full history to diff against base ref

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Validate pipeline completeness
        id: validate
        run: |
          node cli/src/validate-pipeline.js --format=json | tee validation.json
        continue-on-error: false

      - name: Annotate PR with violations
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('validation.json', 'utf8'));
            const body = report.violations.map(v =>
              `- **[${v.rule}]** \`${v.artifact}\` — ${v.message}\n  Fix: ${v.fix}`
            ).join('\n');
            await github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Pipeline validation failed\n\n${body}`,
            });
```

Path filters keep the action cheap (skipped on docs-only PRs).

### 5. Jenkinsfile (alternative for self-hosted)

Skeleton — can be added under `infra/jenkins/Jenkinsfile.pipeline-validate` for teams that mirror to Jenkins:

```groovy
pipeline {
  agent { label 'node22' }
  options { timeout(time: 5, unit: 'MINUTES') }

  stages {
    stage('Checkout')  { steps { checkout scm } }
    stage('Install')   { steps { sh 'npm ci' } }
    stage('Validate')  {
      steps {
        sh 'node cli/src/validate-pipeline.js --format=json > validation.json || true'
        script {
          def report = readJSON file: 'validation.json'
          if (report.violations.any { it.severity == 'BLOCK' }) {
            error("Pipeline validation failed: ${report.summary.blocking} blocking issue(s)")
          }
        }
      }
      post {
        always {
          archiveArtifacts artifacts: 'validation.json', allowEmptyArchive: true
        }
      }
    }
  }
}
```

## Decision Tree per Artifact

Pseudo-code the validator follows for each `artifacts/<name>/` folder:

```
classify(folder):
  if has aggregate-contract.json     → kind = 'aggregate'
  else if has report-contract.json   → kind = 'report'
  else if has contract.json          → kind = 'window'
  else if has generated/ only        → kind = 'aggregate-section' (whitelisted)
  else                               → kind = 'unknown'

per kind:
  window     → run F1, F2, F3, F5, F6, F7, F10
  report     → run F8 only
  aggregate  → run F9 only
  unknown    → emit WARN (or BLOCK with --strict)
```

## Migration Path

1. **Doc review** (this file) — get approval.
2. **Implement `validate-pipeline.js`** + unit tests (`cli/test/validate-pipeline.test.js`) using fixture artifacts. ~250 LOC.
3. **Patch generators** to emit `sourceHashes` + `generated/.manifest.json`. Backwards-compatible (read-or-default).
4. **Run backfill migration** once on `main`, commit the resulting hashes/manifests in a single PR (high churn but mechanical).
5. **Land the GitHub Action in `report-only` mode** for one week (logs violations as comments but does not fail). Collect false-positive list.
6. **Flip to enforce mode**, install the pre-commit hook in `make install`.
7. **Add Jenkinsfile** if/when needed.

## Open Questions

1. Should the validator regenerate the contract from `decisions.json` in CI (requires raw inputs to be checked in, or recomputed from a snapshot) or trust `sourceHashes`? — Recommendation: trust the hashes. Re-running is a separate "pipeline-rebuild" job nightly.
2. The 27 windows currently in `CG` state (`contract + generated`, no `decisions.json`) — are they intentional (auto-classified, no human decisions yet) or did somebody delete `decisions.json`? Need to triage in step 4 before turning the rule on.
3. Aggregate sections (`accounting`, `crm`, …) — should they have their own contract too? Out of scope for this proposal but worth a follow-up.
4. Should rule F3 also check `menu.json` / `menu-cache` for orphaned menu entries? — Probably yes, but defer to a follow-up.
5. What's the policy for `--no-verify` commits landing on `main`? — Recommend: CI catches them anyway since the same validator runs on PR.

## Next Steps (after approval)

- Convert this doc's "Migration Path" into a phased plan under `docs/plans/<date>-pipeline-validator-implementation.md` with task IDs.
- Create Jira issues per phase (epic ETP-3504 if it fits, else new epic).
- Spawn `Schema Forge Developer` agent to implement `validate-pipeline.js` + generator patches in a feature branch.
- Land the GitHub Action in shadow mode first (see step 5 above).
