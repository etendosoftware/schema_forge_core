# @etendosoftware/schema-forge-core

Reusable JavaScript core for Schema Forge automation.

## Domain Boundary Check

Install in another repository and run the packaged binary:

```bash
npm install @etendosoftware/schema-forge-core
npx sf-domain-boundary-check --base origin/main
```

Use it from code:

```js
import { analyzeBoundary } from '@etendosoftware/schema-forge-core/domain-boundary';

const report = analyzeBoundary({
  changedFiles: ['artifacts/sales-order/contract.json'],
  knownWindows: ['sales-order'],
});
```

The binary expects the target repository to expose Schema Forge-style paths such
as `artifacts/<window>`, `tools/app-shell`, `docs/generated-custom-windows`, and
`e2e/tests/flows`. Repositories with a different layout can call the exported
functions directly with their own changed-file list and known windows.

## Boundary Policy

The check ships with a default policy, but repositories can extend it without
editing package code. The CLI auto-loads `domain-boundary.config.json` or
`.schema-forge/domain-boundary.config.json` from the repository root, and it also
accepts an explicit policy file:

```bash
npx sf-domain-boundary-check --base origin/main --policy-file domain-boundary.config.json
```

Example:

```json
{
  "verticalWindows": {
    "aftermarket": ["warranty-claim", "service-order"]
  },
  "patternGroups": [
    {
      "id": "local-generator-fixtures",
      "kind": "generator-change",
      "scope": "generator-change",
      "patterns": ["^fixtures/generator/"]
    }
  ]
}
```

Pattern groups with an existing `id` append patterns by default. Set
`"replacePatterns": true` to replace the default patterns for that group.

## Local Workspace Consumption

Inside this monorepo, root tooling depends on `@etendosoftware/schema-forge-core` by package
name and matching version, for example `"@etendosoftware/schema-forge-core": "0.1.0"`. npm then
links the workspace package from `packages/schema-forge-core` in
`package-lock.json`, avoiding relative imports while staying compatible with the
npm version used by this repository. For command-line use inside this repo,
prefer `npx sf-domain-boundary-check` so the dependency is resolved from the
local workspace package instead of the public registry.
