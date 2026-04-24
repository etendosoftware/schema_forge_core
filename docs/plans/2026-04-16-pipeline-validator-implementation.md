# Pipeline Completeness Validator — Implementation Plan

**Status:** `tbd`
**Date:** 2026-04-16
**Owner:** sbarrozo
**Type:** plan
**Parent design:** [2026-04-16-pipeline-completeness-validator.md](./2026-04-16-pipeline-completeness-validator.md)
**Epic:** ETP-3504

## Goal

Land the validator described in the parent design as a series of small, independently shippable PRs. Each phase is a single PR with a single Jira ticket so we can stop or revert at any boundary.

## Phase Summary

| #   | Phase                                        | Output                                                                  | Depends on  | Risk    |
| --- | -------------------------------------------- | ----------------------------------------------------------------------- | ----------- | ------- |
| P1  | Validator core + tests                       | `cli/src/validate-pipeline.js`, `cli/test/validate-pipeline.test.js`    | —           | low     |
| P2  | Generator patches (sourceHashes + manifest)  | edits to `generate-contract.js`, `generate-frontend.js`                 | P1 (schema) | medium  |
| P3  | Backfill migration                           | `cli/src/migrations/backfill-pipeline-hashes.js` + one mass-update PR    | P2          | high (large diff) |
| P4  | Pre-commit hook                              | `.githooks/pre-commit`, `make install` update                           | P1, P2, P3  | low     |
| P5  | GitHub Action (shadow mode)                  | `.github/workflows/pipeline-validate.yml`                               | P1          | low     |
| P6  | Flip GitHub Action to enforce mode           | edit workflow                                                           | P3, P5      | low     |
| P7  | Optional Jenkinsfile                         | `infra/jenkins/Jenkinsfile.pipeline-validate`                           | P1          | low     |

Each phase = 1 Jira issue + 1 PR. Branch naming follows `feature/ETP-XXXX` per Etendo Git Police.

## Task IDs

### P1 — Validator core

| Task ID  | Description                                                                                  |
| -------- | -------------------------------------------------------------------------------------------- |
| P1-T1    | Scaffold `cli/src/validate-pipeline.js` with `validatePipeline({scope, strict, skip})` API   |
| P1-T2    | Implement artifact classifier (`window` / `report` / `aggregate` / `aggregate-section`)      |
| P1-T3    | Implement rules F1, F2, F3, F5, F6, F7, F10 (window kind)                                    |
| P1-T4    | Implement rule F8 (report kind)                                                              |
| P1-T5    | Implement rule F9 (aggregate kind)                                                           |
| P1-T6    | Implement rule F4 (orphan output WARN/BLOCK)                                                 |
| P1-T7    | Wire CLI flags `--staged`, `--strict`, `--format=json`, `--skip=`                            |
| P1-T8    | Reporter: human-readable text + JSON formats                                                 |
| P1-T9    | Tests: fixture artifacts under `cli/test/fixtures/pipeline-validator/` covering each rule     |
| P1-T10   | Add `make validate-pipeline` target                                                          |

Acceptance: `node cli/src/validate-pipeline.js --format=json` runs cleanly today (against the existing repo, in **non-strict mode**) without crashing — even with rules F1/F2 unable to verify yet (they emit `skipped: missing-hashes` until P2 lands).

### P2 — Generator patches

| Task ID  | Description                                                                                  |
| -------- | -------------------------------------------------------------------------------------------- |
| P2-T1    | Add `sourceHashes` field to contract output in `generate-contract.js`                        |
| P2-T2    | Same for `generateProcessContract` (process/report contracts)                                |
| P2-T3    | Emit `artifacts/<window>/generated/.manifest.json` from `pipeline.js` `generate-frontend` step |
| P2-T4    | Update `cli/test/generate-contract.test.js` and friends to assert hashes are present          |
| P2-T5    | Wire validator rules F1, F2 to read the new fields (no more `skipped: missing-hashes`)        |
| P2-T6    | Update `docs/decisions-reference.md` + `docs/architecture-overview.md` with the new fields    |

