# CSV Import (generic, per-entity) — Design

- Date: 2026-07-06
- Status: approved (reviewed by user 2026-07-06)
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

**Two nuances found verifying `BatchService.java` directly** (worth stating, not hiding):
- It is **create-only** in practice (`createRecord` hardcodes `httpMethod("POST")`,
  BatchService.java:472) — the "generic CRUD" framing in its javadoc is aspirational; for
  this feature that's fine, v1 is create-only anyway.
- There is **no idempotency key**. If a `/batch` call for a row times out client-side
  without a response, the server may have already committed it. Retrying that exact row
  blindly risks a duplicate create (no dedupe-against-existing in v1 to catch it). The
  import engine must treat "no response / timeout" as a distinct outcome from "response
  received with `committed:false`" — the former surfaces as "unknown — check before
  retrying" in the review queue, not an auto-safe-to-retry failure. See Error handling.

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
`artifacts/product/contract.json`). Contacts' `locationAddress.locationAddress` field is
also a required `foreignKey` on the surface, but turns out to need fundamentally different
handling — see "Not every `foreignKey` column..." below.

The CSV carries human-readable text (e.g. `"Kilogramo"`, `"Bebidas"`). Resolving that text
to a record id is split into two independent pieces — a generic **matching engine** and a
per-column **match resolver** — so the fuzzy-matching logic is reusable and testable on
its own, and the decision of what to do with an imperfect match lives with the import flow,
not the engine.

**Matching engine (reused, with one required change):** `tools/app-shell/src/lib/simSearch.js`
wraps Etendo's `SimSearch` webhook (backed by `com.etendoerp.copilot.toolpack`'s
`SimSearch` servlet, which resolves the entity via `ModelProvider.getEntity(entityName)`
and trigram-matches `t.name`/`t.value` — verified in `SimSearchHelpersTest.java`). It's
already in production use by the OCR/Copilot ingest flow (`purchaseInvoiceDescriptor.js`,
matching `Product` and `FinancialMgmtTaxRate` by free text). **No new backend/webhook
work** — but the **frontend client needs one real change**, verified by reading it: its
response parser (`parseSimSearchEnvelope`, `simSearch.js:48`) currently keeps only
`data[0]` — the single best match — even though the webhook accepts `qtyResults > 1`. Our
"needs-review with candidates to pick from" UX depends on getting back more than one
candidate, so `parseSimSearchEnvelope` must be extended to return the full candidate list
(bounded by `qtyResults`), not just the first. This is a small, backward-compatible change
(existing callers that only ever look at result `[0]` keep working) but it is a real code
change, not a pure reuse — call it what it is in the plan.
Since it's genuinely generic (not OCR-specific), the (extended) client moves to
`packages/app-shell-core/src/lib/simSearch.js` as a shared primitive; `tools/app-shell`'s
OCR ingest is updated to import it from there instead of keeping its own copy.

**Entity-name mapping is not automatic.** `ModelProvider.getEntity(entityName)` needs the
actual Etendo/Openbravo DAL entity name, which is **not guaranteed to equal** the
contract's `reference` value. Confirmed example: Product's `taxCategory` field has
`reference: "TaxCategory"` (`artifacts/product/contract.json`), but there are **two**
distinct Java model classes literally named `TaxCategory` in the Etendo core
(`org.openbravo.model.common.businesspartner.TaxCategory` and
`org.openbravo.model.financialmgmt.tax.TaxCategory`) — which one (if either) is registered
under the plain DAL name `"TaxCategory"` needs to be verified against `AD_Table`, not
assumed from the contract label. `decisions.json → import.fields[]` therefore needs an
explicit optional `matchEntity` override per FK column (defaulting to `reference` when
that happens to be correct, but overridable when it isn't) — resolved and hard-coded once
per window during implementation, not derived generically at runtime.

**Not every `foreignKey` column is "match an existing record" — some are "create a new
one."** Contacts' `locationAddress.locationAddress` field points at `C_Location`, which has
no meaningful `name`/`value` to trigram-match, and for a brand-new contact there is nothing
existing to match against anyway — the row's location should be **created**, not looked
up, exactly like the existing composite-descriptor pattern already does for other
sub-entities via `$ref`. The two FK-resolution modes are therefore:
- **`match`** — resolve free text to an existing record's id via the matching engine (UOM,
  ProductCategory, TaxCategory, and Location's own `country`/`region` sub-fields — small,
  standard reference lists, safe to match).
- **`createInline`** — the composite descriptor emits its own nested `create` op for that
  sub-entity (e.g. Location) instead of resolving to an existing id; any of *its* required
  FK fields (country, region) use `match` mode themselves.

