# Consolidated Risk Register — Schema Forge Day-1

| Property | Value |
|-----------|-------|
| Date | 2026-03-05 |
| Sources | scope-review.md (PO), architecture-review.md (Arch), risk-assessment.md (Ext) |
| Status | Consolidated — requires team decisions |

---

## Blocking Actions (resolve BEFORE writing code)

These items surfaced from all 3 evaluators and are consistent. Without resolving them, the vertical slice carries a high risk of costly rework.

### AB-1: Run extraction queries against real Etendo on day 1
**Source:** External Advisor (7.2), Architect (8.1)

Before designing the complete extractor, execute the 4 SQL queries from TDD 3.1 against the real Etendo instance. Save the result. Identify metadata inconsistencies (null fields, broken references, non-existent callouts). Make design decisions based on real data.

**Deliverable:** `artifacts/sales-order/raw-query-results/` with the raw CSVs.

---

### AB-2: Manually create a minimal Etendo module that compiles and works
**Source:** External Advisor (7.3), Architect (8.2)

Manually create (without a generator) the simplest possible Etendo module: a GET endpoint that returns hardcoded data, an event handler that logs the save. Compile with gradlew. Deploy to Etendo. Verify it responds. This validates build.gradle, module structure, classpath, XML format, and Application Dictionary registration — all before the generator attempts to do it automatically.

**Deliverable:** `artifacts/sales-order/generated-minimal/` compilable.

---

### AB-3: Build the "classification honeypot"
**Source:** External Advisor (7.1, 1.1, 1.4)

25-30 Sales Order rules with the correct decision manually annotated by someone with Etendo knowledge. Measure the pre-classifier's precision against this ground truth BEFORE trusting the 60%.

**Deliverable:** `artifacts/sales-order/classification-honeypot.json`

---

### AB-4: Edge case alignment session (2h) before Wave 1
**Source:** External Advisor (6.1, 6.2), Architect (2.1)

4 developers in parallel without established patterns = 4 different solutions to the same problem. Define 10-15 edge cases and agree on exact JSON representation:
- Field with `visibility: system` without `derivation` → error or warning?
- Rule whose Java class does not exist → how is it represented?
- Semantics of `confidence: high|medium|low`
- Error handling: throws vs returns error object
- DB access: shared pattern

**Deliverable:** `docs/conventions.md` with decisions and examples.

---

### AB-5: Define schema of `steps[].operation` per step type
**Source:** Architect (4.3, D4), External Advisor (2.4)

The `operation` field in process definitions is a "step-specific definition" without structure. The backend generator CANNOT be implemented without knowing what to read for `type: forEach`, `type: mutation`, etc. Write the `processes.json` for completeOrder by hand and derive the schema.

**Deliverable:** Formal schema in `schemas/step-operation.schema.json` + example in `artifacts/sales-order/processes.json`.

---

### AB-6: Decide what the generator generates vs what are stubs
**Source:** Architect (5.2, D5, D6), External Advisor (2.2)

The TDD shows `calculateOrderTax` as `/* ... */`. The team must agree on:
- Option A (recommended by Arch): Generate structure + preconditions + dispatch. Stubs with TODO for complex logic.
- Option B: Generate via AI (requires Etendo API context in prompt).
- Option C: Complex Handlebars helpers.

**Deliverable:** Decision documented in `docs/plans/evaluations/day-1-decisions.md`.

---

### AB-7: Document Etendo version and configure DB access
**Source:** Architect (D1, D3), External Advisor (3.1)

- Exact Etendo version → `ETENDO_VERSION` file in root
- Environment variables for DB → `.env.example`
- DB must NOT be production
- Verify that Java source code for callouts is available (not just JARs)

---

## Scope Gaps (decide whether to add to the slice)

### BS-1: 2 of 3 MVP processes missing (voidOrder, openPeriod)
**Source:** Product Owner (1.2)
**Severity:** High
**PO recommendation:** Add at least `voidOrder` to Phase 5. `openPeriod` can be deferred.

