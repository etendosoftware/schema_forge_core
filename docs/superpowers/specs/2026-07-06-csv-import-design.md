# CSV Import (generic, per-entity) — Design

- Date: 2026-07-06
- Status: approved (pending user review of this file)
- Repos touched: `schema_forge_core` (functionality), `etendo_schema_forge` (contract/decisions)

## Problem

Users need to bulk-load records (starting with **Contacts** and **Products**) from a
CSV/TXT file instead of creating them one by one. Reference UX: drag-and-drop a file →
preview with per-column mapping → validation/error summary → confirm → progress bar →
result with failed-row detail (see mockups attached to the originating conversation).

Scope for v1: **CSV/TXT only** (no XLSX). No AI/Copilot-assisted import in this phase —
straight column mapping and validation. Must be **extensible to any entity/window**
without per-entity frontend code for the common case.

## Key finding: no backend work required

`POST /sws/neo/batch` already exists and is generic
(`etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/BatchService.java`):
it takes an ordered list of `{ id, spec, entity, body, parentRef? }` operations, runs them
in one OBDal transaction, supports `$ref:<opId>` substitution between operations, and
commits or rolls back atomically. It is already used by the OCR/Copilot contact-ingest
flow (`tools/app-shell/src/components/copilot/ocr/ingest/`).

**Decision: each imported row = its own `/batch` call** (row-level isolation, per user
decision — not one giant all-or-nothing call, not a single op per call). A row that maps
to a composite entity (e.g. a Contact = BusinessPartner + LocationAddress + Contact)
still sends all of its operations in one `/batch` call so that sub-entity stays
transactional; only the row boundary is the isolation unit. This means v1 needs **zero
new backend code** — the import engine is a new client of an existing endpoint.

If a future need arises for dedupe-against-existing-records (server-side lookup) or
bulk-native performance, that's an explicit non-goal called out below, not silently
assumed.

## Non-goals (v1)

- XLSX/other spreadsheet formats (CSV/TXT only).
- Copilot/AI-assisted mapping or data cleanup.
- Dedupe against already-persisted records (only in-file dedupe, see below).
- A dedicated bulk-insert backend endpoint (row-by-row via `/batch` is deliberate, for
  isolation and error reporting per row).
- Update/upsert of existing records (v1 is create-only; a row that collides with an
  existing record is not detected server-side and will attempt a create).

## Foreign-key columns (new complication found during design)

Several entities have **required `foreignKey` fields** that a human-authored CSV cannot
reasonably carry as raw Etendo IDs — e.g. Product's `uOM`, `productCategory`,
`taxCategory` (all `required: true`, `type: "foreignKey"` per
`artifacts/product/contract.json`). Contacts' `locationAddress.locationAddress` field
(country/region chain) has the same shape.

The CSV carries human-readable text (e.g. `"Kilogramo"`, `"Bebidas"`). Resolving that text
to a record id is split into two independent pieces — a generic **matching engine** and a
per-column **match resolver** — so the fuzzy-matching logic is reusable and testable on
its own, and the decision of what to do with an imperfect match lives with the import flow,
not the engine.

