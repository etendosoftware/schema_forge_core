---
name: innocuous-check
description: >
  Verify that pending changes are behavior-preserving (innocuous) — that a refactor
  does NOT alter observable functionality. Use after refactoring to lower cognitive
  complexity, resolve SonarQube issues, rename, extract/inline functions, or apply
  guard clauses. Analyzes the diff hunk by hunk for behavior-changing edits, flags poor
  function names (generic auto-extract names, placeholders), then runs the affected tests.
  Triggers on: "is this safe", "inocuo", "inocuidad", "refactor", "bad function names",
  "did I break anything", "behavior preserving", "Sonar fix", "bajar complejidad cognitiva",
  "check my changes", "verify diff".
argument-hint: "[staged | unstaged | both]  (default: both)"
---

# /innocuous-check — Behavior-Preservation Verification

**Arguments:** `$ARGUMENTS` — scope to inspect: `staged`, `unstaged`, or `both`. Default: `both`.

Goal: confirm a change is a **pure refactor** — same inputs produce the same outputs and side
effects. The intent of these changes is to lower cognitive complexity, fix SonarQube findings,
and improve readability **without changing what the code does**. This skill is the gate that
catches accidental behavior changes hiding inside a "harmless" refactor.

This is a **read-and-verify** skill: it inspects and runs tests. It never edits code, never
commits, never stages. It produces a verdict only.

---

## Step 1 — Resolve scope and collect the diff

Pick the git command from `$ARGUMENTS` (default `both` when empty/unrecognized):

| Scope | Command |
|-------|---------|
| `staged` | `git diff --cached` |
| `unstaged` | `git diff` |
| `both` | `git diff HEAD` |

Also get the file list for the same scope (`--name-status` variant) so you know what changed:

```bash
git diff HEAD --name-status        # adjust flag per scope (--cached / no flag)
```

If the diff is empty, stop and tell the user there is nothing to check for that scope.

Only consider **source files** for behavior analysis (`.js`, `.jsx`, `.ts`, `.java`, `.py`).
Note — but do not behavior-analyze — changes to tests, docs, JSON config, and generated output.
Flag separately if the diff touches:
- `artifacts/*/generated/` → generated files must never be hand-edited (see CLAUDE.md). Warn loudly.
- `decisions.json` → this is config, not a refactor; behavior IS expected to change. Note it and skip the refactor analysis for it.

---

## Step 2 — Classify every hunk

For each changed source hunk, label it as one of:

- **PURE** — provably behavior-preserving (rename of a local, extracted helper called identically,
  reordered independent statements, dead-code removal, formatting, early-return that covers the
  exact same cases, simplified boolean that is logically equivalent).
- **RISKY** — could change behavior; needs justification or a test. (See the catalog in Step 3.)
- **INTENTIONAL** — clearly changes behavior on purpose (new feature, bugfix). Out of scope for an
  "innocuous" claim — call it out so the user knows this is NOT a pure refactor.

Reason about *semantic equivalence*, not textual similarity. A small diff can change behavior; a
large diff can be a faithful extraction.

---

## Step 3 — Behavior-change risk catalog (the core check)

These are the traps that turn a "harmless" refactor into a regression. Inspect the diff for each:

**Control flow**
- Inverted/De-Morgan'd conditionals that are subtly wrong (`!(a && b)` → `!a && !b`).
- Guard clause / early return that changes which branch runs for edge inputs.
- Changed short-circuit order (`a() && b()` → `b() && a()`) when `a`/`b` have side effects or one guards the other.
- Loop bounds shifted (off-by-one) when restructuring `for`/`while`/`map`.
- `switch` fallthrough or default branch altered.

**Values & types**
- Default values added/removed/changed (param defaults, `||` vs `??`, `?.`).
- Null/undefined/empty handling changed (a removed `if (!x) return` is a behavior change).
- Truthiness vs strict equality (`==` ↔ `===`, `0`/`''`/`NaN`/`false` edge cases).
- Return value or shape changed (returns `undefined` where it used to return `null`/a value).
- Number/string coercion differences.

**Side effects & ordering**
- Reordered statements where order matters (mutation before read, logging, I/O, DB writes).
- A side-effecting call moved inside/outside a conditional or loop, changing how often it runs.
- Caching/memoization added that can serve stale values.
- Async: `await` added/removed, `Promise.all` ↔ sequential, race conditions, unhandled rejections.

**Error handling**
- `try/catch` scope widened/narrowed; an error now swallowed or newly thrown.
- Error type or message that other code (or tests) depends on.

**Scope & visibility**
- A `const`/`let` hoisted or its scope changed; closure capture altered.
- Function/variable visibility changed (exported ↔ local) affecting other modules.
- `this` binding changed (arrow vs function, extracted method).

**Extraction fidelity (the most common refactor here)**
- Extracted function does NOT receive/return everything the inline code used (missing param, lost mutation).
- Extracted code is now called conditionally where it used to always run (or vice versa).
- A variable the extracted block mutated in the outer scope is now local to the helper.

For each RISKY hunk, write one line: *what could change* and *under which input*. If you can prove
it is actually safe, downgrade it to PURE with the reason. If you cannot, it stays RISKY and must be
backed by a passing test (Step 4) or escalated to the user.

---

## Step 4 — Naming quality of new/renamed identifiers