This replaces the earlier (incorrect) framing that treated Contacts' location field as
"the same shape" as Product's UOM/category — it isn't, and needs its own `createInline`
path in `buildOperations.js`'s Contacts descriptor, not a lookup.

**Match resolver (`resolveForeignKeys.js`, import-specific, `match`-mode columns only):**
1. For each `match`-mode `foreignKey` column, collect the **distinct raw text values**
   across the file, normalized (trimmed, case-folded) so `"Kg"` and `"kg "` collapse to the
   same lookup (a 500-row file with 3 distinct UOM strings does one `simSearch` call for
   those 3 values, not 500 lookups).
2. Call the matching engine once per column with that distinct-value list and
   `qtyResults > 1`, using each column's resolved `matchEntity`.
3. Classify each distinct value:
   - **auto-resolved** — a single candidate clears a confidence threshold with no close
     runner-up → used directly, no user interaction.
   - **needs review** — zero candidates above threshold, or two+ candidates too close to
     call → surfaced to the user (see below), not treated as a hard error yet.
4. Cache the resulting `value → id` table for the run and reuse it in `buildOperations`.
   Accepted v1 limitation: two rows whose raw text is identical always collapse to the
   same resolved id, even in the (rare) case where they should legitimately point at two
   different real-world records — not solved generically, worth remembering if it bites
   someone.

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

**Required-field coverage is a per-window verification, not a generic guarantee.**
Checking `artifacts/contacts/contract.json`'s `businessPartner` entity turned up more
required fields than the illustrative example above shows — some hidden from the normal
form (`form: false`, e.g. `businessPartnerCategory`, a required `foreignKey`) that are very
likely already covered by NEO's own default-injection (`DefaultJsonDataService.add`, the
same codepath a normal single-record create already relies on for these — not a new
problem CSV import introduces), and some genuinely user-facing and required
(`name`, `etgoFirstname`, `etgoLastname`, `oBTIKTaxIDKey`, `creditLimit`). **Every
`required: true, form: true` field of every entity node in a window's import descriptor
must have coverage** — a CSV column mapping, or a fixed default in `decisions.import` — or
that row will fail row-level validation with a clear reason. This is verified per-window
at implementation time (Contacts vs Product each get checked against their own contract),
not assumed to be automatically complete. One universal rule regardless of window:
**fields with `type: "button"` (e.g. `setNewCurrency`) are never valid import targets**,
even if `required: true` — they're UI actions, not data, and must be excluded from
`decisions.import.fields` at the schema level.

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

**Reference mock:** a 7-screen interactive prototype built with Claude Design, project
"Pasted images" (`865968a8-af18-4c9f-a45c-d2abec42245a`), file
`Flujo Importación Contactos.dc.html`. It defines the authoritative **interaction flow,
screen anatomy, and Spanish copy** for the Contacts import (Product's copy follows the
same anatomy with its own field/entity labels). It ships its own parallel CSS design
system (custom properties like `--etendo-ink`, `--purple-500`, plain classes like `.btn`/
`.modal`/`.pill`) that **does not match** this repo's actual tokens
(`tools/app-shell/src/index.css` — shadcn/HSL, no purple/yellow brand colors). Decision:
**fidelity of interaction and anatomy, not of skin** — the implementation uses this
repo's real shadcn/Radix primitives already in `app-shell-core/src/components/ui/`
(`dialog.jsx`, `table.jsx`, `button.jsx`, etc.), styled with the app's actual theme, not
the mock's custom properties or plain CSS classes.

**Three points where implementation deliberately diverges from the mock, resolved
during design review (not oversights):**
- The mock's confirm step shows a "Crear etiquetas automáticamente" (auto-create tags)
  checkbox. **Dropped entirely** — Contacts/Product have no tagging feature in this
  design; there is nothing for it to control.
- The mock shows "Evitar duplicados" (avoid duplicates) as a per-run checkbox the user
  could untick. **Not implemented as a toggle** — dedupe stays exactly as already
  specified: driven by `decisions.import.dedupe`, always applied when configured, no UI
  toggle. The confirm step therefore shows the two stat lines and no checkboxes at all.
- The mock's result screen (1f) shows a **one-time downloadable error report** ("descarga
  los errores ahora, ya que no podrás consultarlos nuevamente" — download now, you won't
  be able to see them again) with no way to revisit or act on failed rows afterward. **The
  interactive review queue already specified above is kept** — a "Download errors" button
  is added as one more action *inside* the review queue (export what's currently in the
  queue to CSV), not as a replacement for it. Nothing about failed rows is one-shot or
  unrecoverable within the session.

