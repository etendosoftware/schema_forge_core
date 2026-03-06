# useEntity Hook + UI Layer Separation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract all data fetching and CRUD state into a fixed `useEntity` hook so the UI generator only produces visual components.

**Architecture:** A `useEntity(entity, childEntity, { token, apiBaseUrl })` hook in the app shell owns all fetch/CRUD/process logic. The generator's `generatePageComponent` is updated to import and call this hook instead of inlining state management. Table and Form generators stay unchanged (already pure props).

**Tech Stack:** React hooks, Vite `@/` alias, Node.js `node:test`

---

### Task 1: Create useEntity Hook (PARALLEL — independent)

**Files:**
- Create: `tools/app-shell/src/hooks/useEntity.js`

**Context:** This hook lives in the app shell (fixed, never regenerated). It encapsulates all data fetching, CRUD operations, and state management that the current `OrderPage.jsx` does inline. The app shell already has `@/` alias pointing to `tools/app-shell/src/`. The auth module provides tokens via `useAuth()` from `@/auth/AuthContext.jsx`. The hook receives `token` and `apiBaseUrl` as options — it does NOT call `useAuth()` itself.

The generated components (`OrderPage.jsx`, etc.) will consume this hook. The hook must match the return signature from the design doc exactly.

**Step 1: Create the hook**

Create `tools/app-shell/src/hooks/useEntity.js`:

```javascript
import { useState, useEffect, useCallback } from 'react';

function buildHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export function useEntity(entity, childEntity, { token, apiBaseUrl }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);

  const headers = buildHeaders(token);

  const refresh = useCallback(() => {
    setLoading(true);
    fetch(`${apiBaseUrl}/${entity}`, { headers })
      .then(res => res.json())
      .then(data => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [apiBaseUrl, entity, token]);

  useEffect(() => { refresh(); }, [refresh]);

  const fetchChildren = useCallback((parentId) => {
    if (!childEntity || !parentId) { setChildren([]); return; }
    fetch(`${apiBaseUrl}/${entity}/${parentId}/${childEntity}`, { headers })
      .then(res => res.json())
      .then(setChildren)
      .catch(() => setChildren([]));
  }, [apiBaseUrl, entity, childEntity, token]);

  const handleSelect = useCallback((row) => {
    setSelected(row);
    setEditing({ ...row });
    fetchChildren(row?.id);
  }, [fetchChildren]);

  const handleNew = useCallback(() => {
    setSelected(null);
    setEditing({});
  }, []);

  const handleChange = useCallback((field, value) => {
    setEditing(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!editing) return;
    const isNew = !editing.id;
    const url = isNew ? `${apiBaseUrl}/${entity}` : `${apiBaseUrl}/${entity}/${editing.id}`;
    const method = isNew ? 'POST' : 'PUT';
    try {
      const res = await fetch(url, { method, headers, body: JSON.stringify(editing) });
      if (res.ok) {
        const saved = await res.json();
        setSelected(saved);
        setEditing({ ...saved });
        refresh();
      }
    } catch { /* caller handles */ }
  }, [editing, apiBaseUrl, entity, token, refresh]);

  const handleDelete = useCallback(async () => {
    if (!selected?.id) return;
    try {
      await fetch(`${apiBaseUrl}/${entity}/${selected.id}`, { method: 'DELETE', headers });
      setSelected(null);
      setEditing(null);
      setChildren([]);
      refresh();
    } catch { /* caller handles */ }
  }, [selected, apiBaseUrl, entity, token, refresh]);

  const handleProcess = useCallback(async (processName) => {
    if (!selected?.id) return;
    await fetch(`${apiBaseUrl}/process/${processName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: selected.id }),
    });
    refresh();
  }, [selected, apiBaseUrl, token, refresh]);

  return {
    items, selected, editing, children, loading,
    handleSelect, handleNew, handleChange, handleSave, handleDelete, handleProcess,
    refresh,
  };
}
```

**Step 2: Verify it compiles with the app shell**

Run: `cd tools/app-shell && npx vite build 2>&1 | tail -5`
Expected: Build succeeds (hook is tree-shaken since nothing imports it yet, but no syntax errors).

**Step 3: Commit**

```bash
git add tools/app-shell/src/hooks/useEntity.js
git commit -m "feat: add useEntity hook for entity CRUD state management"
```

---

### Task 2: Update Generator to Produce Hook-Based PageComponent (PARALLEL — independent)

**Files:**
- Modify: `cli/src/generate-frontend.js` (function `generatePageComponent` at line 180)
- Modify: `cli/test/generate-frontend.test.js` (update `generatePageComponent` tests)

**Context:** The `generatePageComponent` function currently generates inline `useState`, `useEffect`, and `fetch` calls. It needs to instead generate code that imports `useEntity` from `@/hooks/useEntity` and delegates all data/state logic to it. The Table and Form generators (`generateTableComponent`, `generateFormComponent`) stay unchanged — they already accept pure data props.

The generated PageComponent signature stays `{ token, apiBaseUrl }` (passed by `WindowLoader.jsx`). The hook call is: `useEntity('entityName', 'childEntityName', { token, apiBaseUrl })`.

**Important:** The existing `OrderForm` component signature is `{ data, onChange, onSave, onProcess }`. The hook returns `{ editing, handleChange, handleSave, handleProcess }`. The generated page must bridge these: `<OrderForm data={order.editing} onChange={order.handleChange} onSave={order.handleSave} onProcess={order.handleProcess} />`.

**Step 1: Update the test expectations**

Edit `cli/test/generate-frontend.test.js`, replace the `generatePageComponent` describe block:

```javascript
describe('generatePageComponent', () => {
  it('generates header-detail layout with useEntity hook', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes('export default function OrderPage'), 'should export OrderPage');
    assert.ok(code.includes('OrderTable'), 'should include header table');
    assert.ok(code.includes('OrderForm'), 'should include header form');
    assert.ok(code.includes('OrderLineTable'), 'should include detail table');
  });

  it('imports useEntity from @/hooks/useEntity', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes("from '@/hooks/useEntity'"), 'should import useEntity');
  });

  it('calls useEntity with correct entity names', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes("useEntity('order', 'orderLine'"), 'should call useEntity with entity names');
  });

  it('does NOT contain inline useState or fetch', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(!code.includes('useState'), 'should not have useState (hook handles state)');
    assert.ok(!code.includes('fetch('), 'should not have fetch calls (hook handles fetching)');
  });

  it('passes hook properties to child components', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes('.items'), 'should pass items to table');
    assert.ok(code.includes('.editing'), 'should pass editing to form');
    assert.ok(code.includes('.handleSelect'), 'should pass handleSelect');
    assert.ok(code.includes('.handleChange'), 'should pass handleChange');
    assert.ok(code.includes('.handleSave'), 'should pass handleSave');
    assert.ok(code.includes('.handleProcess'), 'should pass handleProcess');
    assert.ok(code.includes('.children'), 'should pass children to detail table');
  });

  it('includes New and Delete buttons', () => {
    const code = generatePageComponent('order', 'orderLine', sampleContract);
    assert.ok(code.includes('.handleNew'), 'should wire handleNew');
    assert.ok(code.includes('.handleDelete'), 'should wire handleDelete');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd cli && node --test test/generate-frontend.test.js 2>&1 | tail -10`
Expected: New tests FAIL (current generator produces inline state, not useEntity).

**Step 3: Update generatePageComponent**

Replace the `generatePageComponent` function in `cli/src/generate-frontend.js` (starting at line 180):

```javascript
export function generatePageComponent(headerEntity, detailEntity, contract) {
  const headerName = capitalize(headerEntity);
  const detailName = capitalize(detailEntity);
  const compName = `${headerName}Page`;

  return `import React from 'react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useEntity } from '@/hooks/useEntity';
import ${headerName}Table from './${headerName}Table';
import ${headerName}Form from './${headerName}Form';
import ${detailName}Table from './${detailName}Table';

export default function ${compName}({ token, apiBaseUrl }) {
  const ${headerEntity} = useEntity('${headerEntity}', '${detailEntity}', { token, apiBaseUrl });

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">${toLabel(headerEntity)}</h2>
        <div className="flex gap-2">
          <Button onClick={${headerEntity}.handleNew}>New</Button>
          {${headerEntity}.selected && (
            <Button variant="outline" onClick={${headerEntity}.handleDelete}>Delete</Button>
          )}
        </div>
      </div>
      <${headerName}Table data={${headerEntity}.items} onRowSelect={${headerEntity}.handleSelect} />
      {${headerEntity}.editing && (
        <>
          <Separator />
          <${headerName}Form
            data={${headerEntity}.editing}
            onChange={${headerEntity}.handleChange}
            onSave={${headerEntity}.handleSave}
            onProcess={${headerEntity}.handleProcess}
          />
          <Separator />
          <h3 className="text-lg font-medium">${toLabel(detailEntity)}</h3>
          <${detailName}Table data={${headerEntity}.children} />
        </>
      )}
    </div>
  );
}
`;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd cli && node --test test/generate-frontend.test.js 2>&1 | tail -10`
Expected: ALL tests pass. The existing Table/Form tests should still pass (unchanged). The Page tests should now pass with the new hook-based output.

**Step 5: Commit**

```bash
git add cli/src/generate-frontend.js cli/test/generate-frontend.test.js
git commit -m "feat: update generatePageComponent to use useEntity hook instead of inline state"
```

---

### Task 3: Regenerate Sales Order Components (SEQUENTIAL — depends on Tasks 1+2)

**Files:**
- Overwrite: `artifacts/sales-order/generated/web/sales-order/OrderPage.jsx`
- Verify: `artifacts/sales-order/generated/web/sales-order/OrderTable.jsx` (unchanged)
- Verify: `artifacts/sales-order/generated/web/sales-order/OrderForm.jsx` (unchanged)
- Verify: `artifacts/sales-order/generated/web/sales-order/OrderLineTable.jsx` (unchanged)

**Context:** Now that the generator produces hook-based code and the hook exists in the app shell, we regenerate the Sales Order components. The CLI entry point is: `node cli/src/generate-frontend.js artifacts/sales-order/contract.json`. This reads the contract and writes all generated files to `artifacts/sales-order/generated/web/sales-order/`.

Only `OrderPage.jsx` should change (it now uses `useEntity`). The Table and Form components remain the same since their generators weren't modified.

**Step 1: Regenerate**

Run: `node cli/src/generate-frontend.js artifacts/sales-order/contract.json`
Expected: Output shows files written to `artifacts/sales-order/generated/web/sales-order/`.

**Step 2: Verify OrderPage.jsx uses the hook**

Run: `head -15 artifacts/sales-order/generated/web/sales-order/OrderPage.jsx`
Expected: Should show `import { useEntity } from '@/hooks/useEntity'` and `const order = useEntity('order', 'orderLine'...`.

**Step 3: Verify app shell builds**

Run: `cd tools/app-shell && npx vite build 2>&1 | tail -5`
Expected: Build succeeds. The generated `OrderPage.jsx` imports `useEntity` from `@/hooks/useEntity` which resolves via the `@` Vite alias.

**Step 4: Run all tests**

Run: `cd cli && node --test 'test/*.test.js' 2>&1 | tail -15`
Expected: All tests pass (generate-frontend + any other test suites).

**Step 5: Commit**

```bash
git add artifacts/sales-order/generated/web/sales-order/
git commit -m "feat: regenerate Sales Order UI with useEntity hook"
```
