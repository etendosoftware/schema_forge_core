# @schema-forge/core

Reusable JavaScript core for Schema Forge automation.

## Domain Boundary Check

Install in another repository and run the packaged binary:

```bash
npm install @schema-forge/core
npx sf-domain-boundary-check --base origin/main
```

Use it from code:

```js
import { analyzeBoundary } from '@schema-forge/core/domain-boundary';

const report = analyzeBoundary({
  changedFiles: ['artifacts/sales-order/contract.json'],
  knownWindows: ['sales-order'],
});
```

The binary expects the target repository to expose Schema Forge-style paths such
as `artifacts/<window>`, `tools/app-shell`, `docs/generated-custom-windows`, and
`e2e/tests/flows`. Repositories with a different layout can call the exported
functions directly with their own changed-file list and known windows.

## Local Workspace Consumption

Inside this monorepo, root tooling depends on `@schema-forge/core` by package
name and matching version, for example `"@schema-forge/core": "0.1.0"`. npm then
links the workspace package from `packages/schema-forge-core` in
`package-lock.json`, avoiding relative imports while staying compatible with the
npm version used by this repository. For command-line use inside this repo,
prefer `npx sf-domain-boundary-check` so the dependency is resolved from the
local workspace package instead of the public registry.
