---
name: local-sonar-gate
description: Use when validating a branch locally against Sonar before pushing, after rebases, before opening or updating PRs, or when fixing Sonar and review findings in the Etendo Go module.
---

# Local Sonar Gate

## Overview

Run the existing local Sonar workflow, read the generated reports, and convert findings into an execution order. Do not invent a second scanner path when `run-sonar.sh` already exists.

## When to Use

Use this skill when:
- a branch touched `etendo_core/modules/com.etendoerp.go`
- Sonar comments or PR review findings need local verification
- a rebase may have introduced new issues
- you want to check only what changed before pushing

Do not use this skill when:
- the task is a pure code fix with no branch-level validation need
- Sonar credentials are unavailable and the user only wants static reasoning

## Preconditions

For `etendo_core/modules/com.etendoerp.go`:
- `SONAR_HOST_URL` must be set
- `SONAR_TOKEN` must be set
- run from the module root unless a caller explicitly needs a different cwd

Existing local assets:
- `run-sonar.sh`
- `sonar-project.properties`
- output directory `sonar-reports/`

## Standard Flow

1. Run local Sonar from the module root:
   ```bash
   ./run-sonar.sh
   ```
2. Read generated reports:
   - `sonar-reports/sonar-quality-gate.json`
   - `sonar-reports/sonar-issues.json`
   - `sonar-reports/sonar-issues-by-file.json`
   - `sonar-reports/sonar-measures.json`
3. If the branch is under review, compare findings against changed files only.
4. Prioritize fixes:
   - security / correctness
   - compile or runtime risk
   - maintainability with broad blast radius
   - cosmetic or purely conventional items
5. Fix in batches.
6. Rerun `./run-sonar.sh` after each substantial batch.

## Commit Hygiene

If the user wants Sonar work separated from the functional refactor:
- commit the behavior/refactor change first
- run Sonar on that committed state
- apply Sonar-requested fixes in a follow-up commit
- avoid mixing refactor and Sonar-only cleanups in the same commit unless the user explicitly prefers it

When `run-sonar.sh` requires a clean tree, this split is the preferred path over `--allow-dirty`. Use `--allow-dirty` only for exploratory scans or when the user explicitly accepts a non-canonical run.

## Changed-File Filter

When the goal is “only what this branch introduced”, gather changed files first:

```bash
git diff --name-only <base-ref>...HEAD
```

Typical base refs:
- `origin/main`
- `origin/epic/ETP-3504`
- another feature or epic branch if the PR targets it

Only treat Sonar findings on those changed files as branch work unless the user explicitly wants cleanup outside scope.

## How to Read the Reports

### Quality gate
- `OK` means the gate passed
- `ERROR` means the branch still has blocking Sonar conditions

### `sonar-issues-by-file.json`
Use this as the main triage input. It is already grouped per file and easier to turn into a repair plan than the flat issues list.

### `sonar-issues.json`
Use this when you need raw issue details not preserved in the grouped file.

### `sonar-measures.json`
Use this for branch-level context only. Do not let aggregate counts override file-level evidence.

## Triage Rules

### Apply immediately
- null-safety issues with clear runtime risk
- missing access checks
- incorrect transaction ownership
- duplicated literals that are security or domain messages used across multiple paths
- review comments that point to real compile or runtime failures

### Usually apply
- Javadoc / `@throws` completeness
- duplicated literals with localized low-risk extraction
- small complexity reductions through helper extraction

### Treat skeptically
- suggestions that add defensive checks where a surrounding invariant already guarantees non-null
- suggestions that increase ceremony without reducing risk
- “blocking” bots that require a larger redesign than the current branch scope

## Common Mistakes

- Running Sonar from the wrong directory
- Reading PR comments but not rerunning local Sonar
- Fixing every comment blindly without checking branch scope
- Treating all “blocking” bot comments as equally valid
- Reporting global issue counts instead of changed-file impact

## Quick Reference

### Run Sonar
```bash
cd etendo_core/modules/com.etendoerp.go
./run-sonar.sh
```

### Filter branch files
```bash
git diff --name-only origin/main...HEAD
```

### Minimal decision rule
- changed file + credible issue + low/medium refactor cost = fix now
- changed file + credible issue + large redesign = isolate and discuss
- unchanged file + cosmetic issue = ignore unless user asked for cleanup

## Output Expectation

After using this skill, report:
- quality gate status
- which changed files still have issues
- which findings were fixed
- which findings were intentionally left out of scope and why
