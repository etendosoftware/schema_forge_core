# Grid + Form Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the split-view grid+form with a full-page navigation pattern: clean minimal table at `/:windowName`, single-scroll form at `/:windowName/:id`.

**Architecture:** Two new components (`ListView`, `DetailView`) replace `MasterDetailPage` and `SingleEntityPage`. React Router `/:windowName/:id` param distinguishes list from detail. `useEntity` hook unchanged. Generated window files updated to export config objects consumed by the new components.

**Tech Stack:** React 18, React Router 7, Tailwind CSS, shadcn/ui, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-11-grid-form-redesign-design.md`

---

## File Structure

### New files
- `tools/app-shell/src/components/contract-ui/ListView.jsx` — full-width table with search toolbar
- `tools/app-shell/src/components/contract-ui/DetailView.jsx` — full-page form with sticky breadcrumb + scroll
- `tools/app-shell/src/components/contract-ui/SummaryBar.jsx` — inline summary (doc, total, date) reused in DetailView

### Modified files
- `tools/app-shell/src/components/contract-ui/DataTable.jsx` — remove per-column filters, add global search, restyle headers, add link styling on doc column
- `tools/app-shell/src/components/contract-ui/EntityForm.jsx` — change from `grid-cols-2` to `grid-cols-3`
- `tools/app-shell/src/components/contract-ui/index.js` — export `ListView`, `DetailView`, `SummaryBar`
- `tools/app-shell/src/windows/WindowLoader.jsx` — read `:id` param, render ListView or DetailView
- `tools/app-shell/src/App.jsx` — add `/:windowName/:id` route

### Generated files to update (all 36+ windows)
Each generated `*Page.jsx` / `index.jsx` must switch from `MasterDetailPage`/`SingleEntityPage` to the new pattern. We'll update the generated index to export a config object and let `WindowLoader` handle the view switch.

### Files to remove (after migration)
- `tools/app-shell/src/components/contract-ui/MasterDetailPage.jsx`
- `tools/app-shell/src/components/contract-ui/SingleEntityPage.jsx`

---

## Chunk 1: Core components (ListView + DetailView)

### Task 1: Restyle DataTable — global search, clean headers

**Files:**
- Modify: `tools/app-shell/src/components/contract-ui/DataTable.jsx`

- [ ] **Step 1: Read current DataTable.jsx to confirm current state**

Read `tools/app-shell/src/components/contract-ui/DataTable.jsx`.

- [ ] **Step 2: Replace per-column filter inputs with global search**

Replace the filter bar section (lines ~137-154) with a single search input that filters across all `filters` columns:

```jsx
const [searchQuery, setSearchQuery] = useState('');

