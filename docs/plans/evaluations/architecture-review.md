# Architecture Evaluation — Schema Forge

| Property | Value |
|-----------|-------|
| Date | 2026-03-05 |
| Reviewer | Software Architect |
| Documents reviewed | TDD v2.1, TDD-annex A, vertical-slice-design 2026-03-05 |
| Status | Draft — Pre-development |

---

## Executive Summary

The proposed architecture is technically solid for the most part. The stack choices are conservative and appropriate for the domain. Critical risks concentrate in three areas: (1) Java code generation for complex processes like `completeOrder` likely requires more sophisticated template logic than Handlebars can offer cleanly, (2) extracting rules from Java source code via regex is fragile and the TDD does not clearly define where that source code lives in the pipeline, and (3) the dependency on the Etendo compiler in CI (gradlew, 5 min) introduces a significant bottleneck that may slow the slice's feedback cycle. None of these risks are blocking, but they require concrete decisions before writing any code.

---

## 1. Technology Stack Viability

### 1.1 Node.js CLI — SUITABLE

**Evaluation:** Correct for the intended use. The extractors (TDD Sections 3.1, 3.2) are I/O-bound operations: SQL queries + Java file reading. Node.js handles this well with native async/await.

**However, there is an unresolved tension:** the TDD (Section 1.1) describes the CLI tools as "Zero-dependency," but the vertical slice design (Section 4) lists real dependencies: `pg`, `ajv`, `handlebars`, `@anthropic-ai/sdk`. "Zero-dependency" likely means "no external runtime like JVM or Python," not literally zero `npm packages`. This should be made explicit in the workspace package.json to avoid confusion at install time.

**Minor risk:** The native Node.js test runner (specified in vertical-slice Section 4) is adequate for the ~145 contract tests, but lacks features like watch mode, reporters, and coverage that developers expect. It is recommended to evaluate whether `node:test` is sufficient or whether `vitest` is needed (compatible with the Vite ecosystem already in use for the tools).

### 1.2 pg driver (PostgreSQL) — SUITABLE with condition

**Evaluation:** Correct. Etendo runs on PostgreSQL and `pg` is the standard driver for Node.js.

**Critical condition:** The TDD does not specify credential handling beyond "Environment variables" (Section 12). The vertical slice needs to explicitly define:
- Which environment variables are required (e.g. `ETENDO_DB_HOST`, `ETENDO_DB_PORT`, `ETENDO_DB_USER`, `ETENDO_DB_PASSWORD`, `ETENDO_DB_NAME`).
- Whether the extractor runs against a production, staging, or local copy of the DB.
- What minimum DB permissions the user needs (SELECT-only on AD_* tables).

**Security risk:** Running extractors against a production DB is risky. The TDD does not specify whether there is a separate development/staging DB. This must be decided before day 1.

### 1.3 Handlebars for Java generation — PARTIALLY SUITABLE, with significant risk

**Evaluation:** Handlebars is appropriate for simple artifacts (DTOs, Mappers, XML file structures). The `DTO.java.hbs` example in the vertical slice would be a straightforward template.

**Critical risk with complex processes:** The `CompleteOrderProcess.java` example (TDD Section 4.4) contains substantial conditional logic: iteration over lines, calls to helper methods (`reserveStock`, `calculateOrderTax`, `postDocument`), and precondition handling. Handlebars is "logic-less" by design — it has no complex loops, business helpers, or nested conditionals without custom helpers.

To generate method bodies like `doExecute`, the team will need to:
- Write custom Handlebars helpers (possibly many), or
- Pre-process the contract into an intermediate model before rendering the template, or
- Accept that helper methods (`reserveStock`, etc.) are stubs requiring manual implementation.

**The TDD does not clarify which parts of the process are generated and which are stubs.** In Section 4.4, `calculateOrderTax` and `postDocument` appear as `/* ... */`, suggesting they are not fully generated. This boundary must be explicitly documented: what Schema Forge generates and what the developer is expected to complete.

**Recommendation:** Keep Handlebars but define a clear "generation model." Templates should generate the structure (class, annotations, methods) and process "steps" based on the `processes.json` JSON. The body of each step would be generated from `type: validate|mutation|forEach|compute|process`. This is feasible with Handlebars + helpers, but requires careful design of the helpers before writing the first template.

