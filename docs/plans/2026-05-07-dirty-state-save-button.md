# Design: Dirty-State Save Button

**Status:** In design / pre-implementation  
**Scope:** `useEntity.js` + `DetailView.jsx` (core); extensible to custom windows  
**Affects:** All 47+ windows that use `DetailView`; extension points for custom-save windows

---

## Problem

The Save button is currently enabled at all times (unless `isSaving` or `isDocumentReadOnly`). This means users can click Save on a record they haven't touched, triggering unnecessary network requests and causing confusion. The desired behavior: the Save button is only enabled when there are pending unsaved changes — at the header level or the lines level.

---

## Sources of "Dirtiness"

Four independent sources of pending changes exist in the current architecture:

| # | Source | Current state variable | Location |
|---|--------|----------------------|----------|
| 1 | Header field changed | `editing[k] !== selected[k]` | `useEntity.js` |
| 2 | Primary add-row open | `addingLine === true` | `DetailView.jsx:237` |
| 3 | Secondary tab add-row open | `addingSecondaryLine[tabKey] === true` | `DetailView.jsx:241` |
| 4 | Sidebar line edit open | `lineEdits !== null` | `DetailView.jsx:315` |

**Key insight on lines:** Lines are NOT batched with the header save. Each line is persisted immediately via `handleAddChild` (individual POST). The only "dirty lines" state is when the user is mid-input in an add-row form (`addingLine === true`). Once the user confirms the add-row, the line is already in the backend.

---

## Architecture: Three-Layer Design

```
Layer 1: useEntity.js
  isDirtyHeader = computed from (editing vs selected)
  refreshHeaderTotals = smart refresh that preserves user-edited fields in editing
  Exposed in hook return value

Layer 2: DetailView.jsx
  isDirty = isDirtyHeader
          || addingLine
          || Object.values(addingSecondaryLine).some(Boolean)
          || (lineEdits != null && Object.keys(lineEdits).length > 0)
          || additionalDirtyState   ← extension point (prop)

Layer 3: Save button condition
  disabled={hook.isSaving || !isDirty}   (existing record)
  disabled={hook.isSaving}               (new record — always active)
  disabled={hook.isSaving}               (Confirm button — never blocked by dirty)
```

---

## Layer 1 — `isDirtyHeader` in `useEntity.js`

```js
const isDirtyHeader = useMemo(() => {
  if (!selected) {
    // New record: dirty as soon as any non-id field has a value
    return Object.keys(editing || {}).some(
      k => k !== 'id' && editing[k] != null && editing[k] !== ''
    );
  }
  return Object.entries(editing || {}).some(
    ([key, val]) => key !== 'id' && val !== selected[key]
  );
}, [editing, selected]);
```

Added to the `return` of `useEntity` alongside `isSaving`.

---

## Layer 1b — `refreshHeaderTotals` in `useEntity.js` (required companion fix)

### The pre-existing bug this solves

`fetchById` (called by `handleAddChild`, `handleUpdateChild`, `handleDeleteChild`) currently does:

```js
// useEntity.js:457-458 — current behavior
setSelected(row);
setEditing({ ...row });  // ← OVERWRITES editing with server response
```

This means: if a user edits a header field (e.g., payment terms) and then adds a line before saving, the `fetchById` triggered by the line add **silently discards the user's header change**.

This bug exists today but has no visible signal. With dirty-state, it becomes visible — the Save button flicks from enabled back to disabled after a line add, alerting the user that something was lost. Fixing the root cause is therefore **part of the same implementation**.

### The fix: `refreshHeaderTotals`

A new function that updates `selected` (needed as base for the next PATCH) but merges only non-user-touched fields into `editing`, preserving any pending header changes:

```js
const refreshHeaderTotals = useCallback((id) => {
  if (!id) return;
  fetch(`${apiBaseUrl}/${entity}/${id}`, { headers })
    .then(res => {
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    })
    .then(data => {
      const row = normalizeRecord(data?.response?.data?.[0] ?? data, entity);
      setSelected(row);  // always update selected (base for next PATCH diff)
      setEditing(prev => {
        if (!prev) return { ...row };
        const merged = { ...prev };
        for (const [key, val] of Object.entries(row)) {
          // Only update fields the user has NOT explicitly changed
          if (!userChangedKeysRef.current.has(key)) {
            merged[key] = val;
          }
        }
        return merged;
      });
    })
    .catch(() => {});
}, [apiBaseUrl, entity, headers]);
```

`userChangedKeysRef` already exists (`useEntity.js:334`) and already tracks exactly which fields the user typed into. No new tracking needed.

### Callers that switch from `fetchById` to `refreshHeaderTotals`

| Function | Current call | New call |
|----------|-------------|----------|
| `handleAddChild` (line 750) | `fetchById(selected.id)` | `refreshHeaderTotals(selected.id)` |
| `handleUpdateChild` (line 768) | `fetchById(selected.id)` | `refreshHeaderTotals(selected.id)` |
| `handleDeleteChild` (line 774) | `fetchById(selected.id)` | `refreshHeaderTotals(selected.id)` |

