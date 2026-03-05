# Scope Evaluation — Product Owner Review

| Property | Value |
|----------|-------|
| Reviewer | Product Owner |
| Date | 2026-03-05 |
| Document reviewed | `2026-03-05-vertical-slice-design.md` |
| Against | PRD v2.1 + TDD v2.1 |
| Status | Draft — requires consolidation in Risk Register |

---

## 1. Scope Alignment

### 1.1 What the slice covers correctly

The vertical slice covers the core MVP pipeline with good fidelity:

- **Field Extractor (PRD 14.1):** Implemented in Phase 1a. SQL specified in TDD 3.1. Automatic pre-classification included. Aligned.
- **Rule Extractor (PRD 14.1):** Implemented in Phase 1b. Java source analysis with DML detection included (TDD 3.2). Aligned.
- **AI Pre-classifier (PRD 14.1):** Phase 3. Two-tier logic documented (TDD sections 3.3). Aligned.
- **Decision Editor + Rule Catalog (PRD 14.1):** Implemented as unified "decision-panel" in Phase 4. See observation in section 2.1.
- **Process Definitions — completeOrder (PRD 9.4):** Phase 5. Only `completeOrder` is included. See critical gap in section 3.
- **Contract Generator (PRD 14.1):** Phase 6. ~245 tests (Node.js + JUnit stubs). Aligned with PRD 11.1 and TDD 3.4.
- **Backend Generator (PRD 14.1):** Phase 7. Generates standard Etendo module (event handlers, endpoints, processes). Aligned with TDD 4.x.
- **UI Generator (PRD 14.1):** Phase 8. With documented simplification: first pass is static React without conversational AI. See observation in section 5.

### 1.2 Critical gap: only 1 of 3 MVP processes

**PRD Section 9.4 defines 3 mandatory processes for the MVP:**

| Process | Steps | Preconditions | Edge Cases | In the slice? |
|---------|-------|---------------|------------|---------------|
| `completeOrder` | 6 | 5 | 3+ | YES |
| `voidOrder` | 3 | 3 | 3+ | **NO** |
| `openPeriod` | 3 | 3 | 3+ | **NO** |

The slice only defines `completeOrder`. `voidOrder` and `openPeriod` are absent from the design.

**Impact:** The success criteria of PRD 15 ("3 processes in < 2 hours") are unreachable with this slice. The behavioral tests covering `voidOrder` and `openPeriod` (~4-6 JUnit tests per PRD 11.1) cannot be generated or executed.

**Evaluation:** This is the most significant scope gap. It does not block the architecture but does block validation of the PRD 15 time target.

---

## 2. Priority Validation — The 8 Phases

### 2.1 The order is broadly correct

The pipeline-first sequence (F1 -> F2 -> F3 -> F4 -> F5/F6 -> F7/F8) correctly reflects the system's dependencies. There are no ordering inversions that introduce technical risk.

### 2.2 Observations per phase

**Phase 1 (Extractors):** Correct as a starting point. Without extractors, nothing else can advance.

**Phase 2 (JSON Schemas + Validators):** Correct in second position. Formal schemas (Ajv) are the contract that validates everything that follows. Moving it later would introduce technical debt.

**Phase 3 (AI Pre-classification):** The order is correct (depends on F1 + F2). However, the slice does not specify how to handle the case where the Anthropic API is unavailable during development. TDD 9.1 documents 3 AI touchpoints but does not define an offline/mock mode for testing. Minor risk.

**Phase 4 (Decision Panel):** The slice unifies Decision Editor + Rule Catalog into a single component (`decision-panel`). The PRD treats them as separate tools (PRD 4.1, decisions 2 and 4-6). The unification is reasonable for MVP and is documented as a conscious simplification (slice section 3.1). Acceptable, but the team must ensure the UI does not mix contexts: fields and rules are different cognitive workflows for the user.

**Phase 5 (Process Definitions):** Correctly positioned as parallel to F3/F4. The slice describes it as "manual JSON editing," aligned with PRD 14.2 ("Process Designer interactive UI — MVP: JSON"). Correct.

**Phase 6 (Contract Generator):** Depends on F4 + F5. Correct order. Generates ~245 tests automatically, which is the critical quality gate before compilation.

**Phase 7 (Backend Generator):** Depends on F6. Correct order. It is the highest-risk technical step (generating real Java that must compile).

**Phase 8 (UI Generator):** Parallel to F7. The slice documents an important simplification: first iteration generates static React, without conversational AI. This is technically sound for MVP but implies that the fast loop in the PRD (sections 6.1 and 6.3) will not be demonstrable in this slice. See section 5 (YAGNI check).

