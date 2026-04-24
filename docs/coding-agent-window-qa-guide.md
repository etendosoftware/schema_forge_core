# Coding Agent Window QA Guide

> **Status:** Mandatory for generated/custom window work.
>
> **Applies to:** Developers using any coding agent to create, regenerate, customize, or review Schema Forge windows.

## Purpose

Coding agents are capable of finding many window-level defects, but they do not reliably do so unless the task explicitly requires cross-layer QA. A buildable implementation is not enough. For Schema Forge windows, the delivery risk lives in the contract between:

- the Jira requirement and acceptance criteria;
- Figma design evidence;
- per-window functional documentation in `docs/generated-custom-windows/`;
- generated/custom React UI;
- `contract.json` and `decisions.json`;
- shared app-shell runtime components;
- NEO action endpoints and handlers;
- document status rules;
- required payload fields;
- parent/child persistence rules;
- user-visible actions.

This guide defines the mandatory workflow developers must follow when using coding agents for window work.

## Core rule

Do not use a coding agent only as an implementer. Every window change must include:

1. requirement validation;
2. Figma evidence validation;
3. implementation;
4. a separate functional QA review pass;
5. PR-level evidence.

A task is not complete because:

- the app builds;
- generated code compiles;
- existing tests pass;
- the requested button appears;
- documentation was updated.

A task is complete only when the implementation has been checked against the functional contracts in this guide and the evidence is included in the PR.

## Mandatory requirement validation

Development must not start until the requirement is clear enough to implement and verify.

The developer must inspect the Jira issue before implementation and confirm:

- the user/business goal is explicit;
- acceptance criteria are present or can be derived and written down;
- affected window(s), route(s), and user role(s) are identified;
- the expected behavior is defined for success and failure states;
- required data dependencies are known;
- design source is linked when the change affects visible UI.

If the Jira requirement is incomplete, the developer must be proactive:

- ask the missing question in Jira, Slack, or the agreed team channel;
- propose a concrete completion of the requirement for stakeholder approval;
- record assumptions in the PR only after they were accepted or explicitly authorized.

The developer must not implement from an unclear requirement.

Unacceptable requirement states:

- “make it work like the old system” without specifying the visible behavior;
- “add the button” without defining the action result;
- “use the Figma” without linking the frame or explaining which state applies;
- “fix the flow” without reproduction or acceptance criteria;
- “backend will handle it” without endpoint or process evidence.

## Mandatory Figma evidence

If the change affects visible UI, the Jira task must contain one or more screenshots from Figma. The PR must link to the Jira task and confirm that the required design evidence is present there.

This is Jira/PR evidence, not commit content. Do not commit Figma screenshots unless the task explicitly asks for versioned design assets.

### Effective Figma process

Use this process for UI-affecting work:

1. **Locate the source design**
   - Find the Figma file/frame linked from Jira or the product/design handoff.
   - If no Figma link exists for a visible UI change, ask for it or document that no design exists before starting.

2. **Capture the relevant states in Jira**
   - Add one or more Figma screenshots to the Jira task before the PR is marked ready.
   - Include the main happy path state.
   - Include additional states when relevant: empty, loading, error, read-only, processed/completed, modal open, action confirmation.

3. **Compare implementation against design**
   - In the PR, link the Jira task that contains the Figma screenshots.
   - Add implementation screenshots to the PR so reviewers can compare them with the Figma screenshots stored in Jira.
   - Call out intentional deviations explicitly.
   - If the implementation cannot match Figma because of a platform constraint, document the constraint before review.

4. **Keep evidence in the right place**
   - Store Figma screenshots in Jira.
   - Link the Figma frame in Jira and/or the PR.
   - Add implementation screenshots to the PR.
   - Do not require a commit just to add screenshot artifacts.

### Required PR fields for Figma

Every UI-affecting PR must include:

```md
## Design Evidence

Jira design evidence:
- <Jira issue link containing Figma screenshot(s)>

Figma:
- <frame/file link or "No Figma source exists; requirement confirmed in Jira">

Figma screenshots in Jira:
- [ ] Main expected state is attached to Jira
- [ ] Additional required states are attached to Jira, if applicable

Implementation screenshots in PR:
- <embedded or attached screenshot 1>
- <embedded or attached screenshot 2, if needed>

Intentional deviations:
- ...
```

If no Figma exists, the PR must state:

```md
Design Evidence: No Figma source exists for this change. Requirement confirmed in <Jira/comment/link>.
```

## Functional window documentation source

Per-window functional guides live in `docs/generated-custom-windows/`.

Before changing a window, the developer must:

1. open `docs/generated-custom-windows/INDEX.md`;
2. find the affected window guide;
3. read the existing guide before implementation;
4. compare the Jira/Figma requirement against the documented current behavior;
5. update the window guide in the same PR when behavior changes.

The guide is the QA/product-facing functional map for the window. It is not optional background reading.

If the existing guide conflicts with Jira or Figma, the developer must resolve the conflict before implementation:

- ask for clarification;
- propose the intended behavior;
- update the guide once the decision is made.

If a changed window does not have a functional guide, create one before marking the PR ready.

## The agent gap

Coding agents can detect many of these issues when asked directly, but normal implementation prompts are too local. If the prompt says “add this button” or “regenerate this window,” the agent may optimize for the local diff and stop once the UI compiles.

The common gap is:

```text
agent capability != agent obligation
```

The agent may be capable of checking backend support, required hidden fields, unsaved parent state, action status rules, Figma alignment, and functional docs, but it will not consistently perform those checks unless the workflow makes them mandatory.

## Mandatory separation of roles

Every non-trivial window change must use at least two distinct agent passes:

1. **Implementation pass** — performs the requested feature/fix/regeneration.
2. **Functional QA review pass** — reviews the finished diff as a QA engineer, not as the implementer.

For large or risky changes, use three passes:

1. Implementation pass.
2. Code review pass.
3. QA scenario pass.

The QA pass must be run after implementation and before the PR is marked ready.

## Required coding-agent QA prompt

Use this prompt, or an equivalent stricter version, after any generated/custom window change:

```text
Review this diff as a functional QA engineer for Schema Forge windows.

Do not focus on style. Find only bugs, delivery blockers, and product inconsistencies.

First validate delivery inputs:
- Jira requirement is clear enough to implement and verify;
- acceptance criteria are explicit or documented in the PR;
- Jira contains the required Figma link and one or more Figma screenshots for UI changes, or an accepted no-Figma note;
- implementation screenshots are present in the PR for UI changes;
- affected docs/generated-custom-windows/<window>.md guides were read and updated if behavior changed.

Then check every changed generated/custom window for:
- visible actions with empty or placeholder handlers;
- frontend action endpoints not declared in contract.json or not supported by backend handlers;
- required hidden fields missing from save/add-line payloads;
- custom modals or child tabs that bypass saved-parent requirements;
- mutating actions that can run with recordId = new/null/undefined;
- status-gated actions visible in the wrong document state;
- read-only/processed/completed records that can still be edited;
- dependent selectors missing parent context;
- multi-step actions that can partially succeed and duplicate work on retry;
- versioned child entities edited without visible or deterministic version context;
- missing unit/component/E2E evidence for changed critical flows.

For each finding, return:
- severity: Blocker, High, Medium, or Low;
- impacted window and user flow;
- exact file evidence;
- why it matters;
- recommended verification or fix.

If no findings exist, say which files, flows, Jira requirement, Figma evidence, and functional docs were checked.
```

## Mandatory cross-layer checks

### 1. Visible actions must be real

For every visible action added or changed, verify all links in this chain:

```text
visible UI action -> frontend handler -> endpoint/action name -> contract.json action -> backend handler/process -> test or manual evidence
```

Rules:

- No visible action may use `onClick: () => {}` or equivalent no-op handler.
- No visible action may call a backend action that is missing from `contract.json` unless there is explicit custom handler support.
- Destructive actions must have confirmation and observable result.
- If an action is intentionally not implemented, it must be hidden, not rendered as a dead control.

### 2. Required fields must reach the payload

For every changed form or inline add-row flow, compare visible/hidden fields against the contract.

Any field that is required by the contract or source column must be covered by at least one of:

- visible editable field;
- `addLineFields.hidden`;
- `addLineFields.derived`;
- contract default value;
- derivation from parent/config/sequence;
- callout result with regression coverage;
- backend default with explicit evidence.

If a required field is hidden and none of these are true, the change is not ready.

### 3. Quantity and amount fallbacks must match the entity

Do not assume one quantity field fits every document line.

Examples:

- sales/purchase/quotation lines often use `orderedQuantity`;
- invoice lines may use `invoicedQuantity`;
- shipment/movement lines may use movement-specific quantity fields.

Any fallback that calculates amount fields must use the quantity field present in that entity's add-line configuration.

### 4. Parent/child flows must respect persisted parent state

If a child tab, custom modal, or child selector requires a saved parent record, verify that the UI either:

- saves the parent first;
- blocks the child action until the parent exists;
- or hides the action while the parent is new.

This rule applies to generated child forms and custom modals equally.

### 5. Mutating actions must not run on unsaved records

Any action URL containing a record id must prove the id is persisted before the request is sent.

Invalid action states include:

- `recordId === 'new'`;
- `recordId == null`;
- missing parent id;
- stale route id after failed save.

Actions such as process, confirm, cancel, generate list, update quantities, send document, and create downstream document must be guarded.

### 6. Status gates must be explicit

For document windows, create or verify a state matrix:

| State | Editable? | Visible actions | Hidden actions | Expected backend behavior |
|---|---|---|---|---|
| New | Yes | Save | Process/Confirm/Generate | No mutating action endpoint without saved id |
| Draft | Yes | Save/Confirm/Send | Completed-only actions | Draft actions only |
| Completed/Processed | Usually no | Management actions only | Save/edit actions | Backend rejects invalid mutation |
| Closed/Void | No | View-only actions | Save/process/edit | Backend rejects mutation |