### 1.4 Ajv for JSON Schema validation — SUITABLE

**No significant observations.** Ajv is the most performant JSON Schema validator for Node.js. The 4 validation layers in the TDD (Section 3.3) are implementable with Ajv for the structural level and custom Node.js logic for the semantic and cross-reference levels.

**Version note:** Specify `ajv@8.x` (with JSON Schema Draft-07 and Draft-2019 support) in package.json. Ajv v6 is legacy and has breaking changes relative to v8.

### 1.5 React + Vite for the decision panel — SUITABLE

**No significant risks.** Vite 5.x with React 18 is the current standard stack. The vertical slice simplification (merging decision-editor + rule-catalog into a single `decision-panel`) reduces the monorepo configuration complexity.

**Point of attention:** TDD Section 5.1 describes the UI preview as "sandboxed iframe with Babel standalone." Babel standalone in the browser has noticeable overhead (~300KB minified). For the vertical slice this is acceptable, but it should be documented as a technical limitation of the tool, not of the generated product.

### 1.6 Anthropic Claude API — SUITABLE with cost management

**The prompt design is reasonable.** The three touchpoints (TDD Section 9.1) have defined token budgets: ~1,500/rule for classification, ~5,500/turn for UI, ~3,000/delta for Day-2.

**Operational risk:** For a window with many rules (e.g. Sales Order may have 50-100 rules), the pre-classification cost can scale. At $3/MTok for Sonnet, 100 rules x 1,500 tokens = $0.45 per extraction, which is manageable. But the TDD does not define a rule count limit that triggers manual review instead of AI classification, nor what happens when the API is down or rate-limited.

**Recommendation:** Add a `--dry-run` mode to the classification CLI that generates placeholder recommendations without calling the API, to allow offline development and cost-free testing.

---

## 2. Repository Structure

### 2.1 Discrepancy between TDD and Vertical Slice Design

TDD Section 1.2 defines a directory structure, and the vertical slice (Section 3) defines a slightly different one. The differences:

| Element | TDD 1.2 | Vertical Slice 3 |
|---------|---------|-----------------|
| Templates | `templates/etendo-module/*.tmpl` | `templates/*.hbs` |
| Tools | 5 separate tools | 2 tools (decision-panel + ui-generator) |
| CLI files | Root of `cli/` | `cli/src/` with subdirectory |
| core-maps | `core-maps/` | `core-maps/` (matches) |
| JSON schemas | Not mentioned | `schemas/` dedicated directory |

**The vertical slice structure is more detailed and more correct for a Node.js monorepo.** The TDD should be updated to reflect the definitive structure. It is not a blocking risk, but the discrepancy creates confusion for the 4 developers in Wave 1.

### 2.2 Absence of monorepo configuration

The vertical slice mentions "npm workspaces basic" without detailing the configuration. For a monorepo with 3 packages (cli, tools/decision-panel, tools/ui-generator) a root `package.json` is needed with:

```json
{
  "workspaces": ["cli", "tools/decision-panel", "tools/ui-generator"]
}
```

It is also necessary to define whether CI scripts run from the root or from each package. TDD Section 10 shows commands like `schema-forge validate-schema` that imply a globally installed CLI or via `npx`. This is not defined.

### 2.3 Missing directory: `schemas/`

TDD Section 2 defines the data models in prose, but vertical slice Section 3 mentions a `schemas/` directory with 5 formal JSON Schema files. These schemas are critical: they are the source of truth for Ajv. The TDD does not include the content of these schemas — only the models in prose. **This is real design work that must be done in Wave 1, it cannot be assumed trivial.**

### 2.4 `artifacts/` directory in the repository

The plan stores generated artifacts (schema-raw.json, rules-raw.json, etc.) inside the schema-forge repository. This is correct for the vertical slice, but introduces a long-term management question: when there are 20 windows, the repository will have 20 x ~8 artifacts = ~160 JSON files + generated Java code. Consider whether `artifacts/` should be in `.gitignore` or in a separate repository. **Decision pending before starting the second window.**

---

## 3. Critical Dependency Analysis

