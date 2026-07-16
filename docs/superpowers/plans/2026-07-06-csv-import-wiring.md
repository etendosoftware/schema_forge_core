# CSV Import Wiring (ListView + Generators + Windows) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CSV import reachable end-to-end from the real running app for **Contacts**
and **Product**: a toolbar button in `ListView` opens `ImportDialog` (already built,
`docs/superpowers/plans/2026-07-06-csv-import-dialog-ui.md`), backed by the engine
(already built, `docs/superpowers/plans/2026-07-06-csv-import-engine.md`), configured per
window via `decisions.json`.

**Architecture — spans two repos, verified, not assumed:**
- `schema_forge_core` (this repo): `cli/src/generate-contract.js` merges
  `decisions.json → window.import` with contract field metadata into `contract.json`;
  `cli/src/generate-frontend.js` emits an `import` prop on the generated `<ListView>`
  call when `window.import.enabled`. A small, additive extension to
  `packages/app-shell-core/src/lib/import/` adds a **custom FK-resolver registry** — see
  "Country/Region resolution" below.
- `etendo_schema_forge` (sibling repo, absolute path
  `/Users/sebastianbarrozo/Documents/work/epic/schema-forge`): `ListView.jsx` (hand-
  authored, **not generated** — confirmed by reading it; lives at
  `tools/app-shell/src/components/contract-ui/ListView.jsx`) accepts the new `import`
  prop, renders the toolbar icon, and mounts `<ImportDialog>` wired to the *real*
  `postBatch` (reusing the existing `useBatch` hook — verified it already POSTs to
  `/sws/neo/batch` with the exact response shape `ImportDialog` expects) and `simSearchFn`
  (the extended `simSearch` from `@etendosoftware/app-shell-core/lib/simSearch.js`, built
  in the engine plan). The Contacts composite descriptor and both windows'
  `decisions.json → import` blocks are authored here too.

