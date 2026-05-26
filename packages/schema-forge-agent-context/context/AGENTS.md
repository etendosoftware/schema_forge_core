# Schema Forge Agent Context

Use this packaged context as the default orientation when working on a consumer project that depends on Schema Forge packages.

## Core Workflow

- Keep implementation changes, tests, and documentation aligned.
- Use feature branches and pull requests for all repository changes.
- Prefer deterministic checks in code over complex shell logic embedded in workflows.
- Keep committed code, comments, filenames, commit messages, and documentation in English.

## Architecture Context

- Schema Forge defines contracts, generated UI inputs, validation policy, and packaging boundaries.
- Etendo Go serves runtime API behavior through NEO Headless.
- External app-shell consumers receive the reusable shell runtime, shared styles, UI primitives, reporting frame, auth helpers, and menu/layout contracts.
- Generated contracts and generated windows stay outside `@etendosoftware/app-shell-core`.

## Hard Rules

- Do not hardcode or guess window, process, or menu IDs.
- Do not manually edit generated files under `artifacts/*/generated/`.
- If a task touches a generated/custom window, update the related functional documentation in the same change.
- Prefer public package imports such as `@etendosoftware/app-shell-core` over monorepo-relative imports.
- Do not add frontend business logic to `@etendosoftware/app-shell-core` when it belongs to a specific window.

## References

- `CLAUDE.md`
- `.github/copilot-instructions.md`
- `.github/copilot-review-instructions.md`
- `docs/agent-context-index.md`
- `docs/architecture-overview.md`
