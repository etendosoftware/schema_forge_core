# Schema Inspector Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an inspector mode to the app-shell that lets functional users click fields, edit schema properties (visibility, required, grid, form, searchable), add/remove fields, and save changes that auto-regenerate the full pipeline (contract + frontend + HMR reload).

**Architecture:** Vite dev middleware exposes REST endpoints to read/write schema JSON files and trigger regeneration. A React context (`InspectorProvider`) holds the in-memory schema state with dirty tracking. When edit mode is active, fields get clickable highlight overlays that open a Sheet panel for editing properties. On save, the middleware writes the schema, regenerates the contract and frontend code, and Vite HMR handles the browser reload.

**Tech Stack:** React 18, Vite 6 plugin API, shadcn Sheet/Switch/Select/Dialog, existing CLI generators (`generate-contract.js`, `generate-frontend.js`).

---

### Task 1: Vite Schema API Plugin

**Files:**
- Create: `tools/app-shell/vite-plugins/schema-api.js`
- Modify: `tools/app-shell/vite.config.js:5-6` (add plugin import + usage)

**Step 1: Create the Vite plugin**

Create `tools/app-shell/vite-plugins/schema-api.js`:

```js
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ARTIFACTS_DIR = resolve(import.meta.dirname, '../../../artifacts');

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

export default function schemaApiPlugin() {
  return {
    name: 'schema-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/schema(-raw)?\/([a-z0-9-]+)$/);
        if (!match) return next();

        const isRaw = match[1] === '-raw';
        const window = match[2];
        const filename = isRaw ? 'schema-raw.json' : 'schema-curated.json';
        const filePath = resolve(ARTIFACTS_DIR, window, filename);

        if (req.method === 'GET') {
          if (!existsSync(filePath)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: `${filename} not found for ${window}` }));
            return;
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(readFileSync(filePath, 'utf-8'));
          return;
        }

        if (req.method === 'POST' && !isRaw) {
          try {
            const { schema } = await parseBody(req);
            const start = Date.now();

            // 1. Write schema-curated.json
            writeFileSync(filePath, JSON.stringify(schema, null, 2), 'utf-8');

            // 2. Generate contract
            const { generateContract } = await import(
              resolve(import.meta.dirname, '../../../cli/src/generate-contract.js')
            );
            const contract = generateContract(schema);
            const contractPath = resolve(ARTIFACTS_DIR, window, 'contract.json');
            writeFileSync(contractPath, JSON.stringify(contract, null, 2), 'utf-8');

            // 3. Generate frontend
            const { generateAll } = await import(
              resolve(import.meta.dirname, '../../../cli/src/generate-frontend.js')
            );
            const files = generateAll(contract);
            const outDir = resolve(ARTIFACTS_DIR, window, 'generated/web', window);
            mkdirSync(outDir, { recursive: true });
            for (const [fname, code] of Object.entries(files)) {
              writeFileSync(resolve(outDir, fname), code, 'utf-8');
            }

            const duration = ((Date.now() - start) / 1000).toFixed(1);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, regenerated: true, duration: `${duration}s`, files: Object.keys(files) }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        next();
      });
    },
  };
}
```

**Step 2: Register the plugin in vite.config.js**

Modify `tools/app-shell/vite.config.js` to import and use the plugin:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import schemaApiPlugin from './vite-plugins/schema-api.js';