### 3.1 External dependencies and version risks

| Dependency | Recommended version | Risk |
|-------------|---------------------|------|
| `pg` | `^8.11` | Low. Stable API since v8. |
| `ajv` | `^8.12` | Medium. Breaking changes between v6 and v8 — specify version. |
| `handlebars` | `^4.7` | Low. Mature API. |
| `@anthropic-ai/sdk` | `^0.20` | **High.** SDK in active development, frequent breaking changes. Pin to minor version. |
| `react` / `vite` | React 18 / Vite 5 | Low. Stable stack. |
| `node:test` | Node.js 18+ | Low, but verify Node.js version in CI. |

**Major risk — Anthropic SDK:** The Anthropic SDK has had significant breaking changes between minor versions. The package.json must pin the exact version with a lock file (`package-lock.json` or `yarn.lock`) and there must be a controlled update process.

### 3.2 Compatibility with Etendo

**This is the most critical dependency risk in the project.** The generated code uses:
- `OBDal.getInstance()` — Etendo's central API
- `OBCriteria`, `Restrictions` — Hibernate Criteria API via Etendo
- `EntityPersistenceEventObserver` — Etendo's Weld/CDI event system
- `DalBaseProcess`, `ProcessBundle` — Etendo's process framework
- `OBContext`, `OBMessageUtils` — Etendo context APIs
- `FIN_Utility.getDocumentNo()` — Financial module-specific utility

**The TDD mentions that the Etendo version is recorded in the provenance manifest (Section 7.2) but does not specify what the minimum supported Etendo version is or how it is automatically detected.**

Etendo can change internal APIs between minor versions. The "Compilation Gate" (TDD Section 8.3) only captures incompatibilities AFTER generation. For the vertical slice, the following are needed:
1. Document the exact Etendo version against which development is done.
2. Add to `check-version.js` or a new `check-compatibility.js` the ability to read the Etendo version from the environment and warn if it does not match the version registered in the contract.

**The `FIN_Utility.getDocumentNo()` call in TDD Section 4.4 is an example of coupling to a specific module (Financial)** that may not be installed in all Etendo environments. This must be treated as a declared module dependency, not an assumed one.

---

## 4. Data Model Evaluation

### 4.1 Fields Schema (TDD Section 2.1) — WELL DESIGNED

The schema-raw/schema-curated structure is solid. Positive points:
- The `visibility: editable|readOnly|system|discarded` distinction is clear and maps well to the Etendo model.
- The derivation model (`fromConfig|fromParent|fromField|lookup|computed|sequence`) covers the main Sales Order use cases.
- The inclusion of `sourceChecksum` allows change detection in Day-2.

**Minor structural problems:**

1. **`displayLogic` and `readOnlyLogic` are expression strings** (Section 2.1), but rules in the Rule Catalog (Section 2.2) also include `displayLogic` as a rule type. There is duplication: display logic can live in field.displayLogic OR in rules[].type=displayLogic. The level-4 validator (Section 3.3) needs to verify that there is no conflict between these two sources.

2. **The `computed` field** appears both in fields (`computed: expression`) and in derivation (`type: computed`). The semantic difference between a field with `derivation.type=computed` and a field with a `computed` expression is not defined. Are they the same or are they distinct concepts?

3. **`uniqueConstraints: [[field, field]]`** — The array-of-arrays structure is correct for composite constraints, but the formal JSON schema needs to define whether the names are field names (camelCase) or DB column names. This affects how the generator produces `@UniqueConstraint` annotations in the Etendo XML.

### 4.2 Rule Catalog (TDD Section 2.2) — WELL DESIGNED

The rule structure is the richest in the model. The distinction between `tier: auto|human` and `decision: keep|replace|simplify|omit|pending` is correct and supports the human-in-the-loop workflow.

**Structural problem:** `autoDecision: keep | null` — only allows `keep` as an automatic decision. But in TDD Section 3.2, display/readOnly logic is auto-classified as `keep` when translation succeeds. Simple validations as well. However, there is no support for `autoDecision: omit` (a field that the AI can determine with high confidence is safe to omit). This may be intentional (conservative by design), but it should be explicitly documented.

