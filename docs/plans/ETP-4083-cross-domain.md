# ETP-4083 Cross-Domain Plan: Cognitive-Complexity Refactor Sweep

## Domains

- `generator-change`: behavior-preserving cognitive-complexity refactors in the
  CLI generators — extract helpers out of the long routines in
  `cli/src/generate-contract.js` and `cli/src/generate-frontend.js`. Both land
  alongside their tests (`cli/test/generate-contract.test.js`,
  `cli/test/generate-frontend-custom-lines.test.js`). No change to generated
  output (confirmed by the generator unit tests and the `Offline Regeneration
  Check`).
- `platform-change`: extract a pure `getBillingPatch(opts, form)` helper out of
  the long submit handler in
  `tools/app-shell/src/components/contract-ui/CreateContactModal.jsx` and export
  it, with behavioral unit tests
  (`tools/app-shell/src/components/contract-ui/__tests__/getBillingPatch.vitest.js`,
  8 cases). No rendering or data-flow change.
- `unknown` (CLI verification script): same behavior-preserving helper
  extraction applied to `cli/src/verify-window.js` — classified `unknown` only
  because it has no scope glob; it is a CLI verification script and belongs to
  the generator/CLI domain. Covered by `cli/test/verify-window.test.js` (new).

Also includes a test-only hardening fix: `cli/test/contract-all.test.js` now
skips `_`-prefixed transient fixture dirs to remove a discovery race with
`cli/test/check-version.test.js`.

## Why This Cannot Be Split Cleanly

This PR is one ETP-4083 readability sweep: a set of pure, behavior-preserving
extractions made to lower cognitive complexity and clear SonarQube findings,
each paired with the tests that prove the extracted code is exercised. None of
the individual extractions carry functional change or have independent review
value; splitting per scope would yield several trivial PRs that only make sense
reviewed together as "the complexity-reduction pass."

## Review Order

1. Generator refactors — `cli/src/generate-contract.js` and
   `cli/src/generate-frontend.js`: confirm extracted helpers are called
   identically and the suites (`generate-contract.test.js`,
   `generate-frontend-custom-lines.test.js`) exercise each one.
2. CLI verification refactor — `cli/src/verify-window.js`: confirm extracted
   helpers preserve behavior, covered by `verify-window.test.js`.
3. Platform refactor — `CreateContactModal.jsx` `getBillingPatch` extraction:
   confirm output is unchanged, covered by `getBillingPatch.vitest.js`.
4. Test hardening — `contract-all.test.js` fixture-dir skip.
5. Review this plan.

## Tests

- `make test` / CLI suite run from repo root: 11887/11887 green, including the
  new `generate-frontend-custom-lines` and `verify-window` tests.
- `getBillingPatch.vitest.js`: 8/8 (app-shell vitest).
- `Offline Regeneration Check`, `Pipeline Validation`, and SonarQube checks pass.
- No DB, NEO push, or `export.database` involved — these are source-level
  refactors and test additions only.

## Rollback

Every change is behavior-preserving (helper extractions plus added tests), so
rollback is a straight revert of the PR merge commit. Each item is an isolated,
atomically committed extraction, so a single regression can be reverted with
`git revert <commit>` without touching the others. No data migration, NEO
re-push, or `export.database` is required — reverting fully restores prior
behavior. Detection is via the existing unit suites and the `Offline
Regeneration Check`.
