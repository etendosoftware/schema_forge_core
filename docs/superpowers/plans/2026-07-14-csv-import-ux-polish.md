# CSV Import UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the eight UX/correctness fixes from `docs/superpowers/specs/2026-07-14-csv-import-ux-polish-design.md` for the CSV import dialog, entirely within `schema_forge_core` (no backend, no `etendo_schema_forge` changes).

**Architecture:** All changes live in `packages/app-shell-core/src/components/import/` (`ImportReviewQueue.jsx`, `ImportColumnMapping.jsx`, `ImportDialog.jsx`) plus their sibling `__tests__/*.test.jsx` files. No new dependencies — `Ban` icon is already in the installed `lucide-react` package; the compact-mapping modal reuses the existing `Dialog`/`Select` UI primitives already used elsewhere in this same directory.

**Tech Stack:** React (function components + hooks), Vitest + `@testing-library/react`, Tailwind utility classes, `lucide-react` icons, Radix UI primitives (`Select`, `Dialog`) via this package's `../ui/*` wrappers.

## Global Constraints

- Every visible-string default lives in each component's existing `DEFAULT_LABELS` object, overridable via the `labels` prop — follow this pattern exactly for any new string (per the existing convention in `ImportReviewQueue.jsx:12-30`). Do not hardcode new strings outside that object.
- No new npm dependencies. `Ban` (lucide-react) is already installed; confirm nothing else is added to `package.json`.
- Test runner for this package is Vitest: run tests with `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/<file>.test.jsx`.
- Every `data-testid` added must follow this directory's existing `ComponentName__purpose` or `ComponentName__purpose-${key}` convention.
- No backend changes. No changes to `resolveForeignKeys.js`, `validateRows.js`, `buildOperations.js`, or `importEngine.js` — this plan is UI-only.
- Do not touch `styles.css` (item 4 of the design needs no code change — see the design doc's §4).
- Commit after each task, following this repo's Etendo Git Police convention: `Feature ETP-4447: <short description>` (max 80 chars first line), no `Co-Authored-By`.

---

## Task 1: Skip icon — `SkipForward` → `Ban`

**Files:**
- Modify: `packages/app-shell-core/src/components/import/ImportReviewQueue.jsx:3` (import), `:469` (OK-row skip button), `:555` (error-row skip button)
- Test: `packages/app-shell-core/src/components/import/__tests__/ImportReviewQueue.test.jsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new (internal icon swap only, no prop/behavior change).

- [ ] **Step 1: Write the failing test**

Add to `ImportReviewQueue.test.jsx`, inside the existing `describe('ImportReviewQueue', ...)` block (after the existing skip test around line 141-146):

```jsx
it('uses the Ban icon (not SkipForward) for the skip action', () => {
  render(<ImportReviewQueue entries={[okEntry]} statusFilter="all" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
  expect(screen.getByTestId('Ban__a73779')).toBeDefined();
  expect(screen.queryByTestId('SkipForward__a73779')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportReviewQueue.test.jsx -t "Ban icon"`
Expected: FAIL — `Ban__a73779` not found (current code still renders `SkipForward__a73779`).

- [ ] **Step 3: Write minimal implementation**

In `ImportReviewQueue.jsx:3`, change:

```js
import { RotateCw, Copy, SkipForward, AlertCircle, ChevronDown, Pencil } from 'lucide-react';
```

to:

```js
import { RotateCw, Copy, Ban, AlertCircle, ChevronDown, Pencil } from 'lucide-react';
```

Then at line 469 (OK-row skip button), change:

```jsx
<SkipForward className="h-3 w-3" aria-hidden="true" data-testid="SkipForward__a73779" />
```

to:

```jsx
<Ban className="h-3 w-3" aria-hidden="true" data-testid="Ban__a73779" />
```

And the identical block at line 555 (error-row skip button) — same replacement.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportReviewQueue.test.jsx`
Expected: PASS — all tests in the file, including the new one.

- [ ] **Step 5: Commit**

```bash
cd /Users/sebastianbarrozo/Documents/work/epic/schema_forge_core
git add packages/app-shell-core/src/components/import/ImportReviewQueue.jsx packages/app-shell-core/src/components/import/__tests__/ImportReviewQueue.test.jsx
git commit -m "Feature ETP-4447: Use Ban icon for CSV import row skip action"
```

---

## Task 2: Status filter pill counts

**Files:**
- Modify: `packages/app-shell-core/src/components/import/ImportReviewQueue.jsx` (add a `counts` computation near `visibleEntries`, ~line 304-310; render a count badge inside each pill, ~lines 368-379)
- Test: `packages/app-shell-core/src/components/import/__tests__/ImportReviewQueue.test.jsx`

**Interfaces:**
- Consumes: `entries` (already a prop).
- Produces: nothing new for other components — this is a self-contained render addition inside `ImportReviewQueue`.

- [ ] **Step 1: Write the failing test**

Add to `ImportReviewQueue.test.jsx`, as a new top-level `describe` block (after the existing `describe('status filter', ...)` block):

```jsx
describe('status filter pill counts', () => {
  it('shows the count of each bucket next to its label', () => {
    const okEntry2 = { row: { name: 'Marta', email: 'marta@x.com' }, errors: [], status: 'pending' };
    const skipped = { row: { name: 'Old', email: 'old@x.com' }, errors: [], status: 'skipped' };
    render(
      <ImportReviewQueue
        entries={[okEntry, okEntry2, errorEntry, skipped]}
        statusFilter="all"
        onStatusFilterChange={() => {}}
        onEditField={() => {}}
        onRetryEntry={() => {}}
        onSkipEntry={() => {}}
        onDownloadErrors={() => {}}
      />,
    );
    expect(screen.getByTestId('ImportReviewQueue__statusFilterCount-all').textContent).toBe('4');
    expect(screen.getByTestId('ImportReviewQueue__statusFilterCount-ok').textContent).toBe('2');
    expect(screen.getByTestId('ImportReviewQueue__statusFilterCount-error').textContent).toBe('2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportReviewQueue.test.jsx -t "shows the count of each bucket"`
Expected: FAIL — `ImportReviewQueue__statusFilterCount-all` not found.

- [ ] **Step 3: Write minimal implementation**

In `ImportReviewQueue.jsx`, right after the `visibleEntries` computation (currently ending around line 310, before the `pendingBulkApply` state declaration), add:

```js
const counts = {
  all: entries.length,
  ok: entries.filter((e) => e.status !== 'skipped' && e.errors.length === 0).length,
  error: entries.filter((e) => e.status === 'skipped' || e.errors.length > 0).length,
};
```

Then update the pill render (currently lines 368-379):

```jsx
{STATUS_FILTERS.map((opt) => (
  <Button
    key={opt.value}
    type="button"
    size="sm"
    variant={statusFilter === opt.value ? 'default' : 'ghost'}
    onClick={() => onStatusFilterChange(opt.value)}
    data-testid={`ImportReviewQueue__statusFilter-${opt.value}`}
  >
    {text[opt.labelKey]}
    <span
      className="ml-1.5 rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] tabular-nums"
      data-testid={`ImportReviewQueue__statusFilterCount-${opt.value}`}
    >
      {counts[opt.value]}
    </span>
  </Button>
))}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportReviewQueue.test.jsx`
Expected: PASS — all tests, including the existing status-filter tests (they only check button click behavior/variant, not textContent equality, so the added count badge does not break them — confirm by reading the diff of `describe('status filter', ...)` before running: none of those assertions use `.textContent`).

- [ ] **Step 5: Commit**

```bash
cd /Users/sebastianbarrozo/Documents/work/epic/schema_forge_core
git add packages/app-shell-core/src/components/import/ImportReviewQueue.jsx packages/app-shell-core/src/components/import/__tests__/ImportReviewQueue.test.jsx
git commit -m "Feature ETP-4447: Show row counts on CSV import status filter pills"
```

---

## Task 3: Off-screen field-error tooltip on the Status cell

**Files:**
- Modify: `packages/app-shell-core/src/components/import/ImportReviewQueue.jsx` (add `fieldErrorLabels`/`errorTooltip` near the existing `rowLevelError`/`rowColumns` computation at ~lines 505-506; add `title` to the `AlertCircle` icon at ~line 516-519; add `fieldErrorsTooltip` to `DEFAULT_LABELS`)
- Test: `packages/app-shell-core/src/components/import/__tests__/ImportReviewQueue.test.jsx`

**Interfaces:**
- Consumes: `entry.errors` (`{ target, message }[]`, already available), `dataColumns`/`fields` prop (already available) for field labels.
- Produces: nothing new for other components.

- [ ] **Step 1: Write the failing test**

Add to `ImportReviewQueue.test.jsx`, as a new top-level `describe` block:

```jsx
describe('off-screen field-error tooltip', () => {
  it('lists every field-level error by label in the Status cell tooltip', () => {
    const multiFieldError = {
      row: { name: 'Andres', email: 'not-an-email', country: 'Nowhereland' },
      errors: [
        { target: 'email', message: 'Not a valid email address.' },
        { target: 'country', message: 'Could not be matched to an existing record.' },
      ],
      status: 'pending',
    };
    render(
      <ImportReviewQueue
        entries={[multiFieldError]}
        fields={[
          { target: 'name', label: 'Name' },
          { target: 'email', label: 'Email' },
          { target: 'country', label: 'Country' },
        ]}
        statusFilter="error"
        onStatusFilterChange={() => {}}
        onEditField={() => {}}
        onRetryEntry={() => {}}
        onSkipEntry={() => {}}
        onDownloadErrors={() => {}}
      />,
    );
    expect(screen.getByTestId('AlertCircle__a73779').getAttribute('title'))
      .toBe('Errors in: Email, Country — scroll right to see them.');
  });

  it('shows no tooltip when the only error is row-level (blank target)', () => {
    const rowLevelEntry = {
      row: { name: 'Andres' },
      errors: [{ target: '', message: 'Operation rejected by server.' }],
      status: 'pending',
    };
    render(
      <ImportReviewQueue
        entries={[rowLevelEntry]}
        fields={[{ target: 'name', label: 'Name' }]}
        statusFilter="error"
        onStatusFilterChange={() => {}}
        onEditField={() => {}}
        onRetryEntry={() => {}}
        onSkipEntry={() => {}}
        onDownloadErrors={() => {}}
      />,
    );
    expect(screen.getByTestId('AlertCircle__a73779').getAttribute('title')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportReviewQueue.test.jsx -t "off-screen field-error tooltip"`
Expected: FAIL — `getAttribute('title')` returns `null` for the first test (no tooltip wired yet).

- [ ] **Step 3: Write minimal implementation**

In `ImportReviewQueue.jsx`, add a new key to `DEFAULT_LABELS` (near line 25, after `statusError`):

```js
  statusError: 'Error',
  fieldErrorsTooltip: 'Errors in: {fields} — scroll right to see them.',
```

Then, in the error-row branch, right after the existing:

```js
const rowLevelError = entry.errors.find((e) => !e.target);
const rowColumns = dataColumns ?? entry.errors.map((e) => ({ target: e.target, label: e.target }));
```

add:

```js
const fieldErrorLabels = entry.errors
  .filter((e) => e.target)
  .map((e) => rowColumns.find((f) => f.target === e.target)?.label ?? e.target);
const errorTooltip = fieldErrorLabels.length > 0
  ? formatTemplate(text.fieldErrorsTooltip, { fields: fieldErrorLabels.join(', ') })
  : undefined;
```

Then update the `AlertCircle` icon (currently lines 516-519) to carry the tooltip:

```jsx
<AlertCircle
  className="h-3.5 w-3.5"
  aria-hidden="true"
  title={errorTooltip}
  data-testid="AlertCircle__a73779" />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportReviewQueue.test.jsx`
Expected: PASS — all tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/sebastianbarrozo/Documents/work/epic/schema_forge_core
git add packages/app-shell-core/src/components/import/ImportReviewQueue.jsx packages/app-shell-core/src/components/import/__tests__/ImportReviewQueue.test.jsx
git commit -m "Feature ETP-4447: Add off-screen field-error tooltip to CSV import status cell"
```

---

## Task 4: Remove the pre-send "Re-validate" button

**Files:**
- Modify: `packages/app-shell-core/src/components/import/ImportReviewQueue.jsx` (add `showRetry` prop, guard both Retry-button renders at ~lines 449-459 and ~523-533)
- Modify: `packages/app-shell-core/src/components/import/ImportDialog.jsx` (pre-send `ImportReviewQueue` instance at ~lines 373-387: remove `onRetryEntry`/`retryLabel`, add `showRetry={false}`; delete the now-dead `handleRetryEntryPreSend` callback, ~lines 168-202, including its comment block)
- Test: `packages/app-shell-core/src/components/import/__tests__/ImportReviewQueue.test.jsx`, `packages/app-shell-core/src/components/import/__tests__/ImportDialog.test.jsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ImportReviewQueue` gains a `showRetry` prop (`boolean`, default `true`) — the post-send `ImportReviewQueue` instance in `ImportDialog.jsx` (RESULT step, ~lines 415-429) needs no change since it relies on the default.

- [ ] **Step 1: Write the failing test**

Add to `ImportReviewQueue.test.jsx`, as a new top-level `describe` block:

```jsx
describe('showRetry prop', () => {
  it('hides the Retry button on an OK row when showRetry is false', () => {
    render(<ImportReviewQueue entries={[okEntry]} showRetry={false} statusFilter="all" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.queryByTestId('ImportReviewQueue__retry-0')).toBeNull();
  });

  it('hides the Retry button on an error row when showRetry is false', () => {
    render(<ImportReviewQueue entries={[errorEntry]} showRetry={false} statusFilter="error" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.queryByTestId('ImportReviewQueue__retry-0')).toBeNull();
  });

  it('shows the Retry button by default (showRetry defaults to true)', () => {
    render(<ImportReviewQueue entries={[errorEntry]} statusFilter="error" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.getByTestId('ImportReviewQueue__retry-0')).toBeDefined();
  });
});
```

Add to `ImportDialog.test.jsx`, as a new test in the `describe('ImportDialog', ...)` block:

```jsx
it('does not show a Retry/Re-validate button in the pre-send mapping step', async () => {
  render(<ImportDialog open config={config} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
  await uploadFile('Name,Email\nLucia,not-an-email');
  await waitFor(() => screen.getByTestId('ImportReviewQueue__fieldError-0-email'));
  expect(screen.queryByTestId('ImportReviewQueue__retry-0')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportReviewQueue.test.jsx -t "showRetry prop"`
Expected: FAIL — the first two assertions fail (`ImportReviewQueue__retry-0` is still found because `showRetry` isn't implemented yet).

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportDialog.test.jsx -t "does not show a Retry"`
Expected: FAIL — `ImportReviewQueue__retry-0` is found (pre-send instance still renders "Re-validate").

- [ ] **Step 3: Write minimal implementation**

In `ImportReviewQueue.jsx`, add `showRetry = true` to the component's destructured props (currently lines 287-302):

```js
export function ImportReviewQueue({
  entries,
  fields = [],
  statusFilter = 'all',
  onStatusFilterChange,
  onEditField,
  onRetryEntry,
  onSkipEntry,
  onUnskipEntry,
  onApplyFkValue,
  onDownloadErrors,
  retryLabel = 'Retry',
  showRetry = true,
  labels,
  simSearchFn,
  token,
}) {
```

Wrap the OK-row Retry button (currently lines 449-459) in `showRetry &&`:

```jsx
{showRetry && (
  <Button
    type="button"
    size="icon"
    className="h-6 w-6"
    onClick={() => onRetryEntry(index)}
    data-testid={`ImportReviewQueue__retry-${index}`}
    title={retryLabel}
  >
    <RotateCw className="h-3 w-3" aria-hidden="true" data-testid="RotateCw__a73779" />
    <span className="sr-only">{retryLabel}</span>
  </Button>
)}
```

Wrap the error-row Retry button (currently lines 523-533) the same way:

```jsx
{showRetry && (
  <Button
    type="button"
    size="icon"
    className="h-6 w-6"
    onClick={() => onRetryEntry(index)}
    data-testid={`ImportReviewQueue__retry-${index}`}
    title={retryLabel}
  >
    <RotateCw className="h-3 w-3" aria-hidden="true" data-testid="RotateCw__a73779" />
    <span className="sr-only">{retryLabel}</span>
  </Button>
)}
```

In `ImportDialog.jsx`, update the pre-send `ImportReviewQueue` instance (currently lines 373-387) — remove `onRetryEntry={handleRetryEntryPreSend}` and `retryLabel="Re-validate"`, add `showRetry={false}`:

```jsx
<ImportReviewQueue
  entries={entries}
  fields={config.fields}
  statusFilter={statusFilterPreSend}
  onStatusFilterChange={setStatusFilterPreSend}
  onEditField={handleEditField}
  showRetry={false}
  onSkipEntry={handleSkipEntry}
  onUnskipEntry={handleUnskipEntry}
  onApplyFkValue={handleApplyFkValue}
  onDownloadErrors={() => downloadCsv(buildErrorsCsv(entries), 'import-errors.csv')}
  simSearchFn={simSearchFn}
  token={token}
  data-testid="ImportReviewQueue__38a6c3" />
```

Delete the entire `handleRetryEntryPreSend` callback (currently lines 168-202, including its leading comment block) from `ImportDialog.jsx` — it has no remaining caller.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportReviewQueue.test.jsx src/components/import/__tests__/ImportDialog.test.jsx`
Expected: PASS — all tests in both files. In particular, confirm the existing post-send Retry tests (`ImportDialog.test.jsx` lines ~185-216, "shows a failed row in the result review queue with Retry re-invoking postBatch") still pass — they exercise the RESULT step's `ImportReviewQueue` instance, which is untouched and keeps `showRetry`'s default of `true`.

- [ ] **Step 5: Commit**

```bash
cd /Users/sebastianbarrozo/Documents/work/epic/schema_forge_core
git add packages/app-shell-core/src/components/import/ImportReviewQueue.jsx packages/app-shell-core/src/components/import/ImportDialog.jsx packages/app-shell-core/src/components/import/__tests__/ImportReviewQueue.test.jsx packages/app-shell-core/src/components/import/__tests__/ImportDialog.test.jsx
git commit -m "Feature ETP-4447: Remove pre-send Re-validate button from CSV import"
```

---

## Task 5: Compact column-mapping summary + edit modal

**Files:**
- Modify: `packages/app-shell-core/src/components/import/ImportColumnMapping.jsx` (full rewrite — compact chip summary + "Editar match" button + edit modal; fixes the double-chevron bug by not carrying over the manual `ChevronDown` into the modal's grid)
- Modify: `packages/app-shell-core/src/components/import/ImportDialog.jsx` (rename+resignature `handleMappingChange` to accept a full mapping object; update the `ImportColumnMapping` usage in the MAPPING step, ~lines 367-372, to pass `onApplyMapping` instead of `onMappingChange`)
- Modify: `packages/app-shell-core/src/components/import/__tests__/ImportDialog.test.jsx` (the shared `uploadFile` helper, ~lines 24-29, waits on a testid that no longer exists after this task — update it)
- Test: `packages/app-shell-core/src/components/import/__tests__/ImportColumnMapping.test.jsx` (full rewrite)

**Interfaces:**
- Consumes: same `headers`/`importFields`/`mapping`/`labels` props as before.
- Produces: `ImportColumnMapping` now takes `onApplyMapping(newMapping)` instead of `onMappingChange(header, target)` — called exactly once, with the complete new `{ [header]: target }` mapping object, when the user confirms the edit modal (never per-keystroke). This is the prop Task 6 wires up to trigger revalidation.

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `ImportColumnMapping.test.jsx` with:

```jsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ImportColumnMapping } from '../ImportColumnMapping.jsx';

// Radix Select needs these polyfilled in jsdom to open/select — same idiom as the
// ResizeObserver/scrollIntoView polyfills already used for the FK-mismatch popover
// (cmdk) in ImportReviewQueue.test.jsx.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

afterEach(() => {
  cleanup();
});

const importFields = [
  { target: 'name', label: 'Name' },
  { target: 'email', label: 'Email' },
];

describe('ImportColumnMapping', () => {
  it('renders a compact chip per header showing "header → target label"', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Correo']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Correo: 'email' }}
        onApplyMapping={() => {}}
      />,
    );
    expect(screen.getByTestId('ImportColumnMapping__chip-Nombre').textContent).toContain('Name');
    expect(screen.getByTestId('ImportColumnMapping__chip-Correo').textContent).toContain('Email');
  });

  it('shows "Not imported" in the chip for an unmapped header', () => {
    render(
      <ImportColumnMapping
        headers={['Telefono']}
        importFields={importFields}
        mapping={{ Telefono: null }}
        onApplyMapping={() => {}}
      />,
    );
    expect(screen.getByTestId('ImportColumnMapping__chip-Telefono').textContent).toContain('Not imported');
  });

  it('shows the mapped/total summary count', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Correo', 'Telefono']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Correo: 'email', Telefono: null }}
        onApplyMapping={() => {}}
      />,
    );
    expect(screen.getByTestId('ImportColumnMapping__summaryCount').textContent).toContain('2/3');
  });

  it('shows a warning icon when not every header is mapped', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Telefono']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Telefono: null }}
        onApplyMapping={() => {}}
      />,
    );
    expect(screen.getByTestId('ImportColumnMapping__summaryWarning')).toBeDefined();
  });

  it('does not show a warning icon when every header is mapped', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre']}
        importFields={importFields}
        mapping={{ Nombre: 'name' }}
        onApplyMapping={() => {}}
      />,
    );
    expect(screen.queryByTestId('ImportColumnMapping__summaryWarning')).toBeNull();
  });

  it('opens the edit modal showing one select per header, pre-filled with the current mapping', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre']}
        importFields={importFields}
        mapping={{ Nombre: 'name' }}
        onApplyMapping={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    expect(screen.getByTestId('ImportColumnMapping__select-Nombre').textContent).toContain('Name');
  });

  it('renders exactly one chevron icon per select trigger inside the edit modal (regression: no double chevron)', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre']}
        importFields={importFields}
        mapping={{ Nombre: 'name' }}
        onApplyMapping={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    const trigger = screen.getByTestId('ImportColumnMapping__select-Nombre');
    expect(trigger.querySelectorAll('svg').length).toBe(1);
  });

  it('does not call onApplyMapping when the modal is cancelled', () => {
    const onApplyMapping = vi.fn();
    render(
      <ImportColumnMapping
        headers={['Nombre']}
        importFields={importFields}
        mapping={{ Nombre: 'name' }}
        onApplyMapping={onApplyMapping}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    fireEvent.click(screen.getByTestId('ImportColumnMapping__cancelButton'));
    expect(onApplyMapping).not.toHaveBeenCalled();
  });

  it('calls onApplyMapping with the unchanged mapping when Save is clicked without edits', () => {
    const onApplyMapping = vi.fn();
    render(
      <ImportColumnMapping
        headers={['Nombre']}
        importFields={importFields}
        mapping={{ Nombre: 'name' }}
        onApplyMapping={onApplyMapping}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    fireEvent.click(screen.getByTestId('ImportColumnMapping__saveButton'));
    expect(onApplyMapping).toHaveBeenCalledWith({ Nombre: 'name' });
  });

  it('calls onApplyMapping with the updated mapping after changing a select and clicking Save', () => {
    const onApplyMapping = vi.fn();
    render(
      <ImportColumnMapping
        headers={['Nombre']}
        importFields={importFields}
        mapping={{ Nombre: 'name' }}
        onApplyMapping={onApplyMapping}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    fireEvent.click(screen.getByTestId('ImportColumnMapping__select-Nombre'));
    fireEvent.click(screen.getByText('Email'));
    fireEvent.click(screen.getByTestId('ImportColumnMapping__saveButton'));
    expect(onApplyMapping).toHaveBeenCalledWith({ Nombre: 'email' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportColumnMapping.test.jsx`
Expected: FAIL — every test fails (`ImportColumnMapping__chip-*`, `__summaryCount`, `__editButton`, etc. don't exist in the current flat-grid implementation).

- [ ] **Step 3: Write minimal implementation**

Replace the entire contents of `ImportColumnMapping.jsx`:

```jsx
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog.jsx';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select.jsx';

const DEFAULT_LABELS = {
  notImported: 'Not imported',
  mappedSummary: '{mapped}/{total} columns mapped',
  editMatch: 'Edit match',
  editTitle: 'Edit column match',
  save: 'Save',
  cancel: 'Cancel',
};
const UNMAPPED_VALUE = '__unmapped__';

function formatTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

function targetLabel(importFields, target) {
  if (!target) return null;
  return importFields.find((f) => f.target === target)?.label ?? target;
}

/**
 * The full editable grid — one label+select pair per detected CSV header.
 * Only ever mounted inside the edit modal, operating on draft state owned by
 * the parent; nothing here touches the dialog's real mapping until Save.
 */
function MappingGrid({ headers, importFields, mapping, onMappingChange, text }) {
  return (
    <div className="flex flex-wrap gap-2 py-2">
      {headers.map((header) => {
        const target = mapping[header];
        return (
          <div key={header} className="flex flex-col gap-1 min-w-[140px]">
            <span className="text-xs font-medium text-muted-foreground" data-testid={`ImportColumnMapping__header-${header}`}>{header}</span>
            <Select
              value={target ?? UNMAPPED_VALUE}
              onValueChange={(value) => onMappingChange(header, value === UNMAPPED_VALUE ? null : value)}
              data-testid="Select__bf9e7b">
              <SelectTrigger data-testid={`ImportColumnMapping__select-${header}`} className="h-9">
                <SelectValue data-testid="SelectValue__bf9e7b" />
              </SelectTrigger>
              <SelectContent data-testid="SelectContent__bf9e7b">
                <SelectItem value={UNMAPPED_VALUE} data-testid="SelectItem__bf9e7b">{text.notImported}</SelectItem>
                {importFields.map((field) => (
                  <SelectItem
                    key={field.target}
                    value={field.target}
                    data-testid={"SelectItem__" + field.target}>{field.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}

export function ImportColumnMapping({ headers, importFields, mapping, onApplyMapping, labels }) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const [open, setOpen] = useState(false);
  const [draftMapping, setDraftMapping] = useState(mapping);

  const mappedCount = headers.filter((h) => mapping[h]).length;

  const handleOpen = () => {
    setDraftMapping(mapping);
    setOpen(true);
  };

  const handleDraftChange = (header, target) => {
    setDraftMapping((prev) => ({ ...prev, [header]: target }));
  };

  const handleSave = () => {
    onApplyMapping(draftMapping);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-2 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="ImportColumnMapping__summaryCount">
          {mappedCount < headers.length && (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" data-testid="ImportColumnMapping__summaryWarning" />
          )}
          {formatTemplate(text.mappedSummary, { mapped: mappedCount, total: headers.length })}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleOpen} data-testid="ImportColumnMapping__editButton">
          {text.editMatch}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5" data-testid="ImportColumnMapping__chips">
        {headers.map((header) => {
          const label = targetLabel(importFields, mapping[header]);
          return (
            <span
              key={header}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
              data-testid={`ImportColumnMapping__chip-${header}`}
            >
              <span className="text-muted-foreground">{header}</span>
              <span aria-hidden="true">&rarr;</span>
              <span className={label ? '' : 'italic text-muted-foreground'}>{label ?? text.notImported}</span>
            </span>
          );
        })}
      </div>
      <Dialog open={open} onOpenChange={setOpen} data-testid="Dialog__columnMappingEdit">
        <DialogContent data-testid="DialogContent__columnMappingEdit">
          <DialogHeader data-testid="DialogHeader__columnMappingEdit">
            <DialogTitle data-testid="DialogTitle__columnMappingEdit">{text.editTitle}</DialogTitle>
          </DialogHeader>
          <MappingGrid headers={headers} importFields={importFields} mapping={draftMapping} onMappingChange={handleDraftChange} text={text} />
          <DialogFooter data-testid="DialogFooter__columnMappingEdit">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="ImportColumnMapping__cancelButton">
              {text.cancel}
            </Button>
            <Button type="button" onClick={handleSave} data-testid="ImportColumnMapping__saveButton">
              {text.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

Note this rewrite drops the manual `ChevronDown` entirely from the select trigger (fixing the double-chevron bug) — `SelectTrigger` (in `ui/select.jsx`) already renders its own.

In `ImportDialog.jsx`, rename and resignature `handleMappingChange` (currently lines 148-150):

```js
const handleMappingChange = useCallback((header, target) => {
  setMapping((prev) => ({ ...prev, [header]: target }));
}, []);
```

to:

```js
const handleMappingChange = useCallback((newMapping) => {
  setMapping(newMapping);
}, []);
```

And update the `ImportColumnMapping` usage in the MAPPING step (currently lines 367-372):

```jsx
<ImportColumnMapping
  headers={headers}
  importFields={config.fields}
  mapping={mapping}
  onApplyMapping={handleMappingChange}
  data-testid="ImportColumnMapping__38a6c3" />
```

In `ImportDialog.test.jsx`, update the shared `uploadFile` helper (currently lines 24-29) — it waits for a `select` testid that is no longer rendered by default (only inside the now-closed edit modal):

```js
async function uploadFile(content) {
  const input = screen.getByTestId('ImportDropzone__fileInput');
  const file = makeFile(content);
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => screen.getByTestId('ImportColumnMapping__chip-Name'));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportColumnMapping.test.jsx`
Expected: PASS — all tests.

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportDialog.test.jsx`
Expected: PASS — every existing test in this file uses the `uploadFile` helper; confirm none of them independently assert on `ImportColumnMapping__select-Name` being visible right after upload (only Task 6's new test opens the modal explicitly). If any existing test does reference `ImportColumnMapping__select-*` outside an opened modal, update it to open the modal first via `fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'))`.

- [ ] **Step 5: Commit**

```bash
cd /Users/sebastianbarrozo/Documents/work/epic/schema_forge_core
git add packages/app-shell-core/src/components/import/ImportColumnMapping.jsx packages/app-shell-core/src/components/import/ImportDialog.jsx packages/app-shell-core/src/components/import/__tests__/ImportColumnMapping.test.jsx packages/app-shell-core/src/components/import/__tests__/ImportDialog.test.jsx
git commit -m "Feature ETP-4447: Compact CSV import column-mapping summary with edit modal"
```

---

## Task 6: Persist raw rows and revalidate on mapping apply

**Files:**
- Modify: `packages/app-shell-core/src/components/import/ImportDialog.jsx`:
  - `handleFileSelected` (~lines 132-146): persist parsed header-keyed rows to new `rawRows` state
  - new `isRevalidating` state
  - `handleMappingChange` (from Task 5): extend into `handleApplyMapping`, re-deriving `entries` from `rawRows` via the new mapping and re-running `runValidation`
  - MAPPING step JSX (~lines 365-399): pass `onApplyMapping={handleApplyMapping}` to `ImportColumnMapping`; wrap `ImportReviewQueue` in a loading overlay shown while `isRevalidating`
- Test: `packages/app-shell-core/src/components/import/__tests__/ImportDialog.test.jsx`

**Interfaces:**
- Consumes: `ImportColumnMapping`'s `onApplyMapping(newMapping)` contract from Task 5; `runValidation(mappedRows)` (already defined in `ImportDialog.jsx`, unchanged signature).
- Produces: nothing new for other components — this is the last piece of the mapping-change flow, entirely internal to `ImportDialog`.

- [ ] **Step 1: Write the failing test**

Add to `ImportDialog.test.jsx`, as new tests in the `describe('ImportDialog', ...)` block. First, add the same Radix Select jsdom polyfills used in Task 5's `ImportColumnMapping.test.jsx`, near the top of the file (after the existing imports, before `const config = ...`):

```js
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
```

Then add:

```jsx
it('re-derives the grid from the raw file using the new mapping after Save in the edit-match modal', async () => {
  render(<ImportDialog open config={config} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
  await uploadFile('Name,Email\nLucia,not-an-email');
  await waitFor(() => screen.getByTestId('ImportReviewQueue__fieldError-0-email'));
  // Unmap the "Email" CSV header entirely — proves entries are rebuilt from the
  // persisted raw rows with the new mapping, not just cosmetically relabeled: the
  // invalid value is no longer read into the `email` target at all, so the email
  // format check has nothing to flag.
  fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
  fireEvent.click(screen.getByTestId('ImportColumnMapping__select-Email'));
  fireEvent.click(screen.getByText('Not imported'));
  fireEvent.click(screen.getByTestId('ImportColumnMapping__saveButton'));
  await waitFor(() => expect(screen.queryByTestId('ImportReviewQueue__fieldError-0-email')).toBeNull());
});

it('shows a loading overlay while revalidating after a mapping change, then hides it', async () => {
  render(<ImportDialog open config={config} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
  await uploadFile('Name,Email\nLucia,lucia@x.com');
  fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
  fireEvent.click(screen.getByTestId('ImportColumnMapping__saveButton'));
  expect(screen.getByTestId('ImportDialog__revalidatingOverlay')).toBeDefined();
  await waitFor(() => expect(screen.queryByTestId('ImportDialog__revalidatingOverlay')).toBeNull());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportDialog.test.jsx -t "re-derives the grid"`
Expected: FAIL — `ImportReviewQueue__fieldError-0-email` is still present after Save (mapping change currently has no effect on `entries`).

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportDialog.test.jsx -t "loading overlay"`
Expected: FAIL — `ImportDialog__revalidatingOverlay` does not exist.

- [ ] **Step 3: Write minimal implementation**

In `ImportDialog.jsx`, add a new state near the existing `mapping`/`headers`/`entries` declarations (currently lines 46-48):

```js
const [mapping, setMapping] = useState({});
const [headers, setHeaders] = useState([]);
const [rawRows, setRawRows] = useState([]);
const [entries, setEntries] = useState([]);
const [isRevalidating, setIsRevalidating] = useState(false);
```

In `handleFileSelected` (currently lines 132-146), persist the header-keyed rows before renaming:

```js
const handleFileSelected = useCallback(async (file) => {
  try {
    const buffer = await file.arrayBuffer();
    const text2 = decodeCsvBuffer(buffer);
    const { headers: parsedHeaders, rows } = parseDelimited(text2);
    const { mapping: autoMapping } = mapColumns(parsedHeaders, config.fields);
    setHeaders(parsedHeaders);
    setRawRows(rows);
    setMapping(autoMapping);
    await runValidation(rows.map((row) => renameRowKeys(row, autoMapping)));
    setStep(STEP.MAPPING);
  } catch (error) {
    setFileErrorMessage(error.message);
    setStep(STEP.FILE_ERROR);
  }
}, [config.fields, runValidation]);
```

Replace the Task-5 `handleMappingChange` with `handleApplyMapping`, which also re-derives entries and re-runs validation:

```js
const handleApplyMapping = useCallback(async (newMapping) => {
  setMapping(newMapping);
  setIsRevalidating(true);
  try {
    await runValidation(rawRows.map((row) => renameRowKeys(row, newMapping)));
  } finally {
    setIsRevalidating(false);
  }
}, [rawRows, runValidation]);
```

Update the MAPPING step JSX (currently lines 365-399) to use `handleApplyMapping` and add the loading overlay around `ImportReviewQueue`:

```jsx
{step === STEP.MAPPING && (
  <div className="flex min-h-0 max-h-[70vh] min-w-0 flex-col gap-4">
    <ImportColumnMapping
      headers={headers}
      importFields={config.fields}
      mapping={mapping}
      onApplyMapping={handleApplyMapping}
      data-testid="ImportColumnMapping__38a6c3" />
    <div className="relative flex min-h-0 flex-1 flex-col">
      {isRevalidating && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-background/70"
          data-testid="ImportDialog__revalidatingOverlay"
        >
          <span className="text-sm text-muted-foreground">Revalidating rows…</span>
        </div>
      )}
      <ImportReviewQueue
        entries={entries}
        fields={config.fields}
        statusFilter={statusFilterPreSend}
        onStatusFilterChange={setStatusFilterPreSend}
        onEditField={handleEditField}
        showRetry={false}
        onSkipEntry={handleSkipEntry}
        onUnskipEntry={handleUnskipEntry}
        onApplyFkValue={handleApplyFkValue}
        onDownloadErrors={() => downloadCsv(buildErrorsCsv(entries), 'import-errors.csv')}
        simSearchFn={simSearchFn}
        token={token}
        data-testid="ImportReviewQueue__38a6c3" />
    </div>
    <div className="flex justify-end">
      <Button
        type="button"
        onClick={() => setStep(STEP.CONFIRM)}
        disabled={validCount === 0}
        data-testid="ImportDialog__importButton"
      >
        {`Import ${validCount}`}
      </Button>
    </div>
  </div>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportDialog.test.jsx`
Expected: PASS — all tests in the file, including every pre-existing regression test (the `uploadFile` helper and `rawRows` addition do not change any existing behavior for tests that never open the edit-match modal).

- [ ] **Step 5: Run the full import test suite**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/`
Expected: PASS — every test file under `src/components/import/__tests__/` (`ImportReviewQueue`, `ImportColumnMapping`, `ImportDialog`, `ImportConfirmStep`, `ImportDropzone`, `ImportFileErrorDialog`, `ImportProgressStep`, `ImportSystemErrorDialog`). This is the full-scope regression gate for the whole plan — run it once at the end even though each task already ran its own scoped subset.

- [ ] **Step 6: Commit**

```bash
cd /Users/sebastianbarrozo/Documents/work/epic/schema_forge_core
git add packages/app-shell-core/src/components/import/ImportDialog.jsx packages/app-shell-core/src/components/import/__tests__/ImportDialog.test.jsx
git commit -m "Feature ETP-4447: Revalidate CSV import grid on column-mapping change"
```

---

## Post-plan note (not a task — informational)

Item 4 of the design (grid scrollbar) needs **no code change**: the styling already exists on this branch (`styles.css:26-48`) and only appears "broken" because the **published** `@etendosoftware/app-shell-core@0.3.5` package (consumed by `etendo_schema_forge`) predates it. It resolves automatically the next time this package is published and the dependency is bumped downstream — do not add a task for it.