### 4.3 Process Definitions (TDD Section 2.3) — MEDIUM RISK

The process structure is correct in form, but there is an expressiveness problem:

**`steps[].operation` is a "step-specific definition"** without a defined structure. For type `forEach`, the operation is probably something like `{ iterate: "orderLines", do: [steps] }`. For `mutation`, it is probably `{ set: { field: value } }`. But the TDD does not define the `operation` schema for each step type.

**This is a critical design gap.** The generator (`generate-backend.js`) needs to know exactly how to read `operation` to generate the Java method body. Without a formal definition of `operation` per step type, the generator cannot be correctly implemented.

**Recommendation:** Before Wave 1, define the `operation` schema for each `type`: `validate`, `mutation`, `forEach`, `compute`, `process`. This is design work that can be done when writing the `processes.json` for the vertical slice (completeOrder).

### 4.4 Contract (TDD Section 2.4) — MINOR INCONSISTENCY

The contract has `backendContract.supportedVersions` (Section 2.4) and `backendContract.supportedApiVersions` (TDD-annex A.9). These are two different names for the same field. The formal schema in `schemas/contract.schema.json` needs to use a consistent name.

---

## 5. Code Generation Approach

### 5.1 Handlebars for static structures — CORRECT

Templates for DTO, Mapper, EventHandler (derivation), and Endpoint with static filters are appropriate for Handlebars. The contract data model is sufficiently structured to feed these templates directly.

### 5.2 Templates for complex processes — REAL PROBLEM

The `CompleteOrderProcess.java` example (TDD Section 4.4) illustrates the problem:

```java
private void reserveStock(OrderLine line) { ... }
private void calculateOrderTax(Order order) { /* ... */ }
private void postDocument(Order order) { /* ... */ }
```

These private methods contain real business logic (Hibernate queries, StorageDetail updates, tax calculation). **They cannot be generated from a Handlebars template with the current contract information.** The contract defines `steps[].type=mutation` and `steps[].operation`, but the contents of `reserveStock` require knowledge of the Etendo data model (StorageDetail, Warehouse, StorageBin) that is not in the contract.

**There are three possible strategies, and the TDD does not choose any:**

**Option A — Partial generation (recommended):** Generate the process structure (class, preconditions, step dispatch), and for each `type: keep` step with `existingClass`, generate a call to the existing Etendo process. For `type: replace` steps, generate a stub with TODO and documentation of expected behavior from `behavioral.postcondition`.

**Option B — Full generation via AI:** Use the Anthropic API not only for rule classification but to generate the method bodies. This requires the model to have context of the Etendo API, implying a much larger system prompt.

**Option C — Templates with complex helpers:** Define Handlebars helpers for each operation type (reserveStock → `{{generate-reserve-stock step schema}}`). These helpers contain the generation logic in JavaScript. This is feasible but complex to maintain.

**The vertical slice needs to make this decision before Wave 4 (backend generation).**

### 5.3 Dataset XML — UNDERESTIMATED

The TDD mentions `dataset.xml.hbs` for reference data, but the Etendo XML for module configuration (AD_Window_Access, AD_Process_Access, AD_Column_Callout) is significantly more complex than the example shown in Section 4.7. UUIDs must be deterministic (generated from a seed of the module name), role IDs must be resolvable in the target environment, and cross-record XML references must be coherent. **Underestimating the complexity of dataset XML is a classic risk in Etendo projects.**

---

## 6. Testing Architecture

### 6.1 Dual Runtime (Node.js + JUnit) — VIABLE but with gaps

The separation between contract tests (Node.js, ~145 tests) and integration tests (JUnit, ~100 tests) is architecturally correct. Contract tests validate the shape of JSON before compiling, which speeds up the feedback loop.

**Gap 1 — There are no tests for the tool itself.** The TDD defines tests for the generated code, but not for the generator code. `generate-backend.js`, `generate-contract.js`, and the Handlebars templates have no tests. If the generator produces invalid Java, the Compilation Gate detects it, but compilation time (5 min) has already been consumed in CI. Unit tests for the generator (that verify the template produces the expected string given a fixture contract) are necessary and absent from the plan.

