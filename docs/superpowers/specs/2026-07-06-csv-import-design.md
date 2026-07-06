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
| `validateRows.js` | Applies `required` + basic format checks (e.g. email shape) from contract metadata, plus any FK value still `needsReview` after the user has had a chance to resolve it. Returns `{ validRows, errorRows }` with a reason per error row. |
| `dedupeRows.js` | Collapses rows within `validRows` that share the same `dedupe.key` values (keeps first occurrence, reports the rest as skipped-duplicate — visible in the summary, not silently dropped). |
| `buildOperations.js` | Turns one row into the `operations[]` array for a single `/batch` call. Default: one `create` op against `import.entity` using the mapped/resolved values. Composite entities (Contacts) use a registered descriptor (same shape as `ocr/ingest/purchaseInvoiceDescriptor.js`) that returns `{ id, spec, entity, body, parentRef? }[]` for BusinessPartner + LocationAddress + Contact. |
| `importEngine.js` | Orchestrates: for each row (bounded by `limit.maxRows`), run `buildOperations` → `POST /batch` (bounded parallelism = `limit.concurrency`) → collect `{ row, ok, recordId?, error? }` → emit progress callback. No dependency on `fetch` directly — takes an injected `postBatch(operations)` function, so tests supply a mock. |

### 3. UI (`ImportDialog.jsx`, `schema_forge_core / app-shell-core / components`)

Steps, matching the reference mockups:
1. **Dropzone** — accepts `.csv`/`.txt`, shows detected row count.
2. **Mapping table** — one column per detected header, auto-mapped via `mapColumns`,
   each with a dropdown to override the target field (or mark "not imported").
3. **Preview + errors** — shows sample rows, an "N errors found" expandable panel
   (validation + dedupe-skips), and how many rows will actually import. **FK values
   needing review** get their own panel, one entry per distinct value (not per row), each
   with the `simSearch` candidates to pick from or a manual entity-search fallback;
   resolving a value live-updates every row that shares it.
4. **Confirm dialog** — "Will import N contacts, M rows will be skipped due to errors" +
   options surfaced from `decisions.import` (dedupe on/off if ever made optional later —
   v1 ships it always-on per the config).
5. **Progress** — "Importing… X%" driven by `importEngine`'s progress callback.
6. **Result** — success toast/count + a **failed-rows panel** listing each row that
   `/batch` rejected, with its server error message and a **retry** action (re-runs just
   that row through `buildOperations` → `/batch`).

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
  failed with the server's `error.message`, offered for retry. A row's own multi-op
  transaction (e.g. BP+Location+Contact) still rolls back atomically per existing
  `BatchService` behavior — no partial sub-entities.
- **Limit reached**: rows beyond `limit.maxRows` are not sent; the summary explicitly
  states how many were skipped for that reason (no silent truncation).

### 6. Testing

Unit tests (Vitest/`node:test`, per repo convention) for every engine module in
isolation with `postBatch` mocked — dedupe collisions, FK resolution (auto-resolved /
needs-review with candidates / needs-review with zero candidates, and the user-picks-a-
candidate / user-uses-manual-fallback paths), row-level failure + retry, `maxRows`
truncation, concurrency bound. The relocated `simSearch.js` keeps its existing test
coverage (moved, not rewritten) plus a regression test that `tools/app-shell`'s OCR ingest
still imports it correctly post-move. Per CLAUDE.md, test-writing is delegated to the
`test-generator` subagent (Tester) during implementation, not written ad hoc.

## Open items explicitly deferred (not this iteration)

- Real ceiling for `limit.maxRows`/`concurrency` — ships as a config knob, tuned later
  against real payload sizes.
- Dedupe against existing (already-persisted) records.
- XLSX support.
- Update/upsert semantics for rows that collide with existing records.
