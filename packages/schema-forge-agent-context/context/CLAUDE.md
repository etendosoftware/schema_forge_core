# Schema Forge Claude Context

This package contains the portable subset of the Schema Forge repository guidance for agent-assisted work in downstream projects.

## Package Boundaries

- `@etendosoftware/schema-forge-core` owns reusable Node tooling and deterministic validation.
- `@etendosoftware/app-shell-core` owns reusable shell runtime, styles, UI primitives, auth/menu/layout/report contracts, and Tailwind preset.
- `@etendosoftware/schema-forge-agent-context` owns portable agent instructions and curated reference docs.
- `@etendosoftware/schema-forge-stack` ties those packages together and exposes verification/install commands.

## Consumer Expectations

- Consumers import runtime and UI directly from `@etendosoftware/app-shell-core`.
- Consumers provide generated contracts, generated windows, and app-specific business logic.
- React, React DOM, Tailwind, Radix, and other browser runtime dependencies remain peer dependencies of the app-shell core package.
- The stack package should help verify setup; it should not hide package boundaries behind broad reexports.

## Validation Habits

- Run package tests for changed workspaces.
- Run pack or publish dry-runs before publishing private packages.
- Validate a real external consumer with local tarballs before treating the package contract as stable.
- Use safe installers for docs/context: list first, dry-run when possible, and never overwrite user files unless explicitly forced.
