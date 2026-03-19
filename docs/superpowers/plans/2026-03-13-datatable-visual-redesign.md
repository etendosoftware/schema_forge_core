# DataTable Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `DataTable` and `ListView` components to match the new design screens — status dots on dates, footer totals for amount columns, improved typography/spacing, and record count badge.

**Architecture:** All changes go in `tools/app-shell/src/components/contract-ui/DataTable.jsx` and `ListView.jsx` (host components). The generator (`cli/src/generate-frontend.js`) only changes if new column metadata is needed. Existing generated JSX files do NOT need regeneration — the visual improvements apply automatically.

**Tech Stack:** React 18, Tailwind CSS, lucide-react icons, shadcn/ui primitives (Table, Badge, Input).

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `tools/app-shell/src/components/contract-ui/DataTable.jsx` | Modify | Add date status dots, footer totals, improved cell rendering, typography |
| `tools/app-shell/src/components/contract-ui/ListView.jsx` | Modify | Better header layout, record count badge styling, "New" button as split-style |
| `cli/test/generate-frontend.test.js` | Modify | Add test for `mapFieldType` returning `'date'` type (already works, verify) |

**No new files.** All changes are in existing components.

---

## Chunk 1: DataTable Improvements

### Task 1: Date cells with status dots

The design screens show colored dots next to date values:
- Green dot: date is in the future (not yet due)
- Red dot: date is in the past (overdue)
- No dot: date is today or null

**Files:**
- Modify: `tools/app-shell/src/components/contract-ui/DataTable.jsx` (lines 206-225, `renderCellValue` function)

- [ ] **Step 1: Add date status dot helper function**

Add this function after `getStatusBadgeProps` (after line 28):

```jsx
/**
 * Return a colored dot class based on whether a date is past, future, or today.
 * Green = future (not yet due), Red = past (overdue), null = today or empty.
 */
function getDateDotColor(dateValue) {
  if (!dateValue) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateValue);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return null;
  return d > today ? 'bg-emerald-500' : 'bg-red-500';
}
```

- [ ] **Step 2: Update renderCellValue for date type**

In `renderCellValue` (around line 206), add a case for `col.type === 'date'` before the final `return`:

```jsx
if (col.type === 'date') {
  const dotColor = getDateDotColor(row[col.key]);
  const formatted = row[col.key]
    ? new Date(row[col.key]).toLocaleDateString()
    : '\u2014';
  return (
    <span className="inline-flex items-center gap-1.5">
      {formatted}
      {dotColor && <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />}
    </span>
  );
}
```

- [ ] **Step 3: Verify in browser**

Run: `cd tools/app-shell && npm run dev`

Open any window with date columns (e.g., Sales Order). Dates should show green/red dots based on past/future.

- [ ] **Step 4: Commit**

```bash
git add tools/app-shell/src/components/contract-ui/DataTable.jsx
git commit -m "Feature ETP-3529: Add date status dots to DataTable"
```

---

### Task 2: Footer totals row

The design shows a totals row at the bottom of the grid that sums all `amount` columns.

**Files:**
- Modify: `tools/app-shell/src/components/contract-ui/DataTable.jsx` (after `</TableBody>`, before closing `</Table>`)

- [ ] **Step 1: Import TableFooter**

Update the import on line 2 to include `TableFooter`:

```jsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
```

- [ ] **Step 2: Compute totals with useMemo**

Add this inside the `DataTable` component, after `filteredData` memo (after line 204):

```jsx
const amountColumns = useMemo(
  () => columns.filter(col => col.type === 'amount'),
  [columns]
);

const totals = useMemo(() => {
  if (amountColumns.length === 0) return null;
  const sums = {};
  for (const col of amountColumns) {
    sums[col.key] = filteredData.reduce((sum, row) => sum + (Number(row[col.key]) || 0), 0);
  }
  return sums;
}, [filteredData, amountColumns]);
```

- [ ] **Step 3: Render footer row**

Add the `<TableFooter>` block after `</TableBody>` and before `</Table>` (after line 299):

```jsx
{totals && (
  <TableFooter>
    <TableRow className="bg-muted/30 font-medium">
      {columns.map((col, idx) => (
        <TableCell key={col.key} className={col.type === 'amount' ? 'tabular-nums text-right' : ''}>
          {col.type === 'amount'
            ? totals[col.key]?.toLocaleString()
            : idx === 0 ? '' : ''}
        </TableCell>
      ))}
    </TableRow>
  </TableFooter>
)}
```

- [ ] **Step 4: Verify in browser**

Open a window with amount columns (Sales Order — grandTotalAmount, summedLineAmount). The footer should show summed totals.

- [ ] **Step 5: Commit**

