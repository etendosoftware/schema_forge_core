# User Onboarding QA Dry Run — 2026-04-24

## Session Metadata

| Field | Value |
|-------|-------|
| Session date | 2026-04-24 |
| Facilitator | AI assistant |
| Participant alias | Internal dry run |
| Participant background | Repository-aware facilitator simulation |
| Selected walkthrough window | Sales Order (`sales-order`) |
| Repository branch/commit | Not recorded in this dry run |

## Setup

| Check | Result |
|-------|--------|
| Participant can access repository | Simulated as available |
| Participant can read docs | Simulated as available |
| Participant can run local commands if needed | Not required for this theoretical dry run |
| Facilitator did not provide undocumented setup guidance | Passed for document-only journey |

## Scope

This dry run validates the onboarding QA assets against the current repository content. It does not measure strict code coverage and does not run the browser E2E suite.

## Artifact Availability

| Expected item | Observed evidence | Result |
|---------------|-------------------|--------|
| Onboarding guide | `docs/plans/evaluations/onboarding.md` | Pass |
| Methodology guide | `docs/onboarding-methodology-shift.md` | Pass |
| E2E guide | `docs/e2e-testing-guide.md` | Pass |
| Sales Order artifact directory | `artifacts/sales-order/` | Pass |
| Sales Order decisions | `artifacts/sales-order/decisions.json` | Pass |
| Sales Order contract | `artifacts/sales-order/contract.json` | Pass |
| Sales Order generated web files | `artifacts/sales-order/generated/web/sales-order/` | Pass |
| Sales Order E2E flow | `e2e/tests/flows/sales-order-crud.spec.js` | Pass |
| Etendo core root | `etendo_core/` | Pass |
| NEO Headless module | `etendo_core/modules/com.etendoerp.go/` | Pass |
| NEO Headless module instructions | `etendo_core/modules/com.etendoerp.go/AGENTS.md` | Pass |
| Schema Forge Java integration package | `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/` | Pass |

## First-Success Journey Trace

The dry run used `businessPartner` as the field to trace from decisions to generated UI behavior.

| Layer | Evidence | Result |
|-------|----------|--------|
| Human decision artifact | `artifacts/sales-order/decisions.json` marks `businessPartner` as grid-enabled, searchable, `BusinessPartner` reference, and `selectorFilter: isCustomer=Y`. | Pass |
| Dependent behavior | `partnerAddress` depends on `businessPartner` with filter key `C_BPartner_ID`. | Pass |
| Contract | `artifacts/sales-order/contract.json` exposes `businessPartner` as required, editable, `C_BPartner_ID`, `Business Partner`, `foreignKey`, and `inputMode: search`. | Pass |
| Generated form | `HeaderForm.jsx` renders `businessPartner` as a required search field in the principal section. | Pass |
| Generated list | `HeaderTable.jsx` includes the `Business Partner` column. | Pass |
| E2E coverage | `sales-order-crud.spec.js` verifies the Business Partner column, the required Business Partner field on New Order, and Partner Address disabled before Business Partner selection. | Pass |

## Checklist Dry Run Result

| Checklist Area | Result | Notes |
|----------------|--------|-------|
| Conceptual Understanding | Pass | Required concepts are present in onboarding and methodology docs. |
| Repository Orientation | Pass | Expected paths exist and are discoverable. |
| Safety Rules | Pass | Safety rules are present in repo instructions and checklist. |
| First-Success Journey | Pass | `businessPartner` can be traced from decisions to contract, generated UI, and E2E assertions. |
| Friction Logging | Pass | The session template has fields for confusion points, assumptions, severity, evidence, and follow-up backlog. |

## Rubric Dry Run Result

| Category | Result | Notes |
|----------|--------|-------|
| Concept | Pass | The onboarding docs explain Schema Forge and the generated-module methodology. |
| Pipeline | Pass | The onboarding docs describe extraction, decisions, generation, and validation loops. |
| Repository | Pass | Referenced paths exist in the repository. |
| Safety | Pass | Generated-file and ID lookup rules are explicit in repo instructions and repeated in the checklist. |

Dry run score: not numerically assigned because this was a facilitator simulation, not a participant session.

## Observations

| Moment | Observation | Impact | Suggested Fix |
|--------|-------------|--------|---------------|
| Selecting walkthrough artifact | `artifacts/sales-order/` currently contains `decisions.json` and `contract.json`, not a visible `schema-raw.json` in the top-level artifact directory. | Low | Keep the checklist wording as "raw schema or decision artifact"; if future participants expect `schema-raw.json`, explain that current generated windows may preserve only the active decision/contract artifacts. |
| E2E selector review | Existing Sales Order E2E already covers the onboarding trace for Business Partner and Partner Address dependency. | Positive | Reuse this as the first demonstration instead of adding onboarding-specific automation immediately. |
| Automation timing | The optional onboarding smoke E2E should wait until after one moderated participant session. | Medium | Do not create `onboarding-smoke.spec.js` yet; first validate that the manual journey is understandable to a real new user. |

## Friction Points

| Friction | Category | Severity | Evidence |
|----------|----------|----------|----------|
| Possible expectation of `schema-raw.json` under `artifacts/sales-order/` | Documentation | Low | Sales Order top-level artifact directory observed with `contract.json`, `decisions.json`, `custom/`, and `generated/`. |
| No real participant score yet | Missing context | Medium | This dry run validates assets, not actual user comprehension. |

## Incorrect Assumptions

| Assumption | What caused it | Correction needed |
|------------|----------------|-------------------|
| A dry run can replace moderated onboarding validation | QA asset completeness can look sufficient without user evidence | Treat this dry run only as readiness evidence; still run one moderated session. |

## Final Outcome

| Result | Status |
|--------|--------|
| Pass | Selected |
| Pass with documentation fixes | Not selected |
| Needs another onboarding iteration | Not selected |
| Blocked | Not selected |

## Follow-up Backlog

| Priority | Action | Owner | Target artifact |
|----------|--------|-------|-----------------|
| P0 | Run one moderated onboarding QA session with a real participant using the facilitator runbook and participant brief. | QA facilitator | `docs/qa/user-onboarding-moderated-session-runbook.md`, `docs/qa/user-onboarding-participant-brief.md`, `docs/qa/user-onboarding-session-template.md` |
| P1 | Capture the participant's rubric score and first confusion point. | QA facilitator | `docs/qa/user-onboarding-rubric.md` |
| P1 | Decide whether the optional onboarding smoke E2E is still useful after the moderated session. | QA + dev | `e2e/tests/flows/onboarding-smoke.spec.js` |
| P2 | If participants look for `schema-raw.json`, add a short note explaining current artifact availability. | Docs | `docs/qa/user-onboarding-checklist.md` |

## Moderated Session Package

Use these files for the first real participant session:

- `docs/qa/user-onboarding-moderated-session-runbook.md` — facilitator script, scoring flow, expected evidence, and closeout steps.
- `docs/qa/user-onboarding-participant-brief.md` — participant-facing task sheet.
- `docs/qa/user-onboarding-session-template.md` — session evidence template.
- `docs/qa/user-onboarding-multi-repo-analysis.md` — expanded QA analysis across Schema Forge, Etendo Core, and `com.etendoerp.go`.

## Decision

The onboarding QA assets are ready for a first moderated user session. Do not add the optional onboarding smoke E2E yet; the existing Sales Order E2E already covers the technical path needed for the dry run, and the current risk is user comprehension rather than UI automation coverage.