**Country/Region resolution — why this needs its own mechanism, verified against the
real schema, not assumed:** Contacts' address requires creating a `C_Location` record
(confirmed via direct DB query — `c_location` has no `name`/`value` column at all, so it
can never be a `match`-mode target; it must be `createInline`, per the design spec).
`C_Location.c_country_id` is `NOT NULL`; `c_region_id` is nullable. `C_Country` and
`C_Region` **do** have a matchable `name` column — but region matching is not
independent: the same free-text region name (e.g. "Córdoba") exists under multiple
countries, so it must be resolved **scoped by the row's own already-resolved country**,
not as a standalone distinct-value lookup. This breaks the assumption
`resolveForeignKeys` (already built and tested in the engine plan) is built on — one
column resolves independently of the others. Rather than reshape that already-shipped,
tested API, this plan adds a **small, purely additive registry** (`registerFkResolver`/
`getFkResolver`, same pattern as `buildOperations.js`'s existing descriptor registry) that
the Contacts composite descriptor calls directly when building the `Location` operation —
outside the generic pre-send `resolveForeignKeys` pass entirely. This is the "override
mechanism on the `_core` side, custom matching solution in `etendo_schema_forge`" split
requested: the registry (generic, reusable) lives in `packages/app-shell-core`; the actual
country/region matching logic (calls `simSearch` against `Country`/`Region`, scopes region
by country) lives in `etendo_schema_forge`, registered under names the Contacts descriptor
looks up by string, never hardcoded to Contacts.

**Verified real DAL/schema facts this plan relies on (queried directly against the
Etendo DB via `cli/src/db.js`, not assumed from the contract's `reference` field):**

| Contract field | `reference` | Actual DAL `classname` (`AD_Table.classname`) | Match? |
|---|---|---|---|
| `product.uOM` | `UOM` | `UOM` (table `C_UOM`) | ✅ same |
| `product.productCategory` | `ProductCategory` | `ProductCategory` (table `M_Product_Category`) | ✅ same |
| `product.taxCategory` | `TaxCategory` | `TaxCategory` (table `C_TaxCategory`) | ✅ same — the two `TaxCategory.java` source files found earlier are a non-issue: `ModelProvider` registers by `AD_Table.classname`, and only **one** table (`C_TaxCategory`) has `classname='TaxCategory'` |
| `businessPartner.businessPartnerCategory` | `BusinessPartnerCategory` | `Category` (table `C_BP_Group`) | ❌ **differs** — real, confirmed case for the `matchEntity` override; not used in this plan (field excluded from `import.fields`, covered by NEO defaults per the design spec) but proof the override capability is load-bearing, not speculative |

So Product's three FK columns use `matchEntity` defaulting to `reference` (no override
needed); the override field exists in the schema for the case that does need it.

## Global Constraints

- All code, comments, commit messages, and identifiers in English (root `CLAUDE.md`
  `<language_policy>`). Spanish only in `decisions.json` label/alias *content* (the
  actual column-header text users will see, per this repo's i18n rule that the product is
  primarily Spanish) — never in code or comments.
- Commit messages: `Feature ETP-4447: <description>` (max 80 chars first line), no
  `Co-Authored-By`. Branch `feature/ETP-4447` already exists and is checked out in
  **both** repos — work in the repo each task specifies, never the other one for that
  task.
- Every `decisions.json` change is followed by the **Window Change Integrity Protocol**
  from `etendo_schema_forge`'s root `CLAUDE.md`: `make regen ONLY=<window>`, then the
  contract-integrity Python check, then the generated-import-path check, then the
  addLineFields check (N/A here, no lines entity involved) — Task 8 runs all of this for
  both windows.
- `packages/app-shell-core/src/` still may not import via `@/`, from `tools/app-shell`,
  or from `@schema-forge/app-shell` (same boundary test as the UI plan,
  `test/public-api.test.js`) — Task 1 (the only `schema_forge_core`-side *library* code
  in this plan) must respect it.

---

### Task 1: `registerFkResolver`/`getFkResolver` — custom FK-resolver registry (core)

**Repo:** `/Users/sebastianbarrozo/Documents/work/epic/schema_forge_core`

**Files:**
- Create: `packages/app-shell-core/src/lib/import/fkResolvers.js`
- Create: `packages/app-shell-core/src/lib/import/__tests__/fkResolvers.test.js`
- Modify: `packages/app-shell-core/package.json` (test glob — same fixed-list pattern as
  the engine plan; `src/lib/import/__tests__` is already in the glob from that plan, so
  **no edit needed** here, just confirming before skipping the step)

**Interfaces:**
- Produces: `registerFkResolver(name: string, fn: (value: string, context: object) =>
  Promise<ClassifyResult>): void` — `fn` resolves **one** raw text value (not a batch;
  callers needing distinct-value batching do it themselves, same as the Contacts
  descriptor in Task 6 will) and returns the same `ClassifyResult` shape
  `classifyCandidates` already produces (`{status:'auto-resolved',id,name}` or
  `{status:'needs-review',candidates}`), so downstream consumers (the review queue) don't
  need a second result shape to handle.
- Produces: `getFkResolver(name: string): Function | undefined`.
- This module has **zero dependency** on `resolveForeignKeys.js` and vice versa — it is
  a parallel, independent mechanism, not a modification of the already-shipped,
  already-tested distinct-value engine.

- [ ] **Step 1: Write the failing test**

Create `packages/app-shell-core/src/lib/import/__tests__/fkResolvers.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { registerFkResolver, getFkResolver } from '../fkResolvers.js';

describe('registerFkResolver / getFkResolver', () => {
  it('registers and retrieves a resolver by name', () => {
    const fn = async () => ({ status: 'auto-resolved', id: 'X', name: 'X' });
    registerFkResolver('test-resolver', fn);
    assert.equal(getFkResolver('test-resolver'), fn);
  });

  it('returns undefined for an unregistered name', () => {
    assert.equal(getFkResolver('nonexistent-resolver'), undefined);
  });

  it('overwrites a resolver registered twice under the same name', () => {
    const first = async () => ({ status: 'auto-resolved', id: 'A', name: 'A' });
    const second = async () => ({ status: 'auto-resolved', id: 'B', name: 'B' });
    registerFkResolver('overwrite-test', first);
    registerFkResolver('overwrite-test', second);
    assert.equal(getFkResolver('overwrite-test'), second);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test packages/app-shell-core/src/lib/import/__tests__/fkResolvers.test.js`
Expected: FAIL with `Cannot find module '../fkResolvers.js'`.

- [ ] **Step 3: Create `packages/app-shell-core/src/lib/import/fkResolvers.js`**

```js
const resolvers = new Map();

/**
 * Register a custom foreign-key resolver under a name a composite descriptor can look
 * up by string (same pattern as `buildOperations.js`'s descriptor registry). Exists
 * because some FK columns can't be resolved independently by distinct value — e.g. a
 * region name means different things depending on which country a row already
 * resolved to — so they opt out of the generic `resolveForeignKeys` distinct-value
 * batching entirely and are resolved by the composite descriptor itself, one value (and
 * whatever extra context it needs, e.g. an already-resolved country id) at a time.
 */
export function registerFkResolver(name, fn) {
  resolvers.set(name, fn);
}

export function getFkResolver(name) {
  return resolvers.get(name);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test packages/app-shell-core/src/lib/import/__tests__/fkResolvers.test.js`
Expected: PASS, all 3 cases.

- [ ] **Step 5: Run the full package suite and confirm the public-api boundary test still passes**

Run: `npm test --workspace=packages/app-shell-core`
Expected: PASS (the new file is picked up by the existing
`src/lib/import/__tests__/*.test.js` glob entry — added in the engine plan, confirm by
reading `packages/app-shell-core/package.json`'s `"test"` script before this step; if
somehow absent, add it exactly as the engine plan's Task 1 did).

- [ ] **Step 6: Commit**

```bash
git add packages/app-shell-core/src/lib/import/fkResolvers.js \
        packages/app-shell-core/src/lib/import/__tests__/fkResolvers.test.js
git commit -m "Feature ETP-4447: Add custom FK-resolver registry"
```

---

### Task 2: Expose the resolver registry from the package's public export surface (core)

**Repo:** `/Users/sebastianbarrozo/Documents/work/epic/schema_forge_core`

**Files:**
- Modify: `packages/app-shell-core/test/public-api.test.js`

**Interfaces:**
- No new export entry needed in `package.json` — `fkResolvers.js` already resolves via
  the existing `"./lib/*": "./src/lib/*"` wildcard export added in the UI plan's Task 6.
  This task only adds a regression assertion so a future change to that wildcard doesn't
  silently break this module's reachability.

- [ ] **Step 1: Write the failing test**

Edit `packages/app-shell-core/test/public-api.test.js` — add one line after the existing
`pkg.exports['./lib/*']` assertion (added in the UI plan's Task 6):

```js
  assert.equal(pkg.exports['./lib/*'], './src/lib/*');
```

(This line already exists from the UI plan — if it's there, this task instead adds a
direct resolvability check using Node's own resolver, which is the thing actually worth
testing here since the wildcard entry itself is already covered):

```js
test('fkResolvers.js is reachable at the documented subpath', async () => {
  const mod = await import('../src/lib/import/fkResolvers.js');
  assert.equal(typeof mod.registerFkResolver, 'function');
  assert.equal(typeof mod.getFkResolver, 'function');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test packages/app-shell-core/test/public-api.test.js`
Expected: FAIL only if Task 1 wasn't completed first (module missing) — since Task 1
precedes this one, this step should actually already PASS; run it anyway to document the
expectation and catch drift.

- [ ] **Step 3: Confirm (no code change expected)**

If Step 2 passed, there's nothing to implement — the wildcard export from the UI plan
already covers this. Skip to Step 4.

- [ ] **Step 4: Commit**

```bash
git add packages/app-shell-core/test/public-api.test.js
git commit -m "Feature ETP-4447: Add regression test for fkResolvers.js reachability"
```

---

### Task 3: `generate-contract.js` — merge `window.import` with resolved field metadata

**Repo:** `/Users/sebastianbarrozo/Documents/work/epic/schema_forge_core`

**Files:**
- Modify: `cli/src/generate-contract.js`
- Modify: `cli/test/generate-contract.test.js`

**Interfaces:**
- Consumes: `schema.window.import` (from `decisions.json`, shape per the design spec —
  `{ enabled, spec, entity, formats, delimiter, limit, dedupe, fields: [{target,
  aliases}], descriptor? }`).
- Produces: `contract.json → frontendContract.window.import` with every `fields[]` entry
  enriched with `label`, `required`, `type`, `reference` looked up from the contract's
  own entities — so `etendo_schema_forge`'s `decisions.json` only declares aliases, never
  duplicates metadata the contract already derives elsewhere.

- [ ] **Step 1: Write the failing test**

Add to `cli/test/generate-contract.test.js` (append a new `describe` block; read the
file's existing `minimalSchema` fixture first — reuse it, extended with an `import`
block, rather than inventing a second fixture):

```js
describe('generateFrontendContract — window.import', () => {
  it('passes through window.import.enabled unchanged when there are no fields to enrich', () => {
    const schema = { ...minimalSchema, window: { ...minimalSchema.window, import: { enabled: false } } };
    const fc = generateFrontendContract(schema);
    assert.equal(fc.window.import.enabled, false);
  });

  it('enriches each import field with label/required/type/reference from the contract', () => {
    const schema = {
      ...minimalSchema,
      window: {
        ...minimalSchema.window,
        import: {
          enabled: true,
          spec: 'sales',
          entity: 'order',
          fields: [{ target: 'documentNo', aliases: ['doc no'] }],
        },
      },
    };
    const fc = generateFrontendContract(schema);
    const field = fc.window.import.fields[0];
    assert.equal(field.target, 'documentNo');
    assert.deepEqual(field.aliases, ['doc no']);
    assert.equal(field.required, true);
    assert.equal(field.type, 'string');
  });

  it('throws when import.fields references a field name absent from every entity', () => {
    const schema = {
      ...minimalSchema,
      window: {
        ...minimalSchema.window,
        import: { enabled: true, fields: [{ target: 'doesNotExist' }] },
      },
    };
    assert.throws(() => generateFrontendContract(schema), /import\.fields references unknown field "doesNotExist"/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test cli/test/generate-contract.test.js`
Expected: FAIL — `fc.window.import.fields[0].required` is `undefined` (no enrichment
yet), and the third case doesn't throw.

- [ ] **Step 3: Implement the enrichment in `generate-contract.js`**

Read `generateFrontendContract` (around `cli/src/generate-contract.js:310-424` as of this
writing) before editing — the `win`/`entities` spread already happens there; add the
enrichment **after** both are fully built (so every entity's fields are available to
search), right before the `return`:

```js
  // window.import passes through via the spread above for free (enabled, spec, entity,
  // formats, limit, dedupe, descriptor, and each field's declared `target`/`aliases`).
  // What it doesn't get for free is per-field label/required/type/reference — those
  // live on the already-built `entities` fields, so backfill them here rather than
  // making etendo_schema_forge's decisions.json duplicate metadata the contract already
  // derives. Fails loudly on an unknown target, same posture as every other
  // decisions.json/contract mismatch in this file.
  if (win.import?.fields) {
    const allFields = Object.values(entities).flatMap((e) => e.fields);
    win.import.fields = win.import.fields.map((f) => {
      const match = allFields.find((ef) => ef.name === f.target);
      if (!match) {
        throw new Error(`window.import.fields references unknown field "${f.target}"`);
      }
      return { ...f, label: match.label, required: !!match.required, type: match.type, reference: match.reference };
    });
  }

  return { window: reorderKeys(win, WINDOW_KEY_ORDER), entities };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test cli/test/generate-contract.test.js`
Expected: PASS, including all pre-existing cases in that file (2269 lines as of this
writing — this change must not regress any of them; the enrichment is additive and only
triggers when `win.import.fields` is present).

- [ ] **Step 5: Commit**

```bash
git add cli/src/generate-contract.js cli/test/generate-contract.test.js
git commit -m "Feature ETP-4447: Merge window.import with resolved field metadata"
```

---

### Task 4: `generate-frontend.js` — emit the `import` prop on the generated `<ListView>`

**Repo:** `/Users/sebastianbarrozo/Documents/work/epic/schema_forge_core`

**Files:**
- Modify: `cli/src/generate-frontend.js`
- Create: `cli/test/generate-frontend.import.test.js`

**Interfaces:**
- Consumes: `contract.json → frontendContract.window.import` (from Task 3).
- Produces: when `window.import?.enabled` is true, the generated `HeaderPage.jsx`'s
  `<ListView ... import={${JSON.stringify(windowConfig.import)}} ... />` — the exact
  resolved config object, serialized as a JS object literal in the generated source
  (same technique already used for `attachmentsOpts` at
  `cli/src/generate-frontend.js:1137-1141`, confirmed by reading it).

- [ ] **Step 1: Write the failing test**

Create `cli/test/generate-frontend.import.test.js` — follow
`cli/test/generate-frontend.menuactions.test.js`'s exact style (a small pure helper
function, tested directly, no full schema/contract fixture needed):

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getImportProp } from '../src/generate-frontend.js';

describe('getImportProp', () => {
  it('returns an empty string when import is not enabled', () => {
    assert.equal(getImportProp({ enabled: false }), '');
    assert.equal(getImportProp(undefined), '');
    assert.equal(getImportProp(null), '');
  });

  it('emits an import prop with the serialized config when enabled', () => {
    const out = getImportProp({ enabled: true, spec: 'contacts', fields: [{ target: 'name' }] });
    assert.match(out, /import=\{/);
    assert.match(out, /"spec":"contacts"/);
    assert.match(out, /"target":"name"/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test cli/test/generate-frontend.import.test.js`
Expected: FAIL — `getImportProp` is not exported (doesn't exist yet).

- [ ] **Step 3: Implement `getImportProp` and wire it into the `<ListView>` emission**

Add the new exported helper near the other small prop-builders in
`cli/src/generate-frontend.js` (e.g. near `resolveAttachmentsConfig`, around line
1022 as of this writing):

```js
// window.import → <ListView import={...}> prop. Mirrors resolveAttachmentsConfig's
// enabled/disabled gating, but import has no "opt-in by default" case — a window is
// either explicitly configured for it or the button never appears.
export function getImportProp(importConfig) {
  if (!importConfig?.enabled) return '';
  return `\n      import={${JSON.stringify(importConfig)}}`;
}
```

Wire it into the `<ListView>` JSX template. Read the exact block first (around
`cli/src/generate-frontend.js:2309-2320` as of this writing) — append
`${importConfigProp}` to the existing prop-concatenation line right after
`${sendDocumentProp}${listSortByProp}`:

```js
      breadcrumb={breadcrumb}${apiProp}${isGallery ? `
      galleryRenderer={(gProps) => <${headerName}Gallery {...gProps} />}` : ''}${listKpiCardsProp}${listViewOptionsProp}${listBaseFilterProp}${quickFiltersProp}${subsetFiltersProp}${dateFilterKeyProp}${initialHiddenColumnsProp}${bulkActionsProp}${listbarPaddingXProp}${tablePaddingXProp}${hidePrintListProp}${hideCreateProp}${hideMoreMenuListProp}${hideListFiltersProp}${hideStatusFilterProp}${hideLinkProp}${hideEyeCountProp}${customListIconsProp}${labelOverridesListProp}${rowQuickActionsProp}${sendDocumentProp}${listSortByProp}${importConfigProp}
```

And define `importConfigProp` alongside the other resolved props earlier in the same
function (near where `sendDocumentProp`/`sendDocumentDetailProp` are computed, per
`cli/src/generate-frontend.js:1022-1041` as of this writing):

```js
  const importConfigProp = getImportProp(windowConfig.import);
```

`{...props}` (already present right after the prop block, confirmed by reading the
template) already spreads `token`/`apiBaseUrl` into `ListView` — no separate wiring
needed for those.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test cli/test/generate-frontend.import.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full generator test suite to confirm no regression**

Run: `node --test 'cli/test/generate-frontend*.test.js'`
Expected: PASS, every existing `generate-frontend*.test.js` file included.

- [ ] **Step 6: Commit**

```bash
git add cli/src/generate-frontend.js cli/test/generate-frontend.import.test.js
git commit -m "Feature ETP-4447: Emit ListView import prop from window.import config"
```

---

### Task 5: `ListView.jsx` — toolbar button, real `postBatch`/`simSearchFn` wiring

**Repo:** `/Users/sebastianbarrozo/Documents/work/epic/schema-forge`

**Files:**
- Modify: `tools/app-shell/src/components/contract-ui/ListView.jsx`
- Create: `tools/app-shell/src/components/contract-ui/__tests__/ListView.import.test.jsx`
  (a focused test file for just this behavior, additive to whatever `ListView.jsx` test
  coverage already exists — do not touch other `ListView` tests)

**Interfaces:**
- Consumes: `ImportDialog` from `@etendosoftware/app-shell-core/components/import/ImportDialog.jsx`
  (built in the UI plan, reachable today via the `LOCAL_CORE` dev alias documented in
  `docs/repo-topology.md` and via the published package once released — see the note at
  the end of this plan), `simSearch` from
  `@etendosoftware/app-shell-core/lib/simSearch.js`, and the existing `useBatch` hook at
  `tools/app-shell/src/components/copilot/ocr/ingest/useBatch.js` (verified: its
  `runBatch(operations)` already POSTs to `/sws/neo/batch` and returns the exact
  `{committed, operations, failedAt, error}` shape `sendRow`/`runImport` expect — this is
  a straight reuse, not new network code).
- Produces: a new `import` prop on `ListView` (`= null` default — every existing caller
  that doesn't pass it is unaffected), rendering a toolbar `IconButton`-style `Button`
  (matching the existing Refresh/Print button styling in the same toolbar block) that
  opens `ImportDialog` when clicked, and refreshes the list (`hook.refresh()`) via
  `onImported`.

- [ ] **Step 1: Write the failing test**

Create `tools/app-shell/src/components/contract-ui/__tests__/ListView.import.test.jsx`.
Read `ListView.jsx`'s existing test setup first (its `__tests__` directory, if one
exists, for the exact render-harness/mock-provider pattern this repo uses for `ListView`
specifically — it has real data-fetching hooks, `useEntity`, routing, etc., so it likely
needs more setup than the app-shell-core plans' components did) before writing this, and
follow that exact harness rather than inventing a new one. The test itself:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListView } from '../ListView.jsx';
// import whatever test-harness/provider wrapper this file's sibling tests already use

describe('ListView — import button', () => {
  it('does not render the import toolbar button when the import prop is absent', () => {
    // render with the existing minimal required props, import omitted
    expect(screen.queryByTestId('ListView__importButton')).toBeNull();
  });

  it('renders the import toolbar button when the import prop is present and enabled', () => {
    // render with import={{ enabled: true, spec: 'contacts', fields: [] }}
    expect(screen.getByTestId('ListView__importButton')).toBeDefined();
  });

  it('opens ImportDialog when the import button is clicked', () => {
    // render with import config, click ListView__importButton,
    // assert the dialog's dropzone testid (ImportDropzone__zone) appears
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `tools/app-shell`): `npx vitest run src/components/contract-ui/__tests__/ListView.import.test.jsx`
Expected: FAIL — no `ListView__importButton` testid exists yet.

- [ ] **Step 3: Add the `import` prop, toolbar button, and dialog wiring**

Add `import: importConfig = null` to `ListView`'s destructured props (alongside
`hidePrint`/`hideCreate` etc., per `ListView.jsx:176-236` as of this writing).

Add imports near the top of the file:

```jsx
import { ImportDialog } from '@etendosoftware/app-shell-core/components/import/ImportDialog.jsx';
import { simSearch } from '@etendosoftware/app-shell-core/lib/simSearch.js';
import { useBatch } from '../copilot/ocr/ingest/useBatch.js';
import { Upload } from 'lucide-react';
```

Add state and the batch hook inside the component body (near the other `useState` calls):

```jsx
  const [showImportDialog, setShowImportDialog] = useState(false);
  const { runBatch } = useBatch({ apiBaseUrl, token });
```

Add the toolbar button in the default (non-selection) toolbar block, next to
`RefreshButton` (per `ListView.jsx:784-789` as of this writing — insert immediately
after it):

```jsx
                {importConfig?.enabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-muted-foreground font-normal h-9 px-3 rounded-lg bg-white"
                    onClick={() => setShowImportDialog(true)}
                    data-testid="ListView__importButton"
                  >
                    <Upload className="h-3.5 w-3.5" data-testid="Upload__ListViewImport" />
                  </Button>
                )}
```

Mount the dialog once, near the end of the component's returned JSX (alongside the other
conditionally-rendered modals such as `showReport`/`showDocPrint` — read the file to find
that block and match its placement pattern):

```jsx
      {importConfig?.enabled && showImportDialog && (
        <ImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          config={importConfig}
          token={token}
          postBatch={runBatch}
          simSearchFn={simSearch}
          onImported={() => {
            setShowImportDialog(false);
            hook.refresh();
          }}
        />
      )}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/contract-ui/__tests__/ListView.import.test.jsx`
Expected: PASS, all 3 cases.

- [ ] **Step 5: Run the full `ListView` test suite (existing + new) to confirm no regression**

Run: `npx vitest run src/components/contract-ui/__tests__/ListView*`
Expected: PASS — every pre-existing `ListView` test file still passes; the new `import`
prop is `null`-default so no existing caller/test is affected.

- [ ] **Step 6: Commit**

```bash
git add tools/app-shell/src/components/contract-ui/ListView.jsx \
        tools/app-shell/src/components/contract-ui/__tests__/ListView.import.test.jsx
git commit -m "Feature ETP-4447: Add import toolbar button and ImportDialog wiring to ListView"
```

---

### Task 6: Register `country`/`region` FK resolvers (Contacts-specific matching logic)

**Repo:** `/Users/sebastianbarrozo/Documents/work/epic/schema-forge`

**Files:**
- Create: `tools/app-shell/src/windows/custom/contacts/contactsFkResolvers.js`
- Create: `tools/app-shell/src/windows/custom/contacts/__tests__/contactsFkResolvers.test.js`

**Interfaces:**
- Consumes: `registerFkResolver` from `@etendosoftware/app-shell-core/lib/import/fkResolvers.js`
  (Task 1), `simSearch` from `@etendosoftware/app-shell-core/lib/simSearch.js`.
- Produces: two registered resolvers, `'contacts-country'` and `'contacts-region'`
  (namespaced, not just `'country'`/`'region'`, since the registry is a single global
  map shared across every window that might ever need custom FK resolution — a generic
  `'country'` name would collide the moment a second window needs country resolution
  with different matching rules).
  - `contacts-country`: `(value, { token }) => Promise<ClassifyResult>` — resolves free
    text against the `Country` DAL entity (verified `classname` — see the table in this
    plan's header) via `simSearch`, `qtyResults: 5`, same
    threshold/gap classification logic as `classifyCandidates`
    (`packages/app-shell-core/src/lib/import/resolveForeignKeys.js`) — reused directly,
    not reimplemented.
  - `contacts-region`: `(value, { token, countryId }) => Promise<ClassifyResult>` —
    same mechanism, but **only matches candidates whose resolved country matches
    `countryId`** (verified `C_Region` has a `c_country_id` column; `simSearch`'s webhook
    doesn't support server-side scoping by a second column, so this resolver calls
    `simSearch` unscoped and filters the returned `candidates` client-side by re-fetching
    each candidate's country — see the implementation below for exactly how, rather than
    hand-waving a "scoped lookup" that doesn't exist as a single API call).

- [ ] **Step 1: Write the failing test**

Create `tools/app-shell/src/windows/custom/contacts/__tests__/contactsFkResolvers.test.js`:

```js
import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';
import { getFkResolver } from '@etendosoftware/app-shell-core/lib/import/fkResolvers.js';
import '../contactsFkResolvers.js'; // side-effecting import: registers on load

describe('contacts-country resolver', () => {
  it('auto-resolves a single high-confidence country match', async () => {
    const resolver = getFkResolver('contacts-country');
    const simSearchFn = async () => [{ id: 'C-AR', name: 'Argentina', similarityPercent: '95', candidates: [{ id: 'C-AR', name: 'Argentina', similarityPercent: '95' }] }];
    const result = await resolver('Argentina', { token: 't', simSearchFn });
    assert.equal(result.status, 'auto-resolved');
    assert.equal(result.id, 'C-AR');
  });

  it('needs review when there is no confident match', async () => {
    const resolver = getFkResolver('contacts-country');
    const simSearchFn = async () => [null];
    const result = await resolver('Nowhereland', { token: 't', simSearchFn });
    assert.equal(result.status, 'needs-review');
  });
});

describe('contacts-region resolver', () => {
  it('auto-resolves a region candidate whose country matches the given countryId', async () => {
    const resolver = getFkResolver('contacts-region');
    const simSearchFn = async () => [{
      id: 'R-1', name: 'Córdoba', similarityPercent: '95',
      candidates: [{ id: 'R-1', name: 'Córdoba', similarityPercent: '95' }],
    }];
    const fetchRegionCountryId = async (regionId) => (regionId === 'R-1' ? 'C-AR' : 'C-ES');
    const result = await resolver('Córdoba', { token: 't', countryId: 'C-AR', simSearchFn, fetchRegionCountryId });
    assert.equal(result.status, 'auto-resolved');
    assert.equal(result.id, 'R-1');
  });

  it('needs review when every candidate belongs to a different country', async () => {
    const resolver = getFkResolver('contacts-region');
    const simSearchFn = async () => [{
      id: 'R-2', name: 'Córdoba', similarityPercent: '95',
      candidates: [{ id: 'R-2', name: 'Córdoba', similarityPercent: '95' }],
    }];
    const fetchRegionCountryId = async () => 'C-ES';
    const result = await resolver('Córdoba', { token: 't', countryId: 'C-AR', simSearchFn, fetchRegionCountryId });
    assert.equal(result.status, 'needs-review');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `tools/app-shell`): `npx vitest run src/windows/custom/contacts/__tests__/contactsFkResolvers.test.js`
Expected: FAIL — `../contactsFkResolvers.js` doesn't exist.

- [ ] **Step 3: Create `tools/app-shell/src/windows/custom/contacts/contactsFkResolvers.js`**

```js
import { registerFkResolver } from '@etendosoftware/app-shell-core/lib/import/fkResolvers.js';
import { simSearch } from '@etendosoftware/app-shell-core/lib/simSearch.js';
import { classifyCandidates } from '@etendosoftware/app-shell-core/lib/import/resolveForeignKeys.js';

registerFkResolver('contacts-country', async (value, { token, simSearchFn = simSearch }) => {
  const [result] = await simSearchFn({ token, entityName: 'Country', items: [value], qtyResults: 5 });
  return classifyCandidates(result?.candidates ?? []);
});

/**
 * Region names collide across countries (e.g. "Córdoba" exists in both Argentina and
 * Spain), so a plain distinct-value simSearch isn't enough — verified against the
 * schema: `simSearch`'s webhook has no way to scope the query by a second column, and
 * `C_Region` rows carry their own `c_country_id`. This resolver runs the free-text
 * search unscoped, then keeps only the candidates whose own country matches the row's
 * already-resolved country before classifying — `fetchRegionCountryId` is injected so
 * tests never need a real NEO fetch.
 */
registerFkResolver('contacts-region', async (value, { token, countryId, simSearchFn = simSearch, fetchRegionCountryId }) => {
  const [result] = await simSearchFn({ token, entityName: 'Region', items: [value], qtyResults: 10 });
  const candidates = result?.candidates ?? [];
  const scoped = [];
  for (const candidate of candidates) {
    const candidateCountryId = await fetchRegionCountryId(candidate.id, token);
    if (candidateCountryId === countryId) scoped.push(candidate);
  }
  return classifyCandidates(scoped);
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/windows/custom/contacts/__tests__/contactsFkResolvers.test.js`
Expected: PASS, all 4 cases.

- [ ] **Step 5: Implement the real `fetchRegionCountryId` (not the test's injected stub)**

The production default for `fetchRegionCountryId` (used when the descriptor in Task 7
calls this resolver without overriding it) queries the `Region` entity's `c_country_id`
via the existing NEO selector pattern already used elsewhere in this codebase — follow
`purchaseInvoiceDescriptor.js`'s `findBpLocation` function (in
`tools/app-shell/src/components/copilot/ocr/ingest/purchaseInvoiceDescriptor.js`) as the
exact precedent for "fetch one field of one record by id via a NEO GET", adapted to the
`Region` entity's `country` field instead of a business partner's location. Add this as
the actual default in `contactsFkResolvers.js`'s `contacts-region` resolver (replacing
the bare injected-only version from Step 3) and add one more test case confirming the
real default is used when `fetchRegionCountryId` is omitted, with `fetch` itself mocked
via `vi.stubGlobal('fetch', ...)` (this repo's existing convention for testing fetch
calls — confirm by grepping other `__tests__` files under `ingest/` for the exact stub
pattern before writing it).

- [ ] **Step 6: Commit**

```bash
git add tools/app-shell/src/windows/custom/contacts/contactsFkResolvers.js \
        tools/app-shell/src/windows/custom/contacts/__tests__/contactsFkResolvers.test.js
git commit -m "Feature ETP-4447: Register country/region FK resolvers for Contacts import"
```

---

### Task 7: Contacts composite import descriptor

**Repo:** `/Users/sebastianbarrozo/Documents/work/epic/schema-forge`

**Files:**
- Create: `tools/app-shell/src/windows/custom/contacts/contactsImportDescriptor.js`
- Create: `tools/app-shell/src/windows/custom/contacts/__tests__/contactsImportDescriptor.test.js`

**Interfaces:**
- Consumes: `registerImportDescriptor` from
  `@etendosoftware/app-shell-core/lib/import/buildOperations.js`, `getFkResolver` from
  Task 6.
- Produces: a descriptor registered under `'contacts'` (the name
  `artifacts/contacts/decisions.json`'s `import.descriptor` will reference in Task 8),
  building `[businessPartner, location, contact]` operations for one CSV row —
  `businessPartner` is a plain `create`; `location` is `createInline` (per this plan's
  header — `C_Location` has no matchable text column) with `parentRef` linking it to the
  business partner via the existing `$ref:`/`parentRef` mechanism `BatchService.java`
  already provides (no new backend behavior); `contact` likewise `parentRef`s to the
  business partner.

**Scope note, matching the user's chosen "full address" option:** the CSV is expected to
carry `address`, `city`, `postal`, `country`, `region` columns (`country`/`region` free
text, resolved via Task 6's resolvers) alongside the already-covered `name`,
`etgoEmail`, `etgoFirstname`, `etgoLastname`, `etgoPhone` business-partner fields — the
exact alias list for each lives in Task 8's `decisions.json`, not here; this descriptor
only knows field **names** (the already-resolved `target` keys on the row), never raw
CSV header text.

- [ ] **Step 1: Write the failing test**

Create `tools/app-shell/src/windows/custom/contacts/__tests__/contactsImportDescriptor.test.js`:

```js
import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';
import { buildOperations } from '@etendosoftware/app-shell-core/lib/import/buildOperations.js';
import '../contactsImportDescriptor.js';

const baseRow = {
  name: 'Acme Corp', etgoFirstname: 'Lucia', etgoLastname: 'Fernandez', etgoEmail: 'lucia@x.com',
  address: 'Av. Siempreviva 742', city: 'Springfield', postal: '1000',
  country: 'Argentina', region: 'Córdoba',
};

describe('contacts import descriptor', () => {
  it('builds businessPartner, location, and contact ops with location parentRef to the businessPartner', async () => {
    const resolveCountry = vi.fn().mockResolvedValue({ status: 'auto-resolved', id: 'C-AR', name: 'Argentina' });
    const resolveRegion = vi.fn().mockResolvedValue({ status: 'auto-resolved', id: 'R-1', name: 'Córdoba' });
    const ops = await buildOperations(baseRow, {
      spec: 'contacts', descriptorName: 'contacts', token: 't',
      resolveCountryFn: resolveCountry, resolveRegionFn: resolveRegion,
    });
    assert.equal(ops.length, 3);
    const [bp, location, contact] = ops;
    assert.equal(bp.entity, 'businessPartner');
    assert.equal(bp.body.name, 'Acme Corp');
    assert.equal(location.entity, 'locationAddress');
    assert.equal(location.parentRef, bp.id);
    assert.equal(location.body.country, 'C-AR');
    assert.equal(location.body.region, 'R-1');
    assert.equal(contact.entity, 'contact');
    assert.equal(contact.parentRef, bp.id);
  });

  it('omits the location op entirely when no address fields are present on the row', async () => {
    const row = { name: 'Acme Corp', etgoFirstname: 'Lucia', etgoLastname: 'Fernandez', etgoEmail: 'lucia@x.com' };
    const ops = await buildOperations(row, { spec: 'contacts', descriptorName: 'contacts', token: 't' });
    assert.equal(ops.find((op) => op.entity === 'locationAddress'), undefined);
  });

  it('surfaces an unresolved country as a thrown, catchable error the caller can turn into a row-level failure', async () => {
    const resolveCountry = vi.fn().mockResolvedValue({ status: 'needs-review', candidates: [] });
    await assert.rejects(
      () => buildOperations(baseRow, { spec: 'contacts', descriptorName: 'contacts', token: 't', resolveCountryFn: resolveCountry }),
      /country .* could not be resolved/i,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/windows/custom/contacts/__tests__/contactsImportDescriptor.test.js`
Expected: FAIL — `../contactsImportDescriptor.js` doesn't exist.

- [ ] **Step 3: Create `tools/app-shell/src/windows/custom/contacts/contactsImportDescriptor.js`**

```js
import { registerImportDescriptor } from '@etendosoftware/app-shell-core/lib/import/buildOperations.js';
import { getFkResolver } from '@etendosoftware/app-shell-core/lib/import/fkResolvers.js';

const BP_TARGETS = ['name', 'etgoFirstname', 'etgoLastname', 'etgoEmail', 'etgoPhone', 'oBTIKTaxIDKey', 'creditLimit', 'taxID'];
const CONTACT_TARGETS = ['firstName', 'lastName', 'email', 'phone', 'position'];
const HAS_ADDRESS = (row) => Boolean(row.address || row.city || row.postal || row.country);

function pick(row, targets) {
  const body = {};
  for (const t of targets) if (row[t] !== undefined) body[t] = row[t];
  return body;
}

registerImportDescriptor('contacts', async (row, config) => {
  const bpOp = { id: 'bp', spec: config.spec, entity: 'businessPartner', body: pick(row, BP_TARGETS) };
  const ops = [bpOp];

  if (HAS_ADDRESS(row)) {
    const resolveCountry = config.resolveCountryFn || getFkResolver('contacts-country');
    const countryResult = await resolveCountry(row.country, { token: config.token });
    if (countryResult.status !== 'auto-resolved') {
      throw new Error(`Row's country "${row.country}" could not be resolved to an existing record.`);
    }
    let regionId;
    if (row.region) {
      const resolveRegion = config.resolveRegionFn || getFkResolver('contacts-region');
      const regionResult = await resolveRegion(row.region, { token: config.token, countryId: countryResult.id });
      if (regionResult.status === 'auto-resolved') regionId = regionResult.id;
      // An unresolved region is not fatal — country alone satisfies C_Location's only
      // NOT NULL geography column (verified: c_region_id is nullable) — the row still
      // imports, just without a region on its location.
    }
    ops.push({
      id: 'location',
      spec: config.spec,
      entity: 'locationAddress',
      parentRef: 'bp',
      body: { address1: row.address, city: row.city, postal: row.postal, country: countryResult.id, ...(regionId ? { region: regionId } : {}) },
    });
  }

  ops.push({ id: 'contact', spec: config.spec, entity: 'contact', parentRef: 'bp', body: pick(row, CONTACT_TARGETS) });
  return ops;
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/windows/custom/contacts/__tests__/contactsImportDescriptor.test.js`
Expected: PASS, all 3 cases.

- [ ] **Step 5: Commit**

```bash
git add tools/app-shell/src/windows/custom/contacts/contactsImportDescriptor.js \
        tools/app-shell/src/windows/custom/contacts/__tests__/contactsImportDescriptor.test.js
git commit -m "Feature ETP-4447: Add Contacts composite import descriptor"
```

---

### Task 8: `decisions.json` for Contacts and Product, regenerate, verify

**Repo:** `/Users/sebastianbarrozo/Documents/work/epic/schema-forge`

**Files:**
- Modify: `artifacts/contacts/decisions.json`
- Modify: `artifacts/product/decisions.json`

**Interfaces:**
- Produces: the `window.import` block each window's `contract.json` will carry once
  regenerated (Task 3/4's generator changes read this).

- [ ] **Step 1: Add the `import` block to `artifacts/contacts/decisions.json`**

Add under the top-level `window` key (read the file first to place it correctly among
existing keys — do not reorder unrelated keys):

```jsonc
"import": {
  "enabled": true,
  "spec": "contacts",
  "entity": "businessPartner",
  "formats": ["csv", "txt"],
  "limit": { "maxRows": 5000, "concurrency": 4 },
  "dedupe": { "scope": "file", "key": ["etgoEmail"] },
  "descriptor": "contacts",
  "fields": [
    { "target": "name", "aliases": ["nombre comercial", "razon social"] },
    { "target": "etgoFirstname", "aliases": ["nombre"] },
    { "target": "etgoLastname", "aliases": ["apellido", "apellidos"] },
    { "target": "etgoEmail", "aliases": ["email", "correo", "e-mail"] },
    { "target": "etgoPhone", "aliases": ["telefono", "teléfono"] },
    { "target": "email", "aliases": ["email de contacto"] },
    { "target": "firstName", "aliases": ["nombre de contacto"] },
    { "target": "lastName", "aliases": ["apellido de contacto"] },
    { "target": "phone", "aliases": ["telefono de contacto"] },
    { "target": "position", "aliases": ["cargo"] },
    { "target": "address", "aliases": ["direccion", "dirección"] },
    { "target": "city", "aliases": ["ciudad"] },
    { "target": "postal", "aliases": ["codigo postal", "código postal", "cp"] },
    { "target": "country", "aliases": ["pais", "país"] },
    { "target": "region", "aliases": ["provincia", "region", "región"] }
  ]
}
```

Note: `address`/`city`/`postal`/`country`/`region` are **not** contract fields on any
entity in `artifacts/contacts/contract.json` (they're `C_Location` columns, and
`C_Location` has no corresponding contract entity in this window today — confirmed by
listing this window's entities earlier in this plan's research). Task 3's
`generate-contract.js` enrichment step (`generateFrontendContract`) will **throw** on
these targets exactly as designed ("fails loudly on an unknown target") — this is
intentional and surfaces a real gap this plan does not silently paper over: either (a) a
follow-up adds a synthetic/virtual field descriptor for these five targets so the
enrichment lookup succeeds without a real backing contract field, or (b) `generate-
contract.js`'s enrichment is relaxed to tolerate `import`-only targets that don't
correspond to any generated entity field (since they're consumed entirely by the
composite descriptor, never by the generic `buildDefaultOperations` path that needs
real field metadata). **Resolve this explicitly before running Step 3** — do not silently
drop the address fields from `decisions.json` to make the generator stop throwing; that
would ship Task 6/7's country/region work with no way to ever populate it from a real
CSV. Recommended resolution: extend Task 3's enrichment to accept an explicit
`{ target, label, required: false, type: 'string' }` inline in `decisions.json` for
fields with no contract backing (i.e., `import.fields[]` entries may supply their own
`label`/`type`/`required` directly instead of requiring a contract match), and treat that
as satisfying the lookup instead of throwing. This is a small addendum to Task 3, not a
new task — apply it there before starting this task's `decisions.json` edit.

- [ ] **Step 2: Add the `import` block to `artifacts/product/decisions.json`**

```jsonc
"import": {
  "enabled": true,
  "spec": "product",
  "entity": "product",
  "formats": ["csv", "txt"],
  "limit": { "maxRows": 5000, "concurrency": 4 },
  "dedupe": { "scope": "file", "key": ["searchKey"] },
  "fields": [
    { "target": "searchKey", "aliases": ["codigo", "código", "sku"] },
    { "target": "name", "aliases": ["nombre"] },
    { "target": "description", "aliases": ["descripcion", "descripción"] },
    { "target": "uOM", "aliases": ["unidad de medida", "uom"], "matchEntity": "UOM" },
    { "target": "productCategory", "aliases": ["categoria", "categoría"], "matchEntity": "ProductCategory" },
    { "target": "taxCategory", "aliases": ["categoria impositiva", "categoría impositiva", "impuesto"], "matchEntity": "TaxCategory" }
  ]
}
```

`matchEntity` is explicit here even though it equals `reference` for all three fields
(verified in this plan's header table) — being explicit costs nothing and removes any
future doubt about whether the default was intentional or accidental.

- [ ] **Step 3: Regenerate both windows**

Run: `make regen ONLY=contacts,product` (from `etendo_schema_forge`'s repo root).

- [ ] **Step 4: Verify contract integrity (mandatory per root `CLAUDE.md`)**

For each window, run the contract-integrity check from `CLAUDE.md`'s "Window Change
Integrity Protocol" (adapt the field list to check `window.import` is present and
`fields` non-empty, in addition to the existing draftMode/readOnly checks already in that
script):

```bash
python3 -c "
import json
for name in ['contacts', 'product']:
    d = json.load(open(f'artifacts/{name}/contract.json'))
    imp = d['frontendContract']['window'].get('import')
    print(name, '— import.enabled:', imp and imp.get('enabled'), '| fields:', len(imp.get('fields', [])) if imp else 0)
"
```

Expected output: both windows print `import.enabled: True` with a non-zero field count.

- [ ] **Step 5: Verify the generated import path**

```bash
grep -n "import { ImportDialog }\|import.*app-shell-core/components/import" artifacts/contacts/generated/web/contacts/HeaderPage.jsx artifacts/product/generated/web/product/HeaderPage.jsx 2>/dev/null
```

If `ListView` itself imports `ImportDialog` (per Task 5, not the generated file), this
grep is expected to find nothing in `HeaderPage.jsx` — confirm instead that
`window.import` shows up as a literal prop value in the generated `<ListView ...
import={...} .../>` call:

```bash
grep -n "import={" artifacts/contacts/generated/web/contacts/HeaderPage.jsx artifacts/product/generated/web/product/HeaderPage.jsx
```

- [ ] **Step 6: `push-to-neo` reminder**

Per `CLAUDE.md`: after `make regen` (which does not push by default), remind that a real
deployment needs `make regen ONLY=contacts,product PUSH_TO_NEO=1` followed by
`./gradlew export.database` in the Etendo root — **do not run this as part of the plan**
unless the user explicitly asks to push to a live NEO instance; this task's job is
correctness of the generated artifacts, not deployment.

- [ ] **Step 7: Commit**

```bash
git add artifacts/contacts/decisions.json artifacts/contacts/contract.json artifacts/contacts/generated \
        artifacts/product/decisions.json artifacts/product/contract.json artifacts/product/generated
git commit -m "Feature ETP-4447: Enable CSV import for Contacts and Product windows"
```

---

## Self-Review

**Spec coverage:** Every architectural piece the design spec assigned to "the follow-up
wiring plan" is covered: `ListView.jsx` toolbar + dialog mount (Task 5), generator wiring
in both directions (Tasks 3–4), and the two windows' real configuration (Task 8). The
`matchEntity` override mechanism from the spec is exercised for real (Product's fields,
even though they happen to equal `reference`) and justified with a genuine counter-
example (`businessPartnerCategory` → `Category`) rather than a hypothetical one. The
`createInline` vs `match` FK-resolution split from the spec is implemented concretely for
Contacts' location (Tasks 6–7), including the region-scoped-by-country nuance the spec
flagged as an "accepted v1 limitation" for collapse-by-raw-text — this plan actually
avoids that limitation for country/region specifically, by scoping region to a resolved
country instead of matching text globally.

**A gap found and resolved during this plan's own self-review, not left implicit:**
`address`/`city`/`postal`/`country`/`region` have no backing contract field in Contacts'
`contract.json` (they're `C_Location` columns, and `C_Location` isn't a contract entity in
this window). Task 3's enrichment step as originally scoped would throw on these targets.
Task 8 calls this out explicitly and requires Task 3 to be extended (before Task 8's
`decisions.json` edit) to accept inline `label`/`type`/`required` metadata for
`import.fields[]` entries that have no real contract field to look up — rather than
silently dropping the address columns from the decisions file to avoid the crash, which
would have shipped Tasks 6–7's country/region resolvers with no way to ever be invoked
from a real import.

**Placeholder scan:** none in the executable code. Task 6's Step 5 intentionally defers
the *production* `fetchRegionCountryId` implementation detail (which exact NEO
selector call) to "follow this codebase's own precedent" rather than inventing an
unverified endpoint shape — this is a pointer to a real, existing pattern
(`findBpLocation` in `purchaseInvoiceDescriptor.js`), not a placeholder.

**Type consistency:** `ClassifyResult` (`{status:'auto-resolved',id,name}` or
`{status:'needs-review',candidates}`) is the *only* shape ever returned across three
independent code paths — the engine plan's `classifyCandidates`, and both new
`contacts-country`/`contacts-region` resolvers (which explicitly reuse
`classifyCandidates` rather than reimplementing the threshold logic) — so
`contactsImportDescriptor.js`'s `if (countryResult.status !== 'auto-resolved')` check
works identically regardless of which resolution path produced the result.
`registerImportDescriptor`'s function signature (`(row, config) => operations[]`,
established in the engine plan) is honored unchanged by the Contacts descriptor;
`config.token`/`config.resolveCountryFn`/`config.resolveRegionFn` are additive fields on
the same `config` object `buildOperations` already threads through, not a parallel
parameter.

**Known follow-up, explicitly not silently assumed complete:** publishing
`@etendosoftware/app-shell-core` with the engine + UI plans' changes so `etendo_schema_forge`'s
*default* (non-`LOCAL_CORE`) profile actually resolves `ImportDialog`/`simSearch`/
`fkResolvers` is a release-engineering step outside this plan — Tasks 5–7 are written and
tested against `LOCAL_CORE=1` (`make dev-local-core`, per `docs/repo-topology.md`) during
development; someone must bump and publish the package before this reaches a normal
functional-only developer's environment or CI.