```bash
git add tools/app-shell/src/components/contract-ui/DataTable.jsx
git commit -m "Feature ETP-3529: Add footer totals row to DataTable"
```

---

### Task 3: Typography and spacing improvements

Match the design's cleaner look: more row padding, lighter header, better font sizes.

**Files:**
- Modify: `tools/app-shell/src/components/contract-ui/DataTable.jsx`

- [ ] **Step 1: Update header row styling**

Change the `TableHead` className (line 257) from:
```
text-xs font-medium text-muted-foreground uppercase tracking-wider
```
to:
```
text-xs font-medium text-muted-foreground/70 tracking-wide
```

This removes uppercase (the design uses sentence case headers) and softens the color.

- [ ] **Step 2: Update cell padding**

Change `TableRow` in the data rows (around line 275) to add more vertical padding. Update the className array:

```jsx
className={[
  'cursor-pointer transition-colors h-12',
  row.id === selectedId ? 'bg-primary/10 border-l-2 border-l-primary' : '',
  'hover:bg-muted/50',
].filter(Boolean).join(' ')}
```

The `h-12` adds consistent 48px row height matching the design.

- [ ] **Step 3: Update amount column alignment**

In `renderCellValue`, update the amount case to include right-alignment (the table header should also be right-aligned for amounts). Modify the `TableHead` rendering to add conditional alignment:

```jsx
<TableHead
  key={col.key}
  className={`text-xs font-medium text-muted-foreground/70 tracking-wide ${col.type === 'amount' ? 'text-right' : ''}`}
>
```

And wrap `TableCell` for data rows with conditional alignment:

```jsx
<TableCell
  key={col.key}
  className={col.type === 'amount' ? 'text-right' : ''}
>
  {renderCellValue(row, col)}
</TableCell>
```

- [ ] **Step 4: Verify in browser**

Check that headers are sentence case, rows have more breathing room, amounts are right-aligned.

- [ ] **Step 5: Commit**

```bash
git add tools/app-shell/src/components/contract-ui/DataTable.jsx
git commit -m "Feature ETP-3529: Improve DataTable typography and spacing"
```

---

## Chunk 2: ListView Improvements

### Task 4: Updated header and record count badge

The design shows: title with record count badge, and the "New" button styled as a primary split button.

**Files:**
- Modify: `tools/app-shell/src/components/contract-ui/ListView.jsx`

- [ ] **Step 1: Update the header layout**

Replace the toolbar section (lines 34-49) with:

```jsx
{/* Toolbar */}
<div className="flex items-center justify-between px-1 pb-4">
  <div className="flex items-center gap-3">
    <h2 className="text-xl font-semibold text-foreground">{label}</h2>
    {!hook.loading && (
      <span className="inline-flex items-center justify-center h-6 min-w-[1.5rem] px-1.5 text-xs font-medium text-primary bg-primary/10 rounded-full">
        {hook.items.length}
      </span>
    )}
  </div>
  <Button
    size="sm"
    className="gap-1"
    onClick={() => navigate(`/${windowName}/new`)}
  >
    + New
  </Button>
</div>
```

Changes:
- Title bumped from `text-lg` to `text-xl`
- Badge uses `primary/10` background with `text-primary` (colored badge instead of gray)
- Title gap increased from `gap-2` to `gap-3`

- [ ] **Step 2: Verify in browser**

Open any list view. The title should be slightly larger, the badge should be blue/primary colored.

- [ ] **Step 3: Commit**

```bash
git add tools/app-shell/src/components/contract-ui/ListView.jsx
git commit -m "Feature ETP-3529: Update ListView header styling"
```

---

### Task 5: Record count in DataTable footer

Update the record count text at the bottom of DataTable to be more visually consistent with the design.

**Files:**
- Modify: `tools/app-shell/src/components/contract-ui/DataTable.jsx` (line 307)

- [ ] **Step 1: Update record count styling**

Replace the record count line (line 307):
```jsx
<p className="text-xs text-muted-foreground">{filteredData.length} of {data.length} records</p>
```

With an icon-based count matching the design toolbar (eye icon + count):

```jsx
<div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
  <span>{filteredData.length} of {data.length} records</span>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add tools/app-shell/src/components/contract-ui/DataTable.jsx
git commit -m "Feature ETP-3529: Update record count display"
```

---

## Summary

| Task | Component | Change |
|------|-----------|--------|
| 1 | DataTable | Date status dots (green/red) |
| 2 | DataTable | Footer totals for amount columns |
| 3 | DataTable | Typography, spacing, alignment |
| 4 | ListView | Header styling, colored badge |
| 5 | DataTable | Record count display |

All changes are in 2 files. No regeneration of existing window artifacts needed — every generated `*Table.jsx` already passes `columns` with `type: 'date'` and `type: 'amount'`, so the visual improvements apply globally.