**Matching engine (reused, not built new):** `tools/app-shell/src/lib/simSearch.js` already
wraps Etendo's `SimSearch` webhook — given an entity name and a list of text values, it
returns, per value, the best candidate(s) with a `similarityPercent`. It's already in
production use by the OCR/Copilot ingest flow (`purchaseInvoiceDescriptor.js`, matching
`Product` and `FinancialMgmtTaxRate` by free text). **No new backend/webhook work** — this
is an existing generic primitive we point at more entities (`UOM`, `ProductCategory`, plus
whatever entity backs Contacts' location/country chain).
Since it's genuinely generic (not OCR-specific), it moves to
`packages/app-shell-core/src/lib/simSearch.js` as a shared primitive; `tools/app-shell`'s
OCR ingest is updated to import it from there instead of keeping its own copy.

**Match resolver (`resolveForeignKeys.js`, import-specific):**
1. For each `foreignKey`-typed mapped column, collect the **distinct raw text values**
   across the file (a 500-row file with 3 distinct UOM strings does one `simSearch` call
   for those 3 values, not 500 lookups).
2. Call the matching engine once per column with that distinct-value list, `qtyResults`
   > 1 so close alternatives are available for disambiguation, not just the top hit.
3. Classify each distinct value:
   - **auto-resolved** — a single candidate clears a confidence threshold with no close
     runner-up → used directly, no user interaction.
   - **needs review** — zero candidates above threshold, or two+ candidates too close to
     call → surfaced to the user (see below), not treated as a hard error yet.
4. Cache the resulting `value → id` table for the run and reuse it in `buildOperations`.

**Resolving "needs review" values (UI, not just validation text):** the preview step
lists each distinct unresolved/ambiguous value **once** (e.g. "Product Category 'Bebida'
→ no confident match", "UOM 'Kg' → 2 close matches") — never per-row, since the same typo
usually repeats across many rows. For each, the user can:
- Pick one of the candidate matches `simSearch` returned, or
- Fall back to the standard entity selector/search (same lookup control used elsewhere in
  forms) to pick the correct record manually when no candidate fits.

The user's choice is applied to **every row sharing that raw value** and the preview/error
counts update live. A value the user leaves unresolved keeps its rows excluded from send,
listed in the errors panel exactly like a missing-required-field error — nothing is
silently dropped, and nothing blocks confidently-matched rows from importing while a
handful of ambiguous values are still being resolved.

## Architecture

```
decisions.json (per window, etendo_schema_forge)
   └─ window.import { enabled, spec, formats, limit, dedupe, fields, descriptor? }
        │
        ▼ (generate-contract.js merges with contract field metadata)
contract.json → frontendContract.window.import
        │
        ▼ (generate-frontend.js wires the button when import.enabled)
ImportDialog (schema_forge_core / app-shell-core)
        │
        ▼ uses
Import engine (schema_forge_core / app-shell-core, headless, unit-testable)
        │
        ▼ one call per row
POST /sws/neo/batch   (existing backend, unchanged)
```

### 1. Contract / decisions (`etendo_schema_forge`)

New block in `decisions.json`, kept minimal because most field metadata (label,
required, type, reference) is already derivable from the contract:

```jsonc
"import": {
  "enabled": true,
  "spec": "contacts",                 // NEO spec; defaults to the window's own spec
  "entity": "businessPartner",        // primary/root entity for this import
  "formats": ["csv", "txt"],
  "delimiter": "auto",                // auto-detects , ; \t
  "limit": { "maxRows": 5000, "concurrency": 4 },  // tunable; real ceiling TBD later
  "dedupe": { "scope": "file", "key": ["etgoEmail"] },
  "fields": [                          // only what can't be derived: aliases for header-matching
    { "target": "etgoEmail", "aliases": ["email", "correo", "e-mail"] },
    { "target": "name",      "aliases": ["nombre", "razon social", "name"] }
  ],
  "descriptor": "contacts"            // optional: key into a registry of composite builders
}
```

`generate-contract.js` merges this with each `target` field's contract metadata
(`required`, `type`, `reference`, `label`) and writes the merged result to
`contract.json → frontendContract.window.import`. If a `target` doesn't exist in the
contract's importable fields, contract generation fails loudly (same posture as other
`decisions.json` mismatches) rather than silently dropping it.

Applies to **Contacts** (`artifacts/contacts/decisions.json`, composite descriptor) and
**Product** (`artifacts/product/decisions.json`, default single-op descriptor with FK
resolution for `uOM`/`productCategory`/`taxCategory`).

### 2. Import engine (`schema_forge_core/packages/app-shell-core/src/lib/import/`)

Each module has one job and is independently unit-testable:

| Module | Responsibility |
|---|---|
| `parseDelimited.js` | CSV/TXT → rows of raw string cells. Auto-detects delimiter (`,` `;` `\t`), handles quoted fields. |
| `mapColumns.js` | Matches file headers to contract fields using `label` + `decisions.import.fields[].aliases` (case/accent-insensitive). Returns `{ mapping, unmapped }` for the user to override in the UI. |
| `simSearch.js` (lives one level up, at `packages/app-shell-core/src/lib/simSearch.js` — relocated from `tools/app-shell/src/lib/`) | Generic matching engine: entity name + text values → best candidate(s) with `similarityPercent`, via the existing `SimSearch` webhook. Entity-agnostic, no import-specific logic; imported by `resolveForeignKeys.js` below. |
| `resolveForeignKeys.js` | Per-column match resolver: collects distinct raw values per `foreignKey` column, calls `simSearch.js` once per column, classifies each value `auto-resolved` / `needs-review`, returns a `value → { id }|{ candidates, needsReview: true }` table for `ImportDialog` to render and for the user to fix inline. |
| `validateRows.js` | Exposes `validateRow(row, contract)` — pure, single-row validation (required + format + FK-still-`needsReview`) — and a thin `validateRows(rows, contract)` that maps it over the file. Same function powers the initial bulk pass and the **inline re-validate** used when the user edits one erroring row (see UI below): no separate "single row" reimplementation. |
| `dedupeRows.js` | Collapses rows within `validRows` that share the same `dedupe.key` values (keeps first occurrence, reports the rest as skipped-duplicate — visible in the summary, not silently dropped). |
| `buildOperations.js` | Turns one row into the `operations[]` array for a single `/batch` call. Default: one `create` op against `import.entity` using the mapped/resolved values. Composite entities (Contacts) use a registered descriptor (same shape as `ocr/ingest/purchaseInvoiceDescriptor.js`) that returns `{ id, spec, entity, body, parentRef? }[]` for BusinessPartner + LocationAddress + Contact. |
| `importEngine.js` | Orchestrates the bulk send: for each row (bounded by `limit.maxRows`), run `buildOperations` → `POST /batch` (bounded parallelism = `limit.concurrency`) → collect `{ row, ok, recordId?, error? }` → emit progress callback. Exposes `sendRow(row)` as the unit of work (bulk send is just `sendRow` fanned out with bounded concurrency), so the **per-row retry** in the result UI calls the exact same function, not a parallel code path. No dependency on `fetch` directly — takes an injected `postBatch(operations)` function, so tests supply a mock. |

### 3. UI (`ImportDialog.jsx`, `schema_forge_core / app-shell-core / components`)

Steps, matching the reference mockups:
1. **Dropzone** — accepts `.csv`/`.txt`, shows detected row count.
2. **Mapping table** — one column per detected header, auto-mapped via `mapColumns`,
   each with a dropdown to override the target field (or mark "not imported").
3. **Preview + review queue** — see "Review queue" below; default view is capped/sampled
   (see Performance section), with a toggle to show only rows that still need attention
   (validation errors, FK `needs-review`, in-file dedupe-skips) versus all rows.
4. **Confirm dialog** — "Will import N contacts, M rows will be skipped due to errors" +
   options surfaced from `decisions.import` (dedupe on/off if ever made optional later —
   v1 ships it always-on per the config).
5. **Progress** — "Importing… X%" driven by `importEngine`'s progress callback.
6. **Result** — success toast/count + the same **review queue** pattern applied to
   server-rejected rows (see below).

#### Review queue (shared pattern, used in step 3 and step 6)

Both "rows that fail validation before sending" and "rows the server rejected after
sending" use the same interaction model, since the user's ask is one workflow — "hide the
ones that are fine, work the failing ones until they clear or I explicitly skip them":

- **Filter toggle**: "Show only errors" / "Show all", available in both the preview step
  and the result step independently (each step remembers its own toggle state).
- **FK values needing review** are listed once per distinct value (not per row), each with
  the `simSearch` candidates to pick from or a manual entity-search fallback — resolving a
  value live-clears every row that shares it, as already described above.
- **Per-row inline editing**: a row still in the queue (validation error pre-send, or
  server-rejected post-send) can have its individual erroring field(s) edited directly in
  the table, using the same field-input component the record's own form would use for that
  field's type (text, email, the FK selector for a `foreignKey` field, etc.) — not a
  free-form spreadsheet editor, only the cells flagged as the problem.
- **Per-row action after editing**:
  - Pre-send: **Re-validate** re-runs `validateRow` (the same function used for the bulk
    pass, see `validateRows.js` above) on just that row's current values; it clears from
    the queue immediately if it now passes.
  - Post-send: **Retry** re-runs `importEngine.sendRow` (the same function the bulk send
    uses) for just that row; success removes it from the queue and counts it as imported,
    failure keeps it with the updated server error message.
- **Skip**: explicitly removes a row from the queue without it passing — it is excluded
  from the import (pre-send) or accepted as permanently not-imported (post-send) and
  reported as "skipped by user" in the final summary, distinct from "still failing" so the
  numbers stay honest.
- The loop is user-driven and open-ended: edit → re-validate/retry → repeat, or skip,
  until the queue is empty or the user is done. Nothing is auto-retried or auto-skipped.

### 4. Wiring (`generate-frontend.js`, core)

When `contract.json → frontendContract.window.import.enabled` is true, the generator
emits the upload icon in the list toolbar and the dropzone in the empty state, both
opening `<ImportDialog spec=... entity=... />`. i18n keys added to both `en_US.json` and
`es_ES.json` (`import.dropHere`, `import.errorsFound`, `import.confirmTitle`,
`import.importing`, `import.retryRow`, etc.) — this repo's i18n rule (CLAUDE.md) applies:
every new string in both locales, no exceptions.

### 5. Error handling

- **File-level**: unreadable/empty file, unknown delimiter → single blocking error,
  dialog stays on step 1.
- **Row-level (pre-send)**: missing required field, FK value still `needs-review`, format
  mismatch, in-file duplicate → row excluded from send, listed in the errors panel with a
  reason, never silently dropped.
- **Row-level (server)**: `/batch` returns `committed:false` for that row → row marked
  failed with the server's `error.message`, enters the result-step review queue (edit +
  retry, or skip). A row's own multi-op transaction (e.g. BP+Location+Contact) still rolls
  back atomically per existing `BatchService` behavior — no partial sub-entities.
