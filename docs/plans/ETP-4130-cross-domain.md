# Cross-Domain Plan — ETP-4130

## Domains touched

| Domain | Files | Reason |
|--------|-------|--------|
| `window:fiscal-config` | `FiscalConfigPage.jsx`, `OnboardingWizard.jsx`, `SiiSection.jsx`, `TbaiSection.jsx`, `VerifactuSection.jsx`, `CertModal.jsx` | Main task: redesign tax settings subpages layout |
| `window:fiscal-monitor` | `FiscalMonitorPage.jsx` | Minor UI alignment fix coupled to the same fiscal vertical |
| `app-shell-core` | `locales/en_US.json`, `locales/es_ES.json` | New i18n keys for fiscal-config redesign |
| `generator-change` | `cli/test/fiscal-config.utils.test.js` | Contract tests for fiscal-config utility functions |
| `e2e` | `e2e/tests/flows/fiscal-config.mocked.spec.js` | E2E smoke tests for the redesigned flow |

## Why cross-domain is justified

All changes belong to the **fiscal vertical** — a tightly coupled feature where the onboarding wizard, the configuration page, the monitor, and the i18n strings are part of a single user-facing flow. Splitting into separate PRs would leave each in a broken intermediate state.

## Tests

- Unit (Vitest): `OnboardingWizard.vitest.jsx` — 60 tests covering wizard navigation, territory selection, API calls, applied/detail screens
- Node source tests: `SiiSection.test.js`, `VerifactuSection.test.js`, `TabBar.test.js`
- E2E (Playwright): `fiscal-config.mocked.spec.js` — mocked flow covering the main wizard path
- CLI contract: `fiscal-config.utils.test.js`

## Rollback

All changes are additive UI refactors. Rollback = revert the PR. No DB migrations or API contract changes involved.
