# CSV Import Template Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user download a blank CSV template (header row only) from the Import dialog's initial dropzone step, pre-filled with the exact column names the window's auto-mapping already recognizes, so they can fill it in and upload it back without needing to guess or manually fix column names.

**Architecture:** A new pure function `buildTemplateCsv(fields)` in `lib/import/` builds a one-line CSV of column headers — one per import field, using that field's first declared alias (the same text `mapColumns` already auto-matches on upload) or its `label` as a fallback when a field has no aliases. `ImportDialog.jsx` renders a small text link below `ImportDropzone` in the DROPZONE step, calling the existing `downloadCsv` helper with `buildTemplateCsv(config.fields)`. No changes to `ImportDropzone.jsx` itself — it stays a generic, schema-agnostic file-picker component; the window-schema-aware template link is composed alongside it in `ImportDialog`, which already holds `config.fields`.

**Tech Stack:** React (function component), Vitest + `@testing-library/react`, plain CSV string building (matches the existing `buildErrorsCsv` pattern — no CSV library).

## Global Constraints

- No new npm dependencies.
- Every new `data-testid` follows the `ComponentName__purpose` convention.
- No backend changes.
- Every new visible string goes through the relevant component's `DEFAULT_LABELS`/`labels` pattern (`ImportDialog.jsx` already has one).
- Template headers use each field's **first alias** (falling back to `label` when a field has no aliases) — this matches the precedent already set by the "Download errors" CSV (original/recognized headers, not internal target keys or English labels), and guarantees the template round-trips through the exact same auto-mapping logic (`mapColumns`) that a real uploaded file goes through.
- Test runner: `cd packages/app-shell-core && npx vitest run <file>`.
- Commit convention (Etendo Git Police, mandatory): first line `Feature ETP-4447: <description>` (max 80 chars), no `Co-Authored-By` line.

---

### Task 1: `buildTemplateCsv` + dropzone-step download link

**Files:**
- Create: `packages/app-shell-core/src/lib/import/buildTemplateCsv.js`
- Test: `packages/app-shell-core/src/lib/import/__tests__/buildTemplateCsv.test.js` (new file — matches this directory's existing `.test.js` convention for pure-logic modules, e.g. `mapColumns.js`'s own test file)
- Modify: `packages/app-shell-core/src/components/import/ImportDialog.jsx`
- Test: `packages/app-shell-core/src/components/import/__tests__/ImportDialog.test.jsx`

**Interfaces:**
- Produces: `buildTemplateCsv(fields)` — `fields: Array<{ target: string, label?: string, aliases?: string[] }>` (the same shape as `config.fields`, i.e. `decisions.json → window.import.fields` after the contract backfill). Returns a single-line CSV string: the header row only, one column per field, in `fields` array order.

- [ ] **Step 1: Write the failing tests**

Create `packages/app-shell-core/src/lib/import/__tests__/buildTemplateCsv.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTemplateCsv } from '../buildTemplateCsv.js';

describe('buildTemplateCsv', () => {
  it('uses each field\'s first alias as its column header, in field order', () => {
    const fields = [
      { target: 'name', label: 'Commercial Name', aliases: ['nombre comercial', 'razon social'] },
      { target: 'etgoEmail', label: 'Email (Company)', aliases: ['email', 'correo', 'e-mail'] },
    ];
    assert.equal(buildTemplateCsv(fields), 'nombre comercial,email');
  });

  it('falls back to the field label when it has no aliases', () => {
    const fields = [{ target: 'name', label: 'Commercial Name' }];
    assert.equal(buildTemplateCsv(fields), 'Commercial Name');
  });

  it('falls back to the field label when aliases is an empty array', () => {
    const fields = [{ target: 'name', label: 'Commercial Name', aliases: [] }];
    assert.equal(buildTemplateCsv(fields), 'Commercial Name');
  });

  it('falls back to the target when neither aliases nor label are present', () => {
    const fields = [{ target: 'name' }];
    assert.equal(buildTemplateCsv(fields), 'name');
  });

  it('quotes a header containing a comma', () => {
    const fields = [{ target: 'name', label: 'Name', aliases: ['nombre, comercial'] }];
    assert.equal(buildTemplateCsv(fields), '"nombre, comercial"');
  });

  it('returns an empty string for no fields', () => {
    assert.equal(buildTemplateCsv([]), '');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/app-shell-core && node --test src/lib/import/__tests__/buildTemplateCsv.test.js`
Expected: FAIL — `buildTemplateCsv.js` does not exist yet (module not found).

- [ ] **Step 3: Write the implementation**

Create `packages/app-shell-core/src/lib/import/buildTemplateCsv.js`:

```js
function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Builds a blank (header-row-only) CSV template for a window's import
 * fields, so a user can download it, fill in their own data, and upload it
 * back through the exact same auto-mapping (`mapColumns`) a real file goes
 * through — headers are each field's first alias (the text `mapColumns`
 * already recognizes), falling back to the field's label or target when it
 * has no declared aliases.
 */
export function buildTemplateCsv(fields) {
  return fields
    .map((field) => csvEscape(field.aliases?.[0] ?? field.label ?? field.target))
    .join(',');
}
```

Note: `entries.length === 0`-style empty-input handling is implicit — `[].map(...).join(',')` already correctly returns `''` for an empty `fields` array, no special case needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/app-shell-core && node --test src/lib/import/__tests__/buildTemplateCsv.test.js`
Expected: PASS — all 6 tests.

- [ ] **Step 5: Write the failing test for the dropzone-step link**

Add to `ImportDialog.test.jsx`, as a new test in the `describe('ImportDialog', ...)` block:

```jsx
it('shows a download-template link on the dropzone step that downloads a header-only CSV of the window\'s import fields', () => {
  const createObjectURLSpy = vi.fn().mockReturnValue('blob:mock-url');
  const revokeObjectURLSpy = vi.fn();
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = createObjectURLSpy;
  URL.revokeObjectURL = revokeObjectURLSpy;
  try {
    render(<ImportDialog open config={config} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    const link = screen.getByTestId('ImportDialog__downloadTemplate');
    fireEvent.click(link);
    expect(createObjectURLSpy).toHaveBeenCalled();
    const blobArg = createObjectURLSpy.mock.calls[0][0];
    expect(blobArg.type).toBe('text/csv;charset=utf-8;');
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});
```

This file's `config` fixture (already defined near the top of the file) is `{ spec: 'contacts', entity: 'businessPartner', fields: [{ target: 'name', label: 'Name', required: true }, { target: 'email', label: 'Email', isEmail: true }], dedupe: {...} }` — note neither field declares `aliases`, so this test only proves the download mechanism fires (via the `createObjectURL` spy), not the exact header text (that's already covered by `buildTemplateCsv.test.js`'s own unit tests). Do not add an assertion on the Blob's text content here — `Blob` content isn't synchronously readable in jsdom without an async `.text()` call, and the header-content correctness is already the pure unit's job, not this integration test's.

- [ ] **Step 6: Run test to verify it fails**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportDialog.test.jsx -t "download-template link"`
Expected: FAIL — `ImportDialog__downloadTemplate` does not exist yet.

- [ ] **Step 7: Write the implementation**

In `ImportDialog.jsx`, add the import near the other `lib/import/` imports:

```js
import { buildTemplateCsv } from '../../lib/import/buildTemplateCsv.js';
```

Add a new key to `DEFAULT_LABELS` (currently `{ title: 'Import', revalidating: 'Revalidating rows…' }`):

```js
const DEFAULT_LABELS = { title: 'Import', revalidating: 'Revalidating rows…', downloadTemplate: 'Download CSV template' };
```

Find the DROPZONE step's JSX (currently a single line):

```jsx
{step === STEP.DROPZONE && <ImportDropzone onFileSelected={handleFileSelected} data-testid="ImportDropzone__38a6c3" />}
```

Replace it with a small wrapper adding the template-download link below the dropzone:

```jsx
{step === STEP.DROPZONE && (
  <div className="flex flex-col items-center gap-2">
    <ImportDropzone onFileSelected={handleFileSelected} data-testid="ImportDropzone__38a6c3" />
    <button
      type="button"
      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      onClick={() => downloadCsv(buildTemplateCsv(config.fields), `${config.spec}-import-template.csv`)}
      data-testid="ImportDialog__downloadTemplate"
    >
      {text.downloadTemplate}
    </button>
  </div>
)}
```

`downloadCsv` is the function already defined at the top of this file (used by the existing `onDownloadErrors` wiring) — reused as-is, no changes to it needed.

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportDialog.test.jsx`
Expected: PASS — all tests, including the new one.

- [ ] **Step 9: Run the full import test suite as a final regression gate**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/` and `cd packages/app-shell-core && node --test src/lib/import/__tests__/*.test.js`
Expected: PASS on both.

- [ ] **Step 10: Commit**

```bash
cd /Users/sebastianbarrozo/Documents/work/epic/schema_forge_core
git add packages/app-shell-core/src/lib/import/buildTemplateCsv.js packages/app-shell-core/src/lib/import/__tests__/buildTemplateCsv.test.js packages/app-shell-core/src/components/import/ImportDialog.jsx packages/app-shell-core/src/components/import/__tests__/ImportDialog.test.jsx
git commit -m "Feature ETP-4447: Add CSV template download to import dropzone step"
```