- **User-skipped**: a row explicitly skipped via the review queue is reported as "skipped
  by user" in the final summary, kept distinct from "still failing" and from "imported".
- **Limit reached**: rows beyond `limit.maxRows` are not sent; the summary explicitly
  states how many were skipped for that reason (no silent truncation).

### 6. Performance & efficiency

The entire import runs client-side, in the browser tab, entirely in memory — there is no
server-side staging of the file and no streaming parse:

- The file is read fully (`File.text()`) and parsed into an in-memory row array in one
  pass. At the expected scale (business CSVs of contacts/products — thousands of rows,
  a few dozen columns), this is a few MB at most: negligible for both parse time and
  browser memory. `limit.maxRows` puts a hard ceiling on top of that.
- **The actual risk is DOM rendering, not memory**: naively rendering thousands of table
  rows would make the UI sluggish. `app-shell-core` has **no table-virtualization library**
  today (checked: not a dependency), so rather than adding one for this, the preview and
  result tables never render the full row set — they render a **capped sample of OK rows**
  (e.g. first 50) plus **all rows currently in the review queue** (errors / needs-review /
  failed), with simple in-memory pagination (array slicing, no new dependency) for when the
  queue itself is large. This also directly serves the "hide OK, focus on errors" ask:
  toggling to "show only errors" only ever renders the queue, which is normally far smaller
  than the full file.
