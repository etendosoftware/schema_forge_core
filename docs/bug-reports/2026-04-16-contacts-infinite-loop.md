# Bug Report: Contacts Window — Infinite Render/Fetch Loop on Open

**Date:** 2026-04-16
**Branch:** `feature/ETP-3788`
**Severity:** Critical (window unusable)
**Status:** Fixed
**Fixed in:** `tools/app-shell/src/windows/custom/contacts/ContactsTable.jsx`

---

## Summary

Opening the `/contacts` window triggers an infinite loop of API requests and component remounts. The browser tab freezes and the network tab shows endless requests to `/sws/neo/contacts/businessPartner`, `/sws/neo/contacts/locationAddress`, and `/sws/neo/contacts/contact`.

---

## Root Cause

`ContactsTable.jsx` defined its `columns` array **inside** the component using `useMemo`:

```js
// BROKEN — columns is recreated on every remount
export default function ContactsTable({ data = [], token, apiBaseUrl, ...rest }) {
  const columns = useMemo(() => [...], [gl]);
  ...
}
```

All generated table components (e.g. `BusinessPartnerTable`) define `columns` at **module level** — a stable reference that survives remounts:

```js
// CORRECT (generated pattern)
const columns = [...];  // module-level constant
export default function BusinessPartnerTable(props) { ... }
```

### The Loop Cycle

`ListView` conditionally renders the Table component only when `hook.loading === false`. Every call to `refresh()` in `useEntity` sets `loading = true` first, then `loading = false` after the fetch completes. This **unmounts and remounts** the Table on every refresh.

```
refresh() → setLoading(true) → Table UNMOUNTS
fetch completes → setLoading(false) → Table REMOUNTS
```

On every **remount** of `ContactsTable`, React discards all hook state. `useMemo([gl])` runs fresh and creates a **new array reference** for `columns`, even though the content is identical.

`DataTable` watches for column changes:

```js
// DataTable.jsx
useEffect(() => {
  if (onColumnsReady && columns.length > 0) {
    onColumnsReady(columns);  // fires again because columns is a new reference
  }
}, [columns, onColumnsReady]);
```

This fires `onColumnsReady(newColumnsRef)` on every remount, which calls `setTableColumns` in `ListView`. That propagates through:

```
setTableColumns(newRef)
  → tableColumns changes
    → columnDefs changes (useMemo recomputes)
      → refresh callback changes (useCallback dep changed)
        → useEffect([refresh]) fires
          → refresh() called
            → setLoading(true) → Table UNMOUNTS → ∞
```

### Why Only Contacts?

This window was the only one with a **custom table** that defined `columns` inside the component with `useMemo`. All other windows use generated tables with module-level column constants.

---

## Trigger Chain (Detailed)

| Step | What happens | Caused by |
|------|-------------|-----------|
| 1 | `ListView` mounts, `refresh()` called | `useEffect([refresh])` initial fire |
| 2 | `setLoading(true)` | First line of `refresh()` |
| 3 | `ContactsTable` **unmounts** | `ListView` shows `<Skeleton>` when `hook.loading` |
| 4 | Fetch completes, `setItems(rows)`, `setLoading(false)` | Async fetch resolves |
| 5 | `ContactsTable` **remounts** | `ListView` shows `<Table>` when `!hook.loading` |
| 6 | `useMemo([gl])` runs fresh → new `columns` reference | Component remounted, hooks reset |
| 7 | `DataTable.useEffect([columns])` fires | New `columns` reference detected |
| 8 | `onColumnsReady(newRef)` → `setTableColumns(newRef)` | Effect callback |
| 9 | `columnDefs` recomputed (new object) | `useMemo([tableColumns])` in `ListView` |
| 10 | `refresh` callback recreated | `useCallback([..., columnDefs, ...])` |
| 11 | `useEffect([refresh])` fires → `refresh()` called | New `refresh` reference |
| 12 | **Goto step 2** | ∞ |

---

## Fix Applied

Moved `columns` to module level and updated `TypeBadge` to resolve its own translations internally (no longer needs `t` as prop). Used `labels: { en_US, es_ES }` format which `DataTable` already supports for locale-aware column headers.

```diff
- import { useState, useEffect, useRef, useMemo } from 'react';
+ import { useState, useEffect, useRef } from 'react';
  import { DataTable } from '@/components/contract-ui';
  import { useLocale } from '@/i18n';

- function TypeBadge({ row, t }) {
+ function TypeBadge({ row }) {
+   const dictionary = useLocale();
+   const gl = dictionary?.genericLabels || {};
+   const t = (key) => gl[key] || key;
    ...
  }

+ const columns = [
+   { key: 'name', column: 'Name', type: 'string', labels: { en_US: 'Commercial Name', es_ES: 'Nombre comercial' } },
+   { key: '__type', type: 'string', labels: { en_US: 'Type', es_ES: 'Tipo' }, render: (row) => <TypeBadge row={row} /> },
+   { key: '__location', type: 'string', labels: { en_US: 'Location', es_ES: 'Ubicación' }, render: (row) => row.__location ?? '—' },
+   { key: '__phone', type: 'string', labels: { en_US: 'Phone', es_ES: 'Teléfono' }, render: (row) => row.__phone ?? '—' },
+   { key: '__email', type: 'string', labels: { en_US: 'Email', es_ES: 'Correo electrónico' }, render: (row) => row.__email ?? '—' },
+ ];

  export default function ContactsTable({ data = [], token, apiBaseUrl, ...rest }) {
-   const dictionary = useLocale();
-   const gl = dictionary?.genericLabels || {};
-   const t = (key) => gl[key] || key;
-
-   const columns = useMemo(() => [
-     { key: 'name', column: 'Name', type: 'string', label: t('commercialName') },
-     { key: '__type', type: 'string', label: t('typeColumn'), render: (row) => <TypeBadge row={row} t={t} /> },
-     ...
-   ], [gl]);
```

---

## Prevention Rule

**Any custom table component that renders inside `ListView` MUST define `columns` at module level**, not inside the component function. This is the pattern followed by all generated tables and must be maintained manually in custom tables.

```js
// ✅ Correct — module-level constant, survives remounts
const columns = [
  { key: 'foo', column: 'Foo', type: 'string', labels: { en_US: '...', es_ES: '...' } },
];
export default function MyTable(props) {
  return <DataTable columns={columns} {...props} />;
}

// ❌ Wrong — new reference on every remount → triggers onColumnsReady loop
export default function MyTable(props) {
  const columns = useMemo(() => [...], [deps]);
  return <DataTable columns={columns} {...props} />;
}
```

If columns need to react to locale, use `labels: { en_US, es_ES }` on the column definition and let `DataTable` handle locale selection via `useLocaleSwitch()`. If a `render` function needs translations, call `useLocale()` **inside the render subcomponent** (as `TypeBadge` now does).

---

## Related Code

| File | Role |
|------|------|
| `tools/app-shell/src/windows/custom/contacts/ContactsTable.jsx` | **Fixed** — columns moved to module level |
| `tools/app-shell/src/components/contract-ui/ListView.jsx` | Root of unmount/remount pattern (`hook.loading` toggle) |
| `tools/app-shell/src/components/contract-ui/DataTable.jsx` | `useEffect([columns, onColumnsReady])` — fires on column reference change |
| `tools/app-shell/src/hooks/useEntity.js` | `useEffect([refresh])` — fires when `columnDefs` changes |