### 2.3 Suggested reordering: no changes required

The order of the 8 phases is correct. The only priority observation: if the team is under time pressure, Phase 5 (process definitions) could be reduced to only `completeOrder` (as it stands today), but it should be explicitly documented as debt against the PRD, not as complete scope.

---

## 3. Success Criteria — Achievability Analysis (PRD Section 15)

| PRD 15 Criterion | Target | In the slice? | Risk |
|------------------|--------|---------------|------|
| Field extraction + decision < 30 min | < 30 min | YES (Phase 1a + 4) | Low — depends on real Etendo data |
| Rule extraction + decision < 30 min | < 30 min | YES (Phase 1b + 4) | Medium — Java analysis may be slow on a large codebase |
| UI design iterations < 10 turns, < 15 sec | < 10 turns / < 15 sec | PARTIAL — Phase 8 generates static React, not conversational | High — fast loop is not demonstrable with static React |
| UI total design time < 60 min | < 60 min | NOT demonstrable in this slice | High |
| Process definitions 3 processes in < 2 hours | 3 processes | Only 1 process in the slice | **Critical** |
| Permission setup < 10 min | < 10 min | Manual XML (slice 3.1) — not demonstrable as UX | Medium |
| Contract tests < 5 sec, 0 failures | < 5 sec | YES (Phase 6, Node.js) | Low |
| Module compilation < 5 min | < 5 min | YES (Phase 7, gradlew) | Low — first compilation may be slower |
| Integration tests < 60 sec, 0 failures | < 60 sec | YES (Phase 7, JUnit) | Medium — requires working Etendo test context |
| Auto-classification accuracy > 90% | > 90% | YES (Phase 3) | Medium — dependent on Java analysis quality |
| Test coverage (fields) 100% | 100% | YES (Phase 6) | Low |
| Test coverage (rules) every kept rule | 100% | YES (Phase 6) | Low |
| Test coverage (processes) every side effect + 3 edge cases | 3 edge cases/process | Only for completeOrder | **Critical** — voidOrder and openPeriod absent |
| Rollback integrity | Failed process -> DB unchanged | YES (Phase 7, TDD 6.2) | Low |
| Code traceability | Any file traceable to decisions | YES (TDD 7.1) | Low |
| Day-2 delta review < 30 min | < 30 min | **NO — Day-2 is not in the slice** | High |
| Total roundtrip < 3 hours | < 3 hours | NOT demonstrable (static UI Generator + 1 process) | High |

**Criteria at critical risk:**
1. "3 processes in < 2 hours" — only 1 process exists.
2. "Total roundtrip < 3 hours" — without conversational UI and without voidOrder/openPeriod, the full roundtrip is not validatable.
3. "Day-2 delta review < 30 min" — the Day-2 lifecycle (PRD section 13, TDD section 8) does not appear in any phase of the slice.

**Criteria at medium risk:**
- UI design fast loop (15 sec/turn) — not demonstrable with static React.
- Auto-classification accuracy > 90% — without real Etendo data it is not yet measurable.

---

## 4. Feature Gaps — PRD Section 14.1 (In Scope) not covered by the slice

| PRD 14.1 Feature | In the slice? | Observation |
|------------------|---------------|-------------|
| Field Extractor | YES | Phase 1a |
| Rule Extractor | YES | Phase 1b |
| AI Pre-classifier | YES | Phase 3 |
| Schema Validator | YES | Phase 2 |
| Decision Editor | YES (unified) | Phase 4 |
| Rule Catalog | YES (unified) | Phase 4 |
| UI Generator (conversational) | **PARTIAL** | Phase 8 generates static. Conversational AI absent. |
| Process Definitions (3 processes) | **PARTIAL** | Only completeOrder. voidOrder + openPeriod missing. |
| Process Validator | YES | Phase 2 (validate-processes.js) |
| Permission Matrix | **PARTIAL** | Manual XML. No UI or automatic CLI. |
| Document Flows (enable/disable) | **ABSENT** | Does not appear in any phase or artifact of the slice. |
| Contract Generator (~245 tests) | YES | Phase 6 |
| Version Checker | **ABSENT** | `check-version.js` is in the TDD 1.2 repo but not in any phase of the slice. |
| Generated Module (complete Etendo module) | YES | Phase 7 |
| Day-2 Lifecycle | **ABSENT** | Does not appear in the slice. |

**Priority gaps from a product perspective:**

**Document Flows (PRD 14.1):** The PRD mentions them as enable/disable from existing Etendo (PRD 9.5: "No custom flows in MVP"). Although it is basic functionality, its complete absence from the slice implies that the Flow Selector (PRD 4.1, decision 11) has no tool. Low impact for the validation slice, but it must be clear that this is left for the next iteration.

