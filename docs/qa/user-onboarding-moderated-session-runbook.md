# User Onboarding Moderated Session Runbook

Use this runbook to execute the first real onboarding QA session with a new Schema Forge user. The facilitator should observe and record evidence, not teach missing concepts during the task.

## Session Objective

Validate that a new user can understand Schema Forge, orient themselves in the repository, and complete one first-success journey using the Sales Order window.

## Required Inputs

- `docs/plans/evaluations/onboarding.md`
- `docs/onboarding-methodology-shift.md`
- `docs/qa/user-onboarding-checklist.md`
- `docs/qa/user-onboarding-rubric.md`
- `docs/qa/user-onboarding-session-template.md`
- `docs/qa/user-onboarding-participant-brief.md`
- `docs/qa/user-onboarding-dry-run-2026-04-24.md`

## Recommended Participant Profiles

Run at least one session with one of these profiles:

1. Developer with no Etendo experience.
2. Developer with Etendo experience but no Schema Forge experience.

If possible, run both profiles in separate sessions and compare friction points.

## Facilitator Rules

- Do not explain concepts before the participant attempts the task.
- Do not reveal file paths unless the participant is blocked.
- Do not correct wrong assumptions immediately; record them first.
- Do not count local environment failures as comprehension failures.
- Do not add an onboarding smoke E2E during the session.
- Record evidence in a copy of `docs/qa/user-onboarding-session-template.md`.

## Pre-Session Setup

1. Confirm the participant can access the repository.
2. Confirm the participant can read Markdown files.
3. Share only `docs/qa/user-onboarding-participant-brief.md` as the starting instruction.
4. Prepare a copy of `docs/qa/user-onboarding-session-template.md` for notes.
5. Use `Sales Order` / `sales-order` as the selected walkthrough window.

## Script

### 1. Opening

Say:

> This is a QA session for the onboarding material, not a test of you. Please think aloud. If something is unclear, say what you expected and what you looked for. I will mostly observe and take notes.

Record:

- Participant background.
- Prior Etendo experience.
- Prior Schema Forge experience.

### 2. Reading Task

Ask the participant to read:

- `docs/plans/evaluations/onboarding.md`
- `docs/onboarding-methodology-shift.md`

Do not summarize the docs for them.

Record:

- Any term they ask about.
- Any section they reread.
- Any missing concept they identify.

### 3. Concept Check

Ask these questions verbally:

1. What is Schema Forge?
2. What does the human decide?
3. What does the tooling generate?
4. What is the pipeline order?
5. What is the difference between the fast loop and validation loop?

Score these answers later using `docs/qa/user-onboarding-rubric.md`.

### 4. Repository Orientation Task

Ask the participant to find:

1. The onboarding guide.
2. The E2E testing guide.
3. CLI source code.
4. Sales Order artifact directory.
5. Sales Order generated output.
6. Existing Sales Order E2E test.
7. Project-level agent instructions.
8. Etendo core root directory.
9. NEO Headless module directory.
10. NEO Headless module instructions.
11. Schema Forge Java integration package in the NEO module.

Expected locations:

- `docs/plans/evaluations/onboarding.md`
- `docs/e2e-testing-guide.md`
- `cli/src/`
- `artifacts/sales-order/`
- `artifacts/sales-order/generated/`
- `e2e/tests/flows/sales-order-crud.spec.js`
- `AGENTS.md`
- `etendo_core/`
- `etendo_core/modules/com.etendoerp.go/`
- `etendo_core/modules/com.etendoerp.go/AGENTS.md`
- `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/`

Record the first missing or incorrect path.

### 5. First-Success Journey

Ask the participant to trace `businessPartner` in Sales Order from decision to UI behavior.

Expected evidence:

1. `artifacts/sales-order/decisions.json` contains the `businessPartner` decision.
2. `partnerAddress` depends on `businessPartner` using `C_BPartner_ID`.
3. `artifacts/sales-order/contract.json` exposes `businessPartner` as a required editable `Business Partner` foreign key with search input.
4. `artifacts/sales-order/generated/web/sales-order/HeaderForm.jsx` renders `businessPartner` in the form field list.
5. `artifacts/sales-order/generated/web/sales-order/HeaderTable.jsx` includes the `Business Partner` column.
6. `e2e/tests/flows/sales-order-crud.spec.js` validates the column, required field visibility, and the disabled `Partner Address` dependency.

Do not require exact line numbers from the participant. The pass condition is that they can explain the trace correctly.

### 6. Safety Check

Ask:

1. Which files must not be manually edited?
2. What should you do instead of guessing a window, process, or menu ID?
3. What reminder is needed if `push-to-neo.js` runs?

Expected answers:

- Do not manually edit `artifacts/*/generated/`.
- Query DB or use `node cli/src/menu-cache.js search "<name>"`.
- Remind the team to run `./gradlew export.database` in the Etendo root.

### 7. Scoring

Use `docs/qa/user-onboarding-rubric.md`.

Pass criteria:

- At least 29 out of 36.
- No `0` score in Safety Rules.

Outcome mapping:

| Condition | Outcome |
|-----------|---------|
| Score >= 29 and no high-severity friction | Pass |
| Score >= 29 with doc friction | Pass with documentation fixes |
| Score < 29 | Needs another onboarding iteration |
| Access/setup prevents evaluation | Blocked |

### 8. Closeout

Ask:

1. What was the first confusing step?
2. Which term or file name was least clear?
3. What would you change in the onboarding docs?
4. What would you do next to validate a generated window?

Record all answers in the session template.

## Required Output

Create one completed session note from `docs/qa/user-onboarding-session-template.md`.

Recommended file name:

```text
docs/qa/user-onboarding-session-YYYY-MM-DD-<participant-alias>.md
```

If the participant should remain anonymous, use a neutral alias such as `participant-a`.

## Post-Session Decision

After the first real session:

1. If the participant passes and there are no high-severity documentation gaps, decide whether to add `e2e/tests/flows/onboarding-smoke.spec.js`.
2. If the participant passes with documentation fixes, update the relevant docs before adding automation.
3. If the participant does not pass, fix onboarding content first and rerun the session.

Automation should follow comprehension, not replace it.
