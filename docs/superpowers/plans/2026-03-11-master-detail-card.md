# Master-Detail Card Format Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current all-fields-visible layout in master-detail DetailView with a compact read-only card header that expands inline for editing, giving lines ~70% of visible space.

**Architecture:** Create a `CompactHeader` component that shows title + SummaryBar in collapsed state and the full Form in expanded state. `DetailView` uses `CompactHeader` when `DetailTable` is present (master-detail), otherwise keeps current 3-col form layout (simple entities). No generator changes needed — existing props suffice.

**Tech Stack:** React 18.3, Tailwind CSS 3.4, shadcn/ui, Lucide icons

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `tools/app-shell/src/components/contract-ui/CompactHeader.jsx` | Create | Collapsible card: collapsed shows title+summary, expanded shows Form |
| `tools/app-shell/src/components/contract-ui/DetailView.jsx` | Modify | Use CompactHeader when DetailTable present; keep current layout otherwise |
| `tools/app-shell/src/components/contract-ui/index.js` | Modify | Export CompactHeader |

No generator changes. No generated file changes. No test file changes (visual component, tested via browser).

---

## Chunk 1: CompactHeader + DetailView Integration

### Task 1: Create CompactHeader component

**Files:**
- Create: `tools/app-shell/src/components/contract-ui/CompactHeader.jsx`

- [ ] **Step 1: Create CompactHeader.jsx**