- FK matching stays cheap because it's batched by **distinct value per column**, not per
  row (see Foreign-key columns above) — this is the one part of the flow that would not
  scale linearly with row count if done naively.
- Sending is network-bound, not memory-bound (one `/batch` call per row, bounded
  concurrency) — already covered by the existing `limit.concurrency` design.
- **No resumability**: the import holds all state in the tab's memory only; closing or
  reloading the tab mid-import loses progress and the review queue. This is accepted v1
  behavior, not an oversight — call it out explicitly rather than leaving it implicit.

### 7. Testing

Unit tests (Vitest/`node:test`, per repo convention) for every engine module in
isolation with `postBatch` mocked — dedupe collisions, FK resolution (auto-resolved /
needs-review with candidates / needs-review with zero candidates, and the user-picks-a-
candidate / user-uses-manual-fallback paths), `validateRow` single-row re-validation after
an inline edit, `sendRow` single-row retry after an inline edit, `maxRows` truncation,
concurrency bound. The relocated `simSearch.js` keeps its existing test coverage (moved,
not rewritten) plus a regression test that `tools/app-shell`'s OCR ingest still imports it
correctly post-move. Component-level tests cover the review queue: filter toggle
(preview and result independently), inline edit + re-validate/retry clearing a row from
the queue, and the Skip action reporting a row as "skipped by user" rather than
"failing". Per CLAUDE.md, test-writing is delegated to the `test-generator` subagent
(Tester) during implementation, not written ad hoc.

## Open items explicitly deferred (not this iteration)

- Real ceiling for `limit.maxRows`/`concurrency` — ships as a config knob, tuned later
  against real payload sizes.
- Dedupe against existing (already-persisted) records.
- XLSX support.
- Update/upsert semantics for rows that collide with existing records.
