# Epic Rollout Report

> **Status:** APPLIED in repository automation
> **Last updated:** 2026-04-14

## Context

Feature PRs merge into `epic/ETP-3504`, and the promotion from `epic/ETP-3504` to `develop` is where release risk becomes visible. By that point, reviewers need two things in one place:

- what the epic actually includes
- what the automated PR reviews already found while those feature PRs were entering the epic

Reviewing that information PR-by-PR is noisy and slow.

## Decision

We add a two-step reporting flow on top of the existing PR review gate:

1. Feature PRs targeting `epic/ETP-3504` continue to receive the `architecture-check` review comment and status check.
2. A dedicated workflow, `.github/workflows/epic-rollup-entry.yml`, runs when a feature PR is merged into `epic/ETP-3504`. It converts that PR into a compact stored rollout entry comment.
3. The existing `.github/workflows/epic-rollup-report.yml` workflow still runs on `epic/ETP-3504 -> develop`, but it now prefers those stored entry comments instead of recomputing everything from raw PR data.
4. The final report is posted back to the `epic -> develop` PR and uploaded as a workflow artifact.
## What the report shows

For each included feature PR, the final report includes data captured at epic-merge time:

- PR number, title, author, and merge date into the epic
- the `## Summary` bullets from the feature PR body, when present
- the latest automated review outcome (`Clean`, `Comment only`, `Request changes`)
- the blocker and warning titles detected by the feature PR review

The top of the report also includes an overview count:

- total included PRs
- how many included PRs had blocking findings
- how many included PRs had warnings

## Implementation notes

- `cli/src/epic-rollup-report.js` is zero-dependency and now handles both stored-entry rendering/parsing and final report rendering.
- `.github/workflows/epic-rollup-entry.yml` creates one bot-managed `<!-- epic-rollup-entry -->` comment per merged feature PR.
- `.github/workflows/epic-rollup-report.yml` aggregates those stored entries for `epic -> develop`, with a live fallback for older PRs that do not yet have an entry comment.
- Included feature PRs are still discovered from merge commits already present in the `epic -> develop` PR commit list, which matches the repository policy of preserving merge commits.
- The final report comment uses its own marker, `<!-- epic-rollup-report -->`, so reruns update the same comment instead of posting duplicates.

## Files involved

- `.github/workflows/epic-rollup-entry.yml`
- `.github/workflows/epic-rollup-report.yml`
- `cli/src/epic-rollup-report.js`
- `cli/test/epic-rollup-report.test.js`
- `docs/ops/epic-rollup-report.md`