const filteredData = useMemo(() => {
  if (!searchQuery) return data;
  const q = searchQuery.toLowerCase();
  return data.filter(row =>
    filters.some(key => String(row[key] ?? '').toLowerCase().includes(q))
  );
}, [data, filters, searchQuery]);
```

- [ ] **Step 3: Restyle table header — lighter, no blue background**

Change `TableRow` header class from:
```
border-b-2 border-primary/20 bg-muted/40
```
To:
```
border-b border-border/50
```

Change `TableHead` class from:
```
text-xs font-medium text-blue-800 uppercase tracking-wider
```
To:
```
text-xs font-medium text-muted-foreground uppercase tracking-wider
```

- [ ] **Step 4: Remove zebra striping, add hover**

In row rendering, remove the alternating background:
```jsx
// Remove this line:
idx % 2 !== 0 && row.id !== selectedId ? 'bg-muted/30' : '',
```

Keep hover: `hover:bg-muted/50`.

- [ ] **Step 5: Add link styling on documentNo column**

In `renderCellValue`, add a special case for the first column with type `'string'` that matches common doc-number patterns:

```jsx
// In renderCellValue, detect link column (first string column)
if (col === columns[0] && col.type === 'string') {
  return <span className="font-medium text-primary">{row[col.key]}</span>;
}
```

- [ ] **Step 6: Add `onNavigate` prop for full-page click behavior**

Add prop `onNavigate?: (row) => void` alongside existing `onRowSelect`. When `onNavigate` is provided, clicking a row calls `onNavigate(row)` instead of `onRowSelect(row)`.

```jsx
onClick={() => onNavigate ? onNavigate(row) : onRowSelect?.(row)}
```

- [ ] **Step 7: Run existing tests to ensure no regressions**

```bash
cd tools/app-shell && node --test 'src/**/*.test.js'
```

- [ ] **Step 8: Commit**

```bash
git add tools/app-shell/src/components/contract-ui/DataTable.jsx
git commit -m "refactor: restyle DataTable — global search, clean headers, remove zebra"
```

### Task 2: Widen EntityForm to 3 columns

**Files:**
- Modify: `tools/app-shell/src/components/contract-ui/EntityForm.jsx`

- [ ] **Step 1: Change grid from 2 to 3 columns**

In `EntityForm`, change:
```jsx
<div className="grid grid-cols-2 gap-3">
```
To:
```jsx
<div className="grid grid-cols-2 gap-3 md:grid-cols-3">
```

This keeps 2-col on narrow views (backward compatible with any remaining split-view usage) and uses 3-col on medium+ (the full-page form).

- [ ] **Step 2: Commit**

```bash
git add tools/app-shell/src/components/contract-ui/EntityForm.jsx
git commit -m "refactor: EntityForm 3-column grid on medium+ screens"
```

### Task 3: Create SummaryBar component

**Files:**
- Create: `tools/app-shell/src/components/contract-ui/SummaryBar.jsx`

- [ ] **Step 1: Create SummaryBar**

```jsx
import { useLabel } from '@/i18n';

/**
 * Inline summary of read-only reference fields.
 * Used in DetailView below the title.
 *
 * Props:
 *  - fields: Array<{ key, column, type }>
 *  - data: object with field values
 */
