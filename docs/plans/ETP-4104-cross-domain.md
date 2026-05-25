# ETP-4104 Cross-Domain Plan: Domain Boundary Gate

## Domains

- `repo-infra`: GitHub Actions workflow, CODEOWNERS, Makefile target, and ops docs.
- `generator-change`: CLI package metadata and the Node-based boundary check wrapper.
- `sdk-or-external-app`: publishable `@schema-forge/core` workspace package.

## Why This Cannot Be Split Cleanly

The workflow must call the CLI in the same PR that introduces the CLI, otherwise
the required check would point to a missing script. The reusable core module,
CODEOWNERS, and documentation need to land with the gate so the policy is
reviewable and executable together inside this repo and from external projects.

## Review Order

1. Review classifier policy and package tests.
2. Review workflow behavior, especially that it runs on every PR and merge group
   without `paths:` filters.
3. Review CODEOWNERS and Makefile wiring.
4. Review this plan and the ops documentation.

## Tests

- `npm test --workspace=packages/schema-forge-core`
- `npx sf-domain-boundary-check --changed-file artifacts/sales-order/contract.json`
- Smoke pass case with one window slice.
- Smoke fail case with unrelated windows.

## Rollback

Revert the workflow file first to remove the required gate entry point, then
revert the CLI, tests, docs, Makefile target, package bin entry, and CODEOWNERS
updates together.
