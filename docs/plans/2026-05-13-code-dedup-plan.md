# Code Duplication Cleanup & Cognitive Complexity Reduction

**Owner:** Forge (coordinator) + Valentin
**Jira:** TBD — new task to be created inside the current epic
**Branch:** TBD — `feature/<NEW-TICKET>` off the epic branch
**Date:** 2026-05-13
**Status:** Draft — pending user approval

---

## 1. Goal

Reduce duplication and cognitive complexity across `cli/src/` (Node generators/extractors) and `tools/app-shell/src/` (React runtime UI), and leave behind **reusable tooling** (a skill + a subagent) that:

1. Detects duplication and high-complexity hotspots on demand.
2. Proposes refactors grounded in patterns we've already validated in this repo.
3. Learns from each fix — every closed case becomes a rule the tool knows next time.

Out of scope:
- `artifacts/*/generated/` (regenerated, never hand-edited).
- DB row duplicates (already covered by `cli/src/detect-neo-duplicates.js` + `dedupe-neo.js` + `cli/sql/neo-constraints.sql`). We **reuse the mental model** of that pipeline, not the code.

---

## 2. Tooling — recommended stack

All free, runnable locally, no external services required.

| Tool | What it finds | Why pick it |
|---|---|---|
| **jscpd** | Token-based copy-paste blocks (multi-language: js/jsx/ts/tsx/json/md) | Fast, language-agnostic, JSON report, ideal first pass. |
| **similarity-ts** | AST-based near-duplicate functions in JS/TS | Catches "same shape, different names" that jscpd misses. Output is per-function pairs with similarity %. |
| **eslint + eslint-plugin-sonarjs** | Cognitive complexity, `no-identical-functions`, `no-duplicate-string`, `no-collapsible-if`, `prefer-immediate-return`, etc. | Hooks directly into existing lint pipeline. SonarJS rules align with what SonarQube already enforces on Java side. |
| **knip** | Unused exports/files/deps | Removes dead code before deduping (otherwise we refactor code nobody calls). |
| **madge** | Circular deps + module graph | Helps identify "god files" worth splitting. |
| **jscodeshift** (optional, phase 3+) | Codemod runner for AST rewrites | For mechanical refactors once a pattern is validated (e.g. inline `if/else` → ternary, extract repeated helper). |

**Rejected alternatives:** SonarQube (already used for Java; running it on JS adds infra weight for marginal gain over `eslint-plugin-sonarjs`). PMD CPD (Java-first). Codeclimate (SaaS).

Install command (all dev deps):
```bash
npm i -D jscpd similarity-ts eslint-plugin-sonarjs knip madge jscodeshift
```

---

## 3. Seed cases (user-provided)

The user supplies the initial set of duplication / complexity cases — these become the **first training data** for the skill and the **first targets** for Hunter.

Each case the user reports gets logged as:

```
.claude/skills/dedupe/cases/<date>-<short-name>.md
```

with: location (file:line), what's duplicated/complex, why it matters, agreed refactor approach, before/after metrics once fixed.

The automated detectors (Section 2) are used **as a verification layer** — to confirm we caught the dup the user pointed to, and to surface neighbours of the same pattern. They are **not** used to generate the initial work queue.

> **Pending input from Valentin:** list of cases to address first.

---

## 4. Phased plan

### Phase 0 — Baseline (1 session, ~2h)

1. Install tools (Section 2).
2. Add scripts to `package.json` / `Makefile`:
   - `make dedup-scan` → jscpd + similarity-ts + sonarjs report → writes `reports/dedup/<date>/`.
   - `make complexity` → eslint with sonarjs cognitive-complexity rule, threshold 15.
3. Run all tools, commit raw reports under `reports/dedup/2026-05-13/` (gitignored data, committed summary).
4. Produce `docs/dedup-baseline-2026-05-13.md` — top 20 duplication hotspots + top 10 complexity offenders, with file:line refs. **This becomes the work queue.**

**Exit criteria:** baseline report committed; top-20 list reviewed with user; priorities agreed.

---

### Phase 1 — Build the `dedupe` skill (1 session)

Location: `.claude/skills/dedupe/SKILL.md`

Responsibilities:
- Trigger words: "dedupe", "duplicado", "complejidad cognitiva", "refactor duplication", "/dedupe".
- Knows how to:
  - Run `make dedup-scan` and parse the reports.
  - Run `make complexity` and parse eslint output.
  - Match findings against a **patterns catalog** (`.claude/skills/dedupe/patterns/`) — one md file per known refactor pattern.
  - Recommend a refactor, citing prior case files.