If the UI shows an action outside the valid state, the PR is not ready.

### 7. Multi-step actions must handle partial success

If one user click performs multiple mutating requests, the flow must be atomic or recoverable.

Examples:

```text
confirm order -> create shipment -> create invoice
```

Required protection:

- one atomic backend endpoint; or
- idempotency key; or
- persisted partial-success state; or
- retry UI that disables already-created downstream steps.

A modal that simply shows an error after the second request fails is not enough if the first request already created data.

### 8. Versioned data must expose version context

If a custom UI edits child data through an intermediate version entity, the user must know which version is being edited.

Do not silently choose:

```js
versions[0]
```

unless the code and UI establish a deterministic policy, such as active version, latest valid-from version, or backend-resolved current version.

## Mandatory test expectations

### Minimum evidence for changed windows

For every changed generated/custom window, provide evidence for:

- route loads;
- new record flow;
- edit existing record flow;
- required fields save correctly;
- child row or secondary record flow if present;
- each changed visible action;
- status/read-only behavior if document state is involved;
- dependent selectors if touched;
- error path for at least one changed mutating action;
- Figma-vs-implementation visual comparison for UI changes.

### Critical shared files require broader smoke

If any of these files change, test multiple critical windows, not only the feature window:

- `tools/app-shell/src/components/contract-ui/DetailView.jsx`
- `tools/app-shell/src/hooks/useEntity.js`
- `tools/app-shell/src/windows/registry.js`
- shared selector/default/action helpers
- generator code that affects generated forms, tables, pages, or contracts

Critical smoke set:

- Contacts
- Sales Quotation
- Sales Order
- Purchase Order
- Physical Inventory
- Price List
- Product

## Required PR evidence

Any PR touching window behavior must include this section. This evidence belongs in the PR, not in individual commits.

```md
## Requirement Evidence

Jira:
- <issue link>

Requirement summary:
- ...

Acceptance criteria:
- ...

Open questions resolved before development:
- ...

## Design Evidence

Jira design evidence:
- <Jira issue link containing Figma screenshot(s)>

Figma:
- <frame/file link or "No Figma source exists; requirement confirmed in ...">

Figma screenshots in Jira:
- [ ] Main expected state is attached to Jira
- [ ] Additional required states are attached to Jira, if applicable

Implementation screenshots in PR:
- <embedded or attached screenshot 1>
- <embedded or attached screenshot 2, if needed>

Intentional deviations:
- ...

## Window QA Evidence

Changed windows:
- ...

Coding-agent passes used:
- [ ] Implementation pass
- [ ] Functional QA review pass
- [ ] Code review pass, if applicable

Functional docs:
- [ ] Read `docs/generated-custom-windows/INDEX.md`
- [ ] Read affected `docs/generated-custom-windows/<window>.md`
- [ ] Updated affected functional guide if behavior changed

Cross-layer checks:
- [ ] Every visible action has a real handler and backend/contract support
- [ ] No visible action is a placeholder/no-op
- [ ] Required hidden fields reach the payload through a proven source
- [ ] Child/custom modal flows respect saved parent state
- [ ] Mutating actions cannot run with recordId = new/null/undefined
- [ ] Status-gated actions were checked in valid and invalid states
- [ ] Multi-step mutating flows handle partial success or are atomic
- [ ] Versioned child data has visible or deterministic version context

Commands run:
- ...

Manual scenarios or browser tests:
- ...

Known gaps / accepted risks:
- ...
```

A PR without this evidence is not ready for review.

## Mandatory review stance

When using a coding agent for the QA pass, the reviewer must assume:

- requirements can be incomplete and must be validated before implementation;
- Figma may show states not mentioned in Jira;
- functional docs may reveal existing behavior that conflicts with the request;
- generated code can be structurally correct and functionally wrong;
- action names can be plausible but unsupported;
- backend endpoints can exist for one spec and not another;
- required fields can be hidden by UI decisions;
- custom wrappers can bypass shared generated safeguards;
- partial success is a data-integrity bug, not a UX detail;
- passing build output is not evidence of workflow correctness.

The QA pass must search for the ways the flow breaks, not only confirm the happy path.

## Anti-patterns

These are not acceptable:

- “The agent implemented it, so it should be fine.”
- “The Jira task was vague, so I filled in the behavior silently.”
- “There was no Figma screenshot in Jira, but the UI is obvious.”
- “The build passed.”
- “The button appears in the UI.”
- “The endpoint name follows the same pattern.”
- “Existing tests did not fail.”
- “The generated contract has the field somewhere.”
- “The backend will probably reject invalid states.”
- “We can document the gap later.”

Each of these hides a real delivery risk.

## Bottom line

Coding agents are powerful enough to find many of these problems when instructed correctly. The process must make that instruction mandatory.

For Schema Forge window work, the required standard is:

```text
Validate the requirement.
Confirm the design source.
Read the functional window guide.
Implement locally.
Review systemically.
Verify with PR-level evidence.
Only then deliver.
```
