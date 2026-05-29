# ETP-4083 Cross-Domain Plan: SonarQube Critical-Issue Cleanup

## Domains

- `generator-change`: Sonar fixes in CLI extractors and generators
  (`extract-*.js`, `generate-contract.js`, `generate-report-template.js`,
  `quality-gate.js`, `regen-all.js`, `resolve-curated.js`).
- `platform-change`: Sonar fixes in shared app-shell components and libs
  (`DataTable`, `DetailView`, `EntityForm`, `EntityCreationModal`, `ListView`,
  `CalendarView`, `AdvancedFilterBuilder`, `SideMenu`, `useBarcodeScanner`,
  `gridQuery`, `mockFetch`, `PreviewPage`).
- `shared-custom-capability`: Sonar fixes in the shared `LocationEditorModal`.
- `window:goods-receipt` / `window:product`: Sonar fixes in the custom
  components of those windows (`ImportFromPurchaseOrderModal`, `ProductSidebar`).
- `repo-infra`: adjustment to the `sonar-scan.yml` analysis workflow.
- `unknown`: CLI maintenance scripts and report tooling
  (`check-version.js`, `migrate-*.js`, `pr-review.js`, `report-*.js`,
  `validate-schema.js`, `tools/report-server/server.js`), the Tailwind
  purge guard test and config, `.gitignore`, and `feedback.md`.

## Why This Cannot Be Split Cleanly

This PR is a single transversal SonarQube remediation pass (ETP-4083) that
reduces critical issues across the whole repository. There is no new feature
and no behavior change — only quality refactors. The findings are reported by
one Sonar analysis run over the full tree, so the fixes naturally span every
scope at once. Splitting them per scope would create many tiny PRs with no
independent value, all closing the same Sonar quality gate, and would make the
overall "critical issues reduced" target impossible to review as a unit.

## Review Order

1. Review the generator (`cli/src/*`) Sonar fixes — confirm no behavior change
   in extractors/generators.
2. Review the platform (app-shell) component fixes — confirm rendering and
   props are unchanged.
3. Review the per-window custom component fixes (goods-receipt, product) and the
   shared `LocationEditorModal`.
4. Review the Tailwind purge guard and `sonar-scan.yml` workflow change.
5. Review this plan.

## Tests

- `make test` (CLI test suite).
- `npm test --workspace=tools/app-shell` (app-shell vitest suite, incl. the
  Tailwind purge guard and `CalendarView.indexEvents` test).
- `node cli/src/validate-pipeline.js` clean for touched artifacts.
- Manual smoke of goods-receipt and product custom windows in `make dev`.

## Rollback

These are behavior-preserving refactors, so rollback is a straight revert of the
PR merge commit. If a single fix regresses, revert that file to its pre-PR state;
no data migration or NEO re-push is involved.
