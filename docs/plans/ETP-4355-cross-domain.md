# ETP-4355 — Cross-domain plan: push-to-neo entity methods & i18n for Not Posted Documents

## Summary

This branch (`feature/ETP-4355`) predates the `schema_forge` / `schema_forge_core` repo split.
The functional window (Not Posted Documents — search grid, bulk/single post actions) was built
before the split and has already been migrated to its correct home in the sibling repo
`etendo_schema_forge` (PR #807). The two window-custom files that had leaked into this repo
(`NotPostedDocumentsPage.jsx`, `not-posted-documents.css`) were removed in commit
`ebc7ce559` ("Feature ETP-4355: Remove functional files that belong in etendo_schema_forge").

What remains in `schema_forge_core`'s PR #14 is strictly platform-tooling and shared i18n:

- A `push-to-neo.js` change so the generated NEO entity registers both HTTP methods
  (`isget='Y'`, `ispost='Y'`) needed by the Not Posted Documents endpoint.
- The `en_US.json` / `es_ES.json` i18n keys for the window's UI strings, added to
  `app-shell-core`'s shared locale bundles so the window (which lives in the sibling repo)
  can resolve them at runtime.

Domain-boundary-check flags this PR as cross-domain because git diff still lists the now-deleted
window-custom files against the merge-base, and because `generator-change` + `app-shell-core`
scopes land in the same PR. Functional window files for this feature live in the sibling repo
`etendo_schema_forge` (PR #807) — see that repo's own `docs/plans/ETP-4355-cross-domain.md` for
the full window-side plan.

## Domains touched

| Domain | Changes |
|--------|---------|
| `generator-change` | `cli/src/push-to-neo.js` — set `isget='Y'`, `ispost='Y'` on entity update so the NEO endpoint registers both HTTP methods. |
| `app-shell-core` | `packages/app-shell-core/src/locales/en_US.json`, `packages/app-shell-core/src/locales/es_ES.json` — i18n keys for the Not Posted Documents window UI, whose component code lives in the sibling repo `etendo_schema_forge`. |

## Tests

- `cli/src/push-to-neo.js`: covered by existing push-to-neo unit tests (`cli/test/`) exercising
  entity method flags; no new window-side manual QA is claimed from this repo since no window
  UI code ships here.
- i18n: verified both `en_US.json` and `es_ES.json` contain the same new keys (no drift between
  locales) — checked as part of this change.
- Functional/manual test coverage for the Not Posted Documents window itself (search grid,
  bulk/single post, document type dropdown) is tracked and executed in the sibling repo
  `etendo_schema_forge` PR #807, where the window's component code actually lives.

## Rollback

Revert the `feature/ETP-4355` commits in `schema_forge_core`. No DB schema changes — the
`isget`/`ispost` flags are pushed to `ETGO_SF_ENTITY` via `push-to-neo.js` and can be re-applied
or reverted by re-running the script with the prior generator behavior. The i18n key additions
are additive only (no renamed/removed keys), so reverting is a plain file revert with no runtime
migration needed.
