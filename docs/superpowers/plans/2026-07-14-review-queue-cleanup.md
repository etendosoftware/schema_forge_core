# Review Queue Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three small, independent cleanups to the CSV import review queue, per explicit user decisions: (1) remove the now-redundant "Copy error" action, (2) swap the "Edit again" (unskip) button's icon from a pencil to a checkmark, (3) rebuild "Download errors" to export one row per failed record using the **original uploaded CSV's headers** (not target/label names) plus a single combined `Error` column, instead of today's one-row-per-field-error `target,value,reason` format.

**Architecture:** All three changes are scoped to `ImportReviewQueue.jsx` (and its test file); item 3 additionally threads `headers`/`mapping` from `ImportDialog.jsx` into the already-exported `buildErrorsCsv` function, since reconstructing original headers requires the header→target mapping that only `ImportDialog` currently holds. No engine/backend changes.

## Global Constraints

- No new npm dependencies.
- Every new `data-testid` follows the `ComponentName__purpose` convention (no new testids needed here — item 1 removes one, item 2/3 keep or repurpose existing ones).
- No backend changes.
- Test runner: `cd packages/app-shell-core && npx vitest run <file>`.
- Commit convention (Etendo Git Police, mandatory): first line `Feature ETP-4447: <description>` (max 80 chars), no `Co-Authored-By` line.

---

### Task 1: Remove "Copy error" action

**Files:**
- Modify: `packages/app-shell-core/src/components/import/ImportReviewQueue.jsx`
- Test: `packages/app-shell-core/src/components/import/__tests__/ImportReviewQueue.test.jsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this is a pure removal. `ImportReviewQueue`'s prop signature is unchanged (it never took a dedicated "copy" prop; the button called a purely-internal `handleCopyError`).

- [ ] **Step 1: Update the failing/removed tests first**

In `ImportReviewQueue.test.jsx`, delete the entire `describe('Copy error', ...)` block (currently around lines 330-363, spanning the three tests that reference `ImportReviewQueue__copy-0`). This is a removal-driven task — deleting the tests for a feature you're about to delete is the correct order here (there is no "write a failing test" step for a deletion; the equivalent discipline is: delete the tests for the removed behavior, then delete the behavior, then confirm the remaining suite is still green).

- [ ] **Step 2: Remove the implementation**

In `ImportReviewQueue.jsx`:

1. Remove `Copy` from the `lucide-react` import (currently `import { RotateCw, Copy, Ban, AlertCircle, ChevronDown, Pencil } from 'lucide-react';`) — becomes `import { RotateCw, Ban, AlertCircle, ChevronDown, Pencil } from 'lucide-react';` (Task 2 below changes `Pencil` too — if doing both tasks in sequence, coordinate so the final import line has neither `Copy` nor `Pencil` and does have `Check`; if this task runs alone, just drop `Copy`).
2. Remove the `errorsToText` helper function entirely (currently just above `csvEscape`, used only by `handleCopyError`).
3. Remove the `handleCopyError` function (currently defined alongside `handleFkValueSelected`/`resolvePendingBulkApply`, using `navigator.clipboard.writeText` + `toast`).
4. Remove the `copyError`/`copied`/`copyFailed` keys from `DEFAULT_LABELS` (they become dead — no other caller reads them).
5. Remove the `Copy` button JSX entirely (currently between the Retry button and the Skip button in the error-row branch):

```jsx
<Button
  type="button"
  variant="secondary"
  size="icon"
  className="h-6 w-6"
  data-testid={`ImportReviewQueue__copy-${index}`}
  onClick={() => handleCopyError(entry)}
  title={text.copyError}
>
  <Copy className="h-3 w-3" aria-hidden="true" data-testid="Copy__a73779" />
  <span className="sr-only">{text.copyError}</span>
</Button>
```

6. Check whether `toast` (from `'sonner'`, imported at the top of the file) is still used elsewhere in this file after removing `handleCopyError` — if not, remove that import too; if it is (grep the file for other `toast.` calls first), leave it.

- [ ] **Step 3: Run tests to verify the suite is green**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportReviewQueue.test.jsx`
Expected: PASS — no test references `ImportReviewQueue__copy-*` anymore, and no other test depended on the copy button's presence.

- [ ] **Step 4: Run the full import test suite as a regression check**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/sebastianbarrozo/Documents/work/epic/schema_forge_core
git add packages/app-shell-core/src/components/import/ImportReviewQueue.jsx packages/app-shell-core/src/components/import/__tests__/ImportReviewQueue.test.jsx
git commit -m "Feature ETP-4447: Remove redundant Copy error action from import queue"
```

---

### Task 2: Swap the "Edit again" icon from pencil to check

**Files:**
- Modify: `packages/app-shell-core/src/components/import/ImportReviewQueue.jsx`
- Test: `packages/app-shell-core/src/components/import/__tests__/ImportReviewQueue.test.jsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — same button, same `onClick={() => onUnskipEntry(index)}`, same `data-testid={`ImportReviewQueue__unskip-${index}`}`, only the icon component and its own `data-testid` change (`Pencil__a73779` → `Check__a73779`).

