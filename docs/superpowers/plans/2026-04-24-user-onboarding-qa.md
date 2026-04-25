# User Onboarding QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current onboarding material into a validated QA flow that proves a new user can understand Schema Forge, orient themselves in the repository, and complete one guided first-success journey.

**Architecture:** Keep the first iteration documentation-led and lightweight: add a manual QA checklist, a comprehension rubric, a guided first task, and a session report template. Add one optional onboarding smoke E2E only after the manual golden path is stable, reusing the existing Playwright helper patterns in `e2e/tests/helpers/`.

**Tech Stack:** Markdown documentation, existing Schema Forge docs, Playwright E2E, Node.js test runner where applicable.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `docs/qa/user-onboarding-checklist.md` | Create | Manual checklist for validating a new user's onboarding journey. |
| `docs/qa/user-onboarding-rubric.md` | Create | Scoring rubric for conceptual understanding and repo orientation. |
| `docs/qa/user-onboarding-session-template.md` | Create | Template for moderated onboarding observations and friction logging. |
| `docs/plans/evaluations/onboarding.md` | Modify | Link the QA checklist, rubric, and session template from the existing onboarding evaluation plan. |
| `e2e/tests/flows/onboarding-smoke.spec.js` | Optional create | Automated smoke test for the stabilized golden path. Do this only after Task 4 confirms stable selectors and user path. |

No generated artifacts under `artifacts/*/generated/` should be edited. No Schema Forge pipeline output should be regenerated for this QA-only plan.

---

## Coverage Target

This plan does not target strict numeric code coverage. It targets practical onboarding coverage:

| Area | Required Evidence |
|------|-------------------|
| Conceptual understanding | User can explain Schema Forge, the pipeline, and human decision points. |
| Repository orientation | User can locate docs, CLI, artifacts, generated outputs, E2E tests, and app shell. |
| First-success task | User can trace one existing generated window from artifact to UI behavior. |
| Safety rules | User can identify files that must not be manually edited and when export reminders apply. |
| Feedback loop | QA captures blockers, confusing steps, and follow-up documentation/test actions. |

---

## Task 1: Create the Manual Onboarding QA Checklist

**Files:**
- Create: `docs/qa/user-onboarding-checklist.md`

- [ ] **Step 1: Create the QA docs directory if it does not exist**

Run:

```bash
mkdir -p docs/qa
```

Expected: `docs/qa/` exists. If the directory already exists, the command exits successfully without changing existing files.

- [ ] **Step 2: Add the checklist document**

Create `docs/qa/user-onboarding-checklist.md` with this content:

```markdown
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

Expected locations:

- `docs/plans/evaluations/onboarding.md`
- `docs/e2e-testing-guide.md`
- `cli/src/`
- `artifacts/<window>/`
- `artifacts/<window>/generated/`
- `e2e/tests/`
- `tools/app-shell/src/`
- `AGENTS.md`

## Part 3: Safety Rules

Verify the participant can state:

- [ ] Do not manually edit generated files under `artifacts/*/generated/`.
- [ ] Do not hardcode or guess window, process, or menu IDs.
- [ ] Use DB queries or `node cli/src/menu-cache.js search "<name>"` when IDs are needed.
- [ ] If `push-to-neo.js` runs, remind the team to execute `./gradlew export.database` in the Etendo root.
- [ ] Window-specific work should use the matching guide in `docs/generated-custom-windows/` when applicable.

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
```

- [ ] **Step 3: Review the checklist for repository-specific accuracy**

Confirm every referenced path exists or is intentionally generic:

```bash
ls docs/plans/evaluations/onboarding.md docs/onboarding-methodology-shift.md docs/e2e-testing-guide.md AGENTS.md
```

Expected: all listed files are present.

---

## Task 2: Create the Onboarding Comprehension Rubric

**Files:**
- Create: `docs/qa/user-onboarding-rubric.md`

- [ ] **Step 1: Add the rubric document**

Create `docs/qa/user-onboarding-rubric.md` with this content:

```markdown
# User Onboarding Comprehension Rubric

Use this rubric after the onboarding checklist to score whether the participant has enough understanding to continue independently.

## Scoring

| Score | Meaning |
|-------|---------|
| 0 | Cannot answer or gives an incorrect answer. |
| 1 | Partially correct but requires facilitator correction. |
| 2 | Correct answer with minor prompting. |
| 3 | Correct answer without prompting. |

Passing threshold: at least 24 out of 30, with no 0 score in Safety Rules.

## Questions

| Category | Question | Expected Answer | Score |
|----------|----------|-----------------|-------|
| Concept | What is Schema Forge? | A toolchain that extracts Etendo metadata/business logic, lets humans make decisions, and generates deployable Etendo modules and React UI. | |
| Concept | What does the human decide? | Field visibility/behavior, rule handling, process choices, review of generated output. | |
| Pipeline | What is the pipeline order? | Extract metadata/rules, curate decisions, generate contracts, generate backend/frontend, validate, push/deploy. | |
| Pipeline | What is the fast loop for? | Iterating on UI/contracts/mocks without requiring full backend compilation. | |
| Pipeline | What is the full validation loop for? | Compiling/running against real backend, DB, integration behavior, or Etendo runtime constraints. | |
| Repository | Where are CLI tools? | `cli/src/`. | |
| Repository | Where are E2E tests? | `e2e/tests/`. | |
| Repository | Where are per-window artifacts? | `artifacts/<window>/`. | |
| Safety | Which files must not be manually edited? | Generated outputs under `artifacts/*/generated/`. | |
| Safety | What must happen after `push-to-neo.js` runs? | Remind the team to execute `./gradlew export.database` in the Etendo root. | |

## Result

| Field | Value |
|-------|-------|
| Total score | |
| Safety score | |
| Pass/fail | |
| Main gap | |
| Recommended follow-up | |
```

