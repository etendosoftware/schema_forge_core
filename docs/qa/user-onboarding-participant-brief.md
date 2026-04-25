# User Onboarding QA Participant Brief

You are participating in a QA session for the Schema Forge onboarding material. This is not a performance review. The goal is to find gaps in the documentation and onboarding flow.

## What to Do

Think aloud while you work. Say what you expect to find, what you search for, and what feels unclear.

## Starting Documents

Start by reading:

1. `docs/plans/evaluations/onboarding.md`
2. `docs/onboarding-methodology-shift.md`

## Your Tasks

### Task 1: Explain the System

After reading, explain in your own words:

1. What Schema Forge is.
2. What the human decides.
3. What the tooling generates.
4. The main pipeline steps.
5. The difference between the fast loop and validation loop.

### Task 2: Find the Main Repository Areas

Find these repository areas without asking for exact paths first:

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

### Task 3: Trace One Field

Using the Sales Order window, trace the `businessPartner` field from decision to generated UI behavior.

Try to find:

1. Where the field decision is recorded.
2. Whether another field depends on it.
3. How the field appears in the contract.
4. How it appears in the generated form.
5. How it appears in the generated list.
6. Whether an existing E2E test validates this behavior.

### Task 4: Safety Rules

Answer:

1. Which files should not be manually edited?
2. What should you do instead of guessing window, process, or menu IDs?
3. What reminder is needed if `push-to-neo.js` runs?

## Important Constraints

- Do not edit files during this QA session.
- Do not run destructive commands.
- Do not worry about exact line numbers unless you naturally find them.
- If you get stuck, say what you expected to find and where you looked.

## Completion

The session is complete when you have attempted all tasks and answered the facilitator's follow-up questions.