`fetchById` itself stays unchanged — it is still used on initial load and explicit record navigation, where overwriting `editing` is the correct behavior.

---

## Layer 2 — `isDirty` composed in `DetailView.jsx`

```js
const isDirty =
  hook.isDirtyHeader
  || addingLine
  || Object.values(addingSecondaryLine).some(Boolean)
  || (lineEdits != null && Object.keys(lineEdits).length > 0)
  || (additionalDirtyState === true);   // extension point
```

Where `additionalDirtyState` is a new optional prop on `DetailView`:
```jsx
<DetailView
  hook={hook}
  additionalDirtyState={someCustomCondition}  // optional, default: false
  ...
/>
```

---

## Layer 3 — Save button conditions

### Draft mode (two-button layout)
```jsx
// "Save Draft" — disable when nothing changed
<Button disabled={hook.isSaving || !isDirty}>
  {t('saveDraft')}
</Button>

// "Confirm" — NEVER blocked by isDirty (completing a document is always allowed)
<Button disabled={hook.isSaving}>
  {t('confirm')}
</Button>
```

### Non-draft, new record (`isNew === true`)
```jsx
// Always active — defaults populate editing immediately on open, would give false positives
<Button disabled={isDocumentReadOnly || hook.isSaving}>
  {t('save')}
</Button>
```

### Non-draft, existing record
```jsx
<Button disabled={isDocumentReadOnly || hook.isSaving || !isDirty}>
  {t('save')}
</Button>
```

---

## Auto-save behaviors: verified no breakage

### Inline add-row (Enter / click outside)

The add-row submit path is entirely independent of the Save button:

```
Enter / click outside
  → submitLine() [DataTable.jsx:413]
  → onAdd(coercedValues) [DataTable.jsx:371]
  → hook.handleAddChild() [useEntity.js:714]
  → POST /{entity}/lines
```

The Save button's `disabled` state only prevents user clicks on that HTML element. It never blocks programmatic calls to `hook.handleAddChild()`. ✅ No impact.

### Import from Shipment (sales-invoice)

The flow was verified in `InvoiceBottomPanel.jsx:131`:

```javascript
const handleImportClick = async () => {
  if (onSave) {
    const shouldOpen = await onSave();  // calls hook.handleSave() directly from code
    if (!shouldOpen) return;
  }
  setShowImportModal(true);
};
```

Then in `ImportFromShipmentModal.jsx:294`:
```javascript
// POSTs directly to the lines endpoint — does NOT use the Save button
const res = await fetch(`${base}/sales-invoice/lines`, { method: 'POST', ... });
// After all lines are imported:
onSuccess();  // → window.location.reload()
```

Key points:
- `onSave()` is called **programmatically from JS code**, not via a button click. HTML `disabled` only prevents user click events — it never blocks function calls. ✅ No impact.
- After import, `window.location.reload()` resets all state, so dirty-state is irrelevant post-import.
- The pre-save call (`onSave()`) before opening the modal sends an empty PATCH if the header has no changes (harmless — backend returns current state and the modal proceeds).

---

## Extensibility: Custom-Save Windows

### Scenario A — Window uses DetailView but has custom dirty sources

Windows like `purchase-order` (with `PurchaseOrderActions.jsx`) or `sales-invoice` (with custom index) still render `DetailView`. They can pass a custom boolean via `additionalDirtyState`:

```jsx
// In HeaderPage.jsx (generated or custom)
const [customSectionDirty, setCustomSectionDirty] = useState(false);

<DetailView
  hook={hook}
  additionalDirtyState={customSectionDirty}
  ...
/>
```

The custom component calls `setCustomSectionDirty(true)` whenever its internal state diverges from the saved state.

### Scenario B — Window bypasses DetailView entirely (fiscal-config, contacts)

These windows manage their own save flow via refs and combined save logic. They do NOT use `DetailView`'s save button. They must implement dirty tracking independently using the same primitives:

- `contacts`: Can compute `isDirty` by comparing the form state of `BillingPreferencesForm` and `LocationEditorModal` against fetched values — or expose `isDirty` from each sub-form and `OR` them.
- `fiscal-config`: Uses `siiRef.current?.isDirty` and `tbaiRef.current?.isDirty` — each section's ref exposes an `isDirty` getter.
- `product`: `ProductPriceBar` exposes a `isDirty` boolean via its own state tracking.

These are **out of scope** for the initial implementation. They are self-contained components with their own save paths.

### Scenario C — decisions.json configuration per window (deferred to v2)

> **NOT implemented in v1.** No existing window has a confirmed false-positive case or a concrete need for per-window dirty tracking configuration. Implementing this in v1 would require generator changes, `docs/decisions-reference.md` updates, and generator tests — all for a feature no window currently needs. If a specific window exhibits a false-positive dirty state in the future, this mechanism can be added at that point.