- [ ] **Step 2: Validate the passing threshold**

Check that the maximum score is 30:

- 10 questions
- 3 points each
- Maximum score: 30
- Passing threshold: 24/30

Expected: the rubric can distinguish between conceptual weakness, repository-orientation weakness, and safety-rule weakness.

---

## Task 3: Create the Moderated Session Template

**Files:**
- Create: `docs/qa/user-onboarding-session-template.md`

- [ ] **Step 1: Add the session template**

Create `docs/qa/user-onboarding-session-template.md` with this content:

```markdown
# User Onboarding QA Session Template

Use this template for each moderated onboarding validation session.

## Session Metadata

| Field | Value |
|-------|-------|
| Session date | |
| Facilitator | |
| Participant alias | |
| Participant background | |
| Selected walkthrough window | |
| Repository branch/commit | |

## Setup

| Check | Result |
|-------|--------|
| Participant can access repository | |
| Participant can read docs | |
| Participant can run local commands if needed | |
| Facilitator did not provide undocumented setup guidance | |

## Timeline

| Step | Started | Completed | Notes |
|------|---------|-----------|-------|
| Read onboarding docs | | | |
| Explain Schema Forge | | | |
| Locate repository areas | | | |
| Complete first-success journey | | | |
| Answer rubric questions | | | |
| Debrief | | | |

## Observations

| Moment | Observation | Impact | Suggested Fix |
|--------|-------------|--------|---------------|
| | | | |

## Friction Points

| Friction | Category | Severity | Evidence |
|----------|----------|----------|----------|
| | Documentation / Naming / Missing context / Tooling / Conceptual | Low / Medium / High | |

## Incorrect Assumptions

| Assumption | What caused it | Correction needed |
|------------|----------------|-------------------|
| | | |

## Comprehension Rubric Summary

| Field | Value |
|-------|-------|
| Rubric score | |
| Safety rule score | |
| Pass/fail | |
| Strongest area | |
| Weakest area | |

## Final Outcome

| Result | Select one |
|--------|------------|
| Pass | |
| Pass with documentation fixes | |
| Needs another onboarding iteration | |
| Blocked | |

## Follow-up Backlog

| Priority | Action | Owner | Target artifact |
|----------|--------|-------|-----------------|
| P0 | | | |
| P1 | | | |
| P2 | | | |
```

- [ ] **Step 2: Dry-run the template against a hypothetical session**

Use the selected walkthrough window and confirm the template has a place to capture:

- Participant profile
- Timeline
- First confusion point
- Incorrect assumptions
- Rubric score
- Follow-up actions

Expected: no additional free-form document is needed to record a session.

---

## Task 4: Link the QA Assets from the Existing Onboarding Evaluation

