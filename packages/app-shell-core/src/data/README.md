# Shared client-side data cache (`@etendosoftware/app-shell-core/data`)

Cross-cutting, application-level cache for records and previously loaded
data. Owned by `app-shell-core` — **not** by any consumer window or entity
(SEC T-01).

## What it provides

- **Request deduplication** — concurrent reads of the same key share one request.
- **Freshness windows** — a fresh entry is reused without a network call.
- **Forced refresh** — bypass freshness on demand.
- **Targeted invalidation** — mark matching record / list / child keys stale.
- **Session isolation** — cache is cleared when session, role or org changes,
  and keys are isolated per auth / org / role so data cannot leak across contexts.
- **Memory-only** — cached business data is never written to `localStorage` /
  `sessionStorage`.

## Public API

```js
import {
  DataProvider,      // provider — owns the cache, enforces session isolation
  useQuery,          // hook — read a cached resource (alias: useCachedResource)
  useDataCache,      // hook — access the raw cache + scope
  createQueryCache,  // framework-agnostic cache factory
  createQueryKey,    // build an isolated query key
  matchesQueryKey,   // partial match for invalidation
} from '@etendosoftware/app-shell-core/data';
```

### Composition

`DataProvider` is already composed inside `AppShellRuntime` (between
`AuthProvider` and `CurrencyProvider`). Configure it via the runtime's
`data` prop:

```jsx
<AppShellRuntime
  data={{ apiBase: '/sws/neo', recordStaleTime: 30_000, catalogStaleTime: 300_000 }}
  /* ...auth, routes, etc. */
/>
```

If you compose providers manually, place it inside `AuthProvider`:

```jsx
<AuthProvider>
  <DataProvider apiBase="/sws/neo">
    <App />
  </DataProvider>
</AuthProvider>
```

### Reading data

```js
const { data, isLoading, error, refetch, invalidate } = useQuery({
  entity: 'Contact',
  recordId: id,
  fetcher: ({ signal }) => api.get(`/Contact/${id}`, { signal }),
  // kind: 'record' | 'list' | 'catalog'  → picks the freshness policy
});
```

- Lists: `useQuery({ entity: 'Contact', filters, kind: 'list', fetcher })`
- Child collections: pass `parentId`.
- Stable catalogs / selectors: `kind: 'catalog'` (longer stale time).

`refetch()` forces a fresh request; `invalidate(pattern)` marks matching
entries stale (defaults to the current key).

## Query keys

Keys isolate by: `auth`, `client`, `role`, `org`, `apiBase`, `spec`,
`entity`, `filters`, `parentId`, `recordId`. Filter order is irrelevant —
serialization is canonical.

## Freshness policy

| kind             | default stale time  |
| ---------------- | ------------------- |
| `record` / `list`| `recordStaleTime` (30s) |
| `catalog`        | `catalogStaleTime` (5min) |

Override per call with `staleTime`, or globally via `DataProvider` props.

## Consumer migration path

This task (SEC T-01 1/3) only adds the capability. Migrating consumers is
tracked separately:

1. **1/3 (this)** — provider + primitives in `app-shell-core`.
2. **2/3 (ETP-4563)** — integrate into `useEntity`, `ListView`, `DetailView`.
3. **3/3 (ETP-4564)** — migrate Contacts reads and verify T-01.

To migrate a hook that holds request state locally (e.g.
`tools/app-shell/src/hooks/useEntity.js`):

- Replace the local `useState` + `fetch` + effect with `useQuery`.
- Map the entity / record / filters to the query-key fields.
- Replace ad-hoc reloads with `refetch()` / `invalidate()`.
- Remove any manual cross-navigation caching — the provider owns it now.