- **Does not** write code itself — it produces a refactor brief for the user or for Hunter (subagent).

Initial patterns to seed (one md each):
1. `extract-shared-helper.md` — when N≥2 files repeat a 10+ line block with same shape.
2. `replace-switch-with-table.md` — long `switch`/`if-else if` chains → lookup object.
3. `split-god-function.md` — function with cognitive complexity > 15 → extract by section comment / by logical step.
4. `unify-traversal.md` — schema/AD walkers duplicated across generators → shared visitor in `cli/src/lib/walk-schema.js`.
5. `component-shell.md` — repeated React layout wrapper → generic `<WindowShell>` / `<FormSection>`.

Each pattern md has: when-to-apply, anti-pattern example, refactored example, validation steps (tests + `make regen` for generator changes).

**Exit criteria:** skill invocable via `/dedupe`, returns a prioritized refactor brief from the baseline report.

---

### Phase 2 — Build the `hunter` subagent (1 session)

Location: `.claude/agents/hunter.md`

Identity:
- **Name:** Hunter
- **Role:** DEDUP — detection and surgical refactor of duplication / high-complexity code.
- **Style:** Methodical, evidence-first. Never refactors without a baseline + test coverage check.

Responsibilities:
- Receives a refactor brief from `dedupe` skill or from Forge.
- Validates safety: tests exist for the affected code; if not, delegates to Tester first.
- Applies the refactor in a worktree.
- Runs `make dedup-scan` + relevant tests before/after; reports delta.
- Updates the skill's patterns catalog if a new pattern emerged.

Constraints:
- Never touches `artifacts/*/generated/`.
- For generator changes: must run `make regen ONLY=<window>` on at least 2 representative windows.
- Max 1 refactor per PR — keeps reviews small.

Dispatch rule added to CLAUDE.md `<team>` table:
| `hunter.md` | Hunter | DEDUP — applies dedup/complexity refactors flagged by the `dedupe` skill | Methodical |

**Exit criteria:** Hunter spawnable via `subagent_type="general-purpose"` with identity injected; completes one end-to-end refactor on a seed case.

---

### Phase 3 — Fix user-reported cases iteratively (N sessions, one PR each)

The order is **dictated by the user's seed cases** (Section 3) — not by automated heuristics. For each case:

For each case:
1. Hunter reads the brief + baseline numbers.
2. Hunter delegates to Tester if coverage is missing.
3. Hunter applies refactor in worktree, runs `make dedup-scan`, `make test`, `make regen ONLY=<sample>` if generator.
4. Alex (reviewer) validates diff + zero regression on `validate-pipeline`.
5. Clerk merges.
6. Hunter writes a case file: `.claude/skills/dedupe/cases/<date>-<short-name>.md` — before/after, lessons. The skill learns from this.

**Exit criteria per case:** PR merged, dedup metrics dropped, case file written, patterns catalog updated if needed.

---

### Phase 4 — Integration into pipeline (1 session)

1. Add `make dedup-scan` to CI (non-blocking, annotates PR with deltas).
2. Add SonarJS cognitive-complexity rule to the eslint config — **blocking** at threshold 20, **warning** at 15.
3. Extend REVIEW phase (Alex): "If diff adds a function with cognitive complexity > 15, reject unless justified in PR description."
4. Add `dedup-scan-delta` reporter that fails CI if duplication ratio increases vs `main`.

**Exit criteria:** CI gates active; one PR has been validated through the new gate.

---

## 5. Knowledge persistence

- **Patterns catalog** lives in `.claude/skills/dedupe/patterns/` — committed.
- **Case files** in `.claude/skills/dedupe/cases/` — committed; each one teaches the skill a real example.
- **Baseline reports** in `reports/dedup/<date>/` — raw JSON gitignored, summary md committed.
- **No memory entries** — all knowledge is in committed files so the whole team benefits.

---

## 6. Open questions

- [ ] Threshold for cognitive complexity: 15 (SonarJS default) or 20 (looser)?
- [ ] jscpd minimum tokens: 50 (noisy) vs 70 (default) vs 100 (only big blocks)?
- [ ] Do we want jscodeshift in phase 1 or wait until phase 3 when we have validated patterns?
- [ ] Should Hunter live in the existing pipeline (DEV → REVIEW → QA → DOCS) or as a side-channel agent invoked only on demand?

---

## 7. Next step

Approve plan → execute Phase 0 (baseline) in the next session. Phase 0 is read-only and reversible (only adds dev deps + reports), so it's a safe starting point.
