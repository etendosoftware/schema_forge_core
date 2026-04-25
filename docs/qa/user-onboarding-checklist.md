# User Onboarding QA Checklist

Use this checklist to validate whether a new Schema Forge user can understand the project and complete a first-success journey without ad hoc verbal guidance.

## Participant

| Field | Value |
|-------|-------|
| Name or alias | |
| Role/background | |
| Prior Etendo experience | None / Basic / Advanced |
| Prior Schema Forge experience | None / Basic / Advanced |
| Session date | |
| Facilitator | |

## Entry Criteria

- [ ] Participant has access to the repository.
- [ ] Participant can open the documentation locally or in the repository browser.
- [ ] Participant has not received undocumented setup instructions for this session.
- [ ] Facilitator has selected one existing generated window to use as the walkthrough target.

## Part 1: Conceptual Understanding

Ask the participant to read:

- `docs/plans/evaluations/onboarding.md`
- `docs/onboarding-methodology-shift.md`

Then verify:

- [ ] Participant can explain Schema Forge in one paragraph.
- [ ] Participant can describe the difference between manual Etendo development and generated module development.
- [ ] Participant can describe the high-level flow: extraction, decisions, contract generation, backend/frontend generation, validation, deployment.
- [ ] Participant can explain what the human decides and what the tooling generates.
- [ ] Participant can explain the `DEV -> REVIEW -> QA -> DOCS` workflow.

## Part 2: Repository Orientation

Ask the participant to locate each item without direct path hints after the first reading:

- [ ] Primary onboarding document.
- [ ] E2E testing guide.
- [ ] CLI source directory.
- [ ] Artifacts directory for an existing window.
- [ ] Generated output directory for an existing window.
- [ ] Existing Playwright E2E tests.
- [ ] App shell source directory.
- [ ] Project-level agent instructions.
- [ ] Etendo core root directory.
- [ ] NEO Headless module directory.
- [ ] NEO Headless module instructions.
- [ ] Schema Forge Java integration package in the NEO module.

Expected locations:

- `docs/plans/evaluations/onboarding.md`
- `docs/e2e-testing-guide.md`
- `cli/src/`
- `artifacts/<window>/`
- `artifacts/<window>/generated/`
- `e2e/tests/`
- `tools/app-shell/src/`
- `AGENTS.md`
- `etendo_core/`
- `etendo_core/modules/com.etendoerp.go/`
- `etendo_core/modules/com.etendoerp.go/AGENTS.md`
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/`

## Part 3: Safety Rules

Verify the participant can state:

- [ ] Do not manually edit generated files under `artifacts/*/generated/`.
- [ ] Do not hardcode or guess window, process, or menu IDs.
- [ ] Use DB queries or `node cli/src/menu-cache.js search "<name>"` when IDs are needed.
- [ ] If `push-to-neo.js` runs, remind the team to execute `./gradlew export.database` in the Etendo root.
- [ ] Window-specific work should use the matching guide in `docs/generated-custom-windows/` when applicable.
- [ ] Before changing files under `etendo_core/modules/com.etendoerp.go/`, read `etendo_core/modules/com.etendoerp.go/AGENTS.md`.
- [ ] Window-specific NEO behavior belongs in a `NeoHandler`, not in shared services such as `NeoSelectorService`, `NeoDefaultsService`, `NeoCrudHandler`, or `NeoServlet`.

## Part 4: First-Success Journey

Use one stable existing window selected by the facilitator.

- [ ] Participant identifies the window artifact directory.
- [ ] Participant finds the raw schema or decision artifact for the window.
- [ ] Participant identifies at least one visible field and one system or generated concern.
- [ ] Participant opens or inspects the existing E2E flow for a similar window.
- [ ] Participant explains how the field appears in the generated UI or contract.
- [ ] Participant can describe what would be validated manually versus by E2E.

## Part 5: Friction Logging

During the session, record:

- [ ] First point of confusion.
- [ ] First incorrect assumption.
- [ ] Any missing path, command, or concept in the documentation.
- [ ] Any term that required facilitator explanation.
- [ ] Any step that took longer than expected because the docs were ambiguous.

## Exit Criteria

The onboarding flow passes QA when the participant can:

- [ ] Explain the pipeline accurately.
- [ ] Locate the major repository areas.
- [ ] Complete the first-success journey.
- [ ] State the main safety rules.
- [ ] Identify what they would do next to validate a generated window.

## Outcome

| Result | Select one |
|--------|------------|
| Pass | |
| Pass with documentation fixes | |
| Needs another onboarding iteration | |
| Blocked | |

## Follow-up Actions

| Finding | Owner | Action | Priority |
|---------|-------|--------|----------|
| | | | |
