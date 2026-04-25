# User Onboarding Comprehension Rubric

Use this rubric after the onboarding checklist to score whether the participant has enough understanding to continue independently.

## Scoring

| Score | Meaning |
|-------|---------|
| 0 | Cannot answer or gives an incorrect answer. |
| 1 | Partially correct but requires facilitator correction. |
| 2 | Correct answer with minor prompting. |
| 3 | Correct answer without prompting. |

Passing threshold: at least 29 out of 36, with no 0 score in Safety Rules.

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
| Repository | Where is the NEO Headless module? | `etendo_core/modules/com.etendoerp.go/`. | |
| Repository | Where is Schema Forge Java integration code in NEO Headless? | `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/`. | |
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
