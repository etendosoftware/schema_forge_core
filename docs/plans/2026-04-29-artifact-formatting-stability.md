# Artifact Formatting & Output Stability

**Status:** Pending — not yet scheduled. To be applied as a single coordinated rollout.
**Author:** Forge session, 2026-04-29
**Scope:** `artifacts/*/decisions.json`, `artifacts/*/contract.json`, `artifacts/*/generated/**/*.jsx`, plus extractors/generators that emit them.

---

## 1. Problem Statement

Every `make regen` produces noisy diffs in `artifacts/`, even when no semantic change occurred. This makes PR review harder, hides real changes inside cosmetic churn, and makes the pipeline feel non-deterministic.

The repo currently has **no formatter** configured anywhere (no Prettier, no ESLint, no Biome at root or in any workspace). Generated outputs are written via raw `JSON.stringify` and string templates, so any incidental change to upstream order propagates verbatim into the artifacts.

## 2. Two Distinct Root Causes

It is critical to separate these — they require different fixes and a formatter only addresses one of them.

### 2.1 Non-deterministic ordering (semantic noise)
Object key order and array element order shift between runs because:
- DB queries in `cli/src/extract-fields.js` / `extract-rules.js` rely on AD's `ORDER BY` which is sometimes ambiguous when sequences tie.
- JSON serialization preserves insertion order, which depends on join order and result-set traversal.
- Field arrays inside `entities[].fields` can swap when AD `seqno` values are equal.

**A formatter does NOT fix this.** It only reformats indentation. The diff still shows reordered entries.

### 2.2 Inconsistent formatting (cosmetic noise)
- Generated `.jsx` emits inline arrays of multi-KB option lists on a single line (see `IntrastatForm.jsx`: lines 8–11 are each ~5 KB).
- JSON files written with mixed indent depth in places.
- No trailing-newline policy.

**A formatter fixes this completely.**

## 3. Options (ranked by cost/benefit)

### Option A — Biome formatter (recommended)
- Single binary, covers JSON + JS + JSX + TS, ~10× faster than Prettier+ESLint.
- Setup:
  - `npm i -D --save-exact @biomejs/biome` at the repo root.
  - `biome.json` with `formatter: { indentStyle: "space", indentWidth: 2, lineWidth: 100 }`.
  - Add a `make format` target.
- Integration points:
  - End of `make regen` → `biome format --write artifacts/`.
  - Pre-commit hook (already exists at `.githooks/pre-commit`) → run `biome format --write` on staged JSON/JSX.
- Effort: ~1 hour config + one-time mass reformat commit.
- **Effect:** removes 100% of cosmetic noise. Long inline JSX arrays become readable multiline blocks.

### Option B — Stable key/array ordering in generators
Addresses cause 2.1. Touch:
- `cli/src/extract-fields.js`, `extract-rules.js`: deterministic `.sort()` (by `name` or `apiKey`) before writing.
- `cli/src/resolve-curated.js`, `generate-contract.js`: enforce canonical order on `entities[].fields` (e.g., DB seq → name as tiebreaker).
- For `decisions.json` (human-edited): a `sort-decisions.js` that **preserves** field-within-entity order (intentional, encodes UX seq) but sorts entities and rules alphabetically.

Effort: 2–4 hours. Pays back on every future PR.

### Option C — JSX template cleanup
Largely subsumed by Option A. With `lineWidth: 100`, Biome reformats the inline option arrays automatically. No template changes needed.

### Option D — Idempotency check in CI
After A and B land, add a CI step:
```bash
make regen
git diff --exit-code artifacts/
```
If a fresh regen against unchanged inputs produces a diff, CI fails. This *forces* the pipeline to remain stable and prevents 2.1 from creeping back.

Effort: 30 minutes once A+B are stable.

## 4. What to Skip
- **ESLint** — no benefit on generated files; the hand-written surface is small.
- **Prettier** — functionally equivalent to Biome, slower, two binaries (Prettier + ESLint).
- **AST-based generators (ts-morph, recast)** — overkill, doesn't add anything Biome doesn't already give us.

## 5. Suggested Rollout (single ~1-day window)

Land as a sequence of small, isolated commits to keep blame readable.

1. **Commit 1 — tooling only.** Add Biome devDependency, `biome.json`, `make format` target. No file content changes yet.
2. **Commit 2 — mass reformat (no logic).** Run `make format` over `artifacts/` and `tools/app-shell/src/`. Commit message: `Reformat artifacts with Biome — no logic changes`. Add this SHA to `.git-blame-ignore-revs`.
3. **Commit 3 — pipeline integration.** Wire `biome format --write` into `make regen` (end step) and into `.githooks/pre-commit` (staged files only).
4. **Commit 4 — stable ordering.** Apply Option B sort changes in extractors/generators. Single commit titled `Stabilize artifact ordering`. Re-run `make regen` and commit the resulting (now-final) artifact churn.
5. **Commit 5 (optional, later) — CI idempotency check.** Option D.

## 6. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Mass reformat destroys `git blame` history | Add formatting commit SHA to `.git-blame-ignore-revs`. Editors and `git blame --ignore-rev` honor it. |
| Pre-commit hook becomes slow on large stages | Biome is fast (~ms per file). Already mitigated. |
| Stable-sort change in extractor produces a one-time large diff | Land in a dedicated commit (Commit 4 above), not mixed with feature work. |
| Human-edited `decisions.json` files get reordered against author intent | Restrict the JSON sort to top-level `entities` keys and `rules` keys; never reorder within `fields` (that order is intentional UX seq). |
| Biome's JSX rules disagree with current style | Biome formatter is opinionated but configurable; pin `lineWidth` and `quoteStyle` after a dry-run on a sample window. |

## 7. Estimated Total Effort

| Phase | Hours |
|-------|-------|
| Biome config + format target | 1 |
| Mass reformat commit + blame-ignore | 0.5 |
| Pipeline + hook integration | 1 |
| Stable ordering in extractors/generators | 3 |
| CI idempotency check | 0.5 |
| Buffer / verification across all 28 windows | 2 |
| **Total** | **~8 hours** |

## 8. Decision Pending
The user has chosen to defer this work. When scheduled, execute as a single coordinated rollout (Section 5) rather than incrementally — a partial state (formatter without stable ordering, or vice versa) leaves the diff problem half-solved and adds churn without a clean payoff.