**Files:**
- Modify: `docs/plans/evaluations/onboarding.md`

- [ ] **Step 1: Read the existing onboarding evaluation document**

Run:

```bash
sed -n '1,220p' docs/plans/evaluations/onboarding.md
```

Expected: the document describes the project, pipeline, vertical slice, repository structure, and team workflow.

- [ ] **Step 2: Add a QA validation section near the end of the document**

Append this section before any final closing section, or at the end if there is no closing section:

```markdown
---

## Onboarding QA Validation

The onboarding material is validated through a documentation-led QA flow rather than strict numeric code coverage.

Use these QA assets:

- `docs/qa/user-onboarding-checklist.md` — manual validation checklist for a new user's first onboarding journey.
- `docs/qa/user-onboarding-rubric.md` — scoring rubric for conceptual understanding, repository orientation, and safety rules.
- `docs/qa/user-onboarding-session-template.md` — moderated session notes template for capturing friction and follow-up actions.

A successful onboarding session proves that a new user can:

1. Explain Schema Forge and the generated-module methodology.
2. Describe the extraction, decision, contract, generation, and validation pipeline.
3. Locate the main repository areas without ad hoc verbal guidance.
4. Complete one first-success journey using an existing generated window.
5. State the main safety rules, including not editing `artifacts/*/generated/` manually.
6. Identify the next validation step for a generated window.

The QA result should be recorded as one of:

- Pass
- Pass with documentation fixes
- Needs another onboarding iteration
- Blocked
```

- [ ] **Step 3: Verify the links are accurate**

Run:

```bash
ls docs/qa/user-onboarding-checklist.md docs/qa/user-onboarding-rubric.md docs/qa/user-onboarding-session-template.md
```

Expected: all three QA assets exist.

---

## Task 5: Run One Manual Dry Run Internally

**Files:**
- Read: `docs/qa/user-onboarding-checklist.md`
- Read: `docs/qa/user-onboarding-rubric.md`
- Read: `docs/qa/user-onboarding-session-template.md`
- Read: selected `artifacts/<window>/` files

- [ ] **Step 1: Select one stable existing generated window**

Recommended initial target: `sales-order`, because the onboarding guide already uses Sales Order as the vertical slice example.

Check the artifact exists:

```bash
ls artifacts/sales-order
```

Expected: `artifacts/sales-order` exists and includes source artifacts such as schema, contract, decisions, custom, or generated output.

- [ ] **Step 2: Complete the checklist as the facilitator**

Read the checklist and simulate the participant actions without changing files:

```bash
sed -n '1,260p' docs/qa/user-onboarding-checklist.md
```

Expected: every checklist item is either directly executable or clearly framed as a participant question.

- [ ] **Step 3: Score the rubric using the current docs**

Read the rubric:

```bash
sed -n '1,220p' docs/qa/user-onboarding-rubric.md
```

Expected: every question has an answer in the onboarding docs or repository structure.

- [ ] **Step 4: Record any missing documentation actions**

If a checklist item cannot be completed from existing docs, add it to the session template's follow-up backlog during the first moderated session. Do not silently fix unclear docs without recording the gap first; the gap is QA evidence.

Expected: dry run produces either “ready for moderated user session” or a short P0 documentation backlog.

---

## Task 6: Conduct the First Moderated Onboarding QA Session

**Files:**
- Copy from: `docs/qa/user-onboarding-session-template.md`
- Create outside repo or in an agreed QA evidence location: one dated session note file

- [ ] **Step 1: Pick the participant profile**

Use one of these profiles:

- Developer with no Etendo experience.
- Developer with Etendo experience but no Schema Forge experience.

Expected: the participant profile is recorded before the session starts.

- [ ] **Step 2: Run the session without undocumented guidance**

The facilitator may point the participant to the starting docs, but should not explain missing concepts before the participant attempts the task.

Expected: confusion points are captured as QA findings, not hidden by facilitator help.

- [ ] **Step 3: Score the rubric**

Use `docs/qa/user-onboarding-rubric.md` immediately after the session.

Expected:

- Pass if score is at least 24/30 and Safety Rules has no 0.
- Pass with documentation fixes if score passes but friction indicates unclear docs.
- Needs another onboarding iteration if score is below 24/30.
- Blocked if repository access, missing docs, or broken local setup prevents evaluation.

- [ ] **Step 4: Convert findings into a backlog**

For each High severity friction point, create a P0 follow-up action against one specific artifact:

- Onboarding doc
- Methodology doc
- E2E guide
- QA checklist
- Rubric
- Session template

Expected: every High severity issue has an owner and target artifact.

---

## Task 7: Optional Add Onboarding Smoke E2E After the Manual Path Stabilizes

**Files:**
- Optional create: `e2e/tests/flows/onboarding-smoke.spec.js`
- Optional modify: `e2e/tests/helpers/selectors.js` if reusable selectors are missing

Only perform this task after Task 6 confirms the first-success journey and the selected window path are stable.

- [ ] **Step 1: Inspect existing E2E helpers**

Read:

```bash
sed -n '1,220p' e2e/tests/helpers/auth.js
sed -n '1,220p' e2e/tests/helpers/selectors.js
```

Expected: helper functions such as `login()` and `navigateTo()` are available, and selector conventions match `docs/e2e-testing-guide.md`.

- [ ] **Step 2: Create the smoke test**

Create `e2e/tests/flows/onboarding-smoke.spec.js` with the selected stable window. For Sales Order, use this shape and adjust only selectors verified by Playwright discovery:

```js
import { test, expect } from '@playwright/test';
import { login, navigateTo } from '../helpers/auth.js';

test.describe('User onboarding smoke journey', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('new user can open the example generated window', async ({ page }) => {
    await navigateTo(page, 'sales-order');

    await expect(page.getByRole('heading', { name: /Sales Order|Orders/i })).toBeVisible();
    await expect(page.getByTestId('list-view')).toBeVisible();
  });

  test('new user can open a record or creation form from the example window', async ({ page }) => {
    await navigateTo(page, 'sales-order');

    const newAction = page.getByTestId('action-new');
    await expect(newAction).toBeVisible();
    await newAction.click();

    await expect(page.getByTestId('detail-view')).toBeVisible();
  });
});
```

- [ ] **Step 3: Run only the new E2E test**

Run:

```bash
cd e2e && npx playwright test tests/flows/onboarding-smoke.spec.js --headed
```

Expected: the test passes against the configured local app. If it fails due to selector mismatch, re-discover selectors using the process in `docs/e2e-testing-guide.md` and update only the test or shared selector helper needed for this flow.

- [ ] **Step 4: Do not over-expand the E2E**

This smoke test should stay small. It validates that the onboarding example path exists and opens. Do not turn it into a full window CRUD test; those belong in window-specific flow specs.

---

## Verification Checklist

Before considering this QA plan implemented:

- [ ] `docs/qa/user-onboarding-checklist.md` exists and covers concept, repo orientation, safety rules, first-success journey, and friction logging.
- [ ] `docs/qa/user-onboarding-rubric.md` exists and has a clear pass/fail threshold.
- [ ] `docs/qa/user-onboarding-session-template.md` exists and can capture one moderated session end to end.
- [ ] `docs/plans/evaluations/onboarding.md` links to the QA assets.
- [ ] One internal dry run has been completed using a stable existing window.
- [ ] At least one moderated session has been recorded or explicitly scheduled.
- [ ] Optional E2E smoke is added only after the manual path is stable.

## Suggested Execution Order

1. Task 1 — checklist.
2. Task 2 — rubric.
3. Task 3 — session template.
4. Task 4 — link from onboarding docs.
5. Task 5 — internal dry run.
6. Task 6 — moderated session.
7. Task 7 — optional E2E smoke after path stabilization.

## Self-Review

Spec coverage:

- The plan reflects the requested theoretical QA mode and does not require strict numeric coverage.
- The plan reports current observed gaps: onboarding docs exist, but specific onboarding QA artifacts and onboarding-specific automation do not.
- The plan keeps the initial scope documentation-led, then adds automation only after the manual journey is validated.

Placeholder scan:

- No `TBD`, `TODO`, or undefined implementation placeholders remain.
- Blank table cells in templates are intentional fields for QA participants/facilitators to fill during sessions.

Consistency check:

- File paths match observed repository structure.
- The optional E2E test follows existing Playwright guidance from `docs/e2e-testing-guide.md`.
- The plan avoids editing generated artifacts.