**Gap 2 — JUnit tests require an active Etendo environment.** TDD Section 6.1 mentions "Run on Etendo (OBBaseTest). Require compilation." But it does not specify how the Etendo environment is provisioned for CI. Options: Etendo in Docker, a shared staging instance, or an OBDal mock. Each option has cost, speed, and isolation implications that are not defined.

**Gap 3 — The rollback test (TDD Section 6.2) uses `removeAccountingConfig`** — a helper that destroys test environment configuration. If this affects other concurrent tests, the tests are not isolated. OBBaseTest uses transactions that are rolled back at the end, but `removeAccountingConfig` could modify configuration data that persists between tests if not handled correctly.

### 6.2 Test pyramid — INVERTED for the vertical slice

The plan has ~145 contract tests (Node.js) + ~100 integration tests (JUnit). The 60/40 ratio between fast and slow tests is reasonable, but:
- There are 0 unit tests of the generator itself.
- There are 0 tests of the React decision panel.
- The ~145 "contract tests" are actually JSON schema tests, not HTTP API tests.

**For the vertical slice this is acceptable** (prioritizing E2E over unit), but it should be documented as conscious technical debt.

---

## 7. Scalability to Future Windows

### 7.1 The model scales well structurally

The pipeline-first architecture with artifacts per window (`artifacts/{window-name}/`) scales correctly. Each window is independent. The shared `core-maps/` (system-columns, AD_Reference_ID map) reduces duplication.

### 7.2 Risk of template divergence

As windows with different patterns are added (wizard vs masterDetail, windows with sublines, etc.), Handlebars templates will tend to accumulate conditionals: `{{#if wizard}}...{{else}}...{{/if}}`. Handlebars has no robust template inheritance mechanism (only `{{> partial}}`). If 5+ windows with different patterns are reached, templates can become unmanageable.

**Recommendation:** Design templates from the start as partial composition, with one partial per UI pattern (`{{> masterDetail}}`, `{{> simpleForm}}`). This should be done in Wave 4, not left as a future refactor.

### 7.3 The Rule Extractor assumes access to Java source code

TDD Section 3.2 defines `analyzeJavaSource(className, sourceDir)` which searches for the Java callout source code to analyze side effects. This assumes the team has access to Etendo and module source code. In environments where only binary JARs are available, the extractor falls back to `confidence: 'low'` and escalates to human review. **This fallback is well-designed**, but directly affects the ">50% auto-classified" objective of the vertical slice. Sales Order has well-known Java callouts — verify that the source code is available in the development environment.

---

## 8. Integration Risks

### 8.1 Connection to Etendo DB

**Risk 1 — DB Schema:** The extractor queries (TDD Section 3.1) assume standard Etendo table structure. Etendo may have schema customizations that affect the joins. In particular, the JOIN between `AD_Column` and `AD_Tab` via `AD_Table_ID` may return incorrect results if there are tabs pointing to views instead of tables.

**Risk 2 — AD_Window_ID:** The extractor receives `AD_Window_ID` as a parameter. The vertical slice does not specify how this ID is obtained. Is it searched manually in the DB or is there a tool for it? A CLI `schema-forge list-windows` that shows available windows would be needed before running the extractor.

**Risk 3 — Sensitive data in schema-raw.json:** Extraction queries retrieve `DefaultValue` from columns, which may contain SQL expressions with schema data. The `schema-raw.json` should not contain credentials or sensitive data, but the TDD does not define a sanitization process for extracted values.

### 8.2 Generated module compilation

**Risk 1 — Build classpath:** The generated `build.gradle` (TDD Section 4.1) needs to declare Etendo dependencies. The TDD does not show the contents of `build.gradle.tmpl`. The Gradle configuration for Etendo modules typically includes references to Etendo classpath JARs that must be available in the build environment. If CI does not have access to the Etendo JARs, compilation fails.

**Risk 2 — Compilation time in CI:** The 5-minute compilation target (TDD Section 11) is optimistic for a complete Java module with Etendo on the classpath. In practice, if Gradle needs to download Etendo dependencies for the first time, it may take 15-30 min. CI needs a Gradle cache.

