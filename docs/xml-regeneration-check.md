# Regeneration Check (offline)

Detect drift between the committed `ETGO_SF_*.xml` source-data and what `push-to-neo` would produce, **without** a database, an Etendo install, or `./gradlew export.database`.

## What it does

The regeneration check answers one question:

> If somebody ran `push-to-neo` against the current `decisions.json` + `contract.json` and then ran `export.database`, would the `ETGO_SF_*.xml` files change?

It does this by **applying a predicted delta on top of the committed XML** and comparing the result to the committed XML. If they match, there is no drift.

```
prev XML (committed)  ──┐
                        ├──►  applyDelta  ──►  predicted XML  ──►  diff vs prev
push-to-neo delta  ─────┘                                            │
   (computed offline                                                 ▼
    from contract.json                                          exit 0 = no drift
    + cached AD metadata)                                       exit 1 = drift
```

There are three building blocks, all DB-free:

1. **AD snapshot cache** (`cli/cache/ad-snapshot.json`) — captures the AD queries the extractors and `push-to-neo` would otherwise make to PostgreSQL. Refresh it once after every AD change; commit the diff.
2. **`push-to-neo --dump-delta`** — emits `artifacts/<spec>/neo-delta.json`: the upserts and deletes `push-to-neo` would issue, computed by mirroring `populateWindowSpec` against the cache and the committed `ETGO_SF_*.xml`.
3. **`xml-apply-delta`** — applies a delta on top of the committed XML and writes the predicted XML.

The bottom layer, `xml-regeneration-check.js`, then performs a canonicalized XML compare. It is the same tool the legacy Jenkins check used; the new layers above just feed it inputs computed offline.

## Quick start

```bash
# One-time / when AD changes: refresh the cache (this needs the DB).
make regen ONLY=sales-order CACHE_DB=1
git add cli/cache/ad-snapshot.json && git commit -m "Refresh AD cache"

# Then, in CI or locally — fully offline:
make regen-check ONLY=sales-order FROM_CACHE=1
```

Exit code:
- `0` → predicted XML equals committed XML, no drift.
- non-zero → drift detected (or pipeline error); inspect `tmp/regen-check/<spec>/`.

For multiple specs:

```bash
make regen-check ONLY=sales-order,sales-invoice FROM_CACHE=1
```

For a full help:

```bash
make regen-check-help
```

Cleanup:

```bash
make regen-check-clean
```

## How `make regen-check` works

The target orchestrates the three layers above, per spec listed in `ONLY=`:

1. `node cli/src/regen-all.js --only <spec> --from-cache` (or `--write-cache`) — re-runs extract/resolve/generate against the cache.
2. `node cli/src/push-to-neo.js <spec> --dump-delta tmp/regen-check/<spec>/neo-delta.json --prev-xml-dir <prev>`
   - With `FROM_CACHE=1` this exports `SF_CACHE_MODE=read`, so the AD queries hit the cache stub pool — no real DB connection is opened.
3. `node cli/src/xml-apply-delta.js --prev-xml-dir <prev> --delta tmp/regen-check/<spec>/neo-delta.json --out-dir tmp/regen-check/<spec>/predicted/sourcedata`
4. Copies the relevant `ETGO_SF_*.xml` from `<prev>` into `tmp/regen-check/<spec>/prev/sourcedata/`.
5. `node cli/src/xml-regeneration-check.js tmp/regen-check/<spec>/prev tmp/regen-check/<spec>/predicted --include-dir sourcedata` — the only step that does the actual diff.

`tmp/regen-check/` is gitignored.

Override variables:

| Variable | Default | Meaning |
|----------|---------|---------|
| `ONLY` | _(required)_ | Comma-separated kebab-case spec names |
| `FROM_CACHE` | `0` | Use `cli/cache/ad-snapshot.json` (no DB) |
| `CACHE_DB` | `0` | Refresh the cache from DB during the regen step |
| `REGEN_CHECK_PREV_XML_DIR` | `../modules/com.etendoerp.go/src-db/database/sourcedata` | Committed XML root |
| `REGEN_CHECK_OUT_ROOT` | `tmp/regen-check` | Where predicted/prev artifacts go |

## When does the cache need refreshing?

Refresh `cli/cache/ad-snapshot.json` whenever AD itself changes — typically because someone:
- Added/removed a column to a tab the spec uses.
- Added/renamed/removed a tab in the window.
- Renamed the window or its table.

```bash
make regen ONLY=<spec> CACHE_DB=1     # hits DB, rewrites snapshot
git add cli/cache/ad-snapshot.json
```

If the cache is stale, `make regen-check ... FROM_CACHE=1` will fail with an `AD_CACHE_MISS` error pointing at the query that needs to be cached.

## Limitations

- **Windows only.** `dump-delta` (and therefore `regen-check`) currently supports `specType=W`. Process and Report specs error out explicitly; tracked for a later slice.
- **XML comment trivia is not preserved.** `xml-regeneration-check.js` normalizes child order, strips comments, and sorts attributes before comparing. This is intentional — `export.database` does the same thing.
- **Audit columns are not predicted.** `Created`, `Updated`, `CreatedBy`, `UpdatedBy` are not part of the committed sourcedata XML, so the delta does not emit them.
- **Run a `regen` first.** The check assumes `artifacts/<spec>/contract.json` is up to date. The `make regen-check` target runs `regen-all.js` automatically with `--skip-extract` (or `--from-cache` when requested) to make this hold.

## Low-level CLIs (used internally by `make regen-check`)

You normally invoke these through `make regen-check`. They are documented here as reference.

### `xml-apply-delta.js`

```bash
node cli/src/xml-apply-delta.js \
  --prev-xml-dir <path-to-ETGO_SF_*.xml-dir> \
  --delta artifacts/<spec>/neo-delta.json \
  --out-dir <out>/sourcedata
```

Applies the upserts and deletes from the delta on top of the prev XML. Row alignment uses natural keys (`spec/tabId/columnId`) — not raw UUIDs — so existing rows keep their prev UUIDs.

### `xml-regeneration-check.js`

```bash
node cli/src/xml-regeneration-check.js <original_dir> <exported_dir> \
  [--format text|json] [--include-dir model/tables ...]
```

Generic XML comparator. Walks the include-dirs under both roots, canonicalizes each file (strip comments, sort attributes, sort children by JSON signature), and diffs.

Exit codes:

| Code | Meaning |
|------|---------|
| 0 | All files match |
| 1 | Drift detected (changed, missing, extra, or unparseable) |
| 2 | Usage / input error |

Output formats: `text` (human) or `json` (CI consumption).

## CI integration

Replace the old `install + make regen + push-to-neo + ./gradlew export.database + git diff` pipeline with:

```yaml
- name: Refresh AD cache (only on AD changes)
  if: contains(steps.changes.outputs.paths, 'cli/cache/ad-snapshot.json')
  run: |
    make regen ONLY=<spec> CACHE_DB=1
    git diff --exit-code cli/cache/ad-snapshot.json || echo "cache changed"

- name: Regeneration check (every PR)
  run: make regen-check ONLY=<spec> FROM_CACHE=1
```

The check requires only Node.js 22 and a checkout — no Etendo, no PostgreSQL, no Gradle.

## Testing

```bash
node --test cli/test/xml-apply-delta.test.js                # unit tests for apply-delta
node --test cli/test/regen-check.integration.test.js        # full pipeline in-process
node --test cli/test/push-to-neo.dump-delta.test.js         # delta computation
node --test cli/test/push-to-neo.dump-delta.no-db.test.js   # no-DB verification
```

Or, with everything else:

```bash
make test
```
