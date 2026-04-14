# Epic Rollout Report

> **Status:** APPLIED in repository automation
> **Last updated:** 2026-04-14

## Context

Feature PRs merge into `epic/ETP-3504`, and the promotion from `epic/ETP-3504` to `develop` is where release risk becomes visible. By that point, reviewers need two things in one place:

- what the epic actually includes
- what the automated PR reviews already found while those feature PRs were entering the epic

Reviewing that information PR-by-PR is noisy and slow.

## Decision

We add a second reporting layer on top of the existing PR review gate:

1. Feature PRs targeting `epic/ETP-3504` continue to receive the `architecture-check` review comment and status check.
2. A dedicated workflow, `.github/workflows/epic-rollup-report.yml`, runs only when a PR targets `develop` and its head branch is `epic/ETP-3504`.
3. The workflow collects the feature PRs included in that epic promotion, extracts their latest `<!-- copilot-pr-review -->` result, and renders a single markdown report.
4. The report is posted back to the `epic -> develop` PR and uploaded as a workflow artifact.

## What the report shows

For each included feature PR, the report includes:

- PR number, title, author, and merge date into the epic
- the `## Summary` bullets from the feature PR body, when present
- the latest automated review outcome (`Clean`, `Comment only`, `Request changes`)
- the blocker and warning titles detected by the feature PR review

The top of the report also includes an overview count:

- total included PRs
- how many included PRs had blocking findings
- how many included PRs had warnings

## Implementation notes

- `cli/src/epic-rollup-report.js` is zero-dependency and only renders/parses markdown and JSON.
- The workflow gathers GitHub API data with `actions/github-script` because commit-to-PR association and comment retrieval are GitHub-specific concerns.
- Included feature PRs are discovered from merge commits already present in the `epic -> develop` PR commit list. This avoids maintaining a separate ledger.
- The report comment uses its own marker, `<!-- epic-rollup-report -->`, so reruns update the same comment instead of posting duplicates.

## Files involved

- `.github/workflows/epic-rollup-report.yml`
- `cli/src/epic-rollup-report.js`
- `cli/test/epic-rollup-report.test.js`
- `docs/ops/epic-rollup-report.md`