**Exact screen anatomy and copy from the mock** (Spanish; Contacts window shown, Product
follows the same shape with `product`'s own contract field labels):

1. **1a — Empty state**: dropzone with copy "Arrastra tu archivo aquí" / "o selecciona un
   archivo. Formatos compatibles: CSV o TXT" (mock says "XLS, CSV o TXT" — **XLS dropped**
   per this spec's non-goals), heading "Empieza agregando tus contactos", subtext "Puedes
   crearlos manualmente o importarlos en segundos", and a single primary "Nuevo contacto"
   button (the mock's second button, "Pídeselo a Copilot", is **not implemented** — AI-
   assisted import is an explicit non-goal). The toolbar's import trigger is a secondary
   `IconButton` (upload icon) placed among the other trailing toolbar icons (search,
   filter, more), matching the mock's `ContactosToolbar` layout exactly.
2. **1b — Column mapping**: header shows "Importar contactos" + an info pill "{N} filas
   detectadas" + "Archivo cargado: {filename}" subtitle. Below it, one `colhead` chip per
   detected column with a chevron-down (opens the target-field picker), then the row
   preview table. Footer: a red "{N} Errores encontrados" link on the left (opens the
   review queue filtered to errors), "Volver" (secondary) and "Importar {N} contactos"
   (primary) on the right.
3. **Preview + review queue** — as already specified above (this is the mock's step 1b
   continued, once the user interacts with mapped/erroring columns) — unchanged by the
   mock, since the mock only shows the static "before interaction" state.
4. **1c — Confirm**: title "Confirmar importación", "Se importarán {N} contactos", "{M}
   filas serán omitidas por errores", "Cancelar" (secondary) / "Confirmar importación"
   (primary) — no checkboxes, per the divergence above.
5. **1d — Progress**: "Importando contactos…" label with a live percentage (tabular-nums),
   a progress bar, and "Procesando filas" as secondary text underneath — driven by
   `importEngine`'s progress callback.
6. **1e — File-level error**: a blocking dialog (not the review queue — this is the
   file-level error case from Error handling below) with a danger icon, "No se pudo
   completar la importación", "Ocurrió un problema al procesar el archivo. Verifica el
   formato e inténtalo nuevamente.", "Cancelar" / "Reintentar".
7. **1f/1g — Result**: if any rows failed, a warning banner — "{M} filas fueron omitidas
   por errores." plus two actions: "Ver filas con error" (opens the review queue, scoped
   to this run's failures) and "Descargar errores" (exports the current review-queue
   contents to CSV) — followed by the imported-rows table. A dismissible success toast,
   bottom-center, reads "{N} contactos importados correctamente".

Steps, matching the mock's flow:
1. **Dropzone** — accepts `.csv`/`.txt`, shows detected row count (mock screen 1a).
2. **Mapping table** — one column per detected header, auto-mapped via `mapColumns`,
   each with a dropdown to override the target field (or mark "not imported") (1b).
3. **Preview + review queue** — see "Review queue" below; default view is capped/sampled
   (see Performance section), with a toggle to show only rows that still need attention
   (validation errors, FK `needs-review`, in-file dedupe-skips) versus all rows (1b
   continued).
4. **Confirm dialog** — "Will import N contacts, M rows will be skipped due to errors",
   no options/checkboxes per the divergence above (1c).
5. **Progress** — "Importing… X%" driven by `importEngine`'s progress callback (1d).
6. **Result** — success toast/count + the same **review queue** pattern applied to
   server-rejected rows, plus a Download-errors export action (see below) (1f/1g). File-
   level parse failures use the separate blocking error dialog instead (1e).

#### Review queue (shared pattern, used in step 3 and step 6)

Both "rows that fail validation before sending" and "rows the server rejected after
sending" use the same interaction model, since the user's ask is one workflow — "hide the
ones that are fine, work the failing ones until they clear or I explicitly skip them":

- **Filter toggle**: "Show only errors" / "Show all", available in both the preview step
  and the result step independently (each step remembers its own toggle state).
- **FK values needing review** are listed once per distinct value (not per row), each with
  the `simSearch` candidates to pick from or a manual entity-search fallback — resolving a
  value live-clears every row that shares it, as already described above.