### BS-2: Conversational UI Generator absent
**Source:** Product Owner (5), External Advisor (4.1)
**Severity:** High — the core value proposition is not demonstrable
**Recommendation:** Decide whether Phase 8 is a technical placeholder or real MVP. If placeholder, document that the fast loop is the first priority of the next iteration.

### BS-3: Document Flows (decision 11) absent
**Source:** Product Owner (4)
**Severity:** Low (PRD 9.5: only enable/disable existing flows)

### BS-4: Version Checker absent from the waves plan
**Source:** Product Owner (4)
**Severity:** Medium

### BS-5: Day-2 lifecycle absent
**Source:** Product Owner (7), External Advisor (5.1-5.3)
**Severity:** Medium — acceptable for the first slice, must be on the visible roadmap

---

## High Technical Risks (monitor during development)

| # | Risk | Source | Severity | Mitigation |
|---|------|--------|-----------|-----------|
| RT-1 | Event handler ordering with Core handlers invisible to the extractor | Ext 3.2 | Critical | Inventory existing `@Handler` annotations on C_Order before generating |
| RT-2 | Code compiles but fails at runtime (LazyInit, OBContext, flush) | Ext 2.2 | Critical | AB-2 (minimal manual module) + tests against real Etendo |
| RT-3 | Handlebars insufficient for complex processes | Arch 1.3 | High | AB-6 (decide generation vs stubs) |
| RT-4 | XML format incompatible with DBSourceManager | Ext 3.4 | High | Compare template with real XML of an existing module |
| RT-5 | OBDal accesslevel filtering not handled in endpoints | Ext 3.1 | High | Add org filters to endpoint template |
| RT-6 | `FIN_Utility.getDocumentNo` assumes Financial module installed | Arch 3.2 | High | Declare as module dependency |
| RT-7 | `new Order()` vs `OBProvider.getInstance().get()` | Ext 3.1 | High | Verify correct pattern with target Etendo version |
| RT-8 | Auto-generated tests validate internal consistency, not business correctness | Ext 1.2 | Medium | Add 5-10 manual "golden path" tests |
| RT-9 | UI Generator token budget may be insufficient for large schemas | Ext 4.1 | Medium | Compressed schema for system prompt |
| RT-10 | Hibernate dirty checking may cause recursion in event handlers | Ext 3.1 | High | Add guard clause in template |

---

## Consolidated Pending Decisions (by priority)

### Blockers (resolve before Wave 1)

| # | Decision | Source |
|---|----------|--------|
| D1 | Exact Etendo version | Arch |
| D2 | Node.js version (`.nvmrc`) | Arch |
| D3 | Etendo DB for extractors (not production) | Arch + Ext |
| D4 | Schema of `steps[].operation` | Arch + Ext |
| D5 | Full generation vs stubs for processes | Arch + Ext |
| D6 | Add `voidOrder` to Phase 5? | PO |
| D7 | UI Generator: technical placeholder or real MVP? | PO |

### Blockers for Wave 4

| # | Decision | Source |
|---|----------|--------|
| D8 | Generation strategy (Option A/B/C) | Arch |
| D9 | Etendo environment for JUnit in CI | Arch |
| D10 | UUID determinism in dataset XML | Arch |
| D11 | Location of Java source code for Rule Extractor | Arch + Ext |

### Recommended

| # | Decision | Source |
|---|----------|--------|
| D12 | `node:test` vs `vitest` | Arch |
| D13 | CLI `list-windows` to obtain AD_Window_ID | Arch |
| D14 | Rate limiting / fallback for Anthropic API | Arch |
| D15 | `artifacts/` in .gitignore or in repo | Arch |
| D16 | Date/timezone format in schema | Ext |
| D17 | `VERTICAL-SLICE-SHORTCUT` convention for shortcuts | Ext |

---

## Final Observation (External Advisor)

> "The goal of the vertical slice is not to have the Sales Order working — it is to discover the 5 design assumptions that were wrong before building the complete system. If at the end of the vertical slice they have identified and documented those 5 incorrect assumptions, the vertical slice was successful, regardless of whether the code compiles or not."

---

*Next step: Resolve the 7 blocking decisions and the 7 blocking actions. Then invoke writing-plans to create the detailed implementation plan.*