Acceptance: Run pipeline on `sales-order` (or any worked window). `contract.json` has `sourceHashes`. `generated/.manifest.json` exists. Validator passes for that window. Untouched windows still emit `skipped: missing-hashes` (will be fixed in P3).

### P3 — Backfill migration

| Task ID  | Description                                                                                  |
| -------- | -------------------------------------------------------------------------------------------- |
| P3-T1    | Implement `cli/src/migrations/backfill-pipeline-hashes.js` (idempotent, dry-run by default)   |
| P3-T2    | Run `--dry-run` and triage the 27 `CG`-pattern windows (`contract + generated` no `decisions`) |
| P3-T3    | Decide per artifact: backfill `decisions.json` from existing contract, or whitelist as legacy |
| P3-T4    | Run migration in write mode, commit the result in one mechanical PR                          |
| P3-T5    | Confirm `validate-pipeline.js` reports zero `skipped: missing-hashes`                          |

Acceptance: full repo passes `validate-pipeline.js --strict` (or with a documented short skip-list).

### P4 — Pre-commit hook

| Task ID  | Description                                                                                  |
| -------- | -------------------------------------------------------------------------------------------- |
| P4-T1    | Write `.githooks/pre-commit` with the fast-path filter described in the design                |
| P4-T2    | Add `git config core.hooksPath .githooks` to `make install` and document in `README.md`       |
| P4-T3    | Smoke-test: edit `decisions.json`, attempt commit → blocked. Add `--no-verify` documented.    |
| P4-T4    | Add troubleshooting section to `docs/onboarding-methodology-shift.md`                         |

### P5 — GitHub Action (shadow mode)

| Task ID  | Description                                                                                  |
| -------- | -------------------------------------------------------------------------------------------- |
| P5-T1    | Create `.github/workflows/pipeline-validate.yml` from the skeleton in the design              |
| P5-T2    | Set `continue-on-error: true` for the validate step so PRs aren't blocked yet                 |
| P5-T3    | Wire PR comment annotation on failure                                                        |
| P5-T4    | Run on at least 5 real PRs and collect false-positive list                                   |

### P6 — Flip to enforce

| Task ID  | Description                                                                                  |
| -------- | -------------------------------------------------------------------------------------------- |
| P6-T1    | Address every false positive discovered in P5-T4 (either fix validator or backfill)           |
| P6-T2    | Remove `continue-on-error` from `pipeline-validate.yml`                                      |
| P6-T3    | Add `Required status check` for `Pipeline Validation` on `main` (manual GitHub setting)      |

### P7 — Jenkinsfile (optional)

| Task ID  | Description                                                                                  |
| -------- | -------------------------------------------------------------------------------------------- |
| P7-T1    | Add `infra/jenkins/Jenkinsfile.pipeline-validate` from the design skeleton                   |
| P7-T2    | Document Jenkins setup in `docs/ops/`                                                        |

## Cross-Phase Conventions

- All commits: `Feature ETP-XXXX: <description>` (max 80 chars), no `Co-Authored-By` (Etendo Git Police).
- All work in worktrees under `.worktrees/`, branched from `epic/ETP-3504`.
- Each PR targets `epic/ETP-3504` (not `main`).
- Pipeline order per PR: DEV → REVIEW (Alex) → QA (Sentinel) → DOCS (Sage) → merge by Clerk.

## Open Questions Carried From Design

1. P3-T2 outcome will determine whether F4 stays WARN or becomes BLOCK in `--strict`.
2. Whether to extend rule F3 to `menu.json` orphans is deferred to a follow-up after P6.
3. Aggregate sections (`accounting`, `crm`, …) — do they need their own contract? Out of scope here.

## Kickoff

Phase P1 starts immediately. Ticket created by Clerk under epic ETP-3504. Branch `feature/ETP-XXXX` (number assigned by Clerk). Schema Forge Developer slot 1 will work in a fresh worktree.