- **Per-row inline editing** — the two stages surface errors at different granularity, so
  the editable surface differs too:
  - **Pre-send**: `validateRow` returns a reason **per field**, so only the specific
    erroring cell(s) are highlighted and editable, using the same field-input component the
    record's own form would use for that field's type (text, email, the FK selector for a
    `foreignKey` field, etc.).
  - **Post-send**: `/batch` failures come back as `{ failedAt: { index, id }, error:
    { message } }` — an **operation-level** error, not a field name (verified in
    `BatchService.java`). There is no reliable way to highlight "the" bad cell. The editable
    surface for a post-send failure is therefore the row's **full set of mapped fields**,
    with the server's `error.message` shown as context above them, not a single flagged
    cell.
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
- **Download errors** (result-step queue only, per the mock's screen 1f): exports the
  queue's *current* contents (still-failing + skipped rows, with their reasons/server
  messages) as a CSV the user can act on outside the app. This is additive — it does not
  clear or close the queue, and the user can keep editing/retrying after downloading.
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

- **File-level**: unreadable/empty file, unknown delimiter, duplicate headers → the
  blocking dialog from the mock's screen 1e ("No se pudo completar la importación" / a
  one-line reason / "Cancelar" / "Reintentar" — Retry re-opens the dropzone step so the
  user can pick a corrected file, it does not blindly re-parse the same bad file).
- **File encoding**: Spanish-locale Excel exports commonly save CSV as Windows-1252, not
  UTF-8 — decoding those as UTF-8 corrupts exactly the accented text (`ó`, `ñ`) the FK
  matching engine and validators most need to read correctly. `parseDelimited.js` decodes
  as UTF-8 first and falls back to Windows-1252 if the result contains the UTF-8
  replacement character (`�`); still garbled after that is a file-level error, not a
  silent corruption.
  Two columns sharing a header name ("column 'Email' appears twice") surfaces through the
  same blocking dialog with that specific reason — no attempt to guess which one wins.
- **Locale-formatted values**: numeric/decimal and date columns (e.g. `amount`, `date`
  contract types) accept common alternate formats (`"1.234,56"`, `dd/mm/yyyy`) during
  validation/normalization, not just the raw ISO/plain-number shape a hand-authored English
  CSV would use — this repo's primary users are Spanish-locale, per CLAUDE.md's i18n rule.
- **Row-level (pre-send)**: missing required field, FK value still `needs-review`, format
  mismatch, in-file duplicate → row excluded from send, listed in the review queue with a
  per-field reason, never silently dropped.
- **Row-level (server, confirmed failure)**: `/batch` responds with `committed:false` for
  that row → row marked failed with the server's `error.message`, enters the result-step
  review queue (edit + retry, or skip). A row's own multi-op transaction (e.g.
  BP+Location+Contact) still rolls back atomically per existing `BatchService` behavior —
  no partial sub-entities.
- **Row-level (server, ambiguous — no response)**: a `/batch` call that times out or the
  network drops **without a response** is NOT treated as a safe-to-retry failure — per the
  no-idempotency-key nuance above, the server may have already committed it. This state is
  surfaced distinctly ("unknown result — verify before retrying") rather than folded into
  the normal failed-row retry flow.
- **Session/token expiry mid-import**: a long run (thousands of rows at bounded
  concurrency) can outlive the auth token. On a 401, the engine halts further sends
  immediately — it does not burn through the remaining queue racking up spurious failures
  — and marks unsent rows "not attempted (session expired)". After the user re-
  authenticates, those rows are resumed through the same per-row `sendRow`/Retry mechanism
  already built for the review queue, not a separate code path.
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
isolation with `postBatch` mocked — dedupe collisions, FK resolution (`match` vs
`createInline` modes, auto-resolved / needs-review with candidates / needs-review with
zero candidates, `matchEntity` override, and the user-picks-a-candidate /
user-uses-manual-fallback paths), `validateRow` single-row re-validation after an inline
edit, `sendRow` single-row retry after an inline edit, `maxRows` truncation, concurrency
bound, Windows-1252 encoding fallback, duplicate-header rejection, locale-formatted
number/date parsing, the ambiguous-timeout-vs-confirmed-failure distinction, and
session-expiry mid-import halting remaining sends. The extended `simSearch.js` (relocated,
plus the multi-candidate parser change) keeps its existing test coverage (not rewritten,
only extended) plus a regression test that `tools/app-shell`'s OCR ingest still imports it
correctly post-move and that single-candidate callers are unaffected. Component-level
tests cover the review queue: filter toggle (preview and result independently), inline
edit + re-validate/retry clearing a row from the queue (pre-send field-level highlight vs
post-send whole-row edit), and the Skip action reporting a row as "skipped by user" rather
than "failing". Per CLAUDE.md, test-writing is delegated to the `test-generator` subagent
(Tester) during implementation, not written ad hoc.

## Open items explicitly deferred (not this iteration)

- Real ceiling for `limit.maxRows`/`concurrency` — ships as a config knob, tuned later
  against real payload sizes.
- Dedupe against existing (already-persisted) records.
- XLSX support.
- Update/upsert semantics for rows that collide with existing records.