- [ ] **Step 1: Write the failing test**

Add to `ImportReviewQueue.test.jsx`, inside the existing `describe('ImportReviewQueue', ...)` block (find the existing skipped-row test(s), e.g. one that renders a `skipped` entry and checks `ImportReviewQueue__skippedLabel-0` or `ImportReviewQueue__unskip-0`):

```jsx
it('uses a Check icon (not Pencil) for the unskip / "Edit again" action', () => {
  const skipped = { row: { name: 'Old', email: 'old@x.com' }, errors: [], status: 'skipped' };
  render(<ImportReviewQueue entries={[skipped]} statusFilter="all" onStatusFilterChange={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onUnskipEntry={() => {}} onDownloadErrors={() => {}} />);
  expect(screen.getByTestId('Check__a73779')).toBeDefined();
  expect(screen.queryByTestId('Pencil__a73779')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportReviewQueue.test.jsx -t "Check icon"`
Expected: FAIL — `Check__a73779` not found; current code renders `Pencil__a73779`.

- [ ] **Step 3: Write the implementation**

In `ImportReviewQueue.jsx`, change the `lucide-react` import (coordinating with Task 1's removal of `Copy` if both tasks have landed):

```js
import { RotateCw, Ban, AlertCircle, ChevronDown, Check } from 'lucide-react';
```

Find the unskip button's icon (currently in the skipped-row branch):

```jsx
<Pencil className="h-3 w-3" aria-hidden="true" data-testid="Pencil__a73779" />
```

Change to:

```jsx
<Check className="h-3 w-3" aria-hidden="true" data-testid="Check__a73779" />
```

The button itself, its `onClick`, `data-testid={`ImportReviewQueue__unskip-${index}`}`, and `title={text.unskip}` (label stays `'Edit again'` — only the icon changes, not the label/behavior) are unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportReviewQueue.test.jsx`
Expected: PASS — all tests.

- [ ] **Step 5: Run the full import test suite as a regression check**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/sebastianbarrozo/Documents/work/epic/schema_forge_core
git add packages/app-shell-core/src/components/import/ImportReviewQueue.jsx packages/app-shell-core/src/components/import/__tests__/ImportReviewQueue.test.jsx
git commit -m "Feature ETP-4447: Use Check icon for import row Edit-again action"
```

---

### Task 3: Rebuild "Download errors" as one row per failed record, original headers

**Files:**
- Modify: `packages/app-shell-core/src/components/import/ImportReviewQueue.jsx` (`buildErrorsCsv` signature + implementation)
- Modify: `packages/app-shell-core/src/components/import/ImportDialog.jsx` (both `onDownloadErrors` call sites)
- Test: `packages/app-shell-core/src/components/import/__tests__/ImportReviewQueue.test.jsx`

**Interfaces:**
- Consumes: nothing new inside `ImportReviewQueue.jsx` itself.
- Produces: `buildErrorsCsv` changes signature from `buildErrorsCsv(entries)` to `buildErrorsCsv(entries, headers, mapping)`:
  - `headers: string[]` — the original CSV column headers, in file order (already tracked as `ImportDialog.jsx`'s `headers` state).
  - `mapping: { [header: string]: string | null }` — header → target field, or `null`/falsy for an unmapped header (already tracked as `ImportDialog.jsx`'s `mapping` state).
  - Output: one CSV row per entry with `entry.errors.length > 0` (covers both real validation/FK errors and skip-with-reason entries, e.g. duplicates — unchanged scope from today). Columns: every header in `headers` that has a non-null mapping (in `headers`' own order), each cell filled from `entry.row[mapping[header]]`, followed by a trailing `Error` column containing every one of that entry's error messages joined with `' | '` (format each as `${target}: ${message}` when `target` is non-blank, or just `message` for a blank-target/row-level error — reusing the same per-message formatting `errorsToText` used before Task 1 removed it, just inlined here or kept as a small local helper).

- [ ] **Step 1: Write the failing tests**

Replace the existing `describe('buildErrorsCsv', ...)` block in `ImportReviewQueue.test.jsx` with:

```jsx
describe('buildErrorsCsv', () => {
  const headers = ['Nombre Comercial', 'Correo', 'Pais'];
  const mapping = { 'Nombre Comercial': 'name', 'Correo': 'email', 'Pais': null };

  it('uses the original CSV headers as columns, in the original column order', () => {
    const entry = {
      row: { name: 'Andres', email: 'not-an-email' },
      errors: [{ target: 'email', message: 'Not a valid email address.' }],
      status: 'pending',
    };
    const csv = buildErrorsCsv([entry], headers, mapping);
    const [headerLine] = csv.split('\n');
    expect(headerLine).toBe('Nombre Comercial,Correo,Error');
  });

  it('fills each mapped column from the entry row and appends a combined Error column', () => {
    const entry = {
      row: { name: 'Andres', email: 'not-an-email' },
      errors: [{ target: 'email', message: 'Not a valid email address.' }],
      status: 'pending',
    };
    const csv = buildErrorsCsv([entry], headers, mapping);
    const [, dataLine] = csv.split('\n');
    expect(dataLine).toBe('Andres,not-an-email,email: Not a valid email address.');
  });

  it('joins multiple field errors into one combined Error cell', () => {
    const entry = {
      row: { name: 'Andres', email: 'not-an-email' },
      errors: [
        { target: 'email', message: 'Not a valid email address.' },
        { target: 'name', message: 'Required field is missing.' },
      ],
      status: 'pending',
    };
    const csv = buildErrorsCsv([entry], headers, mapping);
    const [, dataLine] = csv.split('\n');
    expect(dataLine).toBe('Andres,not-an-email,email: Not a valid email address. | name: Required field is missing.');
  });

  it('formats a row-level (blank-target) error without a leading colon', () => {
    const entry = {
      row: { name: 'Andres', email: 'andres@x.com' },
      errors: [{ target: '', message: 'Duplicate row (already in file).' }],
      status: 'skipped',
    };
    const csv = buildErrorsCsv([entry], headers, mapping);
    const [, dataLine] = csv.split('\n');
    expect(dataLine).toBe('Andres,andres@x.com,Duplicate row (already in file).');
  });

  it('skips OK entries entirely', () => {
    const okEntry = { row: { name: 'Lucia', email: 'lucia@x.com' }, errors: [], status: 'pending' };
    const errorEntry = {
      row: { name: 'Andres', email: 'not-an-email' },
      errors: [{ target: 'email', message: 'Not a valid email address.' }],
      status: 'pending',
    };
    const csv = buildErrorsCsv([okEntry, errorEntry], headers, mapping);
    expect(csv.split('\n').filter((l) => l.trim()).length).toBe(2); // header + 1 error row
  });

  it('omits unmapped headers from the output columns', () => {
    const entry = {
      row: { name: 'Andres', email: 'not-an-email' },
      errors: [{ target: 'email', message: 'Not a valid email address.' }],
      status: 'pending',
    };
    const csv = buildErrorsCsv([entry], headers, mapping);
    expect(csv).not.toContain('Pais');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportReviewQueue.test.jsx -t "buildErrorsCsv"`
Expected: FAIL — the current implementation ignores the new `headers`/`mapping` arguments entirely and still emits the old `target,value,reason` format.

- [ ] **Step 3: Write the implementation**

In `ImportReviewQueue.jsx`, replace the existing `buildErrorsCsv` function:

```js
export function buildErrorsCsv(entries, headers, mapping) {
  const mappedHeaders = headers.filter((h) => mapping[h]);
  const lines = [[...mappedHeaders, 'Error'].map(csvEscape).join(',')];
  for (const entry of entries) {
    if (entry.errors.length === 0) continue;
    const values = mappedHeaders.map((h) => entry.row[mapping[h]]);
    const errorText = entry.errors.map((e) => (e.target ? `${e.target}: ${e.message}` : e.message)).join(' | ');
    lines.push([...values, errorText].map(csvEscape).join(','));
  }
  return lines.join('\n');
}
```

This inlines the per-message formatting Task 1 removed (as `errorsToText`) directly into the `errorText` line above — do not reintroduce a separate `errorsToText` helper, since after Task 1 it has exactly one caller.

Update the function's docstring (currently above it, describing the old one-row-per-field-error shape):

```js
/**
 * Builds a CSV of every currently-erroring or skipped entry, one row per
 * entry (not per field) — columns are the ORIGINAL uploaded file's mapped
 * headers (so a fixed copy can be re-uploaded through the same mapping),
 * plus a trailing Error column combining every message for that row.
 * Unmapped headers are omitted — they were never part of the import target
 * set. Additive to the queue, never a replacement for it (the mock's
 * "download once, never revisit" behavior was explicitly NOT adopted; see
 * the design spec's UI divergences).
 */
```

In `ImportDialog.jsx`, update both `onDownloadErrors` call sites (currently identical in the MAPPING step and the RESULT step):

```jsx
onDownloadErrors={() => downloadCsv(buildErrorsCsv(entries), 'import-errors.csv')}
```

to:

```jsx
onDownloadErrors={() => downloadCsv(buildErrorsCsv(entries, headers, mapping), 'import-errors.csv')}
```

`headers` and `mapping` are already in scope in `ImportDialog.jsx` (top-level component state) at both call sites — no new state or props needed there.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportReviewQueue.test.jsx`
Expected: PASS — all tests.

- [ ] **Step 5: Run the full import test suite as a final regression gate**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/`
Expected: PASS — every file, including `ImportDialog.test.jsx` (confirm no existing test there asserts on the old `buildErrorsCsv(entries)` one-argument call shape via a mock or snapshot; if one does, update it to match the new call — do not weaken the assertion, fix the call).

- [ ] **Step 6: Commit**

```bash
cd /Users/sebastianbarrozo/Documents/work/epic/schema_forge_core
git add packages/app-shell-core/src/components/import/ImportReviewQueue.jsx packages/app-shell-core/src/components/import/ImportDialog.jsx packages/app-shell-core/src/components/import/__tests__/ImportReviewQueue.test.jsx
git commit -m "Feature ETP-4447: Rebuild import error CSV as one row per record"
```