**Version Checker (PRD 14.1):** The TDD defines `check-version.js` and CI/CD uses it (TDD 10). The slice does not include it in any development wave. If the team does not build it, the CI pipeline cannot complete as specified in the TDD.

**Day-2 Lifecycle (PRD 14.1 + PRD 13):** It is the most important use case for real customers (Etendo updates, the customer re-decides deltas). Its absence from the slice means the product cannot demonstrate its differential value proposition in this iteration.

---

## 5. YAGNI Check — What is not necessary for MVP validation

The slice is generally conservative and well-focused. The following simplifications documented in `slice section 3.1` are correct from a YAGNI perspective:

- **Decision Editor + Rule Catalog unified:** Correct. Separating into two tools adds no value for validation.
- **Process Designer as manual JSON:** Correct. PRD 14.2 already declares it post-MVP.
- **Permission Matrix as manual XML:** Acceptable for the slice. Does not block pipeline validation.
- **No complex monorepo manager:** Correct. Basic npm workspaces is sufficient.

**One simplification that is NOT YAGNI-correct:**

The decision to generate static React in Phase 8 instead of conversational AI (the fast loop) is the one that most distances the slice from the real MVP. The fast loop is a central part of the value proposition of the PRD (section 6.1, section 6.3 target "< 15 sec/turn"). Generating a static component validates that the code generator works, but does not validate that a human can iterate in seconds — which is the product's differential point.

**Recommendation:** If the team chooses to keep static React in Phase 8 for development speed, it must be documented that the conversational AI fast loop is the first task of the next iteration, before any demos to pilot customers.

**Something in the slice that could be considered YAGNI at this point:**

- The `window-permission` and `process-permission` tests (~12 JUnit tests, PRD 11.1) require a functional Permission Matrix to be meaningful. With the Permission Matrix reduced to manual XML, these tests are difficult to generate automatically. They could be deferred without risk to the validation slice.

---

## 6. Decision Map — Coverage of the 11 decisions (PRD Section 4.1)

| # | PRD 4.1 Decision | PRD Tool | Covered in the slice? | Status |
|---|------------------|----------|-----------------------|--------|
| 1 | Which window to generate | Extractor config | YES — hardcoded to Sales Order | Covered (hardcoded for MVP) |
| 2 | Which fields are visible/system/discarded | Decision Editor | YES — Phase 4 (decision-panel) | Covered |
| 3 | How the UI looks | UI Generator (conversational) | PARTIAL — Phase 8 generates static | Partial |
| 4 | Which complex rules continue | Rule Catalog | YES — Phase 4 (decision-panel) | Covered |
| 5 | How to simplify complex rules | Rule Catalog | YES — Phase 4 (decision-panel) | Covered |
| 6 | Which rules are omitted (with justification) | Rule Catalog | YES — Phase 4, decisions-log.json | Covered |
| 7 | Which processes are enabled | Process Designer | PARTIAL — only completeOrder | Partial |
| 8 | What behavior I expect from each process | Behavioral Editor | PARTIAL — only completeOrder | Partial |
| 9 | Which edge cases each process covers | Behavioral Editor | PARTIAL — only completeOrder | Partial |
| 10 | Which roles exist and which windows they see | Permission Matrix | PARTIAL — manual XML, no UI | Partial |
| 11 | Which document flows are enabled | Flow Selector | **ABSENT** — does not appear in the slice | Not covered |

**Summary:**
- Fully covered decisions: 1, 2, 4, 5, 6 (5/11)
- Partially covered decisions: 3, 7, 8, 9, 10 (5/11)
- Not covered decisions: 11 (1/11)

**Decision 11 (Document Flows)** is the only completely absent one. The PRD clarifies that in MVP only existing Etendo flows are enabled/disabled (PRD 9.5), making it implementable with a simple JSON or a basic selector. Its absence from the slice is a real gap but of low technical risk.

**Decision 3 (Conversational UI)** has the greatest impact on product demonstrability with pilots. The slice covers it only partially with static React.

---

## 7. Risks from a Product Perspective

### RISK 1 — The slice does not demonstrate the core value proposition
**Severity: High**

The PRD's differential claim is "the human iterates the UI in seconds, not hours" (PRD 6.1, 6.3). With the UI Generator generating static React (slice 3.1), this claim is not demonstrable at the end of the slice. The team can complete the 8 technical phases but will not have a product that convinces a pilot customer of the value proposition.

