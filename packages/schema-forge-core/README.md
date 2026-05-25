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
