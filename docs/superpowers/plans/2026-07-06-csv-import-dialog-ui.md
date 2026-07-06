# CSV Import Dialog (UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `ImportDialog` — the shadcn/Radix-based wizard (dropzone → column
mapping → review queue → confirm → progress → result) — as a self-contained, publicly
exported component in `packages/app-shell-core`, consuming the pure-logic engine already
built (`docs/superpowers/plans/2026-07-06-csv-import-engine.md`, merged).

**Architecture:** `ImportDialog` owns all wizard state and orchestrates calls into the
engine (`parseDelimited`, `mapColumns`, `dedupeRows`, `resolveForeignKeys`,
`validateRows`, `buildOperations`, `importEngine`). Every screen is a separate
presentational component receiving plain props and callbacks — no screen owns state
beyond its own local UI concerns (drag-hover, etc.). This plan does **not** touch
`ListView.jsx`, `generate-contract.js`, `generate-frontend.js`, or any `decisions.json` —
those live in the *other* repo (`etendo_schema_forge`) and in `schema_forge_core`'s CLI,
and are covered by a follow-up plan once this one is merged (the wizard needs to exist
and be independently testable before anything wires a real window's toolbar to it).

**Two hard constraints discovered while grounding this plan, both enforced by existing
tests/code — read before writing anything:**
1. `packages/app-shell-core/test/public-api.test.js`'s second test forbids any file
   under `src/` from importing via the `@/` alias, from `tools/app-shell`, or from
   `@schema-forge/app-shell` — this package must never depend on the consumer app.
   Every new component in this plan uses **only relative imports** (to `../ui/*`,
   `../../lib/import/*`, etc.) and packages already in `peerDependencies`
   (`lucide-react`, `sonner`, `@radix-ui/*` — all already used elsewhere in this
   package).
2. `LocaleProvider.jsx` states explicitly: *"app-shell-core does not bundle or load
   locale data itself, so any app consuming this runtime owns its own translations."*
   Confirmed by the one real precedent for a business-facing component in this package,
   `src/reports/ReportViewerFrame.jsx`: it takes copy via **props with English
   defaults** (`title = 'Report'`), not `useUI()`/locale JSON keys (there are no locale
   JSON files in this package to key into). Every component in this plan follows that
   exact pattern: a `labels` prop with sensible English defaults, overridable by
   whichever app mounts it. Translating those labels into Spanish and wiring them from
   `etendo_schema_forge`'s own locale files is the follow-up wiring plan's job, not
   this one's — this plan's job is that every string is override-able, not hardcoded.

**Tech Stack:** React, the existing shadcn/Radix primitives already in
`packages/app-shell-core/src/components/ui/` (`dialog.jsx`, `table.jsx`, `select.jsx`,
`input.jsx`, `button.jsx`, `label.jsx`), `lucide-react` icons, `sonner` for the success
toast. Tests: Vitest + `@testing-library/react`, explicit imports (`import { describe,
it, expect } from 'vitest'` — `vitest.config.js` has no `globals: true`, and its
`include: ['src/**/*.test.jsx']` glob auto-discovers any new `*.test.jsx` file — unlike
the engine plan's `node:test` files, **no glob to edit** for these tests).

**Reference:** Design spec §"UI" (`docs/superpowers/specs/2026-07-06-csv-import-design.md`)
for the exact 7-screen anatomy and mock-derived copy (kept here as the *default* English
translation of that Spanish copy — the mock's actual Spanish strings arrive via `labels`
overrides in the follow-up wiring plan). Engine API surface (already merged, all in
`packages/app-shell-core/src/lib/import/`): `parseDelimited`/`ImportParseError`,
`decodeCsvBuffer`, `mapColumns`, `dedupeRows`, `resolveForeignKeys`, `validateRow`/
`validateRows`, `buildOperations`, `runImport`/`sendRow`/`SEND_STATUS`.

## Global Constraints

- All code, comments, commit messages, and identifiers in English (root `CLAUDE.md`
  `<language_policy>`).
- Commit messages: `Feature ETP-4447: <description>` (max 80 chars first line), no
  `Co-Authored-By`. Branch `feature/ETP-4447` already exists and is checked out in
  `/Users/sebastianbarrozo/Documents/work/epic/schema_forge_core` — work there only.
- No comments explaining *what* code does — only a non-obvious *why*.
- No file under `packages/app-shell-core/src/` may import via `@/`, from
  `tools/app-shell`, or from `@schema-forge/app-shell` (enforced by
  `test/public-api.test.js` — Task 6 extends that same test file for this plan's new
  exports, but the import-boundary check already covers every file, old or new).
- Every component takes copy via a `labels` prop with English defaults — never a
  hardcoded string a caller can't override.
- Every new component gets a co-located `__tests__/*.test.jsx` using
  `@testing-library/react`, following `src/components/ui/__tests__/smoke.vitest.jsx`'s
  explicit-import style (note: **use the `.test.jsx` suffix, not `.vitest.jsx`** — the
  latter is a pre-existing dead naming convention in this package that
  `vitest.config.js`'s `include` glob does not match, so those files silently never
  run. Do not propagate that mistake.)
- **Tests query exclusively via `data-testid`** — never `getByText`, `getByRole(...,
  { name })`, or `getByDisplayValue`. This is an established repo-wide convention (both
  `schema_forge_core` and `etendo_schema_forge` ship a codemod,
  `scripts/add-data-testid.cjs`, that auto-injects `data-testid` on interactive JSX
  across the codebase) caught during this plan's own post-implementation review — the
  code blocks below have already been corrected to this style; give every
  element a test touches an explicit `data-testid` (e.g.
  `ImportReviewQueue__input-${index}-${field.target}`, `ImportConfirmStep__confirm`),
  not a codemod-generated hash, so names stay stable and greppable in hand-written test
  code.

---

### Task 1: `ImportDropzone` — file picker and drag-and-drop

**Files:**
- Create: `packages/app-shell-core/src/components/import/ImportDropzone.jsx`
- Create: `packages/app-shell-core/src/components/import/__tests__/ImportDropzone.test.jsx`

**Interfaces:**
- Produces: `ImportDropzone({ accept = '.csv,.txt', onFileSelected, labels }): JSX` where
  `onFileSelected: (file: File) => void` and `labels` overrides `{ dropHere: 'Drop your
  file here', dropHint: 'or select a file. Supported formats: CSV or TXT' }`.

- [ ] **Step 1: Write the failing tests**

Create `packages/app-shell-core/src/components/import/__tests__/ImportDropzone.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportDropzone } from '../ImportDropzone.jsx';

describe('ImportDropzone', () => {
  it('renders default English copy', () => {
    render(<ImportDropzone onFileSelected={() => {}} />);
    expect(screen.getByText('Drop your file here')).toBeInTheDocument();
    expect(screen.getByText(/Supported formats: CSV or TXT/)).toBeInTheDocument();
  });

  it('renders overridden copy from labels', () => {
    render(<ImportDropzone onFileSelected={() => {}} labels={{ dropHere: 'Suelta tu archivo' }} />);
    expect(screen.getByText('Suelta tu archivo')).toBeInTheDocument();
  });

  it('calls onFileSelected when a file is chosen via the hidden input', () => {
    const onFileSelected = vi.fn();
    render(<ImportDropzone onFileSelected={onFileSelected} />);
    const file = new File(['a,b\n1,2'], 'contacts.csv', { type: 'text/csv' });
    const input = screen.getByTestId('ImportDropzone__fileInput');
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it('calls onFileSelected on drop', () => {
    const onFileSelected = vi.fn();
    render(<ImportDropzone onFileSelected={onFileSelected} />);
    const file = new File(['a,b\n1,2'], 'contacts.csv', { type: 'text/csv' });
    const dropzone = screen.getByTestId('ImportDropzone__zone');
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });
    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it('does nothing when drop carries no files', () => {
    const onFileSelected = vi.fn();
    render(<ImportDropzone onFileSelected={onFileSelected} />);
    const dropzone = screen.getByTestId('ImportDropzone__zone');
    fireEvent.drop(dropzone, { dataTransfer: { files: [] } });
    expect(onFileSelected).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportDropzone.test.jsx`
Expected: FAIL with `Failed to resolve import "../ImportDropzone.jsx"`.

- [ ] **Step 3: Create `packages/app-shell-core/src/components/import/ImportDropzone.jsx`**

```jsx
import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '../../lib/utils.js';

const DEFAULT_LABELS = {
  dropHere: 'Drop your file here',
  dropHint: 'or select a file. Supported formats: CSV or TXT',
};

export function ImportDropzone({ accept = '.csv,.txt', onFileSelected, labels }) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleZoneClick = useCallback(() => inputRef.current?.click(), []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) onFileSelected(file);
  }, [onFileSelected]);

  const handleInputChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    e.target.value = '';
  }, [onFileSelected]);

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="ImportDropzone__zone"
      onClick={handleZoneClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleZoneClick(); } }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors',
        dragOver ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
      )}
    >
      <Upload className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{text.dropHere}</p>
      <p className="text-xs text-muted-foreground">{text.dropHint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        data-testid="ImportDropzone__fileInput"
        className="hidden"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportDropzone.test.jsx`
Expected: PASS, all 5 cases.

- [ ] **Step 5: Commit**

```bash
git add packages/app-shell-core/src/components/import/ImportDropzone.jsx \
        packages/app-shell-core/src/components/import/__tests__/ImportDropzone.test.jsx
git commit -m "Feature ETP-4447: Add ImportDropzone component"
```

---

### Task 2: `ImportColumnMapping` — per-column target picker

**Files:**
- Create: `packages/app-shell-core/src/components/import/ImportColumnMapping.jsx`
- Create: `packages/app-shell-core/src/components/import/__tests__/ImportColumnMapping.test.jsx`

**Interfaces:**
- Produces: `ImportColumnMapping({ headers: string[], importFields: Array<{target,
  label}>, mapping: Record<string,string|null>, onMappingChange: (header, target|null) =>
  void, labels }): JSX`. `labels` overrides `{ notImported: 'Not imported' }`.

- [ ] **Step 1: Write the failing tests**

Create `packages/app-shell-core/src/components/import/__tests__/ImportColumnMapping.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImportColumnMapping } from '../ImportColumnMapping.jsx';

const importFields = [
  { target: 'name', label: 'Name' },
  { target: 'email', label: 'Email' },
];

describe('ImportColumnMapping', () => {
  it('renders one chip per header', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Correo']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Correo: 'email' }}
        onMappingChange={() => {}}
      />,
    );
    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('Correo')).toBeInTheDocument();
  });

  it('shows the currently mapped target for each header', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre']}
        importFields={importFields}
        mapping={{ Nombre: 'name' }}
        onMappingChange={() => {}}
      />,
    );
    expect(screen.getByTestId('ImportColumnMapping__select-Nombre')).toHaveTextContent('Name');
  });

  it('shows "Not imported" for an unmapped header', () => {
    render(
      <ImportColumnMapping
        headers={['Telefono']}
        importFields={importFields}
        mapping={{ Telefono: null }}
        onMappingChange={() => {}}
      />,
    );
    expect(screen.getByTestId('ImportColumnMapping__select-Telefono')).toHaveTextContent('Not imported');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportColumnMapping.test.jsx`
Expected: FAIL with `Failed to resolve import "../ImportColumnMapping.jsx"`.

- [ ] **Step 3: Create `packages/app-shell-core/src/components/import/ImportColumnMapping.jsx`**

```jsx
import { ChevronDown } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select.jsx';

const DEFAULT_LABELS = { notImported: 'Not imported' };
const UNMAPPED_VALUE = '__unmapped__';

export function ImportColumnMapping({ headers, importFields, mapping, onMappingChange, labels }) {
  const text = { ...DEFAULT_LABELS, ...labels };

  return (
    <div className="flex flex-wrap gap-2 py-2">
      {headers.map((header) => {
        const target = mapping[header];
        return (
          <div key={header} className="flex flex-col gap-1 min-w-[140px]">
            <span className="text-xs font-medium text-muted-foreground">{header}</span>
            <Select
              value={target ?? UNMAPPED_VALUE}
              onValueChange={(value) => onMappingChange(header, value === UNMAPPED_VALUE ? null : value)}
            >
              <SelectTrigger data-testid={`ImportColumnMapping__select-${header}`} className="h-9">
                <SelectValue />
                <ChevronDown className="h-3 w-3 opacity-50" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNMAPPED_VALUE}>{text.notImported}</SelectItem>
                {importFields.map((field) => (
                  <SelectItem key={field.target} value={field.target}>{field.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportColumnMapping.test.jsx`
Expected: PASS, all 3 cases.

- [ ] **Step 5: Commit**

```bash
git add packages/app-shell-core/src/components/import/ImportColumnMapping.jsx \
        packages/app-shell-core/src/components/import/__tests__/ImportColumnMapping.test.jsx
git commit -m "Feature ETP-4447: Add ImportColumnMapping component"
```

---

### Task 3: `ImportReviewQueue` — the shared error-handling queue (preview + result)

**Files:**
- Create: `packages/app-shell-core/src/components/import/ImportReviewQueue.jsx`
- Create: `packages/app-shell-core/src/components/import/__tests__/ImportReviewQueue.test.jsx`

**Interfaces:**
- Consumes: entries in the shape `{ row: Record<string,string>, errors: Array<{target,
  message}>, status: 'pending' | 'skipped' }` — the same `errors` shape
  `validateRow`/`sendRow` already produce, so callers pass those results through with no
  reshaping.
- Produces: `buildErrorsCsv(entries): string` (pure, independently testable — the
  "Download errors" action's content builder).
- Produces: `ImportReviewQueue({ entries, fields, showOnlyErrors, onToggleFilter,
  onEditField, onRetryEntry, onSkipEntry, onDownloadErrors, retryLabel, labels }): JSX`
  where `fields: Array<{target, label}>` (the full set of mappable fields, used only for
  the row-level fallback below), `onEditField: (index, target, value) => void`,
  `onRetryEntry: (index) => void`, `onSkipEntry: (index) => void`, `onDownloadErrors: ()
  => void`, `retryLabel` overrides the per-row action's caption (`'Re-validate'`
  pre-send, `'Retry'` post-send — the caller decides which, per the design's split).
  **Editable surface per entry, per the design spec's split**: if every error on an
  entry carries a specific `target` (the pre-send case — `validateRow` always names a
  field), only those flagged fields are editable. If any error has a blank `target` (the
  post-send case — `/batch` failures are operation-level, not field-level, per
  `BatchService.java`), every field in `fields` becomes editable, not just one useless
  blank-labeled input.

- [ ] **Step 1: Write the failing tests**

Create `packages/app-shell-core/src/components/import/__tests__/ImportReviewQueue.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportReviewQueue, buildErrorsCsv } from '../ImportReviewQueue.jsx';

const okEntry = { row: { name: 'Lucia', email: 'lucia@x.com' }, errors: [], status: 'pending' };
const errorEntry = {
  row: { name: 'Andres', email: 'not-an-email' },
  errors: [{ target: 'email', message: 'Not a valid email address.' }],
  status: 'pending',
};

describe('buildErrorsCsv', () => {
  it('builds a CSV with row target/value/reason columns for every erroring entry', () => {
    const csv = buildErrorsCsv([errorEntry]);
    expect(csv).toContain('target,value,reason');
    expect(csv).toContain('email,not-an-email,Not a valid email address.');
  });

  it('skips OK entries entirely', () => {
    const csv = buildErrorsCsv([okEntry, errorEntry]);
    expect(csv.split('\n').filter((l) => l.trim()).length).toBe(2); // header + 1 error row
  });
});

describe('ImportReviewQueue', () => {
  it('hides OK entries when showOnlyErrors is true', () => {
    render(<ImportReviewQueue entries={[okEntry, errorEntry]} showOnlyErrors onToggleFilter={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.queryByDisplayValue('Lucia')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Andres')).toBeInTheDocument();
  });

  it('shows all entries when showOnlyErrors is false', () => {
    render(<ImportReviewQueue entries={[okEntry, errorEntry]} showOnlyErrors={false} onToggleFilter={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.getByDisplayValue('Lucia')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Andres')).toBeInTheDocument();
  });

  it('renders the error message and an editable input for the flagged field', () => {
    render(<ImportReviewQueue entries={[errorEntry]} showOnlyErrors onToggleFilter={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.getByText('Not a valid email address.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('not-an-email')).toBeInTheDocument();
  });

  it('calls onEditField with the entry index, target, and new value', () => {
    const onEditField = vi.fn();
    render(<ImportReviewQueue entries={[errorEntry]} showOnlyErrors onToggleFilter={() => {}} onEditField={onEditField} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    fireEvent.change(screen.getByDisplayValue('not-an-email'), { target: { value: 'fixed@x.com' } });
    expect(onEditField).toHaveBeenCalledWith(0, 'email', 'fixed@x.com');
  });

  it('renders an input for every declared field (not just one blank one) when an error has no specific target — the post-send, row-level case', () => {
    const rowLevelEntry = {
      row: { name: 'Lucia', email: 'lucia@x.com' },
      errors: [{ target: '', message: 'Rejected by server' }],
      status: 'pending',
    };
    render(
      <ImportReviewQueue
        entries={[rowLevelEntry]}
        fields={[{ target: 'name', label: 'Name' }, { target: 'email', label: 'Email' }]}
        showOnlyErrors
        onToggleFilter={() => {}}
        onEditField={() => {}}
        onRetryEntry={() => {}}
        onSkipEntry={() => {}}
        onDownloadErrors={() => {}}
      />,
    );
    expect(screen.getByText('Rejected by server')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Lucia')).toBeInTheDocument();
    expect(screen.getByDisplayValue('lucia@x.com')).toBeInTheDocument();
  });

  it('edits the correct field when editing a row-level-error entry\'s full-row inputs', () => {
    const onEditField = vi.fn();
    const rowLevelEntry = {
      row: { name: 'Lucia', email: 'lucia@x.com' },
      errors: [{ target: '', message: 'Rejected by server' }],
      status: 'pending',
    };
    render(
      <ImportReviewQueue
        entries={[rowLevelEntry]}
        fields={[{ target: 'name', label: 'Name' }, { target: 'email', label: 'Email' }]}
        showOnlyErrors
        onToggleFilter={() => {}}
        onEditField={onEditField}
        onRetryEntry={() => {}}
        onSkipEntry={() => {}}
        onDownloadErrors={() => {}}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('lucia@x.com'), { target: { value: 'fixed@x.com' } });
    expect(onEditField).toHaveBeenCalledWith(0, 'email', 'fixed@x.com');
  });

  it('calls onRetryEntry with the entry index and shows the custom retryLabel', () => {
    const onRetryEntry = vi.fn();
    render(<ImportReviewQueue entries={[errorEntry]} showOnlyErrors onToggleFilter={() => {}} onEditField={() => {}} onRetryEntry={onRetryEntry} onSkipEntry={() => {}} onDownloadErrors={() => {}} retryLabel="Retry" />);
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetryEntry).toHaveBeenCalledWith(0);
  });

  it('calls onSkipEntry with the entry index', () => {
    const onSkipEntry = vi.fn();
    render(<ImportReviewQueue entries={[errorEntry]} showOnlyErrors onToggleFilter={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={onSkipEntry} onDownloadErrors={() => {}} />);
    fireEvent.click(screen.getByTestId('ImportReviewQueue__skip-0'));
    expect(onSkipEntry).toHaveBeenCalledWith(0);
  });

  it('marks a skipped entry distinctly and does not offer edit/retry for it', () => {
    const skipped = { ...errorEntry, status: 'skipped' };
    render(<ImportReviewQueue entries={[skipped]} showOnlyErrors onToggleFilter={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    expect(screen.getByText('Skipped')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('not-an-email')).not.toBeInTheDocument();
  });

  it('calls onDownloadErrors when the download button is clicked', () => {
    const onDownloadErrors = vi.fn();
    render(<ImportReviewQueue entries={[errorEntry]} showOnlyErrors onToggleFilter={() => {}} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={onDownloadErrors} />);
    fireEvent.click(screen.getByText('Download errors'));
    expect(onDownloadErrors).toHaveBeenCalled();
  });

  it('calls onToggleFilter when the filter toggle is clicked', () => {
    const onToggleFilter = vi.fn();
    render(<ImportReviewQueue entries={[errorEntry]} showOnlyErrors onToggleFilter={onToggleFilter} onEditField={() => {}} onRetryEntry={() => {}} onSkipEntry={() => {}} onDownloadErrors={() => {}} />);
    fireEvent.click(screen.getByText('Show all'));
    expect(onToggleFilter).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportReviewQueue.test.jsx`
Expected: FAIL with `Failed to resolve import "../ImportReviewQueue.jsx"`.

- [ ] **Step 3: Create `packages/app-shell-core/src/components/import/ImportReviewQueue.jsx`**

```jsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table.jsx';
import { Input } from '../ui/input.jsx';
import { Button } from '../ui/button.jsx';

const DEFAULT_LABELS = {
  showOnlyErrors: 'Show only errors',
  showAll: 'Show all',
  skip: 'Skip',
  skipped: 'Skipped',
  downloadErrors: 'Download errors',
};

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Builds a CSV of every currently-erroring or skipped entry, one row per
 * (entry, flagged field) pair — additive to the queue, never a replacement
 * for it (the mock's "download once, never revisit" behavior was explicitly
 * NOT adopted; see the design spec's UI divergences).
 */
export function buildErrorsCsv(entries) {
  const lines = ['target,value,reason'];
  for (const entry of entries) {
    for (const error of entry.errors) {
      lines.push([error.target, entry.row[error.target], error.message].map(csvEscape).join(','));
    }
  }
  return lines.join('\n');
}

export function ImportReviewQueue({
  entries,
  fields = [],
  showOnlyErrors,
  onToggleFilter,
  onEditField,
  onRetryEntry,
  onSkipEntry,
  onDownloadErrors,
  retryLabel = 'Retry',
  labels,
}) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const visibleEntries = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !showOnlyErrors || entry.errors.length > 0 || entry.status === 'skipped');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button type="button" className="text-xs text-primary underline" onClick={onToggleFilter}>
          {showOnlyErrors ? text.showAll : text.showOnlyErrors}
        </button>
        <Button type="button" variant="secondary" size="sm" onClick={onDownloadErrors}>
          {text.downloadErrors}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Row</TableHead>
            <TableHead>Errors</TableHead>
            <TableHead className="w-[1%] whitespace-nowrap">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleEntries.map(({ entry, index }) => {
            const isSkipped = entry.status === 'skipped';
            // A blank error.target means BatchService rejected the whole operation, not
            // one field — there is no single cell to flag, so every mapped field becomes
            // editable rather than showing one useless blank-labeled input.
            const rowLevelError = entry.errors.find((e) => !e.target);
            const editableFields = rowLevelError
              ? fields
              : entry.errors.map((e) => ({ target: e.target, label: e.target }));
            return (
              <TableRow key={index}>
                <TableCell>
                  {isSkipped ? (
                    <span className="text-xs text-muted-foreground">{text.skipped}</span>
                  ) : entry.errors.length === 0 ? (
                    Object.values(entry.row).join(' · ')
                  ) : (
                    <div className="flex flex-col gap-2">
                      {rowLevelError && (
                        <span className="text-xs text-destructive">{rowLevelError.message}</span>
                      )}
                      {editableFields.map((field) => {
                        const fieldError = entry.errors.find((e) => e.target === field.target);
                        return (
                          <div key={field.target} className="flex flex-col gap-1">
                            {fieldError && !rowLevelError && (
                              <span className="text-xs text-destructive">{fieldError.message}</span>
                            )}
                            <Input
                              value={entry.row[field.target] ?? ''}
                              onChange={(e) => onEditField(index, field.target, e.target.value)}
                              className="h-8"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TableCell>
                <TableCell>{entry.errors.length}</TableCell>
                <TableCell>
                  {!isSkipped && (
                    <div className="flex gap-1">
                      <Button type="button" size="sm" onClick={() => onRetryEntry(index)}>
                        {retryLabel}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        data-testid={`ImportReviewQueue__skip-${index}`}
                        onClick={() => onSkipEntry(index)}
                      >
                        {text.skip}
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportReviewQueue.test.jsx`
Expected: PASS, all 11 cases.

- [ ] **Step 5: Commit**

```bash
git add packages/app-shell-core/src/components/import/ImportReviewQueue.jsx \
        packages/app-shell-core/src/components/import/__tests__/ImportReviewQueue.test.jsx
git commit -m "Feature ETP-4447: Add ImportReviewQueue shared error-handling component"
```

---

### Task 4: Small step components — confirm, progress, file-level error dialog

**Files:**
- Create: `packages/app-shell-core/src/components/import/ImportConfirmStep.jsx`
- Create: `packages/app-shell-core/src/components/import/ImportProgressStep.jsx`
- Create: `packages/app-shell-core/src/components/import/ImportFileErrorDialog.jsx`
- Create: `packages/app-shell-core/src/components/import/__tests__/ImportConfirmStep.test.jsx`
- Create: `packages/app-shell-core/src/components/import/__tests__/ImportProgressStep.test.jsx`
- Create: `packages/app-shell-core/src/components/import/__tests__/ImportFileErrorDialog.test.jsx`

These three are bundled into one task — each is a single small presentational piece
(a handful of lines) with no shared logic between them; splitting them into three tasks
would add process overhead with nothing meaningful for a reviewer to approve
independently.

**Interfaces:**
- Produces: `ImportConfirmStep({ importCount, skipCount, onCancel, onConfirm, labels }):
  JSX`.
- Produces: `ImportProgressStep({ percent, labels }): JSX`.
- Produces: `ImportFileErrorDialog({ message, onCancel, onRetry, labels }): JSX`.

- [ ] **Step 1: Write the failing tests**

Create `packages/app-shell-core/src/components/import/__tests__/ImportConfirmStep.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportConfirmStep } from '../ImportConfirmStep.jsx';

describe('ImportConfirmStep', () => {
  it('shows the import and skip counts', () => {
    render(<ImportConfirmStep importCount={112} skipCount={8} onCancel={() => {}} onConfirm={() => {}} />);
    expect(screen.getByText(/112/)).toBeInTheDocument();
    expect(screen.getByText(/8/)).toBeInTheDocument();
  });

  it('calls onCancel and onConfirm', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ImportConfirmStep importCount={1} skipCount={0} onCancel={onCancel} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(screen.getByText('Confirm import'));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalled();
  });
});
```

Create `packages/app-shell-core/src/components/import/__tests__/ImportProgressStep.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImportProgressStep } from '../ImportProgressStep.jsx';

describe('ImportProgressStep', () => {
  it('shows the percent value', () => {
    render(<ImportProgressStep percent={42} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('sets the progress bar width to the percent value', () => {
    render(<ImportProgressStep percent={42} />);
    expect(screen.getByTestId('ImportProgressStep__bar')).toHaveStyle({ width: '42%' });
  });
});
```

Create `packages/app-shell-core/src/components/import/__tests__/ImportFileErrorDialog.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportFileErrorDialog } from '../ImportFileErrorDialog.jsx';

describe('ImportFileErrorDialog', () => {
  it('shows the error message', () => {
    render(<ImportFileErrorDialog message="Duplicate column header: &quot;Email&quot;" onCancel={() => {}} onRetry={() => {}} />);
    expect(screen.getByText(/Duplicate column header/)).toBeInTheDocument();
  });

  it('calls onCancel and onRetry', () => {
    const onCancel = vi.fn();
    const onRetry = vi.fn();
    render(<ImportFileErrorDialog message="x" onCancel={onCancel} onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(screen.getByText('Retry'));
    expect(onCancel).toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportConfirmStep.test.jsx src/components/import/__tests__/ImportProgressStep.test.jsx src/components/import/__tests__/ImportFileErrorDialog.test.jsx`
Expected: FAIL — all three modules missing.

- [ ] **Step 3: Create the three components**

`packages/app-shell-core/src/components/import/ImportConfirmStep.jsx`:

```jsx
import { Button } from '../ui/button.jsx';

const DEFAULT_LABELS = {
  title: 'Confirm import',
  willImport: (n) => `${n} records will be imported`,
  willSkip: (n) => `${n} rows will be skipped due to errors`,
  cancel: 'Cancel',
  confirm: 'Confirm import',
};

export function ImportConfirmStep({ importCount, skipCount, onCancel, onConfirm, labels }) {
  const text = { ...DEFAULT_LABELS, ...labels };
  return (
    <div className="flex flex-col gap-3 py-2">
      <h3 className="text-base font-semibold">{text.title}</h3>
      <p className="text-sm text-muted-foreground">{text.willImport(importCount)}</p>
      {skipCount > 0 && <p className="text-sm text-muted-foreground">{text.willSkip(skipCount)}</p>}
      <div className="flex justify-end gap-2 mt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>{text.cancel}</Button>
        <Button type="button" onClick={onConfirm}>{text.confirm}</Button>
      </div>
    </div>
  );
}
```

`packages/app-shell-core/src/components/import/ImportProgressStep.jsx`:

```jsx
const DEFAULT_LABELS = { title: 'Importing…', subtitle: 'Processing rows' };

export function ImportProgressStep({ percent, labels }) {
  const text = { ...DEFAULT_LABELS, ...labels };
  return (
    <div className="flex flex-col gap-2 py-6">
      <div className="flex justify-between text-sm font-medium">
        <span>{text.title}</span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          data-testid="ImportProgressStep__bar"
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{text.subtitle}</span>
    </div>
  );
}
```

`packages/app-shell-core/src/components/import/ImportFileErrorDialog.jsx`:

```jsx
import { CircleAlert } from 'lucide-react';
import { Button } from '../ui/button.jsx';

const DEFAULT_LABELS = {
  title: 'Import could not be completed',
  cancel: 'Cancel',
  retry: 'Retry',
};

export function ImportFileErrorDialog({ message, onCancel, onRetry, labels }) {
  const text = { ...DEFAULT_LABELS, ...labels };
  return (
    <div className="flex flex-col gap-3 py-2">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <CircleAlert className="h-5 w-5" />
      </span>
      <h3 className="text-base font-semibold">{text.title}</h3>
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>{text.cancel}</Button>
        <Button type="button" onClick={onRetry}>{text.retry}</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportConfirmStep.test.jsx src/components/import/__tests__/ImportProgressStep.test.jsx src/components/import/__tests__/ImportFileErrorDialog.test.jsx`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add packages/app-shell-core/src/components/import/ImportConfirmStep.jsx \
        packages/app-shell-core/src/components/import/ImportProgressStep.jsx \
        packages/app-shell-core/src/components/import/ImportFileErrorDialog.jsx \
        packages/app-shell-core/src/components/import/__tests__/ImportConfirmStep.test.jsx \
        packages/app-shell-core/src/components/import/__tests__/ImportProgressStep.test.jsx \
        packages/app-shell-core/src/components/import/__tests__/ImportFileErrorDialog.test.jsx
git commit -m "Feature ETP-4447: Add confirm, progress, and file-error step components"
```

---

### Task 5: `ImportDialog` — orchestrator wiring the engine to the wizard

**Files:**
- Create: `packages/app-shell-core/src/components/import/ImportDialog.jsx`
- Create: `packages/app-shell-core/src/components/import/__tests__/ImportDialog.test.jsx`

**Interfaces:**
- Consumes every Task 1–4 component, plus the engine:
  `decodeCsvBuffer`/`parseDelimited`/`ImportParseError` from `../../lib/import/parseDelimited.js`,
  `mapColumns` from `../../lib/import/mapColumns.js`,
  `dedupeRows` from `../../lib/import/dedupeRows.js`,
  `resolveForeignKeys` from `../../lib/import/resolveForeignKeys.js`,
  `validateRow`, `validateRows` from `../../lib/import/validateRows.js`,
  `buildOperations` from `../../lib/import/buildOperations.js`,
  `runImport`, `sendRow`, `SEND_STATUS` from `../../lib/import/importEngine.js`.
- Produces: `ImportDialog({ open, onOpenChange, config, token, postBatch, simSearchFn,
  onImported, labels }): JSX`, where `config: { spec, entity, descriptorName?, fields:
  Array<{ target, label, aliases?, required?, isEmail?, isForeignKey?, matchEntity?,
  qtyResults? }>, dedupeKeyTargets?: string[], maxRows?: number, concurrency?: number }`
  and `onImported: (importedCount: number) => void` is called once the result step is
  reached (the caller — the follow-up wiring plan's `ListView` integration — uses it to
  refresh the list).

- [ ] **Step 1: Write the failing tests**

Create `packages/app-shell-core/src/components/import/__tests__/ImportDialog.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImportDialog } from '../ImportDialog.jsx';

const config = {
  spec: 'contacts',
  entity: 'businessPartner',
  fields: [
    { target: 'name', label: 'Name', required: true },
    { target: 'email', label: 'Email', isEmail: true },
  ],
  dedupeKeyTargets: ['email'],
};

function makeFile(content, name = 'contacts.csv') {
  return new File([content], name, { type: 'text/csv' });
}

async function uploadFile(content) {
  const input = screen.getByTestId('ImportDropzone__fileInput');
  const file = makeFile(content);
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => screen.getByTestId('ImportColumnMapping__select-Name'));
}

describe('ImportDialog', () => {
  it('parses the file and shows the mapping step with auto-mapped columns', async () => {
    const postBatch = vi.fn();
    render(<ImportDialog open config={config} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    expect(screen.getByTestId('ImportColumnMapping__select-Name')).toHaveTextContent('Name');
    expect(screen.getByTestId('ImportColumnMapping__select-Email')).toHaveTextContent('Email');
  });

  it('shows the file-error dialog for a malformed file and Retry returns to the dropzone', async () => {
    render(<ImportDialog open config={config} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    const input = screen.getByTestId('ImportDropzone__fileInput');
    fireEvent.change(input, { target: { files: [makeFile('')] } });
    await waitFor(() => screen.getByText('Import could not be completed'));
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => screen.getByTestId('ImportDropzone__fileInput'));
  });

  it('flags an invalid email as a review-queue error before sending', async () => {
    render(<ImportDialog open config={config} token="t" postBatch={vi.fn()} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nAndres,not-an-email');
    await waitFor(() => screen.getByText('Not a valid email address.'));
  });

  it('drives the confirm → progress → result flow and calls onImported with the sent count', async () => {
    const postBatch = vi.fn().mockResolvedValue({ committed: true, operations: [{ id: 'row', ok: true, recordId: 'REC-1' }] });
    const onImported = vi.fn();
    render(<ImportDialog open config={config} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={onImported} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByText(/Import 1/));
    fireEvent.click(screen.getByText('Confirm import'));
    await waitFor(() => expect(onImported).toHaveBeenCalledWith(1));
  });

  it('shows a failed row in the result review queue with Retry re-invoking postBatch for that row', async () => {
    const postBatch = vi.fn().mockResolvedValue({ committed: false, failedAt: { index: 0 }, error: { message: 'Rejected by server' } });
    render(<ImportDialog open config={config} token="t" postBatch={postBatch} simSearchFn={vi.fn()} onImported={() => {}} />);
    await uploadFile('Name,Email\nLucia,lucia@x.com');
    fireEvent.click(screen.getByText(/Import 1/));
    fireEvent.click(screen.getByText('Confirm import'));
    await waitFor(() => screen.getByText('Rejected by server'));
    postBatch.mockResolvedValueOnce({ committed: true, operations: [{ id: 'row', ok: true, recordId: 'REC-2' }] });
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => expect(postBatch).toHaveBeenCalledTimes(2));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportDialog.test.jsx`
Expected: FAIL with `Failed to resolve import "../ImportDialog.jsx"`.

- [ ] **Step 3: Create `packages/app-shell-core/src/components/import/ImportDialog.jsx`**

```jsx
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { ImportDropzone } from './ImportDropzone.jsx';
import { ImportColumnMapping } from './ImportColumnMapping.jsx';
import { ImportReviewQueue, buildErrorsCsv } from './ImportReviewQueue.jsx';
import { ImportConfirmStep } from './ImportConfirmStep.jsx';
import { ImportProgressStep } from './ImportProgressStep.jsx';
import { ImportFileErrorDialog } from './ImportFileErrorDialog.jsx';
import { decodeCsvBuffer, parseDelimited } from '../../lib/import/parseDelimited.js';
import { mapColumns } from '../../lib/import/mapColumns.js';
import { dedupeRows } from '../../lib/import/dedupeRows.js';
import { resolveForeignKeys } from '../../lib/import/resolveForeignKeys.js';
import { validateRow } from '../../lib/import/validateRows.js';
import { buildOperations } from '../../lib/import/buildOperations.js';
import { runImport, sendRow } from '../../lib/import/importEngine.js';

const DEFAULT_LABELS = { title: 'Import' };

const STEP = { DROPZONE: 'dropzone', MAPPING: 'mapping', CONFIRM: 'confirm', SENDING: 'sending', FILE_ERROR: 'fileError', RESULT: 'result' };

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function renameRowKeys(row, mapping) {
  const renamed = {};
  for (const [header, target] of Object.entries(mapping)) {
    if (target) renamed[target] = row[header];
  }
  return renamed;
}

export function ImportDialog({ open, onOpenChange, config, token, postBatch, simSearchFn, onImported, labels }) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const [step, setStep] = useState(STEP.DROPZONE);
  const [fileErrorMessage, setFileErrorMessage] = useState(null);
  const [mapping, setMapping] = useState({});
  const [headers, setHeaders] = useState([]);
  const [entries, setEntries] = useState([]);
  // Two independent toggles, not one shared boolean — the design spec is explicit that
  // the preview (pre-send) and result (post-send) review queues each remember their own
  // filter state.
  const [showOnlyErrorsPreSend, setShowOnlyErrorsPreSend] = useState(true);
  const [showOnlyErrorsPostSend, setShowOnlyErrorsPostSend] = useState(true);
  const [progress, setProgress] = useState(0);

  const requiredTargets = useMemo(() => config.fields.filter((f) => f.required).map((f) => f.target), [config.fields]);
  const emailTargets = useMemo(() => config.fields.filter((f) => f.isEmail).map((f) => f.target), [config.fields]);
  const fkColumns = useMemo(() => config.fields.filter((f) => f.isForeignKey).map((f) => ({ target: f.target, matchEntity: f.matchEntity, qtyResults: f.qtyResults })), [config.fields]);
  const fkTargets = useMemo(() => fkColumns.map((c) => c.target), [fkColumns]);
  // buildOperations (engine) expects { spec, entity, targets: string[], descriptorName? } —
  // config carries `fields` (full descriptor objects, needed by the mapping/validation
  // steps above), so the operations-builder config is derived here rather than passing
  // `config` straight through, which would silently build an empty body.
  const operationsConfig = useMemo(() => ({
    spec: config.spec,
    entity: config.entity,
    descriptorName: config.descriptorName,
    targets: config.fields.map((f) => f.target),
  }), [config.spec, config.entity, config.descriptorName, config.fields]);

  const runValidation = useCallback(async (mappedRows) => {
    const { uniqueRows, duplicates } = dedupeRows(mappedRows, config.dedupeKeyTargets || []);
    const fkResolutions = fkColumns.length > 0
      ? await resolveForeignKeys({ rows: uniqueRows, columns: fkColumns, simSearchFn, token })
      : new Map();
    const validated = uniqueRows.map((row) => ({
      row,
      ...validateRow(row, { requiredTargets, emailTargets, fkTargets, fkResolutions }),
      status: 'pending',
    }));
    const skippedDuplicates = duplicates.map((d) => ({ row: d.row, errors: [{ target: '', message: 'Duplicate row (already in file).' }], status: 'skipped' }));
    setEntries([...validated.map((v) => ({ row: v.row, errors: v.errors, status: 'pending' })), ...skippedDuplicates]);
  }, [config.dedupeKeyTargets, fkColumns, fkTargets, requiredTargets, emailTargets, simSearchFn, token]);

  const handleFileSelected = useCallback(async (file) => {
    try {
      const buffer = await file.arrayBuffer();
      const text2 = decodeCsvBuffer(buffer);
      const { headers: parsedHeaders, rows } = parseDelimited(text2);
      const { mapping: autoMapping } = mapColumns(parsedHeaders, config.fields);
      setHeaders(parsedHeaders);
      setMapping(autoMapping);
      await runValidation(rows.map((row) => renameRowKeys(row, autoMapping)));
      setStep(STEP.MAPPING);
    } catch (error) {
      setFileErrorMessage(error.message);
      setStep(STEP.FILE_ERROR);
    }
  }, [config.fields, runValidation]);

  const handleMappingChange = useCallback((header, target) => {
    setMapping((prev) => ({ ...prev, [header]: target }));
  }, []);

  const handleEditField = useCallback((index, targetField, value) => {
    setEntries((prev) => {
      const next = [...prev];
      const row = { ...next[index].row, [targetField]: value };
      const { valid, errors } = validateRow(row, { requiredTargets, emailTargets, fkTargets, fkResolutions: new Map() });
      next[index] = { ...next[index], row, errors: valid ? [] : errors };
      return next;
    });
  }, [requiredTargets, emailTargets, fkTargets]);

  const handleRetryEntryPreSend = useCallback((index) => {
    setEntries((prev) => {
      const next = [...prev];
      const { valid, errors } = validateRow(next[index].row, { requiredTargets, emailTargets, fkTargets, fkResolutions: new Map() });
      next[index] = { ...next[index], errors: valid ? [] : errors };
      return next;
    });
  }, [requiredTargets, emailTargets, fkTargets]);

  const handleSkipEntry = useCallback((index) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, status: 'skipped' } : e)));
  }, []);

  const validCount = entries.filter((e) => e.status === 'pending' && e.errors.length === 0).length;
  const skipCount = entries.length - validCount;

  const handleSend = useCallback(async () => {
    setStep(STEP.SENDING);
    setProgress(0);
    const toSend = entries.filter((e) => e.status === 'pending' && e.errors.length === 0);
    const { results } = await runImport(toSend.map((e) => e.row), {
      buildRowOperations: (row) => buildOperations(row, operationsConfig),
      postBatch,
      concurrency: config.concurrency,
      maxRows: config.maxRows,
      onProgress: (completed, total) => setProgress(Math.round((completed / total) * 100)),
    });
    const okCount = results.filter((r) => r.status === 'ok').length;
    const resultEntries = results
      .filter((r) => r.status !== 'ok')
      .map((r) => ({ row: r.row, errors: [{ target: '', message: r.error?.message || 'Unknown error' }], status: 'pending' }));
    setEntries(resultEntries);
    setStep(STEP.RESULT);
    onImported(okCount);
    if (okCount > 0) toast.success(`${okCount} records imported successfully`);
  }, [entries, operationsConfig, config.concurrency, config.maxRows, postBatch, onImported]);

  const handleRetryEntryPostSend = useCallback(async (index) => {
    const entry = entries[index];
    const result = await sendRow(buildOperations(entry.row, operationsConfig), { postBatch });
    setEntries((prev) => {
      const next = [...prev];
      if (result.status === 'ok') {
        next.splice(index, 1);
      } else {
        next[index] = { ...next[index], errors: [{ target: '', message: result.error?.message || 'Unknown error' }] };
      }
      return next;
    });
  }, [entries, operationsConfig, postBatch]);

  const handleRetryFile = useCallback(() => {
    setFileErrorMessage(null);
    setStep(STEP.DROPZONE);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
        </DialogHeader>

        {step === STEP.DROPZONE && <ImportDropzone onFileSelected={handleFileSelected} />}

        {step === STEP.FILE_ERROR && (
          <ImportFileErrorDialog message={fileErrorMessage} onCancel={() => onOpenChange(false)} onRetry={handleRetryFile} />
        )}

        {step === STEP.MAPPING && (
          <div className="flex flex-col gap-4">
            <ImportColumnMapping headers={headers} importFields={config.fields} mapping={mapping} onMappingChange={handleMappingChange} />
            <ImportReviewQueue
              entries={entries}
              fields={config.fields}
              showOnlyErrors={showOnlyErrorsPreSend}
              onToggleFilter={() => setShowOnlyErrorsPreSend((v) => !v)}
              onEditField={handleEditField}
              onRetryEntry={handleRetryEntryPreSend}
              onSkipEntry={handleSkipEntry}
              onDownloadErrors={() => downloadCsv(buildErrorsCsv(entries), 'import-errors.csv')}
              retryLabel="Re-validate"
            />
            <div className="flex justify-end">
              <Button type="button" onClick={() => setStep(STEP.CONFIRM)} disabled={validCount === 0}>
                {`Import ${validCount}`}
              </Button>
            </div>
          </div>
        )}

        {step === STEP.CONFIRM && (
          <ImportConfirmStep importCount={validCount} skipCount={skipCount} onCancel={() => setStep(STEP.MAPPING)} onConfirm={handleSend} />
        )}

        {step === STEP.SENDING && <ImportProgressStep percent={progress} />}

        {step === STEP.RESULT && (
          <div className="flex flex-col gap-4">
            {entries.length > 0 && (
              <ImportReviewQueue
                entries={entries}
                fields={config.fields}
                showOnlyErrors={showOnlyErrorsPostSend}
                onToggleFilter={() => setShowOnlyErrorsPostSend((v) => !v)}
                onEditField={handleEditField}
                onRetryEntry={handleRetryEntryPostSend}
                onSkipEntry={handleSkipEntry}
                onDownloadErrors={() => downloadCsv(buildErrorsCsv(entries), 'import-errors.csv')}
                retryLabel="Retry"
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportDialog.test.jsx`
Expected: PASS, all 5 cases.

- [ ] **Step 5: Run the whole component suite together**

Run: `cd packages/app-shell-core && npx vitest run src/components/import`
Expected: PASS — every file from Tasks 1–5 runs together with no cross-test leakage.

- [ ] **Step 6: Commit**

```bash
git add packages/app-shell-core/src/components/import/ImportDialog.jsx \
        packages/app-shell-core/src/components/import/__tests__/ImportDialog.test.jsx
git commit -m "Feature ETP-4447: Add ImportDialog orchestrator"
```

---

### Task 6: Publish `ImportDialog` from the package's public export surface

**Files:**
- Modify: `packages/app-shell-core/package.json`
- Modify: `packages/app-shell-core/test/public-api.test.js`

**Interfaces:**
- Produces: `@etendosoftware/app-shell-core/components/import/ImportDialog` (and every
  sibling file in `src/components/import/`) as a resolvable subpath export — the entry
  point the follow-up wiring plan's `ListView.jsx` change (in the other repo) will
  import from. Also exposes `@etendosoftware/app-shell-core/lib/import/*` for the same
  reason (the engine modules, already built, were never given a public export path).

- [ ] **Step 1: Write the failing test**

Edit `packages/app-shell-core/test/public-api.test.js` — add two lines to the existing
`'public package exports the expected runtime entrypoints'` test (do not create a new
test; extend the existing one, matching its own established pattern):

```js
  assert.equal(pkg.exports['./components/ui/*'], './src/components/ui/*');
  assert.equal(pkg.exports['./components/import/*'], './src/components/import/*');
  assert.equal(pkg.exports['./lib/*'], './src/lib/*');
```

(Add these three lines after the existing `pkg.exports['./hooks/use-mobile.jsx']`
assertion — the first line is new coverage for an export that already existed but was
never asserted; the other two are new.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test packages/app-shell-core/test/public-api.test.js`
Expected: FAIL — `pkg.exports['./components/import/*']` and `pkg.exports['./lib/*']`
are `undefined`.

- [ ] **Step 3: Add the two new export entries**

Edit `packages/app-shell-core/package.json`'s `"exports"` block — add two entries after
`"./components/ui/*": "./src/components/ui/*"`:

```json
    "./components/ui/*": "./src/components/ui/*",
    "./components/import/*": "./src/components/import/*",
    "./lib/*": "./src/lib/*"
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test packages/app-shell-core/test/public-api.test.js`
Expected: PASS.

- [ ] **Step 5: Run the entire package test suite (both runners) as a final check**

Run: `npm test --workspace=packages/app-shell-core`
Expected: PASS (`node:test` suite, unaffected by this task).

Run: `cd packages/app-shell-core && npx vitest run`
Expected: PASS — every `*.test.jsx` file across the package, including all of Tasks 1–5,
runs together.

- [ ] **Step 6: Commit**

```bash
git add packages/app-shell-core/package.json packages/app-shell-core/test/public-api.test.js
git commit -m "Feature ETP-4447: Export ImportDialog and import engine from the package"
```

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-07-06-csv-import-design.md` §"UI"
and "Review queue"):
- Screen 1a (dropzone) → Task 1. 1b (mapping) → Task 2. 1c (confirm) → Task 4's
  `ImportConfirmStep`. 1d (progress) → Task 4's `ImportProgressStep`. 1e (file-level
  error, blocking, Retry re-opens dropzone) → Task 4's `ImportFileErrorDialog` + Task 5's
  `handleRetryFile`. 1f/1g (result: banner behavior approximated by rendering the queue
  directly when non-empty, success toast via `sonner`) → Task 5's `STEP.RESULT` branch.
- "Review queue" shared pattern (**independent** filter toggle per step —
  `showOnlyErrorsPreSend`/`showOnlyErrorsPostSend`, two separate `useState` calls, not
  one shared boolean; FK-values-once semantics — deferred: see below; per-row inline
  edit at the flagged-field granularity pre-send vs the **full mapped-field set**
  post-send, per `ImportReviewQueue`'s `rowLevelError` branch — this was a real gap
  caught and fixed during this plan's own self-review, not assumed correct on the first
  draft; retry/re-validate reusing the exact engine functions; skip distinct from
  failing; download-errors as an additive action) → Task 3, wired by Task 5.
- The three divergences from the mock (drop the tags checkbox, dedupe stays
  non-interactive with no confirm-step checkbox, review queue kept instead of one-time
  download) are all honored: `ImportConfirmStep` has no checkboxes, `ImportReviewQueue`
  is the persistent, revisitable queue, and "Download errors" only ever exports —
  never clears — the queue.

**Explicitly deferred, not a gap in this plan** (belongs to the ListView/generator wiring
plan): the FK "needs-review, pick a candidate or fall back to a manual selector" UI
described in the spec is **not** built here. `packages/app-shell-core` has no generic
entity-selector component to reuse (confirmed while researching this plan — the only one,
`SelectorInput.jsx`, lives in `tools/app-shell`, unreachable per the import-boundary
constraint), and building a new one is out of scope for a CSV-import feature. For this
plan, an FK value that isn't auto-resolved surfaces as a plain validation error in the
queue ("could not be matched to an existing record") with a plain-text `Input` to retype
it — consistent with every other flagged field. The richer candidate-picker UX is a
follow-up enhancement once a reusable selector primitive exists in this package, not a
silent scope cut — recorded here so it isn't mistaken for "done per spec."

**Placeholder scan:** none — every task has complete, runnable code.

**Type consistency:** `ImportReviewQueue`'s `entries` shape (`{row, errors, status}`) is
produced identically by `ImportDialog`'s pre-send `runValidation` (from `validateRow`'s
`{valid, errors}`, always target-specific) and post-send `handleSend` (from
`runImport`'s per-result `error`, always blank-target) — `ImportReviewQueue` itself is
what branches on `error.target` being blank or not, not the caller; both call sites pass
the exact same shape. `buildErrorsCsv` and `ImportReviewQueue` share that same entry
shape. `config.fields`'s `{target, label, aliases, required, isEmail, isForeignKey,
matchEntity, qtyResults}` are each read by exactly one derived `useMemo` in
`ImportDialog` (`requiredTargets`, `emailTargets`, `fkColumns`), plus the whole array is
threaded unchanged into `ImportColumnMapping`'s `importFields` and
`ImportReviewQueue`'s `fields` props — three different consumers of the one array, no
reshaping between them. **`buildOperations`'s `{spec, entity, targets, descriptorName}`
input shape is intentionally distinct from `config`** — `operationsConfig` (a fourth
`useMemo`) derives `targets` from `config.fields.map(f => f.target)`; passing `config`
itself to `buildOperations` was an early mistake in this plan's own draft (`config` has
no `targets` key, only `fields`) that would have made every operation body come back
empty — caught and fixed here, both call sites (`handleSend`, `handleRetryEntryPostSend`)
use `operationsConfig`, not `config`.