export default defineConfig({
  base: './',
  plugins: [react(), schemaApiPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@generated': resolve(__dirname, '../../artifacts'),
    },
  },
  server: {
    port: 3100,
    proxy: {
      '/etendo_sf': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
```

**Step 3: Verify the plugin works**

Run: `cd tools/app-shell && npm run dev`

In another terminal, test:
```bash
curl http://localhost:3100/api/schema/sales-order | head -c 200
```
Expected: JSON output starting with `{"version":"0.1.0","window":{...`

**Step 4: Commit**

```bash
git add tools/app-shell/vite-plugins/schema-api.js tools/app-shell/vite.config.js
git commit -m "feat: add Vite schema API plugin for inspector read/write/regenerate"
```

---

### Task 2: InspectorProvider Context

**Files:**
- Create: `tools/app-shell/src/components/inspector/InspectorProvider.jsx`

**Step 1: Create the provider**

Create `tools/app-shell/src/components/inspector/InspectorProvider.jsx`:

```jsx
import { createContext, useContext, useState, useCallback } from 'react';

const InspectorContext = createContext(null);

export function useInspector() {
  return useContext(InspectorContext);
}

export function InspectorProvider({ children }) {
  const [editMode, setEditMode] = useState(false);
  const [schema, setSchema] = useState(null);
  const [schemaRaw, setSchemaRaw] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedField, setSelectedField] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [windowSlug, setWindowSlug] = useState(null);

  const loadSchema = useCallback(async (slug) => {
    setWindowSlug(slug);
    const [schemaRes, rawRes] = await Promise.all([
      fetch(`/api/schema/${slug}`),
      fetch(`/api/schema-raw/${slug}`).catch(() => null),
    ]);
    if (schemaRes.ok) {
      setSchema(await schemaRes.json());
    }
    if (rawRes?.ok) {
      setSchemaRaw(await rawRes.json());
    }
    setDirty(false);
  }, []);

  const updateField = useCallback((entityName, fieldName, updates) => {
    setSchema(prev => {
      const next = structuredClone(prev);
      const entity = next.entities.find(e => e.name === entityName);
      if (!entity) return prev;
      const field = entity.fields.find(f => f.name === fieldName);
      if (!field) return prev;
      Object.assign(field, updates);
      return next;
    });
    setDirty(true);
  }, []);

  const removeField = useCallback((entityName, fieldName) => {
    setSchema(prev => {
      const next = structuredClone(prev);
      const entity = next.entities.find(e => e.name === entityName);
      if (!entity) return prev;
      entity.fields = entity.fields.filter(f => f.name !== fieldName);
      return next;
    });
    setDirty(true);
  }, []);

  const addField = useCallback((entityName, field) => {
    setSchema(prev => {
      const next = structuredClone(prev);
      const entity = next.entities.find(e => e.name === entityName);
      if (!entity) return prev;
      entity.fields.push(field);
      return next;
    });
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    if (!windowSlug || !schema) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/schema/${windowSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema }),
      });
      const result = await res.json();
      if (result.ok) {
        setDirty(false);
      }
      return result;
    } finally {
      setSaving(false);
    }
  }, [windowSlug, schema]);

  const selectField = useCallback((entityName, fieldName) => {
    setSelectedEntity(entityName);
    setSelectedField(fieldName);
  }, []);

  const value = {
    editMode,
    setEditMode,
    schema,
    schemaRaw,
    dirty,
    saving,
    selectedField,
    selectedEntity,
    windowSlug,
    loadSchema,
    updateField,
    removeField,
    addField,
    save,
    selectField,
  };

  return (
    <InspectorContext.Provider value={value}>
      {children}
    </InspectorContext.Provider>
  );
}
```

**Step 2: Commit**

```bash
git add tools/app-shell/src/components/inspector/InspectorProvider.jsx
git commit -m "feat: add InspectorProvider context with schema state and dirty tracking"
```

---

### Task 3: SchemaInspector Panel

**Files:**
- Create: `tools/app-shell/src/components/inspector/SchemaInspector.jsx`

**Step 1: Create the inspector Sheet panel**

Create `tools/app-shell/src/components/inspector/SchemaInspector.jsx`:

```jsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { Trash2 } from 'lucide-react';
import { useInspector } from './InspectorProvider.jsx';

