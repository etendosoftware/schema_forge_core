# ETP-4029 — Cross-domain plan

**Feature:** this PR does two things — (1) adds a new `documentDateField`
window-config option to the generator, used for exchange-rate lookups on
invoice windows (companion to `etendo_schema_forge#814` and
`com.etendoerp.go#674`'s editable-currency/rate-inheritance feature), and
(2) fixes an unrelated pre-existing bug where `setCacheMode({ mode })` calls
across 4 CLI entrypoints never forwarded the `path` option, silently
ignoring `SF_CACHE_PATH` and writing the AD cache to the package's internal
default location instead of the caller-specified one — now consolidated
into one shared `applyCacheModeFromEnv()` helper in `db.js` to also resolve
a Sonar new-duplication gate.

This PR is approved as cross-domain because the cache-path fix touches
`cli/src/db.js`, which does not fall into any predefined domain-boundary
scope (reported as `unknown`), alongside the `generator-change` scope (the
`documentDateField` feature and the four `extract-*`/`regen-all` call
sites it shares with the cache fix) and the `repo-infra` scope (the docs
reference update). The two changes are small, already reviewed, and land
together on the same branch because the cache-path bug was discovered
while validating the generator feature's companion PR.

## Domains touched

### `generator-change` (primary)
The `documentDateField` window-config addition and the cache-path fix's
call sites:
- `cli/src/extract-fields.js`
- `cli/src/extract-from-db.js`
- `cli/src/extract-rules.js`
- `cli/src/generate-frontend.js`
- `cli/src/regen-all.js`
- `cli/src/resolve-curated.js`
- `cli/test/generate-frontend.test.js`
- `cli/test/resolve-curated-helpers.test.js`

### `repo-infra`
- `docs/decisions-reference.md` — documents the new `documentDateField`
  option.

### `cli/src/db.js` (reported as `unknown`)
Not in a predefined domain-boundary scope bucket. Hosts the new shared
`applyCacheModeFromEnv()` helper that the four cache-mode call sites
(`extract-fields.js`, `extract-from-db.js`, `extract-rules.js`,
`regen-all.js`) now use instead of duplicating the
`setCacheMode({ mode, path: process.env.SF_CACHE_PATH })` call inline —
this also clears the SonarQube new-duplicated-lines gate that the
original inline fix triggered.

## Tests

- **Frontend/CLI (Vitest / Node test runner):** `cli/test/generate-frontend.test.js`
  and `cli/test/resolve-curated-helpers.test.js` cover the
  `documentDateField` addition (already existed from the first commit on
  this branch). The cache-path fix and the dedup refactor are verified via
  `make test` (254/254 + 3/3 passing) and `./cli/sonar-check.sh` (clean —
  "No issues found" for the touched files).

## Rollback

Purely additive/internal-tooling — no DB/schema changes.

- Revert the PR: `documentDateField` stops being recognized by the
  generator (invoice windows lose the exchange-rate lookup companion
  field), and the four cache-mode call sites revert to the pre-fix inline
  `setCacheMode({ mode })` calls, silently ignoring `SF_CACHE_PATH` again
  (the original, pre-existing behavior).