**Mitigation:** Add basic conversational AI in Phase 8 (not necessarily perfect) or explicitly document that Phase 8 of the slice is a technical placeholder, not the MVP UI Generator.

### RISK 2 — 2 of 3 MVP processes absent
**Severity: High**

`voidOrder` and `openPeriod` are not in the slice. The PRD requires them for MVP (PRD 9.4). The corresponding behavioral tests (~6 JUnit tests) will not be generated. The success criterion "3 processes in < 2 hours" (PRD 15) is not validatable.

**Mitigation:** Add `voidOrder` to Phase 5 of the slice. `openPeriod` can be deferred to the next iteration with explicit justification, since it is less critical for the Sales Order flow.

### RISK 3 — Day-2 absent from the slice
**Severity: Medium**

The Day-2 lifecycle (PRD section 13, TDD section 8) is the main argument for customers already running Etendo: "when Etendo updates, you don't rewrite — you re-decide deltas." This story does not exist in the slice. The Version Checker also does not appear in the development waves.

**Mitigation:** The slice is a correct first step. Document Day-2 as the scope of the second iteration with clear entry criteria (complete slice + Etendo instance with at least one update).

### RISK 4 — Dependency on a real Etendo instance from day one
**Severity: Medium**

The slice declares "Data Source: Real Etendo instance" (slice header). The Field Extractor (TDD 3.1) and the Rule Extractor (TDD 3.2) make direct SQL queries to the Etendo database and analyze Java source. If the team does not have guaranteed access to an instance with the Sales Order window and the source code available, Phase 1 blocks the entire pipeline.

**Mitigation:** Prepare sample JSON fixtures for `schema-raw.json` and `rules-raw.json` before starting Phase 1, so that Phase 2 onwards can advance in parallel without waiting for the instance.

### RISK 5 — Auto-classification at 60% may not reach the 90% precision target (PRD 15)
**Severity: Medium**

The PRD defines two apparently contradictory numbers: "AI auto-classifies ~60%" of rules (PRD 8.1) but the success criterion is "> 90% correct" (PRD 15). The 90% refers to the precision of what is auto-classified, not total coverage. Without real Sales Order data, there is no way to validate this number before building it.

**Mitigation:** Establish a benchmark with the real instance before committing to 90%. The TDD documents the classification logic (TDD 3.3) but does not have precision tests defined yet.

### RISK 6 — Role confusion in the unified decision-panel
**Severity: Low**

The PRD defines two clear roles: UI Decider (decisions 2, 3) and Rule Decider (decisions 4, 5, 6) (PRD 4.2). By unifying them into a single panel, the UX may mix field decisions with rule decisions in a single session, creating confusion. In internal validation this is manageable; with pilots, it can be a problem.

**Mitigation:** Even though the panel is technically unified, ensure the UX has clearly separated flows (tabs, sections, or steps) for fields vs. rules.

### RISK 7 — No Definition of Done per phase
**Severity: Low**

The slice defines outputs per phase (slice section 2.1) but does not define observable "done" criteria for each one. For example, Phase 1a produces `schema-raw.json` — but does not specify how many fields are expected, what percentage should be pre-classified, or how to validate that the extractor captured all tabs of the Sales Order.

**Mitigation:** Before starting Phase 1, define minimum checkpoints: "schema-raw.json must contain >= N fields, >= M in visibility:system, and validate against schema-raw.schema.json without errors."

---

## 8. Executive Summary

The vertical slice is technically well-designed and reflects the PRD pipeline with reasonable fidelity. The pipeline-first approach with the 8 phases in dependency order is correct and requires no reordering.

**Three product problems that must be resolved before starting development:**

1. **Add `voidOrder` to Phase 5.** It is the second most important MVP process and its absence means the slice does not validate the PRD 15 success criteria.

2. **Decide the fate of the UI Generator.** Generating static React in Phase 8 validates the architecture but not the product. The team must decide: either add minimal conversational AI in this iteration, or formally document that the fast loop is the first priority of the next iteration and this slice is not used for demos with pilots.

3. **Document Day-2 + Version Checker as scope for the next iteration** with clear entry criteria. Not including them in this slice is acceptable, but they must be on the visible roadmap so the team does not lose sight of them.

**What the slice does well:**
- Covers the 5 critical decisions of the Decision Map (PRD 4.1) completely.
- Documented simplifications are YAGNI-correct.
- The two-loop architecture (Node.js + JUnit) is correctly implemented.
- The Contract Generator with ~245 auto-generated tests is the correct quality gate.
- Code traceability (TDD 7.1) is included from the start.

---

*Document generated for the consolidated Risk Register. Next step: Architect and External Advisor review to correlate technical and project risks.*
