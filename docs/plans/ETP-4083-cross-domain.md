# ETP-4083 Cross-Domain Plan: i18n + Behavior-Preserving Refactors

## Domains

- `window:price-list`: internationalize the price list product prices panel
  (`PriceListProductPrices.jsx`) — replace hardcoded strings with i18n hooks.
- `app-shell-core`: add the i18n keys consumed by the price list panel and the
  price list load error to `locales/en_US.json` and `locales/es_ES.json`.
- `platform-change`: behavior-preserving refactors in shared app-shell code —
  extract line net and tax factor helpers in `useLineGrossAmount.js`, and rename
  the onboarding stream helpers in `onboardingApi.js` for clarity.
- `generator-change`: behavior-preserving refactors in the CLI — extract the
  i18n check predicates in `quality-gate/checks/i18n.js`, and refactor argument
  parsing in `pipeline.js`'s `parseArgs`.
- `unknown`: extract field/entity helpers in the `neo-writer.js` populate
  functions (no behavior change).

Detected vertical: `finance` (single window: `price-list`).

## Why This Cannot Be Split Cleanly

This PR is a single follow-up pass on ETP-4083 that finishes the price list
panel internationalization and lands the small, behavior-preserving readability
refactors that fell out of it. The i18n change spans the window component
(`window:price-list`) and the shared locale catalogs (`app-shell-core`) as one
inseparable unit — the new keys are meaningless without the component that reads
them, and vice versa. The accompanying refactors (`platform-change`,
`generator-change`, `unknown`) are pure structural cleanups discovered while
touching those files; they carry no functional change and have no independent
review value as standalone PRs. Splitting per scope would produce several
trivial PRs that only make sense reviewed together.

## Review Order

1. Review the price list panel i18n (`PriceListProductPrices.jsx`) together with
   the new keys in `en_US.json` / `es_ES.json` — confirm every user-visible
   string resolves through a hook and both locales have matching keys.
2. Review the platform refactors (`useLineGrossAmount.js`, `onboardingApi.js`) —
   confirm extracted helpers and renamed functions preserve behavior.
3. Review the generator refactors (`pipeline.js` `parseArgs`,
   `quality-gate/checks/i18n.js` predicates) — confirm no CLI behavior change.
4. Review the `neo-writer.js` helper extraction — confirm populate output is
   unchanged.
5. Review this plan.

## Tests

- `make test` (CLI test suite, covers `pipeline.js`, `quality-gate/checks/i18n.js`,
  and `neo-writer.js`).
- `npm test --workspace=tools/app-shell` (app-shell vitest suite, covers
  `useLineGrossAmount` and the price list panel).
- i18n quality gate clean — no hardcoded strings, both locales in sync.
- Manual smoke of the price list window in `make dev` (panel labels render in
  Spanish, load error message is translated).

## Rollback

Every change is behavior-preserving (i18n + structural refactors), so rollback is
a straight revert of the PR merge commit. If a single refactor regresses, revert
that file to its pre-PR state; no data migration, NEO re-push, or
`export.database` is involved. Reverting the i18n change restores the prior
hardcoded strings without breaking the panel.
