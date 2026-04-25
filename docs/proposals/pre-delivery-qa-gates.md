# Pre-delivery QA Gate Improvements

## Context

Schema Forge already has several GitHub Actions gates:

- `test.yml` runs CLI tests and builds `tools/app-shell`.
- `quality-gate.yml` runs `cli/src/quality-gate.js --pr-affected` with blocker checks for parse, imports, contract, invariants, and i18n.
- `pipeline-validate.yml` validates artifact/pipeline consistency, currently in shadow mode.
- `pr-architecture-alert.yml` runs deterministic PR review logic through `cli/src/pr-review.js`.
- `window-doc-freshness.yml` warns when changed windows do not update their functional guide.
- `core-approval.yml` requires approval for non-artifact changes.
- `epic-rollup-entry.yml` and `epic-rollup-report.yml` summarize feature PR risk when promoting an epic into `develop`.

The gap is not the absence of CI. The gap is that the current gates mostly validate structural integrity, while recent defects were functional contract mismatches between the generated/custom UI, action endpoints, required payload fields, document state, and backend support.

## Goal

Improve pre-delivery QA so window changes cannot reach `develop` with obvious runtime inconsistencies:

- visible buttons that do nothing;
- visible actions that call unsupported backend endpoints;
- hidden required fields missing from payloads;
- custom modals bypassing save-first requirements;
- action calls allowed on unsaved records;
- versioned child data edited without visible version context;
- critical window changes shipped without targeted browser/API evidence.

## Recommended additions to existing gates

### 1. Extend `quality-gate` with visible-action invariants

Add a blocker check that scans generated and custom window source for visible action handlers that are no-ops.

Block patterns such as:

```js
onClick: () => {}
onClick={() => {}}
```

Prioritize these locations:

- `menuActions`
- `topbarRight`
- `topbarExtra`
- `extraActions`
- custom kebab/more-menu content

**Why:** A visible document-management action implies a real state transition. If the handler is empty, the UI lies to the user.

**Suggested severity:** blocker.

### 2. Validate visible action endpoint support

Add a gate that checks every visible frontend `/action/<name>` call against at least one source of backend truth:

1. `artifacts/<window>/contract.json` / `apiPrediction.actions` declares the action.
2. A registered NeoHandler supports the current `specName` and action name.
3. The action is explicitly allowlisted as a custom frontend-only action with a test.

**Example class of issue:** a quotation UI exposing `createDraftInvoice` while the backend draft-invoice handler only supports other specs.

**Suggested severity:** blocker for visible actions.

### 3. Strengthen `addLineFields` required-field coverage

The current quality-gate invariants already validate product lookup, quantity defaults, and some hidden fields. Add a stricter invariant:

> Every required field that is not visible in add-line entry must have a proven payload source.

Acceptable sources:

- present in `addLineFields.hidden`;
- present in `addLineFields.derived`;
- contract `defaultValue`;
- contract derivation (`fromParent`, `fromConfig`, sequence, etc.);
- callout-backed field with a regression test;
- backend mandatory default documented and tested.

The gate should flag a required hidden field when none of those sources is present.

**Important detail:** fallback logic must use the quantity field actually present in the active line shape. Order/quotation lines usually expose `orderedQuantity`; invoice lines may expose `invoicedQuantity`; shipment lines may expose movement quantity. A generic hardcoded quantity field is not enough.

**Suggested severity:** blocker.

### 4. Enforce `customAddModal + requireSavedRecord`

If a secondary tab declares both:

```js
customAddModal: SomeModal,
requireSavedRecord: true
```

the add path must either:

- auto-save the parent before opening the modal;
- block the modal until a persisted parent id exists;
- or hide the add action while the parent record is new.

This rule must apply equally to generated child forms and custom modals.

**Suggested severity:** blocker.

### 5. Block action endpoints on unsaved records

Any custom action that builds a URL like:

```js
/${recordId}/action/<actionName>
```

must prove `recordId` is a persisted id, not `new`, `null`, or `undefined`.

This applies to actions such as:

- process;
- confirm;
- cancel;
- generate list;
- update quantities;
- send document;
- create downstream document.

**Suggested severity:** blocker for mutating actions.

### 6. Add versioned-child data checks

When a custom UI hides an intermediate version entity and edits a child entity directly, the UI must expose or declare a deterministic version policy.

A gate should warn or block when code silently chooses:

```js
const version = versions[0];
```

without showing the selected version or documenting the selection rule.

Acceptable patterns:

- visible version selector;
- deterministic active/current/latest rule with UI label;
- backend endpoint that resolves the active version explicitly;
- documented single-version invariant with test data proving it.

**Suggested severity:** warning initially, blocker for finance/pricing/accounting data.

### 7. Move `pipeline-validate` out of shadow mode for blockers

`pipeline-validate.yml` currently uses `continue-on-error: true`, so blocking violations are advisory in practice.

Recommended rollout:

1. Keep warnings advisory.
2. Make `BLOCK` violations fail on PRs into `epic/ETP-3504` and `develop`.
3. Use strict mode only for epic promotion into `develop` once the false-positive rate is acceptable.

**Suggested severity:** existing `BLOCK` violations should fail required checks.

### 8. Make window doc freshness blocking for epic promotion

`window-doc-freshness.yml` is currently warning-only. Keep that behavior for early feature PRs if needed, but make it blocking when the base branch is `develop` or when the head is the epic branch being promoted.

Recommended policy:

- Feature PR -> `epic/ETP-3504`: warning is acceptable during adoption.
- `epic/ETP-3504` -> `develop`: missing window docs block merge.
- Any PR touching `tools/app-shell/src/windows/custom/**`: stronger enforcement, because custom behavior is where functional drift is most likely.

### 9. Expand `test.yml` beyond CLI tests and build

The current `test.yml` runs CLI tests and builds the app shell. Add separate jobs for frontend behavior:

```yaml
app-shell-unit:
  run: npm run test --workspace=tools/app-shell

artifact-window-tests:
  run: node --test 'artifacts/**/__tests__/*.test.js'

window-e2e-smoke:
  run: npx playwright test <affected-window-specs>
```

Use affected-window detection so CI stays targeted instead of always running every browser test.

### 10. Reuse affected-window detection for targeted Playwright smoke

`pipeline-validate.yml` already computes changed artifact names from the PR diff. Reuse that idea to select smoke tests.

Examples:

| Changed path | Suggested tests |
|---|---|
| `artifacts/sales-order/**` | `e2e/tests/flows/sales-order-*.spec.js` |
| `artifacts/purchase-order/**` | `e2e/tests/flows/purchase-order-*.spec.js` |
| `artifacts/physical-inventory/**` | `e2e/tests/flows/physical-inventory*.spec.js` |
| `tools/app-shell/src/components/contract-ui/DetailView.jsx` | smoke tests for Contacts, Sales Order, Purchase Order, Sales Quotation, Physical Inventory, Price List |
| `tools/app-shell/src/hooks/useEntity.js` | smoke tests for create, edit, child-line add, and defaults flows |

If a critical changed window has no smoke test, the gate should at least emit a high-severity warning.

### 11. Require QA evidence in PR bodies for window changes

Add a PR body check for changes under:

- `artifacts/**`;
- `tools/app-shell/src/windows/custom/**`;
- `tools/app-shell/src/components/contract-ui/**`;
- `tools/app-shell/src/hooks/useEntity.js`.

Required section:

```md
## Window QA Evidence

Changed windows:
- ...

Functional scenarios verified:
- [ ] Create new record
- [ ] Edit existing record
- [ ] Add child rows or secondary records
- [ ] Execute every visible action touched by this PR
- [ ] Verify status/read-only behavior
- [ ] Verify dependent selectors and inline creation flows

Commands run:
- ...

Known gaps / accepted risks:
- ...
```

This should not replace automated tests, but it gives reviewers explicit evidence and makes missing QA visible.

### 12. Extend the epic rollup with QA coverage

`epic-rollup-report.yml` already summarizes feature PRs and automated review results. Add a QA coverage section:

```md
## Window QA Coverage

| Window | PRs touched | Docs updated | Unit/component tests | E2E smoke | Actions changed | Risk |
|---|---:|---|---|---|---|---|
| sales-order | 3 | yes | partial | yes | yes | medium |
| sales-quotation | 2 | yes | partial | no | yes | high |
```

Flag as high risk when:

- a critical window changed without E2E smoke;
- a visible action changed without tests;
- `contract-ui` changed without critical-window smoke;
- a PR changed generated/custom window code but did not update the QA evidence section.

### 13. Add partial-success/idempotency review for multi-action flows

Detect frontend handlers that run multiple mutating action requests sequentially in one user action, for example:

```js
await createShipment();
await createInvoice();
```

Such flows must have one of these protections:

- backend atomic endpoint;
- idempotency key;
- partial success surfaced and stored before the next action;
- retry disables already-created downstream documents.

Start this as a `pr-review.js` warning and promote repeated offenders to blocker.

### 14. Prevent direct push bypass from becoming normal delivery

Branch gates only work if delivery goes through PR checks. If direct push to `epic/ETP-3504` is allowed for emergencies, add a compensating control:

- post-push workflow that runs the same required gates;
- automated issue/comment when a protected check was bypassed;
- required follow-up PR or explicit owner sign-off.

Preferred policy: no direct push to `epic/ETP-3504` or `develop` except documented break-glass cases.

## Proposed implementation order

### Phase 1 — Static blockers with high signal

1. Empty visible action handler check.
2. Visible action endpoint support check.
3. Required hidden field payload coverage check.
4. `customAddModal + requireSavedRecord` check.
5. Unsaved-record action endpoint check.

### Phase 2 — CI enforcement and targeted runtime proof

1. Make `pipeline-validate` fail on `BLOCK` violations.
2. Make `window-doc-freshness` blocking for epic promotion into `develop`.
3. Add app-shell unit/component tests to `test.yml`.
4. Add affected-window artifact tests.
5. Add affected-window Playwright smoke tests.

### Phase 3 — Release-level QA visibility

1. Require `Window QA Evidence` in PR bodies.
2. Add QA coverage matrix to epic rollout reports.
3. Add multi-action/idempotency warnings.
4. Add versioned-child data checks for pricing/accounting windows.

## Bug class coverage

| Failure mode | Existing gate coverage | Recommended addition |
|---|---|---|
| Visible no-op action | Not covered | Empty visible action handler blocker |
| Frontend calls unsupported `/action/*` | Not covered | Visible action endpoint support blocker |
| Required hidden field omitted from payload | Partially covered | Required hidden field payload coverage |
| Custom modal bypasses save-first parent rule | Not covered | `customAddModal + requireSavedRecord` invariant |
| Action runs with `recordId = new` | Not covered | Unsaved-record action blocker |
| Multi-step action duplicates downstream documents on retry | Not covered | Partial-success/idempotency warning + E2E scenario |
| Versioned child data edited through hidden first version | Not covered | Versioned-child context warning/blocker |
| Window docs stale | Covered as warning | Block on epic promotion |
| App shell compiles but behavior is broken | Build only | Affected-window unit/E2E smoke |

## Practical definition of done for window PRs

A window PR should not be considered ready until it proves:

1. Every visible action is implemented or intentionally hidden.
2. Every action endpoint is supported by contract/backend evidence.
3. Every required field reaches the save payload through UI, default, derivation, callout, or backend default.
4. Every child/custom modal honors parent persistence rules.
5. Every status-gated action was checked in at least one valid and one invalid state.
6. Every touched critical window has targeted unit/component or E2E evidence.
7. Every changed window guide is updated before promotion to `develop`.

## Bottom line

The repository already has useful gates. The next improvement should not be more generic CI. It should be functional contract validation for generated/custom windows:

- if the UI shows it, it must exist;
- if the backend requires it, the payload must include it;
- if the flow mutates data, the record must be persisted and the action must be idempotent or recoverable;
- if data is versioned, the user must know which version they are editing;
- if a critical window changed, targeted browser/API evidence must exist before delivery.
