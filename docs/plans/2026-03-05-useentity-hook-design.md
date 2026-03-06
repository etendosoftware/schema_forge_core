# useEntity Hook + UI Layer Separation — Design

> Approved design for separating the generated UI into fixed hook/API layers and a regenerable visual layer.

## What

Extract all data fetching, CRUD operations, and state management into a fixed `useEntity` hook in the app shell. The UI generator only produces visual components that consume the hook. Regenerating the UI never touches data logic.

## Architecture

```
tools/app-shell/src/hooks/useEntity.js     ← FIXED, never regenerated
tools/app-shell/src/lib/api.js             ← FIXED (already exists)
artifacts/.../generated/web/sales-order/   ← GENERATED, only visual UI
```

## useEntity Hook (`tools/app-shell/src/hooks/useEntity.js`)

```javascript
export function useEntity(entity, childEntity, { token, apiBaseUrl })
```

### Returns

| Property | Type | Description |
|---|---|---|
| items | array | List of entity records |
| selected | object/null | Currently selected record |
| editing | object/null | Record being edited (copy of selected, or empty for new) |
| children | array | Child records for selected parent |
| loading | boolean | Fetch in progress |
| handleSelect | (row) => void | Select row, load children |
| handleNew | () => void | Clear form for new record |
| handleChange | (field, value) => void | Update field in editing |
| handleSave | () => Promise | POST (new) or PUT (existing) |
| handleDelete | () => Promise | DELETE selected record |
| handleProcess | (processName) => Promise | Execute process on selected |
| refresh | () => void | Reload items list |

### Internal behavior

- Uses `buildHeaders(token)` from existing `api.js` for auth
- Builds URLs: `${apiBaseUrl}/${entity}`, `${apiBaseUrl}/${entity}/${id}/${childEntity}`
- `handleSave`: POST if no `editing.id`, PUT otherwise. Refreshes list after.
- `handleProcess`: POST to `${apiBaseUrl}/process/${processName}` with `{ id: selected.id }`. Refreshes after.
- `handleSelect`: sets selected + editing copy, fetches children if childEntity provided
- `handleNew`: sets editing to `{}`, clears selected

## Generated UI (what changes)

The generator produces visual-only components that consume useEntity:

```jsx
// OrderPage.jsx — GENERATED
import { useEntity } from '@/hooks/useEntity';

export default function OrderPage({ token, apiBaseUrl }) {
  const order = useEntity('order', 'orderLine', { token, apiBaseUrl });
  // Only JSX here — no fetch, no state management
}
```

OrderTable, OrderForm, OrderLineTable remain pure visual (already are).

## Generator Changes

- `generatePageComponent` in `cli/src/generate-frontend.js`: import and call `useEntity()` instead of inline fetch/useState
- Table and Form generators: no changes needed (already pure UI props)

## YAGNI — Not Included

- No cache or optimistic updates
- No pagination in hook
- No retry or error state
- No generic form validation