```jsx
import { useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SummaryBar } from './SummaryBar.jsx';
import { useLabel } from '@/i18n';

/**
 * Compact card header for master-detail entities.
 *
 * Collapsed: title + subtitle + summary fields (read-only, dense).
 * Expanded: full Form component with all editable fields.
 *
 * Props:
 *  - title: string (e.g. "SO-002")
 *  - subtitle: string (e.g. "Beta LLC")
 *  - summary: Array<{ key, column, type }> — read-only summary fields
 *  - data: object with current field values
 *  - Form: React component (e.g. OrderForm)
 *  - entity: string — entity name for Form
 *  - onChange: (key, value) => void — field change handler
 *  - catalogs: object — FK catalog data for Form
 *  - defaultExpanded: boolean — start expanded (for new records)
 */
export function CompactHeader({
  title,
  subtitle,
  summary = [],
  data,
  Form,
  entity,
  onChange,
  catalogs,
  defaultExpanded = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const t = useLabel();

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      {/* Always visible: title + summary */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground truncate">{title}</h2>
              {subtitle && (
                <span className="text-sm text-muted-foreground truncate">&middot; {subtitle}</span>
              )}
            </div>
            {!expanded && summary.length > 0 && (
              <div className="mt-1.5">
                <SummaryBar fields={summary} data={data} />
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-xs gap-1"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>Cerrar <ChevronUp className="h-3 w-3" /></>
            ) : (
              <>Editar <ChevronDown className="h-3 w-3" /></>
            )}
          </Button>
        </div>
      </div>

      {/* Expandable form */}
      <div
        className="transition-all duration-200 ease-out"
        style={{
          maxHeight: expanded ? '2000px' : '0px',
          opacity: expanded ? 1 : 0,
          overflow: 'hidden',
        }}
      >
        <div className="px-4 pb-4 pt-1 border-t">
          <Form
            entity={entity}
            data={data}
            onChange={onChange}
            catalogs={catalogs}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Open any master-detail window (e.g. Sales Order). The CompactHeader won't be wired up yet, but no errors should appear.

- [ ] **Step 3: Commit**

```bash
git add tools/app-shell/src/components/contract-ui/CompactHeader.jsx
git commit -m "feat: add CompactHeader component for master-detail card layout"
```

---

### Task 2: Export CompactHeader from barrel

**Files:**
- Modify: `tools/app-shell/src/components/contract-ui/index.js`

- [ ] **Step 1: Add export**

Add this line after the existing exports in `index.js`:

```js
export { CompactHeader } from './CompactHeader';
```

- [ ] **Step 2: Commit**

```bash
git add tools/app-shell/src/components/contract-ui/index.js
git commit -m "feat: export CompactHeader from contract-ui barrel"
```

---

### Task 3: Modify DetailView to use CompactHeader for master-detail

**Files:**
- Modify: `tools/app-shell/src/components/contract-ui/DetailView.jsx`

This is the key change. When `DetailTable` is present (master-detail entity), render `CompactHeader` instead of the current title + SummaryBar + Form layout. When `DetailTable` is absent (simple entity), keep the current layout unchanged.

- [ ] **Step 1: Add CompactHeader import**

At the top of `DetailView.jsx`, add:

```js
import { CompactHeader } from './CompactHeader.jsx';
```

- [ ] **Step 2: Replace the scrollable content section**

In `DetailView.jsx`, replace the `{/* Scrollable content */}` section (lines 190-276) with the new conditional layout:

```jsx
      {/* Scrollable content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-1 py-5 space-y-6">

          {/* Master-detail: compact card + prominent lines */}
          {DetailTable ? (
            <>
              <CompactHeader
                title={title}
                subtitle={subtitle}
                summary={summary}
                data={data}
                Form={Form}
                entity={entity}
                onChange={hook.handleChange}
                catalogs={catalogs}
                defaultExpanded={isNew}
              />

              {/* Lines section — prominent, takes most space */}
              <div>
                <div className="flex items-center justify-between pb-3">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    {detailLabel || detailEntity || 'Lines'}
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setShowAddLine(!showAddLine)}
                  >
                    {showAddLine ? 'Cancel' : '+ Add'}
                  </Button>
                </div>

                <Sheet open={showAddLine} onOpenChange={setShowAddLine}>
                  <SheetContent side="bottom" className="max-h-[50vh]">
                    <SheetHeader>
                      <SheetTitle>Add {detailLabel || detailEntity}</SheetTitle>
                      <SheetDescription>
                        Fill in the fields below and click Add to create a new entry.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="pt-4">
                      <form onSubmit={(e) => { e.preventDefault(); handleAddLine(); }} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                          {allEntryFields.map(f => (
                            <div key={f.key} className="min-w-0">
                              <label className="text-xs text-muted-foreground mb-1 block">
                                {t(f.column) ?? f.label ?? f.key}{f.required ? ' *' : ''}
                              </label>
                              <input
                                name={f.key}
                                type={f.type === 'number' ? 'number' : 'text'}
                                placeholder={t(f.column) ?? f.label ?? f.key}
                                value={newLine[f.key] ?? ''}
                                onChange={(e) => setNewLine(prev => ({ ...prev, [f.key]: e.target.value }))}
                                className="w-full h-8 text-sm rounded-md border border-input bg-background px-2 focus:ring-2 focus:ring-primary focus:outline-none"
                                required={f.required}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-end pt-2">
                          <Button type="submit" size="sm">Add Line</Button>
                        </div>
                      </form>
                    </div>
                  </SheetContent>
                </Sheet>

                <DetailTable data={hook.children} entity={detailEntity} />
              </div>
            </>
          ) : (
            /* Simple entity: current layout (title + summary + full form) */
            <>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-foreground">{title}</h1>
                  {subtitle && (
                    <span className="text-base text-muted-foreground">&middot; {subtitle}</span>
                  )}
                </div>
                {summary.length > 0 && (
                  <div className="mt-1">
                    <SummaryBar fields={summary} data={data} />
                  </div>
                )}
              </div>

              <div>
                <Form
                  entity={entity}
                  data={data}
                  onChange={hook.handleChange}
                  catalogs={catalogs}
                />
              </div>
            </>
          )}

        </div>
      </div>
```

- [ ] **Step 3: Remove the now-unused Separator import if it's only used in the old lines section**

Check if `Separator` is still used. The old lines section had `<Separator />` before the lines header. The new master-detail layout doesn't use it. If simple entities don't use it either, remove the import. If in doubt, leave it.

- [ ] **Step 4: Verify in browser**

1. Open a master-detail window (e.g. `/sales-order/SO-001`):
   - Should see compact card with title + summary fields
   - "Editar" button should expand the card to show full form
   - Lines should be prominent below the card
   - "Cerrar" button should collapse the card back

2. Open a simple entity window (e.g. `/business-partner/bp-001`):
   - Should see current layout unchanged (title + summary + 3-col form)

3. Open `/sales-order/new`:
   - Card should start expanded (defaultExpanded=true for new records)

- [ ] **Step 5: Commit**

```bash
git add tools/app-shell/src/components/contract-ui/DetailView.jsx
git commit -m "feat: use CompactHeader for master-detail entities in DetailView"
```

---

### Task 4: Final cleanup and verification

- [ ] **Step 1: Run existing tests**

```bash
cd tools/app-shell && npm test 2>&1 | tail -20
```

Expected: All tests pass (no behavioral changes to tested code).

- [ ] **Step 2: Run the full test suite**

```bash
cd /Users/sebastianbarrozo/Documents/work/epic/schema-forge && node --test 'cli/test/*.test.js'
```

Expected: All CLI tests pass (no generator changes were made).

- [ ] **Step 3: Visual verification checklist**

Open in browser and verify:
- [ ] Master-detail collapsed: card shows doc number + partner + summary values
- [ ] Master-detail expanded: "Editar" opens form inside card, "Cerrar" closes it
- [ ] Master-detail lines: visible below card, take most of the page
- [ ] Master-detail new: card starts expanded
- [ ] Simple entity: layout unchanged, no card
- [ ] Breadcrumb bar: still works (back, save, delete, prev/next)
- [ ] Add line sheet: still works from "+ Add" button

- [ ] **Step 4: Final commit if any adjustments were needed**

```bash
git add -A
git commit -m "feat: master-detail compact card layout complete"
```