export function SchemaInspector() {
  const { schema, selectedField, selectedEntity, selectField, updateField, removeField } = useInspector();

  if (!schema || !selectedField || !selectedEntity) return null;

  const entity = schema.entities.find(e => e.name === selectedEntity);
  const field = entity?.fields.find(f => f.name === selectedField);

  if (!field) return null;

  const handleClose = () => selectField(null, null);

  return (
    <Sheet open={!!selectedField} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <SheetContent className="w-80 sm:w-96">
        <SheetHeader>
          <SheetTitle>{field.name}</SheetTitle>
          <SheetDescription>
            {field.column} &middot; {selectedEntity}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <div className="space-y-2">
            <Label htmlFor="visibility">Visibility</Label>
            <Select
              value={field.visibility}
              onValueChange={(v) => updateField(selectedEntity, selectedField, { visibility: v })}
            >
              <SelectTrigger id="visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editable">Editable</SelectItem>
                <SelectItem value="readOnly">Read Only</SelectItem>
                <SelectItem value="discarded">Discarded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Label htmlFor="required">Required</Label>
            <Switch
              id="required"
              checked={field.required ?? false}
              onCheckedChange={(v) => updateField(selectedEntity, selectedField, { required: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="grid">Show in Grid</Label>
            <Switch
              id="grid"
              checked={field.grid ?? false}
              onCheckedChange={(v) => updateField(selectedEntity, selectedField, { grid: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="form">Show in Form</Label>
            <Switch
              id="form"
              checked={field.form ?? false}
              onCheckedChange={(v) => updateField(selectedEntity, selectedField, { form: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="searchable">Searchable</Label>
            <Switch
              id="searchable"
              checked={field.searchable ?? false}
              onCheckedChange={(v) => updateField(selectedEntity, selectedField, { searchable: v })}
            />
          </div>

          <Separator />

          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => {
              removeField(selectedEntity, selectedField);
              handleClose();
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove Field
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 2: Verify Switch component exists**

Check: `ls tools/app-shell/src/components/ui/switch.jsx`

If missing, install via shadcn:
```bash
cd tools/app-shell && npx shadcn@latest add switch
```

**Step 3: Commit**

```bash
git add tools/app-shell/src/components/inspector/SchemaInspector.jsx
git commit -m "feat: add SchemaInspector Sheet panel with field property editors"
```

---

### Task 4: AddFieldDialog

**Files:**
- Create: `tools/app-shell/src/components/inspector/AddFieldDialog.jsx`

**Step 1: Create the dialog**

Create `tools/app-shell/src/components/inspector/AddFieldDialog.jsx`:

```jsx
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Search, Plus } from 'lucide-react';
import { useInspector } from './InspectorProvider.jsx';

export function AddFieldDialog({ open, onOpenChange, entityName }) {
  const { schema, schemaRaw, addField } = useInspector();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [visibility, setVisibility] = useState('editable');
  const [required, setRequired] = useState(false);
  const [grid, setGrid] = useState(false);
  const [form, setForm] = useState(true);
  const [searchable, setSearchable] = useState(false);

  const availableFields = useMemo(() => {
    if (!schemaRaw || !schema) return [];
    const rawEntity = schemaRaw.entities?.find(e => e.name === entityName);
    const curatedEntity = schema.entities?.find(e => e.name === entityName);
    if (!rawEntity) return [];
    const existingNames = new Set(curatedEntity?.fields.map(f => f.name) ?? []);
    return rawEntity.fields.filter(f => !existingNames.has(f.name));
  }, [schemaRaw, schema, entityName]);

  const filtered = useMemo(() => {
    if (!query) return availableFields;
    const q = query.toLowerCase();
    return availableFields.filter(f =>
      f.name.toLowerCase().includes(q) || f.column.toLowerCase().includes(q)
    );
  }, [availableFields, query]);

  const handleAdd = () => {
    if (!selected) return;
    addField(entityName, {
      ...selected,
      visibility,
      required,
      grid,
      form,
      searchable,
    });
    setSelected(null);
    setQuery('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Field</DialogTitle>
          <DialogDescription>
            Select a field from the raw schema to add to {entityName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search fields..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="max-h-48 overflow-auto border rounded-md">
            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">No available fields</p>
            ) : (
              filtered.map(f => (
                <button
                  key={f.name}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b last:border-b-0 ${
                    selected?.name === f.name ? 'bg-primary/10' : ''
                  }`}
                  onClick={() => setSelected(f)}
                >
                  <span className="font-medium">{f.name}</span>
                  <span className="text-muted-foreground ml-2">{f.column} &middot; {f.type}</span>
                </button>
              ))
            )}
          </div>

          {selected && (
            <>
              <div className="space-y-3 border rounded-md p-3">
                <p className="text-sm font-medium">Configure: {selected.name}</p>

                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <Select value={visibility} onValueChange={setVisibility}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editable">Editable</SelectItem>
                      <SelectItem value="readOnly">Read Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Required</Label>
                  <Switch checked={required} onCheckedChange={setRequired} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Grid</Label>
                  <Switch checked={grid} onCheckedChange={setGrid} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Form</Label>
                  <Switch checked={form} onCheckedChange={setForm} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Searchable</Label>
                  <Switch checked={searchable} onCheckedChange={setSearchable} />
                </div>
              </div>

              <Button onClick={handleAdd} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add {selected.name}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add tools/app-shell/src/components/inspector/AddFieldDialog.jsx
git commit -m "feat: add AddFieldDialog for adding raw schema fields to curated"
```

---

### Task 5: TopBar Edit Mode Toggle + Save Button

**Files:**
- Modify: `tools/app-shell/src/layout/TopBar.jsx`

**Step 1: Add edit mode toggle and save button**

Replace `tools/app-shell/src/layout/TopBar.jsx` with:

```jsx
import { Pencil, PencilOff, Save, Loader2 } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { useInspector } from '@/components/inspector/InspectorProvider.jsx';

export default function TopBar() {
  const inspector = useInspector();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      {inspector?.editMode && (
        <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
          Edit Mode
        </Badge>
      )}

      <div className="flex-1" />

      {inspector?.editMode && inspector.dirty && (
        <Button
          size="sm"
          onClick={inspector.save}
          disabled={inspector.saving}
        >
          {inspector.saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save & Regenerate
        </Button>
      )}

      {inspector && (
        <Button
          variant={inspector.editMode ? 'default' : 'outline'}
          size="icon"
          onClick={() => inspector.setEditMode(!inspector.editMode)}
        >
          {inspector.editMode ? (
            <PencilOff className="h-4 w-4" />
          ) : (
            <Pencil className="h-4 w-4" />
          )}
          <span className="sr-only">Toggle edit mode</span>
        </Button>
      )}
    </header>
  );
}
```

**Step 2: Commit**

```bash
git add tools/app-shell/src/layout/TopBar.jsx
git commit -m "feat: add edit mode toggle and save button to TopBar"
```

---

### Task 6: Wire InspectorProvider + SchemaInspector into App

**Files:**
- Modify: `tools/app-shell/src/layout/AppLayout.jsx`
- Modify: `tools/app-shell/src/windows/WindowLoader.jsx`

**Step 1: Wrap AppLayout with InspectorProvider and add SchemaInspector**

Modify `tools/app-shell/src/layout/AppLayout.jsx`:

```jsx
import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar.jsx';
import AppSidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';
import { CopilotWidget } from '@/components/CopilotWidget.jsx';
import { InspectorProvider } from '@/components/inspector/InspectorProvider.jsx';
import { SchemaInspector } from '@/components/inspector/SchemaInspector.jsx';

export default function AppLayout({ menuGroups }) {
  return (
    <InspectorProvider>
      <SidebarProvider>
        <AppSidebar menuGroups={menuGroups} />
        <SidebarInset>
          <TopBar />
          <div className="flex-1 overflow-auto p-6">
            <Outlet />
          </div>
        </SidebarInset>
        <CopilotWidget />
        <SchemaInspector />
      </SidebarProvider>
    </InspectorProvider>
  );
}
```

**Step 2: Load schema when navigating to a window**

Modify `tools/app-shell/src/windows/WindowLoader.jsx` — add schema loading on mount:

```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext.jsx';
import { useInspector } from '@/components/inspector/InspectorProvider.jsx';

export default function WindowLoader({ windowMap, apiBaseUrl }) {
  const { windowName } = useParams();
  const { token } = useAuth();
  const inspector = useInspector();
  const [Component, setComponent] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (inspector && windowName) {
      inspector.loadSchema(windowName);
    }
  }, [windowName, inspector]);

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
    />
  );
}
```

**Step 3: Commit**

```bash
git add tools/app-shell/src/layout/AppLayout.jsx tools/app-shell/src/windows/WindowLoader.jsx
git commit -m "feat: wire InspectorProvider and SchemaInspector into app layout"
```

---

### Task 7: FieldHighlight Overlay + Integration with DataTable and EntityForm

**Files:**
- Create: `tools/app-shell/src/components/inspector/FieldHighlight.jsx`
- Modify: `tools/app-shell/src/components/contract-ui/DataTable.jsx` (wrap column headers)
- Modify: `tools/app-shell/src/components/contract-ui/EntityForm.jsx` (wrap form fields)

**Step 1: Create the FieldHighlight wrapper**

Create `tools/app-shell/src/components/inspector/FieldHighlight.jsx`:

```jsx
import { useInspector } from './InspectorProvider.jsx';

export function FieldHighlight({ entityName, fieldName, children }) {
  const inspector = useInspector();

  if (!inspector?.editMode) {
    return children;
  }

  const isSelected = inspector.selectedField === fieldName && inspector.selectedEntity === entityName;

  return (
    <div
      className={`relative cursor-pointer rounded transition-all ${
        isSelected
          ? 'ring-2 ring-primary ring-offset-1'
          : 'hover:ring-2 hover:ring-primary/40 hover:ring-offset-1'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        inspector.selectField(entityName, fieldName);
      }}
    >
      {children}
    </div>
  );
}
```

**Step 2: Integrate into DataTable**

In `tools/app-shell/src/components/contract-ui/DataTable.jsx`, add the import at the top:

```jsx
import { FieldHighlight } from '@/components/inspector/FieldHighlight.jsx';
```

Then wrap each `<TableHead>` element in the header row with `<FieldHighlight>`. Find the section that maps `columns` to `<TableHead>` elements and wrap each one:

```jsx
{columns.map(col => (
  <TableHead key={col.key} className={col.type === 'amount' ? 'text-right' : ''}>
    <FieldHighlight entityName={entity} fieldName={col.key}>
      {col.label}
    </FieldHighlight>
  </TableHead>
))}
```

Note: The `entity` prop name must be identified from the DataTable component's props. Check the actual prop name used — it may be passed via props from the parent `MasterDetailPage`.

**Step 3: Integrate into EntityForm**

In `tools/app-shell/src/components/contract-ui/EntityForm.jsx`, add the import:

```jsx
import { FieldHighlight } from '@/components/inspector/FieldHighlight.jsx';
```

Wrap each field's label+input group with `<FieldHighlight>`. Find the section that maps `fields` to form elements and wrap each one:

```jsx
<FieldHighlight entityName={entity} fieldName={field.key}>
  <div className="space-y-2">
    <Label htmlFor={field.key}>{field.label}</Label>
    {/* existing input rendering */}
  </div>
</FieldHighlight>
```

Note: The entity name must be available. Check if DataTable/EntityForm receive an `entity` prop. If not, it can be passed through from `MasterDetailPage` which already has the `entity` prop.

**Step 4: Commit**

```bash
git add tools/app-shell/src/components/inspector/FieldHighlight.jsx \
  tools/app-shell/src/components/contract-ui/DataTable.jsx \
  tools/app-shell/src/components/contract-ui/EntityForm.jsx
git commit -m "feat: add FieldHighlight overlay and integrate with DataTable and EntityForm"
```

---

### Task 8: Add Field Button in Inspector Panel

**Files:**
- Modify: `tools/app-shell/src/components/inspector/SchemaInspector.jsx`

**Step 1: Add the "Add Field" button that opens AddFieldDialog**

Update `SchemaInspector.jsx` to include an "Add Field" button at the bottom of the Sheet and render `AddFieldDialog`:

Add import at top:
```jsx
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { AddFieldDialog } from './AddFieldDialog.jsx';
```

Add state and dialog inside the component:
```jsx
const [addDialogOpen, setAddDialogOpen] = useState(false);
```

After the "Remove Field" button, add:
```jsx
<Button
  variant="outline"
  size="sm"
  className="w-full"
  onClick={() => setAddDialogOpen(true)}
>
  <Plus className="h-4 w-4 mr-2" />
  Add Field
</Button>

<AddFieldDialog
  open={addDialogOpen}
  onOpenChange={setAddDialogOpen}
  entityName={selectedEntity}
/>
```

**Step 2: Commit**

```bash
git add tools/app-shell/src/components/inspector/SchemaInspector.jsx
git commit -m "feat: add 'Add Field' button to inspector panel with dialog"
```

---

### Task 9: Install Missing shadcn Components (if needed)

**Step 1: Check and install Switch component**

Run: `ls tools/app-shell/src/components/ui/switch.jsx`

If missing:
```bash
cd tools/app-shell && npx shadcn@latest add switch
```

**Step 2: Check and install Dialog component**

Run: `ls tools/app-shell/src/components/ui/dialog.jsx`

If missing:
```bash
cd tools/app-shell && npx shadcn@latest add dialog
```

**Step 3: Commit any new shadcn components**

```bash
git add tools/app-shell/src/components/ui/
git commit -m "chore: add missing shadcn components (switch, dialog)"
```

---

### Task 10: End-to-End Smoke Test

**Step 1: Start dev server**

```bash
cd tools/app-shell && VITE_MOCK=true npm run dev
```

**Step 2: Manual test checklist**

1. Open `http://localhost:3100` and navigate to Sales Order
2. Click the Pencil icon in TopBar — "Edit Mode" badge should appear
3. Click on a field in the grid (e.g. "Business Partner" column header) — Sheet should open
4. Change visibility from "editable" to "readOnly" — note the change
5. Toggle "Grid" off — note the change
6. Click "Save & Regenerate" — should POST to API, regenerate files, and page should hot-reload
7. Verify the field change is reflected in the regenerated UI
8. Click "Add Field" — dialog should show fields from schema-raw not in curated
9. Select a field, configure, add — field should appear in schema
10. Save again — verify regeneration

**Step 3: Test API endpoint directly**

```bash
# Read schema
curl -s http://localhost:3100/api/schema/sales-order | python3 -m json.tool | head -20

# Read raw schema
curl -s http://localhost:3100/api/schema-raw/sales-order | python3 -m json.tool | head -20
```

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address smoke test findings for schema inspector"
```

---

### Task 11: Create index.js barrel export

**Files:**
- Create: `tools/app-shell/src/components/inspector/index.js`

**Step 1: Create barrel export**

```js
export { InspectorProvider, useInspector } from './InspectorProvider.jsx';
export { SchemaInspector } from './SchemaInspector.jsx';
export { FieldHighlight } from './FieldHighlight.jsx';
export { AddFieldDialog } from './AddFieldDialog.jsx';
```

**Step 2: Commit**

```bash
git add tools/app-shell/src/components/inspector/index.js
git commit -m "chore: add barrel export for inspector components"
```
