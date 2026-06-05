# ETP-4083 Cross-Domain Plan: Cognitive-Complexity Refactor Sweep

## Domains

- `generator-change`: behavior-preserving cognitive-complexity refactors in the
  CLI — restructure the quality-gate runner (`cli/src/quality-gate/runner.js`)
  and extract the per-step validators in `cli/src/validate-processes.js` into
  named helpers. Both land alongside their tests
  (`cli/test/quality-gate-runner.test.js`, `cli/test/validate-processes.test.js`).
- `platform-change`: extract the report selector helpers in shared app-shell
  code (`tools/app-shell/src/pages/ReportViewerPage.jsx`) with a dedicated test
  (`tools/app-shell/src/pages/__tests__/ReportViewerPage.helpers.vitest.jsx`) —
  no rendering or data-flow change.
- `window:payment-out`: extract the linked-document helpers in the payment-out
  custom window (`RelatedDocuments.jsx`) and add unit coverage
  (`__tests__/RelatedDocuments.vitest.jsx`).
- `unknown`: add the `innocuous-check` skill (`.claude/skills/innocuous-check/SKILL.md`)
  — the behavior-preservation gate authored to verify exactly the refactors in
  this PR. Documentation/tooling only, no runtime effect.

Detected vertical: `finance` (single window: `payment-out`).

## Why This Cannot Be Split Cleanly

This PR is one ETP-4083 readability sweep: a set of pure, behavior-preserving
extractions made to lower cognitive complexity and clear SonarQube findings,
each paired with the tests that prove the extracted code is exercised. The
`innocuous-check` skill is the verification harness created in the same effort
to gate these refactors, so it ships with them rather than as a standalone
tooling PR. None of the individual extractions carry functional change or have
independent review value; splitting per scope would yield several trivial PRs
that only make sense reviewed together as "the complexity-reduction pass."

## Review Order

1. Generator refactors — `cli/src/quality-gate/runner.js` and
   `cli/src/validate-processes.js`: confirm extracted helpers are called
   identically and the suites (`quality-gate-runner.test.js`,
   `validate-processes.test.js`) exercise each one.
2. Platform refactor — `ReportViewerPage.jsx` selector helpers: confirm the
   extracted helpers preserve behavior, covered by
   `ReportViewerPage.helpers.vitest.jsx`.
3. Window refactor — payment-out `RelatedDocuments.jsx` linked-doc helpers:
   confirm output is unchanged, covered by `RelatedDocuments.vitest.jsx`.
4. Tooling — `innocuous-check/SKILL.md`: read-only verification skill, no
   runtime impact.
5. Review this plan.

## Tests

- `make test` (CLI suite — covers `quality-gate/runner.js` and
  `validate-processes.js`; both targeted files run green).
- `npm test --workspace=tools/app-shell` (app-shell vitest — covers the
  ReportViewer selector helpers and the payment-out RelatedDocuments helpers).
- No DB, NEO push, or `export.database` involved — these are source-level
  refactors and test additions only.

## Rollback

Every change is behavior-preserving (helper extractions, added tests, a new
read-only skill doc), so rollback is a straight revert of the PR merge commit.
If a single extraction regresses, revert that one file to its pre-PR state; no
data migration, NEO re-push, or `export.database` is required. Reverting the
skill addition removes the doc with no runtime effect.
