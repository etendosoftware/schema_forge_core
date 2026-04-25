# User Onboarding Multi-Repository QA Analysis

## Scope

This analysis expands the onboarding QA surface across the development areas currently involved in the user onboarding work:

1. `schema-forge/`
2. `etendo_core/`
3. `etendo_core/modules/com.etendoerp.go/`

The goal is not strict numeric coverage. The goal is to make sure QA validates the complete onboarding story across generated UI/artifacts, Etendo runtime behavior, and the NEO Headless module that serves Schema Forge specs.

## Repository Boundary Status

| Area | Git root observed | Current status observed | QA implication |
|------|-------------------|-------------------------|----------------|
| Schema Forge | `/Users/sebastianbarrozo/Documents/work/epic/schema-forge` | Documentation QA changes are in progress; unrelated untracked files also exist. | Keep QA documentation changes scoped and do not assume untracked files belong to this task. |
| Etendo Core | `/Users/sebastianbarrozo/Documents/work/epic/schema-forge/etendo_core` | Active uncommitted Java changes around `InitialOrgSetup` and accounting setup hooks. | Onboarding QA must include organization/accounting bootstrap behavior as a separate backend concern. |
| NEO Headless module | `/Users/sebastianbarrozo/Documents/work/epic/schema-forge/etendo_core/modules/com.etendoerp.go` | Git status clean when checked from the module root. | Treat it as a separate module surface with its own docs, tests, and `AGENTS.md` rules. |

## Layered Onboarding Model

| Layer | Repository area | Responsibility | Primary QA question |
|-------|-----------------|----------------|---------------------|
| User/product onboarding docs | `schema-forge/docs/` | Teach the methodology, repo map, and first-success journey. | Can a new user understand what to do without verbal guidance? |
| Schema Forge artifacts and UI | `schema-forge/artifacts/`, `schema-forge/e2e/`, `schema-forge/tools/app-shell/` | Demonstrate how decisions become contract/UI/E2E behavior. | Can the user trace one field from decision to generated UI and test evidence? |
| Etendo core bootstrap | `etendo_core/src/`, `etendo_core/src-test/` | Create/prepare organizations and accounting defaults needed by onboarding. | Does backend organization setup produce a usable, ready organization with accounting foundation? |
| NEO Headless runtime | `etendo_core/modules/com.etendoerp.go/src/`, `src-test/`, `docs/` | Serve Schema Forge specs, selectors, defaults, callouts, onboarding dataset import, and JWT flows. | Does the module expose and protect the runtime behavior that the generated UI depends on? |

## Observed Coverage by Repository

### 1. Schema Forge

Observed evidence:

- `docs/plans/evaluations/onboarding.md` explains Schema Forge, the pipeline, and the vertical slice.
- `docs/onboarding-methodology-shift.md` provides the methodology shift and onboarding path.
- `docs/e2e-testing-guide.md` describes Playwright/agent-browser E2E authoring.
- `artifacts/sales-order/decisions.json` and `contract.json` exist.
- `artifacts/sales-order/generated/web/sales-order/` contains generated UI files.
- `e2e/tests/flows/sales-order-crud.spec.js` validates Sales Order list/form behavior.
- QA assets now exist under `docs/qa/`.

Coverage status:

| Area | Status | Evidence |
|------|--------|----------|
| Concept onboarding | Covered by docs | `onboarding.md`, `onboarding-methodology-shift.md` |
| Repo orientation | Covered by checklist/runbook | `docs/qa/user-onboarding-checklist.md` |
| Field trace dry run | Covered internally | `docs/qa/user-onboarding-dry-run-2026-04-24.md` |
| Real participant validation | Pending | Requires moderated session evidence |
| UI automation for onboarding smoke | Deferred | Existing Sales Order E2E covers the technical path; add smoke only after real session |

### 2. Etendo Core

Observed evidence:

- Active work is present around `InitialOrgSetup` and accounting setup hooks.
- Relevant changed/new files observed in git status include:
  - `src/org/openbravo/erpCommon/ad_forms/InitialOrgSetup.java`
  - `src/org/openbravo/erpCommon/businessUtility/InitialOrgSetup.java`
  - `src/org/openbravo/erpCommon/businessUtility/InitialOrgSetupAccountingContext.java`
  - `src/org/openbravo/erpCommon/businessUtility/InitialOrgSetupAccountingHandler.java`
  - `src/org/openbravo/erpCommon/businessUtility/InitialOrgSetupAccountingHookCaller.java`
  - `src/org/openbravo/erpCommon/businessUtility/InitialOrgSetupAccountingResult.java`
  - `src-test/src/org/openbravo/test/generalsetup/enterprise/organization/InitialOrgSetupAutomaticAccountingTest.java`
  - `src-test/src/org/openbravo/test/generalsetup/enterprise/organization/InitialOrgSetupAccountingHookSelectionTest.java`
- `InitialOrgSetupAutomaticAccountingTest` validates that a legal-with-accounting organization is automatically wired and marked ready, including ledger/calendar/period/tax/accounting foundations.
- `InitialOrgSetupAccountingHookSelectionTest` validates that legal-with-accounting organization creation routes through the accounting hook path and produces a ready organization.

Coverage status:

| Area | Status | Evidence |
|------|--------|----------|
| Organization creation happy path | Covered by integration-style tests | `InitialOrgSetupAutomaticAccountingTest` |
| Accounting hook routing | Covered by integration-style test | `InitialOrgSetupAccountingHookSelectionTest` |
| Failure paths for accounting hooks | Needs review | No failure-path evidence was observed in the files read. |
| Multi-currency/country/language variations | Needs review | Current observed tests use Euro/F&B context. |
| Full user onboarding bridge from NEO servlet to core setup | Needs integration validation | Core tests validate setup; module tests validate servlet dataset flow separately. |

QA implication:

Etendo core is not just background infrastructure. For user onboarding it is the backend bootstrap layer. The QA plan must verify that user onboarding creates an organization that is ready for generated-window usage, not just that Schema Forge docs are understandable.

### 3. NEO Headless module: `com.etendoerp.go`

Observed evidence:

- Module-specific instructions exist at `etendo_core/modules/com.etendoerp.go/AGENTS.md`.
- Module docs exist:
  - `docs/INDEX.md`
  - `docs/neo-headless.md`
  - `docs/neo-headless-guide.md`
  - `docs/onboarding-sampledata-packaging.md`
- `docs/onboarding-sampledata-packaging.md` defines the runtime/build contract for bundling `GOClient` sampledata into `WebContent/WEB-INF/classes`.
- Onboarding runtime source exists under `src/com/etendoerp/go/onboarding/`.
- Schema Forge NEO runtime source exists under `src/com/etendoerp/go/schemaforge/`.
- Tests exist for onboarding dataset normalization/import and servlet progress reporting:
  - `OnboardingDatasetNormalizerTest`
  - `OnboardingDatasetImportServiceTest`
  - `OnboardingTest`
  - `EtendoGoJwtServletOnboardingDatasetTest`
- Tests also exist for Schema Forge runtime/webhook surfaces:
  - `NeoHandlerHookTest`
  - `NeoSelectorServiceTest`
  - `NeoServletPathTest`
  - `NeoServletTabFilterTest`
  - `SFUpsertSpecTest`
  - `SFUpsertEntityTest`
  - `SFUpsertFieldTest`
  - `SFPopulateSpecTest`
  - `SFListWindowsTest`
  - `SFListMenuTest`
  - `SFListProcessesTest`

Coverage status:

| Area | Status | Evidence |
|------|--------|----------|
| Onboarding step/context unit behavior | Covered | `OnboardingTest` |
| Dataset normalization | Covered | `OnboardingDatasetNormalizerTest` |
| Dataset import delegation and error propagation | Covered | `OnboardingDatasetImportServiceTest` |
| Servlet progress/error events for dataset import | Covered | `EtendoGoJwtServletOnboardingDatasetTest` |
| Packaged WAR sampledata contract | Documented and partially tested | `onboarding-sampledata-packaging.md`, classpath normalizer test |
| NEO Headless request/spec model | Documented | `neo-headless-guide.md` |
| NeoHandler extension rule | Documented | `docs/neo-headless-extensibility.md`, module tests |
| Full browser-to-NEO-to-core onboarding flow | Needs end-to-end validation | No single observed test spans generated UI, servlet onboarding, core org setup, dataset import, and generated Sales Order usage. |

