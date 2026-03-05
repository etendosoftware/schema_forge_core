# Resolved Decisions — Schema Forge Day-1

| Date | 2026-03-05 |
|------|-----------|

---

## Blocking Decisions (Wave 1)

| # | Decision | Resolution | Impact |
|---|----------|-----------|---------|
| D1 | Etendo version | **Etendo 26.x** | Generated templates and APIs target 26.x. Record in `ETENDO_VERSION` |
| D2 | Node.js version | **Node.js 22 LTS** | Record in `.nvmrc`. Mature node:test, native ESM |
| D3 | DB for extractors | **Development/staging DB** | Not production. Variables in `.env.example` |
| D4 | Schema of `steps[].operation` | **Only validate + mutation + forEach** | The 3 types used by completeOrder. Add more when needed |
| D5 | Process generation | **Option A: Partial generation + stubs** | Generate structure, preconditions, dispatch. Stubs with TODO for complex logic |
| D6 | Add voidOrder | **Yes** | Phase 5 now includes completeOrder + voidOrder. openPeriod deferred |
| D7 | UI Generator | **Basic conversational AI** | Simple chat with Claude that generates React. Unpolished but functional |

## Decisions for Wave 4

| # | Decision | Resolution |
|---|----------|-----------|
| D8 | Step types to define | **validate + mutation + forEach** (aligned with D4) |
| D9 | Etendo for JUnit CI | **Local only for now**. CI only runs contract tests (Node.js) |
| D10 | UUIDs in dataset XML | **Random but registered** in manifest. Re-generations reuse the same ones |
| D11 | Java source for Rule Extractor | **src/ directory of the local Etendo installation** |

## Recommended Decisions

| # | Decision | Resolution |
|---|----------|-----------|
| D12 | Test runner | **node:test (built-in)** — zero dependency |
| D13/D14 | API fallback | **No** — assume API always available |
| D15 | Artifacts in git | **In the repo (versioned)** — full traceability |
| D16 | Date format | **ISO 8601 always** — frontend converts |
| D17 | Shortcuts in code | **Yes** — convention `// TODO(vertical-slice): description` |

---

## Summary of changes to the Vertical Slice

Changes relative to the original design:

1. **Phase 5 expanded:** Now includes completeOrder + voidOrder (2 of 3 MVP processes)
2. **Phase 8 changed:** From static React to basic conversational AI (chat + Claude + preview iframe)
3. **Step operation schema:** Only 3 types (validate, mutation, forEach) — YAGNI for the slice
4. **JUnit in CI deferred:** CI only runs contract tests. JUnit is local.
5. **Registered UUIDs:** UUID manifest generated for idempotency
