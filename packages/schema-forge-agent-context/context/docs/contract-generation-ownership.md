# Contract and Generated Output Ownership

Schema Forge is the producer of contracts and generated window outputs. Consumers can import, render, package, or deploy those outputs, but they should not patch generated files directly.

## Package Boundary

| Package or asset | Owns | Does not own |
|------------------|------|--------------|
| `@etendosoftware/schema-forge-core` | reusable generator/validation logic and CI checks | generated business windows |
| `@etendosoftware/app-shell-core` | shell runtime, auth/menu/layout/report contracts, styles, reusable UI | generated contracts, generated windows, app-specific business logic |
| `@etendosoftware/schema-forge-agent-context` | portable agent instructions and reference docs | runtime code |
| `@etendosoftware/schema-forge-stack` | package composition and setup/doctor commands | vendored business artifacts |
| consumer repo artifacts | generated contracts and generated windows for that app/domain | reusable app-shell platform internals |

## Regeneration Rules

Regenerate contracts when raw schema, raw rules, processes, decisions, contract schema, or generator behavior changes.

Regenerate frontend outputs when `contract.json`, frontend generator code, templates, or generated component conventions change.

Do not regenerate generated outputs for custom-only changes, documentation-only changes, or app-shell-core internals that preserve the generated component contract.

## Split-Ready Rule

Generated artifacts must be delivered explicitly if repositories split. Use one of these models:

- consumer-owned `artifacts/**`,
- published artifact packages by domain or release train,
- release bundles that include app-shell packages plus artifact tarballs.

Do not move generated windows into `@etendosoftware/app-shell-core`, import generated windows through monorepo-relative package paths, or publish a stack package that silently vendors generated business windows.

## PR Checklist

- Name the affected windows, reports, or processes.
- Name the producer step that was run.
- Keep generated outputs separate from manual custom code.
- Validate the relevant consumer: app-shell build, package/tarball consumer, or downstream app CI.