## Expanded QA Coverage Matrix

| Scenario | Schema Forge | Etendo Core | com.etendoerp.go | Status |
|----------|--------------|-------------|------------------|--------|
| New user understands methodology | Docs/checklist/rubric | Not applicable | NEO docs as backend context | Ready for moderated validation |
| New user finds all code surfaces | Checklist/runbook/brief | `etendo_core/` paths included | module paths included | Updated |
| Sales Order field trace | decisions/contract/generated/E2E | Not applicable | NEO serves spec at runtime | Dry run passed |
| Organization is ready after onboarding | Not covered | `InitialOrgSetup*` tests | Servlet onboarding should trigger data/bootstrap path | Partially covered, needs integration bridge |
| Onboarding sampledata is packaged | Not covered | WAR packaging target under root | `onboarding-sampledata-packaging.md`, normalizer classpath test | Partially covered |
| Dataset import surfaces progress/errors | Not covered | Import target objects live in core | servlet tests | Covered at module unit level |
| Generated UI can operate after onboarding | Sales Order E2E exists | Requires ready org/accounting | Requires NEO endpoints/selectors/defaults | Needs full E2E after real session |

## Recommended QA Plan Expansion

### P0: Moderated onboarding session with multi-repo orientation

Use:

- `docs/qa/user-onboarding-moderated-session-runbook.md`
- `docs/qa/user-onboarding-participant-brief.md`
- `docs/qa/user-onboarding-session-template.md`

The participant must now locate all three repo surfaces:

- `schema-forge/`
- `etendo_core/`
- `etendo_core/modules/com.etendoerp.go/`

Pass condition uses the updated rubric threshold: at least 29 out of 36 and no Safety score of 0.

### P0: Backend onboarding readiness check

Validate the Etendo core side separately from UI comprehension:

- Run the focused org setup tests when the environment is available:
  - `InitialOrgSetupAutomaticAccountingTest`
  - `InitialOrgSetupAccountingHookSelectionTest`
- Acceptance: legal-with-accounting org creation returns success and produces a ready organization with ledger/calendar/period/tax/accounting foundations.

### P0: NEO onboarding dataset check

Validate the module side separately:

- Run focused module tests when the environment is available:
  - `OnboardingDatasetNormalizerTest`
  - `OnboardingDatasetImportServiceTest`
  - `EtendoGoJwtServletOnboardingDatasetTest`
- Acceptance: dataset normalization loads packaged sampledata, import failures surface, success emits progress/done events, and existing orgs skip import correctly.

### P1: Integration bridge test

After the moderated session and backend checks, define one end-to-end bridge:

1. Onboard user/client/org through the actual NEO servlet path.
2. Confirm core org is ready and accounting foundations exist.
3. Confirm dataset import completed or skipped correctly.
4. Log in through app shell.
5. Open Sales Order.
6. Validate `businessPartner` selector and `partnerAddress` dependency.

This is the point where an onboarding-specific E2E becomes useful.

### P2: Documentation cleanup

If the moderated participant struggles with the multi-repo model, add a short visual map to the onboarding guide:

```text
schema-forge
  docs/qa, artifacts, e2e, tools/app-shell

etendo_core
  core organization/accounting bootstrap, root Gradle, platform runtime

etendo_core/modules/com.etendoerp.go
  NEO Headless, Schema Forge Java runtime, onboarding dataset import
```

## Current Blocker

The next meaningful QA evidence requires one real participant session or a runnable Etendo/NEO environment for focused backend tests. Documentation-only dry runs are complete enough to proceed to that stage, but they cannot prove user comprehension or runtime integration.