**Risk 3 — `ProcessUtil.getProcessId("completeOrder")`:** The generated code in TDD-annex A.5 calls `ProcessUtil.getProcessId("completeOrder")`. This method searches for the process in the Etendo DB by name. If the process is not registered (the XML dataset was not applied), the call fails at runtime with a cryptic error. The module application order (XML first, then tests) must be documented.

---

## 9. Pending Technical Decisions

The following decisions are NOT made in the TDD and must be resolved before starting to code:

### 9.1 Critical (blocking for Wave 1)

| # | Decision | Impact if not made |
|---|----------|----------------------|
| D1 | Exact Etendo version being developed against | Java templates may generate incompatible code |
| D2 | Minimum required Node.js version | Native test runner requires Node 18+; specify in `.nvmrc` |
| D3 | Etendo DB for extractors: production, staging, or local | Security and data risk if not defined |
| D4 | Formal schema of `steps[].operation` per step type | Backend generator cannot be implemented |
| D5 | Which parts of the `completeOrder` process are generated vs stubs | Vertical slice scope undefined |

### 9.2 Important (blocking for Wave 4)

| # | Decision | Impact if not made |
|---|----------|----------------------|
| D6 | Generation strategy for complex process methods (Option A/B/C from Section 5.2) | Backend generator cannot design process templates |
| D7 | How the Etendo environment for JUnit is provisioned in CI | Integration tests cannot run in pipeline |
| D8 | Determinism of UUIDs in dataset XML | Generated XML may create duplicates on re-application |
| D9 | Where the Etendo Java source code lives for the Rule Extractor | `analyzeJavaSource` cannot be implemented |
| D10 | Whether `artifacts/` goes in `.gitignore` or in the repo | Artifact management decision for multi-window |

### 9.3 Recommended (not blocking but important)

| # | Decision | Reason |
|---|----------|-------|
| D11 | Test framework: `node:test` vs `vitest` | Native runner lacks reporter and watch mode |
| D12 | Discovery CLI: `schema-forge list-windows` | Without this, obtaining AD_Window_ID is manual |
| D13 | Rate limiting and fallback for Anthropic API | Without fallback, pipeline fails if API is down |
| D14 | Handlebars template inheritance strategy | Prevents proliferation of conditionals in templates |

---

## 10. Findings by Priority

### Blockers — Resolve before writing code

1. **D4 and D5 (process operation schema):** Without this, Wave 4 cannot start with a clear design. Dedicate 1-2 hours on day 1 to writing the `processes.json` of completeOrder by hand and deriving the `operation` schema from it.

2. **D1 (Etendo version):** Document in an `ETENDO_VERSION` file in the root of the repo. The generator must read it and embed it in the provenance header.

3. **D3 (Etendo DB for extractors):** Define in a `.env.example` with the required variable names. It must not be production.

### High risks — Monitor during the slice

4. **Template complexity for processes (Section 5.2):** The backend generator scope must be clear before Wave 4. If the team expects full generation and discovers only stubs are generated, time is lost.

5. **JUnit environment for CI (D7):** Without this, the ~100 integration tests cannot run in the pipeline. The "Compilation Gate" (TDD Section 8.3) and behavioral tests are unusable.

6. **Etendo version compatibility (Section 3.2):** Coupling to internal Etendo APIs is the most critical long-term risk of the project. The Compilation Gate mitigates the impact but does not eliminate it.

### Acceptable technical debt for the vertical slice

7. Unit tests for the generator (Section 6.2, Gap 1).
8. Tests for the React decision panel.
9. CLI `list-windows` (D12).
10. Template inheritance strategy (D14).

---

## Conclusion

The Schema Forge technical design is coherent and the technology choices are appropriate. The greatest risks are not technological but rather in specification: there are gaps in the definition of what exactly the backend generator generates for complex processes, and there are environment dependencies (Etendo version, DB, Java source code) that are not fully specified.

The Sales Order vertical slice is the correct context to resolve these gaps: it is complex enough to reveal the design's limits (completeOrder has 6 real steps) but sufficiently bounded to be completable. The recommendation is to proceed with the slice, but dedicate the first development session to resolving D1, D3, D4, and D5 before writing a single line of generation code.

---

*Evaluation prepared by the Software Architect. To be synthesized with scope-review.md and risk-assessment.md before development starts.*
