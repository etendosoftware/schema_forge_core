# Network Performance Audit — App Shell

Audit of repeated/redundant network requests observed in the generated app shell. Starting window: **Sales Order** (`artifacts/sales-order/`). Findings apply to the shared shell (`tools/app-shell/src/`) and affect every window unless noted.

## Status Table

Legend: 🔴 critical · 🟡 medium · 🟢 low · ⬜ pending · 🔧 in progress · ✅ fixed · ❌ won't fix

| # | Severity | Finding | File(s) | Status | Notes |
|---|---|---|---|---|---|
| 1 | 🔴 | 5 parallel GETs of the header list on every DetailView mount (1 primary hook + 4 secondary hooks always refresh the same entity) | `components/contract-ui/DetailView.jsx:140,144-147` · `hooks/useEntity.js:305` | ✅ | Fixed 2026-04-20: added `skipListFetch` option to `useEntity`; DetailView passes it for the 4 secondary hooks. Reduces 5→1 GET. 32/32 hook tests pass. |
| 1b | 🟡 | Primary `useEntity` still fetches the header list when DetailView is mounted on `/new` (list not used — `currentItem` is short-circuited by `isNew`) | `components/contract-ui/DetailView.jsx:140` | ✅ | Fixed 2026-04-20: primary hook receives `skipListFetch: recordId === 'new'`. Verified via DevTools: entering `/new` went from 20→16 fetch/xhr requests; header list GET no longer fires on `/new` mount. When the record is saved and URL becomes `/:id`, the effect re-runs and loads the list normally. |
| 2 | 🔴 | `handleUpdateChild` fetches children twice (fetchById already calls fetchChildren) | `hooks/useEntity.js:540-551` | ✅ | Fixed 2026-04-20: removed the direct `fetchChildren` call; `fetchById` still triggers it on resolve. Also removes a race between the two parallel children fetches. 32/32 hook tests pass. |
| 3 | 🟡 | `useCatalogs` invalidates ALL selectors when any selectorContext field changes | `hooks/useCatalogs.js:28` · `components/contract-ui/DetailView.jsx:150-188` | ⬜ | Needs per-selector cache; risky to over-dedupe (dependent selectors must refetch) |
| 4 | 🟢 | Leftover debug `console.log` statements in production code | `hooks/useEntity.js:513` · `components/contract-ui/DetailView.jsx:678` | ✅ | Fixed 2026-04-20: removed `[POST body]` in `useEntity.js` and `[DBG] SL_Order_Amt raw response` in `DetailView.jsx`. |
| 5 | 🔴 | `SelectorInput` / `SearchInput` / `DependentSelect` refetch on every `selectorContext` reference change (triggered by any `hook.editing` update) | `components/contract-ui/EntityForm.jsx:285-318,98-110,397-420` · `components/contract-ui/DetailView.jsx:150-188` | ✅ | Fixed 2026-04-20: `selectorContextByEntity` now depends on the scalar `priceListId` (not on full `hook.editing`/`hook.selected`) and on a string-joined `secondaryTabKeysStr` (not on the unstable `secondaryTabs = []` default). Context stays referentially stable until priceList, parent record, or tab set actually changes. Hook tests 32/32 pass. |
| 6 | 🟡 | `RelatedDocuments` fires 3 GETs on `/new` route (recordId = `'new'` is truthy) | `artifacts/sales-order/custom/RelatedDocuments.jsx:180-203` | ✅ | Fixed 2026-04-20: guard extended to `!recordId \|\| recordId === 'new'`; also `setLoading(false)` on the guard to avoid stuck "Loading..." state. |

## Details

### 1. Duplicate header list fetches on DetailView mount 🔴

`DetailView.jsx` instantiates 5 `useEntity` hooks unconditionally (React rules forbid dynamic hook calls). Each one runs `useEffect(() => refresh(), [refresh])` on mount, and `refresh()` fetches `GET /<entity>?_sortBy=...` for the **same** primary `entity`. Sales Order has no secondary tabs, so the 4 secondary hooks produce no useful data — they only refetch the header list.

**Impact:** every entry to the detail view fires 5 identical requests to `/sws/neo/sales-order/header`.

**Proposed fix:** add a `skipListFetch` option to `useEntity` (or skip `refresh()` when a caller-provided flag is set), and pass it from `DetailView` for the 4 secondary hooks. The primary hook keeps its current behavior.

**Risk:** low if `secondaryHooks[i].items` / `loadMore` / `sortColumn` aren't consumed. Needs grep confirmation before merging.

#### 1b. Primary hook list fetch on `/new` 🟡 ✅

Even after #1, the primary `useEntity` still runs `refresh()` on mount when DetailView is entered via `/sales-order/new`. Grep confirms `hook.items` is only consumed by `currentItem` (line 295), which is short-circuited by `if (isNew) return null;` — so the list is unused during new-record entry.

**Fix applied:** primary hook now receives `skipListFetch: recordId === 'new'`. When the record is saved and the route transitions to `/:id`, `recordId` changes, the `useEffect([refresh, skipListFetch])` re-runs, and the list is pulled normally.

**Verification (DevTools, Sales Order `/new`):** total fetch+xhr requests dropped from **20 → 16**; the second `GET /sales-order/header?_sortBy=creationDate desc&_startRow=0&_endRow=74` (previously fired by DetailView mount) is gone.