export function SummaryBar({ fields = [], data }) {
  const t = useLabel();
  if (!fields.length || !data) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      {fields.map((field, idx) => {
        const label = t(field.column) ?? field.label ?? field.key;
        const val = data[field.key];
        const display = val == null
          ? '\u2014'
          : (field.type === 'amount' || field.type === 'number')
            ? val.toLocaleString?.() ?? val
            : val;
        return (
          <span key={field.key} className="flex items-center gap-1">
            {idx > 0 && <span className="text-border">&middot;</span>}
            <span>{label}:</span>
            <span className="font-medium text-foreground">{display}</span>
          </span>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add tools/app-shell/src/components/contract-ui/SummaryBar.jsx
git commit -m "feat: add SummaryBar component for inline read-only field display"
```

### Task 4: Create ListView component

**Files:**
- Create: `tools/app-shell/src/components/contract-ui/ListView.jsx`

- [ ] **Step 1: Create ListView**

```jsx
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { useEntity } from '@/hooks/useEntity';
import { useMenuLabel } from '@/i18n';

/**
 * Full-width list view for an entity.
 *
 * Props:
 *  - entity: string
 *  - Table: React component (DataTable wrapper with columns/filters baked in)
 *  - entityLabel: string
 *  - windowName: string (URL slug, used for navigation)
 *  - token: string
 *  - apiBaseUrl: string
 */
export function ListView({
  entity,
  Table,
  entityLabel,
  windowName,
  token,
  apiBaseUrl,
}) {
  const hook = useEntity(entity, null, { token, apiBaseUrl });
  const navigate = useNavigate();
  const tMenu = useMenuLabel();
  const label = tMenu(entityLabel) || entityLabel || entity;

  return (
    <div className="h-[calc(100vh-7.5rem)]  flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-1 pb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">{label}</h2>
          {!hook.loading && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {hook.items.length}
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => navigate(`/${windowName}/new`)}
        >
          + New
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {hook.loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <Table
            entity={entity}
            data={hook.items}
            onNavigate={(row) => navigate(`/${windowName}/${row.id}`)}
            compact={false}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add tools/app-shell/src/components/contract-ui/ListView.jsx
git commit -m "feat: add ListView component — full-width table with navigate"
```

### Task 5: Create DetailView component

**Files:**
- Create: `tools/app-shell/src/components/contract-ui/DetailView.jsx`

- [ ] **Step 1: Create DetailView**

```jsx
import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet.jsx';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { useEntity } from '@/hooks/useEntity';
import { useLabel } from '@/i18n';
import { SummaryBar } from './SummaryBar.jsx';

function getStatusBadgeProps(status) {
  if (!status) return { variant: 'outline' };
  const s = String(status).toLowerCase();
  if (s === 'draft' || s === 'dr') return { variant: 'secondary' };
  if (s === 'completed' || s === 'complete' || s === 'booked' || s === 'co')
    return { variant: 'default', className: 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent' };
  if (s === 'voided' || s === 'cancelled' || s === 'void' || s === 'vo')
    return { variant: 'destructive' };
  return { variant: 'outline' };
}

function statusLabel(status) {
  const MAP = { DR: 'Draft', CO: 'Complete', VO: 'Void', IP: 'In Process' };
  return MAP[status] || status;
}

/**
 * Full-page detail view for a single entity record.
 *
 * Props:
 *  - entity, detailEntity, Form, DetailTable: same as MasterDetailPage
 *  - summary, statusField, processes, addLineFields, catalogs: same as MasterDetailPage
 *  - entityLabel, detailLabel, titleField: same as MasterDetailPage
 *  - windowName: string (URL slug)
 *  - recordId: string ('new' for creation)
 *  - token, apiBaseUrl: string
 */
export function DetailView({
  entity,
  detailEntity,
  Form,
  DetailTable,
  summary = [],
  statusField,
  processes = [],
  addLineFields = { entry: [], derived: [] },
  catalogs,
  entityLabel,
  detailLabel,
  titleField = 'documentNo',
  windowName,
  recordId,
  token,
  apiBaseUrl,
}) {
  const hook = useEntity(entity, detailEntity, { token, apiBaseUrl });
  const navigate = useNavigate();
  const t = useLabel();
  const [showAddLine, setShowAddLine] = useState(false);

  // Select the record once items are loaded
  const isNew = recordId === 'new';
  const currentItem = useMemo(() => {
    if (isNew) return null;
    return hook.items.find(item => String(item.id) === String(recordId)) || null;
  }, [hook.items, recordId, isNew]);

  // Auto-select when item is found (or create new)
  useState(() => {
    if (isNew && !hook.editing) {
      hook.handleNew();
    }
  });

  // Select item when loaded
  if (currentItem && (!hook.selected || String(hook.selected.id) !== String(recordId))) {
    hook.handleSelect(currentItem);
  }

  // Prev/Next navigation
  const currentIdx = hook.items.findIndex(item => String(item.id) === String(recordId));
  const prevItem = currentIdx > 0 ? hook.items[currentIdx - 1] : null;
  const nextItem = currentIdx >= 0 && currentIdx < hook.items.length - 1 ? hook.items[currentIdx + 1] : null;

  const data = hook.editing || currentItem || {};
  const title = isNew
    ? `New ${entityLabel || entity}`
    : `${data[titleField] || data.id || ''}`;

  // Subtitle: first non-titleField summary field value (e.g., business partner name)
  const subtitleField = summary.find(f => f.key !== titleField);
  const subtitle = subtitleField ? data[subtitleField.key] : null;

  // Add-line support
  const allEntryFields = addLineFields.entry ?? [];
  const allDerivedFields = addLineFields.derived ?? [];
  const allDetailFields = [...allEntryFields, ...allDerivedFields];
  const emptyLine = Object.fromEntries(allDetailFields.map(f => [f.key, '']));
  const [newLine, setNewLine] = useState(emptyLine);

  const handleAddLine = () => {
    hook.handleAddChild?.(newLine);
    setNewLine({ ...emptyLine });
    setShowAddLine(false);
  };

  if (hook.loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)]">
      {/* Sticky breadcrumb bar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 backdrop-blur border-b px-1 py-2.5">
        <button
          onClick={() => navigate(`/${windowName}`)}
          className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{entityLabel || entity}</span>
        </button>

        <div className="flex-1" />

        {statusField && data[statusField] && (
          <Badge {...getStatusBadgeProps(data[statusField])}>
            {statusLabel(data[statusField])}
          </Badge>
        )}

        {/* Process buttons */}
        {processes.map(p => {
          const btnClass = p.style === 'destructive'
            ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
            : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100';
          return (
            <Button
              key={p.name}
              variant="outline"
              size="sm"
              className={btnClass}
              onClick={() => hook.handleProcess?.(p.name)}
            >
              {p.label}
            </Button>
          );
        })}

        <Button size="sm" onClick={() => hook.handleSave(data)}>
          Save
        </Button>

        {!isNew && hook.selected && (
          <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={hook.handleDelete}>
            Delete
          </Button>
        )}

        <Separator orientation="vertical" className="h-5" />

        {/* Prev/Next */}
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={!prevItem}
          onClick={() => prevItem && navigate(`/${windowName}/${prevItem.id}`)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={!nextItem}
          onClick={() => nextItem && navigate(`/${windowName}/${nextItem.id}`)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-1 py-5 space-y-6">
          {/* Title + summary */}
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

          {/* Form fields */}
          <div>
            <Form
              entity={entity}
              data={data}
              onChange={hook.handleChange}
              catalogs={catalogs}
            />
          </div>

          {/* Detail lines (if master-detail) */}
          {DetailTable && (
            <div className="pt-2">
              <Separator />
              <div className="flex items-center justify-between pt-4 pb-3">
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
                    {/* Reuse add-line form pattern from MasterDetailPage */}
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
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add tools/app-shell/src/components/contract-ui/DetailView.jsx
git commit -m "feat: add DetailView component — full-page single-scroll form"
```

### Task 6: Update contract-ui index exports

**Files:**
- Modify: `tools/app-shell/src/components/contract-ui/index.js`

- [ ] **Step 1: Add exports for new components**

Add to `index.js`:
```js
export { ListView } from './ListView';
export { DetailView } from './DetailView';
export { SummaryBar } from './SummaryBar';
```

Keep `MasterDetailPage` and `SingleEntityPage` exports for now (removed in final cleanup task).

- [ ] **Step 2: Commit**

```bash
git add tools/app-shell/src/components/contract-ui/index.js
git commit -m "feat: export ListView, DetailView, SummaryBar from contract-ui"
```

---

## Chunk 2: Routing + WindowLoader + Generated files migration

### Task 7: Add /:windowName/:id route

**Files:**
- Modify: `tools/app-shell/src/App.jsx`

- [ ] **Step 1: Add the nested route**

In `AppRoutes`, before the `/:windowName` catch-all route, add:
```jsx
<Route
  path=":windowName/:recordId"
  element={<WindowLoader windowMap={windowMap} apiBaseUrl={API_BASE_URL} />}
/>
```

The existing `/:windowName` route stays — it renders the list view.

- [ ] **Step 2: Commit**

```bash
git add tools/app-shell/src/App.jsx
git commit -m "feat: add /:windowName/:recordId route for detail view"
```

### Task 8: Update WindowLoader to support detail view

**Files:**
- Modify: `tools/app-shell/src/windows/WindowLoader.jsx`

- [ ] **Step 1: Read recordId param and pass to component**

Update `WindowLoader` to read `recordId` from params and pass it as a prop:

```jsx
export default function WindowLoader({ windowMap, apiBaseUrl }) {
  const { windowName, recordId } = useParams();
  const { token } = useAuth();
  const inspector = useInspector();
  const [Component, setComponent] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setComponent(null);

    const windowConfig = windowMap[windowName];
    if (!windowConfig) {
      setError(`Window "${windowName}" not found`);
      setLoading(false);
      return;
    }

    windowConfig.loader()
      .then(mod => {
        setComponent(() => mod.default);
        setLoading(false);
      })
      .catch(err => {
        setError(`Failed to load window "${windowName}": ${err.message}`);
        setLoading(false);
      });
  }, [windowName, windowMap]);

  useEffect(() => {
    if (windowName) {
      inspector.loadSchema(windowName).catch(() => {});
    }
  }, [windowName]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive font-medium">{error}</p>
          <p className="text-sm text-muted-foreground mt-2">Check that the component has been generated.</p>
        </div>
      </div>
    );
  }

  if (!Component) return null;

  return (
    <Component
      token={token}
      apiBaseUrl={apiBaseUrl}
      window={windowMap[windowName]}
      windowName={windowName}
      recordId={recordId}
    />
  );
}
```

Key change: passes `windowName` and `recordId` props. When `recordId` is present, the generated page renders `DetailView`; when absent, renders `ListView`.

- [ ] **Step 2: Commit**

```bash
git add tools/app-shell/src/windows/WindowLoader.jsx
git commit -m "feat: WindowLoader passes windowName and recordId to window components"
```

### Task 9: Update generated master-detail windows

**Files to modify:** All generated `index.jsx` and `*Page.jsx` files for windows that use `MasterDetailPage`. There are ~20 of these. The pattern is identical for all.

Example: `artifacts/sales-order/generated/web/sales-order/`

- [ ] **Step 1: Update sales-order index.jsx as template**

Replace `artifacts/sales-order/generated/web/sales-order/index.jsx`:

```jsx
import OrderPage from './OrderPage';

const windowMeta = { category: 'sales', name: 'Sales Order' };

export default function App({ token, apiBaseUrl, window, windowName, recordId }) {
  return (
    <OrderPage
      token={token}
      apiBaseUrl={apiBaseUrl}
      window={window || windowMeta}
      windowName={windowName}
      recordId={recordId}
    />
  );
}
```

- [ ] **Step 2: Update sales-order OrderPage.jsx as template**

Replace `artifacts/sales-order/generated/web/sales-order/OrderPage.jsx`:

```jsx
import { ListView, DetailView } from '@/components/contract-ui';
import OrderTable from './OrderTable';
import OrderForm from './OrderForm';
import OrderLineTable from './OrderLineTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'grandTotal', column: 'GrandTotal', type: 'amount' },
  { key: 'totalLines', column: 'TotalLines', type: 'amount' },
  { key: 'currency', column: 'C_Currency_ID', type: 'string' },
  { key: 'isDelivered', column: 'IsDelivered', type: 'boolean' },
];

const statusField = 'docStatus';
const processes = [];

const addLineFields = {
  entry: [
    { key: 'product', column: 'M_Product_ID', type: 'search', required: true, lookup: true, reference: 'Product', inputMode: 'search' },
    { key: 'quantity', column: 'QtyOrdered', type: 'number', required: true },
    { key: 'description', column: 'Description', type: 'textarea' },
    { key: 'lineNo', column: 'Line', type: 'number', required: true },
  ],
  derived: [
    { key: 'unitPrice', column: 'PriceActual', type: 'number' },
    { key: 'tax', column: 'C_Tax_ID', type: 'selector', reference: 'Tax', inputMode: 'selector' },
    { key: 'discount', column: 'Discount', type: 'number' },
  ],
};

export default function OrderPage({ windowName, recordId, ...props }) {
  if (recordId) {
    return (
      <DetailView
        entity="order"
        detailEntity="orderLine"
        Form={OrderForm}
        DetailTable={OrderLineTable}
        summary={summary}
        statusField={statusField}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Order"
        detailLabel="Order Line"
        windowName={windowName}
        recordId={recordId}
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="order"
      Table={OrderTable}
      entityLabel="Orders"
      windowName={windowName}
      {...props}
    />
  );
}
```

- [ ] **Step 3: Apply same pattern to all master-detail windows**

Repeat the `*Page.jsx` update pattern for all master-detail windows:
- `sales-quotation` (QuotationPage)
- `purchase-order` (OrderPage)
- `goods-receipt` (ReceiptPage)
- `purchase-invoice` (InvoicePage)
- `return-to-vendor` (ReturnPage)
- `return-to-vendor-shipment` (ShipmentPage)
- `goods-shipment` (ShipmentPage)
- `return-from-customer` (ReturnPage)
- `return-material-receipt` (ReceiptPage)
- `sales-invoice` (InvoicePage)
- `payment-in` (PaymentPage)
- `payment-out` (PaymentPage)
- `bank-reconciliation` (ReconciliationPage)
- `recurring-invoice` (InvoicePage)
- `business-partner` (BusinessPartnerPage)

Each `index.jsx` must pass `windowName` and `recordId` props through.
Each `*Page.jsx` must switch between `ListView` and `DetailView` based on `recordId`.

- [ ] **Step 4: Commit all master-detail windows**

```bash
git add artifacts/*/generated/web/*/index.jsx artifacts/*/generated/web/*/*Page.jsx
git commit -m "refactor: migrate all master-detail windows to ListView + DetailView"
```

### Task 10: Update generated single-entity windows

**Files to modify:** All generated `index.jsx` for windows that use `SingleEntityPage` (~15 windows).

- [ ] **Step 1: Update product index.jsx as template**

Replace `artifacts/product/generated/web/product/index.jsx`:

```jsx
import { ListView, DetailView } from '@/components/contract-ui';
import ProductTable from './ProductTable';
import ProductForm from './ProductForm';
import catalogs from './mockCatalogs';

const windowMeta = { category: 'reference', name: 'Product' };

export default function App({ token, apiBaseUrl, window, windowName, recordId, ...props }) {
  if (recordId) {
    return (
      <DetailView
        entity="product"
        Form={ProductForm}
        catalogs={catalogs}
        entityLabel="Product"
        windowName={windowName}
        recordId={recordId}
        token={token}
        apiBaseUrl={apiBaseUrl}
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="product"
      Table={ProductTable}
      entityLabel="Products"
      windowName={windowName}
      token={token}
      apiBaseUrl={apiBaseUrl}
      {...props}
    />
  );
}
```

- [ ] **Step 2: Apply same pattern to all single-entity windows**

Repeat for: `warehouse`, `price-list`, `payment-term`, `payment-method`, `product-category`, `tax`, `uom`, `user`, `physical-inventory`, `goods-movements`, `warehouse-storage-bins`, `chart-of-accounts`, `deal`, `activity`, `lead`, `employee`, `absence`, `project`, `time-tracking`, `document`

- [ ] **Step 3: Commit all single-entity windows**

```bash
git add artifacts/*/generated/web/*/index.jsx
git commit -m "refactor: migrate all single-entity windows to ListView + DetailView"
```

### Task 11: Remove old split-view components

**Files:**
- Remove: `tools/app-shell/src/components/contract-ui/MasterDetailPage.jsx`
- Remove: `tools/app-shell/src/components/contract-ui/SingleEntityPage.jsx`
- Modify: `tools/app-shell/src/components/contract-ui/index.js`

- [ ] **Step 1: Remove exports from index.js**

Remove these lines from `index.js`:
```js
export { MasterDetailPage } from './MasterDetailPage';
export { SingleEntityPage } from './SingleEntityPage';
```

- [ ] **Step 2: Delete the files**

```bash
rm tools/app-shell/src/components/contract-ui/MasterDetailPage.jsx
rm tools/app-shell/src/components/contract-ui/SingleEntityPage.jsx
```

- [ ] **Step 3: Verify no remaining imports**

```bash
grep -r "MasterDetailPage\|SingleEntityPage" tools/app-shell/src/ artifacts/
```

Should return zero results.

- [ ] **Step 4: Run tests**

```bash
cd tools/app-shell && node --test 'src/**/*.test.js'
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove MasterDetailPage and SingleEntityPage (replaced by ListView + DetailView)"
```

### Task 12: Verify build and manual smoke test

- [ ] **Step 1: Build the app**

```bash
cd tools/app-shell && npm run build
```

Should complete with zero errors.

- [ ] **Step 2: Run dev server and smoke test**

```bash
cd tools/app-shell && npm run dev
```

Manual checks:
1. Navigate to any window (e.g., `/sales-order`) — should show full-width table
2. Click a row — should navigate to `/sales-order/{id}` with full-page form
3. Click `← Orders` breadcrumb — should return to table
4. Click prev/next arrows — should navigate between records
5. Click `+ New` on table — should navigate to `/sales-order/new`
6. Verify form has 3 columns on desktop
7. Verify detail lines show below form (scroll down)

- [ ] **Step 3: Final commit with any fixes**

```bash
git add -A
git commit -m "fix: polish ListView + DetailView after smoke test"
```