decisions.json could express **static configuration** about how dirty tracking applies to a window. It cannot express runtime state, but it can control generator behavior. Two options are foreseen:

**`ignoreFields`** — exclude specific header fields from the dirty diff. Useful if a field is returned by the server in a format that differs from what `editing` stores (e.g. a timestamp with millisecond precision, a float that gets rounded differently). Without this escape hatch, that field would always appear dirty even when the user hasn't touched it.

```json
"saveButton": {
  "dirtyTracking": {
    "ignoreFields": ["updatedBy", "updatedAt"]
  }
}
```

**`enabledForNew`** — apply dirty tracking to new records too (default `false`, meaning Save is always active for new records). Set to `true` on a window that wants the Save button disabled until the user fills at least one field.

```json
"saveButton": {
  "dirtyTracking": {
    "enabledForNew": true
  }
}
```

When implemented, the generator would emit a `dirtyTrackingConfig` prop to `DetailView`, which would pass `ignoreFields` to `useEntity` as an option for the `isDirtyHeader` computation. Until then, the defaults cover all current windows correctly with no configuration needed.

---

## Edge Cases

| Case | Result |
|------|--------|
| Open existing record without touching anything | Button disabled ✓ |
| Change a field then revert it to original value | `isDirty` becomes `false` again → button disables ✓ |
| After successful save | `selected` synced to server response → `isDirtyHeader = false` → button disables ✓ |
| Start add-row without submitting it | `addingLine = true` → button enabled; clicking Save calls `flushPendingLines()` → line persisted first ✓ |
| Edit header then add a line (before saving header) | `refreshHeaderTotals` preserves header edits in `editing` → `isDirtyHeader` stays `true` → button stays enabled ✓ |
| Add a line without pending header changes | `refreshHeaderTotals` updates totals in `editing` → `isDirtyHeader = false` → button disables correctly ✓ |
| Document in status CO/CL (completed) | `isDocumentReadOnly = true` disables before evaluating `isDirty` ✓ |
| `hideSaveStatuses` covers current status | Button already hidden before `isDirty` is evaluated ✓ |
| draftMode Confirm with 0 changes | Confirm never has `!isDirty` condition → always operable ✓ |
| New record with backend defaults populating `editing` | `isNew` → button always active, `isDirty` not evaluated ✓ |
| Sidebar line edit open | `lineEdits !== null` → `isDirty = true` → button enabled ✓ |
| Import from Shipment (sales-invoice) | Calls `hook.handleSave()` programmatically → not blocked by button disabled state ✓ |
| Inline add-row Enter / click outside | Calls `handleAddChild` directly → not blocked by button disabled state ✓ |

---

## Impact Map

```
59 total windows
│
├── 47 use DetailView ──────────────────────────── COVERED (automatic)
│   │
│   ├── 8 with lines (SO, PO, SI, PI, SQ...)    isDirty includes addingLine ✓
│   ├── 2 with hideSaveStatuses (PO, SQ)         Button already hidden, no conflict ✓
│   ├── 5 with draftMode enabled                 Confirm never blocked ✓
│   └── 32 plain header-only windows             Only isDirtyHeader ✓
│
└── 12 without standard *Page.jsx                No changes needed
    └── 9 with custom save logic                 Out of scope v1; extension via
        (fiscal-config, contacts, product…)      additionalDirtyState prop when ready
```

---

## Files Changed (v1)

| File | Change | Size |
|------|--------|------|
| `tools/app-shell/src/hooks/useEntity.js` | Add `isDirtyHeader` useMemo + `refreshHeaderTotals` + wire `handleAddChild/UpdateChild/DeleteChild` to use it + expose `isDirtyHeader` in return | ~+30 lines, modify 3 |
| `tools/app-shell/src/components/contract-ui/DetailView.jsx` | Compute `isDirty`, add `additionalDirtyState` prop, update ~5 button disabled conditions | +8 lines, modify ~5 |

**No changes to:** `HeaderPage.jsx` files, `decisions.json`, pipeline generators, contracts, `docs/decisions-reference.md`.

### Deferred to v2 (no action needed today)

| File | Blocked on |
|------|-----------|
| `tools/app-shell/src/hooks/useEntity.js` — `ignoreFields` option in `isDirtyHeader` | A real false-positive case in a specific window |
| `cli/src/generate-frontend.js` — emit `dirtyTrackingConfig` prop | Same |
| `docs/decisions-reference.md` — document `saveButton.dirtyTracking` | Same |

---

## Open Questions

1. **`enabledForNew` in decisions.json?** — Should specific windows opt-in to dirty tracking for new records? Current default is `false` (new records always have Save enabled).
2. **Field-level `ignoreFields`?** — Are there windows with auto-updated fields (e.g. `updatedAt`) that would cause false-positive dirty state? Need to confirm with field inventory.
3. **`additionalDirtyState` for fiscal-config v1?** — Include or defer to v2?
4. **Visual feedback beyond disabled?** — Should the button show a badge/dot when dirty? Out of scope for v1.