### 2. Duplicate children fetch after inline line edit 🔴

```js
const handleUpdateChild = useCallback((childId, fieldOrObject, value) => {
  setChildren(prev => prev.map(c => {...}));
  if (selected?.id) {
    fetchById(selected.id);     // internally calls fetchChildren (line 336)
    fetchChildren(selected.id); // DUPLICATE
  }
}, [selected, fetchById, fetchChildren]);
```

`fetchById` already calls `fetchChildren` on success. Removing the extra call yields identical state with one fewer request.

**Risk:** nil. Same final state; failure paths already leave children stale in both versions.

### 3. Selector catalog cache is too coarse 🟡

`useCatalogs` uses a single `fetchedRef` keyed by `apiBaseUrl | selectorsKey | selectorContextKey`. The context includes per-entity fields (`priceList`, `isSOTrx`, `parentId`, etc.). When any of those changes (e.g. user selects a price list), the key flips and **all 8 selectors** are refetched in parallel even though most don't depend on that field.

**Proposed fix:** per-selector cache keyed by the subset of the context the selector actually consumes. Requires declaring selector dependencies (or deriving them from the URL template).

**Risk:** medium — over-deduping can leave dependent selectors stale (e.g. `partnerAddress` after changing `businessPartner`). Design needs care; defer until #1 and #2 are measured.

### 4. Debug `console.log` left in 🟢 ✅

Two stray logs removed:
- `useEntity.js:513` — `console.log('[POST body]', JSON.stringify(body));`
- `DetailView.jsx:678` — `console.log('[DBG] SL_Order_Amt raw response:', ...)` (added by commit `466e2e41`).

Cosmetic, no performance impact; just noise in the console.

### 5. Selector inputs refetch on every edit 🔴

`EntityForm.jsx:276-318` (`SelectorInput`), `:62-155` (`SearchInput`), `:381-465` (`DependentSelect`) all build `fetchPage` (or equivalent) as a `useCallback` with `selectorContext` in its deps. When `selectorContext` reference changes — but not necessarily its value — the callback is recreated, and the initial-fetch `useEffect` fires again.

Upstream, `DetailView.jsx:150-188` builds `selectorContextByEntity` with `useMemo(() => {...}, [entity, detailEntity, parentRecordId, secondaryTabs, hook.editing, hook.selected, api])`. Two deps invalidate constantly:

1. `hook.editing` — changes on every `handleChange` (defaults, callout result, user typing).
2. `secondaryTabs` — default value `[]` in the destructure creates a new array on every render.

Combined effect on `/new` entry:
- `handleNew()` fetches defaults → `setEditing` → `hook.editing` ref changes → context rebuilds → all selector inputs refetch.
- Default-callout stagger (DetailView:363-390) fires N callouts → each updates editing → each rebuilds context → each refetches all selectors.
- Any subsequent user edit or callout repeats the pattern.

**Proposed fix:** stabilize `selectorContextByEntity` by depending only on the concrete scalar values it reads (`priceListId`, `parentRecordId`, `api?.window?.category`) and on a derived string key of `secondaryTabs` entries. This makes the downstream selector inputs stable by default without changing their internals.

**Risk:** low. The upstream memo produces identical objects for identical values; downstream consumers already behave correctly when the reference is stable.

### 6. RelatedDocuments fires on `/new` 🟡 ✅

`artifacts/sales-order/custom/RelatedDocuments.jsx:180-203` guarded with `if (!recordId) return;`, but the route `/new` sets `recordId = 'new'` (truthy). Result: 3 round-trips on every new-record open (shipments criteria, listInvoices action, payment plan parent lookup), all returning empty.

**Fix applied:** guard extended to `if (!recordId || recordId === 'new') { setLoading(false); return; }`. The extra `setLoading(false)` prevents the "Loading..." placeholder from sticking forever on `/new` (since `loading` initial state is `true`).

**Risk:** nil. A record that has not been saved yet cannot have related documents.

**Follow-up:** the same pattern may exist in other `custom/*.jsx` components across other windows. Worth a grep pass to generalize if found.

## Method

- Source-level read of `useEntity`, `useCatalogs`, `useCallout`, `DetailView`, `ListView`.
- No browser trace yet. If findings above don't explain observed repetition after fixing #1 and #2, continue with a `chrome-devtools` network capture on a populated Sales Order record.

## Change log

- 2026-04-20 — Initial audit against Sales Order (Valentin).
- 2026-04-20 — Fixed #1: `skipListFetch` option in `useEntity`, applied in `DetailView` secondary hooks.
- 2026-04-20 — Fixed #2: removed duplicate `fetchChildren` in `handleUpdateChild` (fetchById already triggers it).
- 2026-04-20 — Fixed #5: stabilized `selectorContextByEntity` memo deps (scalar `priceListId` + derived `secondaryTabKeysStr`).
- 2026-04-20 — Fixed #4: removed `[POST body]` log in `useEntity.js` and `[DBG] SL_Order_Amt raw response` log in `DetailView.jsx`.
- 2026-04-20 — Fixed #6: `RelatedDocuments` guard now treats `'new'` as no record; also clears `loading` to avoid stuck placeholder.
- 2026-04-20 — Fixed #1b: primary `useEntity` in DetailView now skips list fetch on `/new` (20→16 requests on Sales Order new-record entry, verified via Chrome DevTools).