Automated refactor tools (and rushed manual extractions) leave bad names behind. A refactor that is
behavior-correct but ships a meaningless name is **not done** — it hurts the very readability the
refactor was meant to improve. Inspect every **newly introduced or renamed** function, method, and
significant variable in the diff and flag:

- **Generic auto-extract names** — `extracted`, `extractedMethod`, `extractedMethod1`, `extracted_2`,
  `newMethod`, `method1`, `func`, `helper`, `helperFunction`, `doStuff`, `handle`, `process`,
  `temp`, `tmp`, `foo`, `bar`, `aux`. Anything matching `/^(extracted|new|temp|tmp|aux|helper|method|func)\w*\d*$/i`.
- **Placeholder / keyboard-mash names** — gibberish like `akjsdnjajkdknasd`, `asdf`, `qwerty`, `xxx`,
  `test123`, `aaa`. Heuristics: no recognizable English word; long runs of consonants; repeated
  characters; random-looking case. When in doubt, ask "could a teammate guess what this does from
  the name alone?" — if no, flag it.
- **Misleading names** — the name claims something the body does not do (e.g. `validateInput` that
  also mutates and saves, `getX` that performs I/O). Flag the mismatch.
- **Lost meaning on rename** — a previously descriptive name replaced by a vaguer one.

For each flagged identifier, **suggest a concrete better name** derived from what the function
actually does — its inputs, its return value, and its side effects. Prefer the verb-noun convention
already used in the surrounding file (match the codebase's style, camelCase for JS, etc.). Give 1–3
options, e.g.:

```
path/to/file.js:42  function extractedMethod1(order, lines)
  ⚠️ Generic auto-extract name.
  → suggests: calculateOrderTotal(order, lines)  |  sumLineAmounts(lines)
```

Naming issues do **not** by themselves make a change "NOT innocuous" (behavior is unchanged), but
they DO force the verdict to at least ⚠️ REVIEW NEEDED — the refactor is incomplete until names are
fixed. List them prominently.

---

## Step 5 — Run the affected tests

Identify and run the tests covering the changed source files. Prefer **targeted** runs over the
full suite for speed; fall back to the full suite when mapping is unclear.

1. For each changed source file, find its test:
   - Same basename in `cli/test/<name>.test.js`, `tools/app-shell/**/__tests__/<name>.test.js`,
     `tools/app-shell/test/<name>.test.js`, or `artifacts/**/__tests__/`.
   - If not found by name, grep the test dirs for the module/function name to find indirect coverage.

   ```bash
   # Example: changed cli/src/quality-gate/runner.js
   ls cli/test/ | grep -i runner
   grep -rl "quality-gate/runner\|runner" cli/test/ tools/app-shell/test/ 2>/dev/null
   ```

2. Run the matching tests:
   ```bash
   cd cli && node --test 'test/<name>.test.js'        # single CLI test file
   cd tools/app-shell && npx vitest run <path>         # single React/vitest file
   ```

3. If no specific test maps to a RISKY hunk, **say so explicitly** — an unverified RISKY change is
   the headline of the report, not a footnote. Offer to run the full suite (`make test`) or to
   delegate writing a covering test to the `test-generator` subagent (Tester).

4. If the change touches a window's `decisions.json` or generator, the relevant verification is the
   Window Change Integrity Protocol (CLAUDE.md), not unit tests — point the user there.

Report each test command and its real pass/fail result. Never claim tests pass without running them.

---

## Step 6 — Verdict

Output a compact report:

```
INNOCUOUS-CHECK — scope: <staged|unstaged|both>
Files: <N source, M other>

Verdict: ✅ INNOCUOUS | ⚠️ REVIEW NEEDED | ❌ NOT INNOCUOUS

Hunks:
  PURE         <count>
  RISKY        <count>   ← each listed below with reason
  INTENTIONAL  <count>   ← behavior changes on purpose (not a pure refactor)

Risky hunks:
  • path:line — <what could change> — <covered by test? which?>

Naming issues:
  • path:line  <identifier> — <generic | placeholder | misleading> → <suggested name(s)>

Tests run:
  • <command> → PASS/FAIL (X passed, Y failed)

Unverified risks:
  • <any RISKY hunk with no covering test>
```

**Verdict rules:**
- ✅ **INNOCUOUS** — every hunk is PURE (or every RISKY hunk is backed by a passing test), no INTENTIONAL hunks, AND no naming issues.
- ⚠️ **REVIEW NEEDED** — RISKY hunks without covering tests, missing tests, generated files touched, OR any naming issue (generic/placeholder/misleading name). A clean-behavior refactor with a `extractedMethod1` is still ⚠️ until renamed.
- ❌ **NOT INNOCUOUS** — a test fails, OR a hunk demonstrably changes behavior, OR INTENTIONAL changes are present while the user claimed a pure refactor.

Be honest and specific. The value of this skill is catching the one inverted condition in a
200-line "cleanup". A false ✅ is worse than a noisy ⚠️.

---

## Notes

- Stay read-only. Do not stage, commit, edit, or regenerate anything.
- Cognitive-complexity / Sonar refactors are the primary use case: the code should be *equivalent*,
  just simpler. If you cannot convince yourself a hunk is equivalent, it is RISKY.
- Test commands and the full suite live in the project `Makefile` (`make test`) and root
  `package.json`. Targeted `node --test` / `vitest run` are preferred for fast iteration.
- To compare cognitive-complexity metrics before/after, the user can run `./cli/sonar-check.sh`
  on the changed Java files (this skill does not do that automatically).
