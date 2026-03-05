# Schema Forge — External Risk Assessment

| Property | Value |
|-----------|-------|
| Reviewer | External Advisor |
| Date | 2026-03-05 |
| Docs version reviewed | PRD v2.1, TDD v2.1, PRD-annex A, TDD-annex A, vertical-slice-design |
| Status | Initial draft pre-development |

---

## Preliminary note

This document does not evaluate whether Schema Forge is a good idea. It is a good idea. It evaluates where the team will likely crash, which assumptions are dangerous, and what they should do differently in the coming days.

I have seen similar projects — code generators for ERP platforms, metadata-driven systems, AI generation pipelines — fail in predictable ways. The failures are not due to lack of intelligence or effort. They are due to overconfidence in paper design and a deficit of early validation.

The severity scale used in this document:

- **CRITICAL**: Can kill the project. Needs action before writing code.
- **HIGH**: Will cause serious delays or partial rewrites. Needs a mitigation plan now.
- **MEDIUM**: Will cause friction. Can be temporarily ignored but not indefinitely.
- **LOW**: Real but manageable. Monitor.

---

## 1. Assumptions that are probably wrong

### 1.1 "~60% auto-classification of rules" [HIGH]

**The assumption:** AI can correctly auto-classify 60% of Sales Order rules (Display Logic, Read Only Logic, simple SQL validations, standard lookups, audit triggers).

**Why it is dangerous:** The number 60% seems conservative and prudent. It is not. The problem is not the quantity — it is the *quality* of the incorrect classifications.

In similar projects involving ERP rule extraction, the real pattern is:
- 40-50% are correctly classified with high confidence
- 20-30% are correctly classified but with medium/low confidence (and the human still has to review them)
- 15-20% are classified *incorrectly* with high confidence — this is the dangerous case

The last group is the one that destroys the consultant's trust in the tool. A mis-classified rule with high confidence that passes through the system without review can result in a module that compiles and deploys, but produces incorrect data in production. A callout marked as "Display Logic auto-keep" that actually modifies data on the server is exactly this scenario.

**What the TDD does not say:** How the pre-classifier's precision is validated *before* its results are used. The "90% accuracy as success criterion" (PRD section 15) is an output number, not a verification mechanism during the process.

**Concrete risk:** The rule extractor detects `hasDmlOperations` via static Java analysis. A callout that does DML inside a helper class that the extractor does not analyze passes as "simple Display Logic." The schema validator does not detect it because the field already has declared derivation. The contract test passes. The module compiles. Only when `completeOrder` is executed in production is it discovered that inventory was not being reserved because the callout that set the warehouse was classified as "Auto-Keep → frontend handles" and the new UI never activated it.

**Required mitigation:** Build a "classification honeypot" — a set of 20-30 Sales Order rules where the team knows the correct answer *before* running the classifier. Measure precision on that set before trusting the 60% of the rest. This should be the first test that runs in Wave 1.

---

### 1.2 "~245 auto-generated tests" [MEDIUM]

**The assumption:** The Contract Generator produces ~245 tests that correctly validate the behavior of the generated system.

**The real problem:** Auto-generated tests validate *internal consistency*, not *business correctness*. If the curated schema has an error — for example, a system field incorrectly classified — the test passes anyway because the test was generated from the same erroneous schema.

The PRD breakdown shows:
- ~145 Node.js tests against the contract JSON (validate that the contract is internally consistent)
- ~100 JUnit tests against Etendo (validate that the generated code does what the contract says)

No level validates that the contract reflects business reality. This is not a design defect — it is a fundamental limitation of auto-generated testing. But the team will likely overestimate the real coverage.

**The number 245 is reassuring for the wrong reasons.** A system with 10 hand-written tests by someone who understands the business can have more value than 245 tests generated from the same artifact being validated.

**Mitigation:** Add a category of tests the team writes by hand for the vertical slice — "golden path tests" that verify known business behavior against the real Etendo instance. Even if there are only 5-10 tests, these are the ones that truly validate that the system generates something useful.

---

### 1.3 "< 3 hours total roundtrip" [HIGH]

**The assumption:** Extraction (5 min) + Field decisions (15 min) + Rule decisions (30 min) + UI design (30-60 min) + Process definitions (60-90 min) + Permissions (10 min) + Contract/compile/test (10 min) = < 3 hours.

**The problem:** This is an estimate of *mechanical execution* time, not *human decision* time.

I have seen this before. The functional consultant reviewing Sales Order rules does not take 30 minutes. It takes 30 minutes *if they already know the answers*. If they need to investigate, consult the client, or understand for the first time what an 800-line callout does, the time multiplies by 4-5x.

The Sales Order in real Etendo has genuine complexity:
- The Business Partner callout touches price, currency, payment terms, address, price list, contact — all with interdependencies
- The Price callout has discount logic, price list exceptions, and customer conditions
- `completeOrder` touches accounting, inventory, taxes, and document sequences — each with its own complexity

A senior functional consultant seeing this for the first time is not going to make good decisions in 30 minutes. They will make *fast decisions* that will later cause bugs in production.

**The 3-hour estimate is realistic for the second or third window a consultant processes, not for the first.**

**Operational risk:** The team will use the Sales Order vertical slice as a demo of the 3-hour time target, but the consultant doing it already knows the domain. The first real customer who tries this without that prior knowledge will take 8-12 hours and will blame the tool.

---

### 1.4 "> 90% accuracy in auto-classification" [CRITICAL]

**The assumption:** Automatic classification has > 90% precision.

**Why it is critical:** This number has no baseline. There is no data on how many fields/rules exist in the Sales Order, nor on how many are genuinely "trivial" vs "complex." The 90% is calculated over what denominator?

If there are 200 fields and the AI classifies 180 correctly, that is 90%. But if the 20 incorrect ones are all `system` fields in the `accounting` or `inventory` category, the generated module produces documents that cannot be posted or processed.

**Specific failure mechanism:** The pre-classifier sees `IsDisplayed = N` and classifies as `system`. But `IsDisplayed = N` in AD can mean "technical field the user does not see but which has complex UI logic" — especially in tabs with conditional DisplayLogic. The classifier does not have sufficient context to distinguish.

**What is missing from the TDD:** An operational definition of "accuracy." Accuracy over what ground truth? Who validates the ground truth? How is it measured before the vertical slice?

---

## 2. Common failure modes in code generation projects

### 2.1 Template drift [CRITICAL]

**The problem:** Templates in `templates/etendo-module/` reflect Etendo patterns at the time of writing. Etendo evolves. In 6-12 months, templates will generate code that compiles but uses deprecated APIs, data access patterns that are no longer recommended, or module structures that Etendo no longer supports correctly.

This is the most predictable failure mode in code generators for platforms with frequent releases. I have seen it in module generators for SAP, Oracle EBS, and similar platforms.

**Specific to Etendo:** Event handlers in Etendo have an API that has changed between versions. The `@Handler` + `EntityPersistenceEventObserver` pattern has subtleties that depend on the framework version. A template written for Etendo 24.x may generate code that compiles in 24.x but has incorrect behavior in 25.x.

**The TDD mentions "compilation gate" to detect API changes.** But the compilation gate only detects *compilation errors*, not *silent behavioral changes*. A method that changes its semantics between versions while maintaining its signature is not detected.

**Mitigation:** Templates need explicit version pinning — each template must declare against which Etendo version it was validated. The Day-2 pipeline needs to compare the template version against the target Etendo version, not just compile.

---

### 2.2 Code that compiles but does not work at runtime [CRITICAL]

**The classic code generation problem:** The generator produces code that passes all static tests and unit tests, compiles without errors, but fails at runtime for reasons that only manifest with a real Etendo running.

**Concrete scenarios for this project:**

*Scenario A — OBContext not initialized:* Event handlers run in the context of OBDal. If the generated handler accesses `OBContext.getOBContext()` at a moment when the context is not initialized (for example, on certain Etendo RX code paths), the result is a NullPointerException that does not appear in OBBaseTest JUnit tests but does in production.

*Scenario B — Lazy loading in Hibernate:* The generated mapper accesses `order.getBusinessPartner().getName()`. If the Hibernate session has already been closed when the mapper runs (for example, in the context of response serialization in Etendo RX), this throws LazyInitializationException. JUnit tests with OBBaseTest keep the session open throughout the test, masking this problem.

*Scenario C — Transaction flush timing:* The process template calls `OBDal.getInstance().flush()` after each step. This seems correct but can cause problems when subsequent steps depend on the pre-flush state of objects in the session. The TDD describes the transaction model as "OBDal, single transaction" but does not specify flush semantics between steps.

*Scenario D — AD registration of processes:* The `completeOrder` process is registered in the Application Dictionary via reference data XML. If the XML format does not match exactly what Etendo expects for the specific version (AD_Process, AD_Process_Para, scheduling config), the process cannot be executed from the Etendo UI even though the Java compiles perfectly.

**The vertical slice needs to execute the `completeOrder` process against real Etendo data, not just compile.** Compilation is not sufficient.

---

### 2.3 Edge cases in metadata that break the extractors [HIGH]

**The problem:** The extractors assume Etendo metadata has a certain structure. Real Etendo metadata has inconsistencies, fields with null values where they should not be null, partial circular references, and legacy configurations that were never updated.

**Specific to Sales Order in Etendo:**

- Fields with `AD_Reference_ID` pointing to references that no longer exist or were replaced
- Tabs with `TabLevel` != 0 that do not have a `ParentColumn` correctly defined
- Callouts registered in `AD_Column_Callout` pointing to Java classes that no longer exist in the classpath
- `DisplayLogic` expressions with old JavaScript syntax that the extractor's parser does not understand (for example, use of `eval()` or `with()`)
- Fields with `DefaultValue` containing embedded SQL instead of the `@variable@` format the extractor expects

**What the TDD does not cover:** A "graceful degradation" mechanism for when metadata is invalid or inconsistent. Currently, if the extractor encounters an invalid reference, the behavior is not specified. In my experience, the extractor fails silently and produces an incomplete schema-raw.json, which then causes obscure errors in later pipeline stages.

**Immediate risk:** In the vertical slice, the team will connect to a real Etendo instance and find inconsistent metadata. They need to decide today whether the extractors fail explicitly (with a clear error) or degrade silently. Failing explicitly is always the correct decision.

---

### 2.4 The "last 20%" problem [HIGH]

**The pattern:** In code generation projects, 80% of the code is generated quickly and well. The remaining 20% — edge cases, complex rules, fields with special semantics — takes 80% of the total time.

**For Schema Forge, the probable "last 20%" includes:**

- Callouts with multi-branch logic that depends on client configuration (not system configuration)
- Fields with different derivation depending on the transaction context (purchase vs sale, domestic vs international)
- Processes that invoke other Etendo processes via `ProcessUtil.executeProcess()` — the single-transaction model in the PRD assumes all steps are direct, but some real `completeOrder` steps in Etendo likely invoke other processes
- Fields of type `image` or `binary` that the schema defines but the DTO generator does not handle
- List-type references with dynamic values that are not a static enum but come from a table

**The vertical slice will run into this.** The team will be able to generate 80% of the Sales Order in the first 3-4 days, then spend 2-3 weeks on the remaining 20%. This is not a failure — it is the normal pattern. The problem is if the team is not prepared for this and interprets the stalling as a failure of the approach.

---

## 3. Etendo-specific risks

### 3.1 Unaddressed OBDal quirks [HIGH]

**Problem 1 — OBCriteria and accesslevel filtering:** `OBDal.getInstance().createCriteria(Order.class)` in Etendo automatically applies organization and client filters based on the active `OBContext`. The generated code in the endpoints (TDD-annex A, section A.5) does not show explicit handling of this filter. In a multi-organization Etendo, this can result in endpoints returning data from other organizations or failing with access errors.

**Problem 2 — Hibernate dirty checking:** OBDal uses Hibernate with automatic dirty checking. If the generated event handler modifies an entity field in the `beforeSave` event, Hibernate may detect that the object was modified and trigger a second save, which can result in recursive handler calls. The TDD does not mention recursion protection in event handlers.

**Problem 3 — OBDal.getInstance() in test context:** Integration tests extend `OBBaseTest`, which sets up a test context. But `OBBaseTest` has setup overhead that can mask real performance problems. An endpoint that takes 2 seconds in tests may take 200ms in production (because tests have transaction overhead) or may take 10 seconds (because tests do not have production data volumes). The < 5 min time for integration tests assumes that the tests do not have performance problems — if they do, the figure jumps significantly.

**Problem 4 — `new Order()` vs `OBProvider.getInstance().get(Order.class)`:** The generated code in TDD-annex A uses `new Order()`. In Etendo, the correct way to create entities may depend on whether IoC containers are configured and on which version of the framework is used. `new Order()` may not correctly initialize fields that Etendo expects to be initialized (such as `isActive`, `client`, `organization`).

---

### 3.2 Event handler ordering [CRITICAL]

**The problem:** Etendo executes event handlers in non-deterministic order when multiple handlers are registered for the same event on the same entity. The generated module registers an `OrderDerivationHandler` for `beforeSave`. But Etendo already has its own handlers registered for `C_Order` — including handlers from tax, accounting, and inventory modules that may run *after* the DerivationHandler.

**Failure scenario:** The generated `OrderDerivationHandler` sets `warehouse` (system field, derivation `fromConfig`). An existing Etendo Core handler then recalculates the warehouse based on the user's organization. The final value of the `warehouse` field in the DB is the one from the Etendo Core handler, not the DerivationHandler, because Etendo Core runs afterward.

**The PRD says:** "Rules marked Keep are already there. The callout stays registered in AD_Column_Callout. Etendo executes it normally." This is correct. But it says nothing about the interaction between the new `DerivationHandler` and existing Core handlers that are not callouts — they are framework event handlers that the rule extractor does not catalog because they are not `AD_Callout`, they are `@Handler` annotations in Java.

**These framework handlers are invisible to the Rule Extractor.** They are not in `AD_Column_Callout`. They are in the Etendo Core classpath as annotated Java classes. The current extractor only looks at the DB and module classes — not the full Etendo classpath.

---

### 3.3 Transaction boundaries and flush semantics [HIGH]

**The PRD model:** "One Connection, one Hibernate Session. If any step fails, the entire transaction rolls back."

**The reality of Etendo:** Some Core Etendo processes — especially accounting and posting ones — open their own OBDal sessions or use `DalConnectionProvider` directly. If `completeOrder` Step 5 (`postAccounting`) calls an Etendo posting process that opens its own connection, that posting occurs outside the `CompleteOrderProcess` transaction. If Step 6 fails, the `CompleteOrderProcess` transaction rolls back, but the posting was already committed in the posting process's connection.

**This is the type of bug that only appears in production, not in tests.** Integration tests with `OBBaseTest` do not test real posting — they test with rollback transactions. Real posting requires a complete Etendo instance with the accounting engine active.

**Recommendation:** The `postAccounting` step in `completeOrder` should be explicitly marked as "invokes external process — does not guarantee atomic rollback" in the process definition. The behavioral test should verify that in case of posting failure, the recovery order is clear.

---

### 3.4 Reference data XML format [HIGH]

**The problem:** Generated reference data (AD_Process, AD_Tab, AD_Column_Callout, etc. records) are generated as XML using Handlebars templates. The exact format of this XML — attribute order, encoding, node structure — is extremely sensitive to the Etendo version.

Etendo uses DBSourceManager to import reference data. DBSourceManager has a merge logic that compares XML with the current DB using IDs and checksums. If the generated XML does not have exactly the structure DBSourceManager expects, the import can:
- Fail silently (partially imports)
- Duplicate records (if it does not recognize the ID as existing)
- Delete existing configuration (if it interprets the XML as desired state instead of a delta)

**The TDD has templates for `dataset.xml.hbs` but does not specify the exact format.** This is a critical gap. The team needs to look at the real reference XML of a working Etendo module and replicate exactly that structure.

---

## 4. AI integration risks

### 4.1 Token budget of 5,500/turn for UI Generator [MEDIUM]

**The TDD assumption:** The schema is used as a system prompt for the UI Generator. The Sales Order has ~60 fields with complete metadata (type, visibility, derivation, reference, validation, displayLogic, readOnlyLogic). The complete Sales Order schema can easily occupy 3,000-4,000 tokens just in structure.

With a budget of 5,500 tokens per turn and ~3,500 spent on the schema, ~2,000 tokens remain for conversation + the generated React component. A React component for a Sales Order form with header and lines can occupy 1,500-2,000 tokens. This leaves very little room for iteration.

**The risk is not running out of tokens on the first turn.** It is that in the 5th or 6th iteration turn, when the conversation history is long, the model has to truncate the schema to fit in context, and starts generating components that do not respect the schema constraints (required fields not marked as required, references not validated, etc.).

**Mitigation:** The schema as system prompt should be sent in compressed form (only fields relevant to UI, without internal metadata) or a "schema fragments" mechanism should exist where the turn sends only the part of the schema relevant to the current component.

---

### 4.2 Classification accuracy for complex callouts [HIGH]

**The problem:** The AI pre-classifies callouts by analyzing Java code. Static Java analysis with an LLM has known limitations:

- Polymorphism and inheritance obscure the execution flow
- Injected dependencies (Spring, Weld) cannot be reasoned about statically
- Side effects in private methods or utility classes of the same module are not captured
- Callouts that call `OBDal` in helper methods do not appear as `hasDmlOperations = true` if the extractor only looks for `OBDal.getInstance()` in the main method

**The most common error case:** A callout classified as "simple field setter" that actually delegates to a helper class that performs a complex query. The AI sees the main method and says "low risk," but the main method is just a facade.

**Specific risk for Sales Order:** The `SalesOrderCallout` in Etendo Core is known for having highly complex pricing logic with many conditional branches. Classification of this callout by an LLM has a high probability of error.

---

### 4.3 Hallucination in generated React components [MEDIUM]

**The problem:** Claude Sonnet can generate React components that:
- Use React hooks that do not exist (`useSomethingThatDoesntExist`)
- Import libraries not in the module bundle
- Implement validation logic that does not correspond to the schema (for example, a field marked as `optional` in the schema but `required` in the component because "it seems like it should be required")
- Generate code that works in the Babel standalone preview but not in the production build (transpilation differences)

**The fast loop with iframe preview** mitigates this for visual validation. But the preview does not validate that the component correctly uses backend APIs (payload structure, field names matching the curated schema).

**Concrete scenario:** The UI Generator produces a component where the `businessPartnerId` field is called `bpId` in the POST payload. The Node.js contract test does not catch it because the contract test verifies that the field exists in the schema, not that the React component serializes it correctly. The JUnit integration test also does not catch it because the test builds the payload directly in Java. Only when a real user attempts to create an order is it discovered that the backend receives `bpId: null` and fails.

---

## 5. Day-2 lifecycle risks

### 5.1 The vertical slice works, scaling to other windows breaks [HIGH]

**The pattern:** The Sales Order vertical slice works because the team built it with deep domain knowledge. When the same pipeline is applied to Purchase Order, Customer Invoice, or Inventory Movement, Sales Order-specific assumptions manifest as bugs.

**Specifically:**
- `core-maps/system-columns.json` is built based on the Sales Order. Other windows have system fields not in the map that the classifier does not recognize.
- Event handler templates assume the entity has a `documentStatus` field with values `DR/CO/VO`. Entities without a document workflow fail.
- The process model (preconditions + steps + rollback) assumes all processes are transactional documents. "Batch" or "recalculation" type processes have different semantics.

**The pipeline generalizer is the most underestimated risk in the project.** The Sales Order is the most complex case in the ERP — if the templates are optimized for the Sales Order, they will be too complex for simple windows (which do not need all this) and will fail for windows with different semantics.

---

### 5.2 Delta detection for real Etendo upgrades [HIGH]

**The PRD model (section 13.1):** Re-run extractors → diff against previous raw → AI pre-processes deltas → Human sees only new/changed items.

**The problem:** The diff between two versions of Etendo metadata is not a simple JSON diff. AD_Field_IDs can change. Relationships can be reorganized. A field can move from one tab to another (changing its parentEntity in the schema). A callout can be internally refactored without changing its external signature.

**What the diff detects:** Changes in the JSON structure (new fields, removed fields, changed values).

**What the diff does not detect:**
- A callout with the same name and same Java signature but completely different internal logic (a refactor that changes behavior without changing the API)
- A field that remains with the same name but whose semantics changed (for example, `warehouse` that in the new version refers to the picking warehouse instead of the dispatch warehouse)
- Dependencies between fields that changed without the fields themselves changing

**This is especially relevant for fields marked as "Keep."** The PRD says: "Modified callout (Keep) → Behavioral test may fail, human re-validates." This assumes the behavioral test detects the change. But if the behavioral test was automatically generated from the same artifact as the code, it may be validating the previous implementation and simply continue passing with the new one, masking the semantic change.

---

### 5.3 Preservation of decisions between regeneration cycles [CRITICAL]

**The PRD model:** Previous decisions are preserved as baseline. In Day-2, the human sees only changes.

**The undocumented problem:** What happens when a previous decision becomes invalid due to a system change?

Example: The consultant decided "Omit" for the callout `C_BPartner_Location_ID_Callout` because "the user always manually chooses the address." In the new version of Etendo, that callout now also sets a `taxCategory` field that is required for posting. The "Omit" decision was made when the callout only set address. Now the callout has additional effects.

**The delta mechanism only detects changes in metadata** — if the callout itself changed. It does not detect that the *effects* of a callout already cataloged as "Keep" or "Omit" changed because other system fields changed their dependency on that callout.

**In practical terms:** The decision log can become obsolete without any system detecting it, because the invalidation is semantic, not structural.

---

## 6. Team and process risks

### 6.1 4 developers in parallel without established patterns [CRITICAL]

**The parallelization plan (vertical slice section 2.3):**
- Wave 1: F1a (extract-fields) + F1b (extract-rules) + F5 (process JSON) + core-maps
- Wave 2: F2 (validators) + F3 (pre-classify)
- Wave 3: F4 (decision-panel) + F6 (contract generator)
- Wave 4: F7 (backend generator) + F8 (UI generator)

**The problem:** The interfaces between phases are not fully specified. The formal JSON schemas (section 2, TDD) define artifact structure, but do not define:
- The exact behavior when a field has `visibility: system` but no declared `derivation` (error? warning? default?)
- How a rule that exists in AD but whose Java class cannot be found in the source is represented in schema-raw.json
- The exact semantics of `confidence: high|medium|low` on a rule's effects — who defines it, how it is calculated
- Required vs optional fields in schema-curated.json (the JSON Schema says the type, but not necessarily the exact cardinality in all contexts)

**Two developers working in parallel on F1a and F1b will make different representation decisions** for edge cases. When F2 (validators) attempts to validate the outputs of F1a and F1b, it will find inconsistencies. This problem is almost inevitable without an explicit alignment session before Wave 1.

**What I have seen in similar projects:** Each developer "solves" the edge cases with their own reasonable criteria. When outputs are integrated, there are 4-6 different formats for the same concept. The refactoring to align them takes longer than aligning them upfront would have.

**Urgent mitigation:** Before Wave 1, define 10-15 specific edge cases and decide exactly how they are represented in JSON. Document with examples. Hold a 2-hour session where the 4 developers review the cases and reach consensus. This is not perfectionism — it is rework prevention.

---

### 6.2 Risk of solution fragmentation [HIGH]

**The pattern:** In greenfield projects with 4 parallel developers, the same problem is solved in 4 different ways in 4 parts of the codebase.

**Specific likely cases for Schema Forge:**

*Error handling:* The field extractor and the rule extractor will likely have different error handling strategies (throws? returns error object? logs and continues?). The validator and contract generator likewise.

*Access to the Etendo DB:* If two developers need queries against AD, they will write their own connection functions or structure the access differently.

*Logging and debugging:* Without an established standard, each CLI tool will log differently, making it difficult to debug the complete pipeline.

**The real cost:** When F7 (backend generator) needs to consume outputs from F1, F2, F3, and F4, it will have to handle 4 variations of the same concept. The backend generator is the most complex in the pipeline — if it also has to normalize inconsistencies from all previous stages, its complexity doubles.

---

### 6.3 The vertical slice as destination vs. the vertical slice as learning [MEDIUM]

**The mindset risk:** If the team treats the vertical slice as "we have to make Sales Order work," they will optimize for making Sales Order work. The shortcuts they take to reach the end of the pipeline will remain embedded in the code as technical debt.

**Examples of shortcuts that seem reasonable but do not scale:**
- Hardcoding the table name `C_Order` in the extractor instead of parameterizing it
- Assuming there is always a header tab and a lines tab (Sales Order has this structure, but not all windows do)
- Generating the event handler with a fixed class name instead of deriving it from the schema
- Hardcoding the OBContext client/org in JUnit tests instead of reading them from the test data schema

**Recommendation:** Every time a developer takes a shortcut, they should record it with a `// VERTICAL-SLICE-SHORTCUT:` comment and a task in the backlog. The goal is to finish the vertical slice knowing exactly how much technical debt was accumulated, not to finish it believing they already have the final generator.

---

## 7. Quick wins the team should capture first

### 7.1 Build the "classification honeypot" before anything else [CRITICAL]

**What it is:** A set of 25-30 Sales Order rules where the team (or someone with deep Etendo knowledge) already knows the correct decision. Before running the pre-classifier, manually annotate the expected decision for each one. Then run the classifier and measure precision.

**Why it is the first experiment:** If precision is < 70%, the classifier is not reliable as a "first line" and the Rule Catalog architecture needs to rethink the confidence mechanism. Discovering this in Wave 1 costs 2 days. Discovering it after building the entire pipeline costs weeks.

**Expected deliverable:** A file `artifacts/sales-order/classification-honeypot.json` with `expected_decision` and `actual_decision` for each rule, and a calculated precision.

---

### 7.2 Run the extractor against real Etendo on day 1 [CRITICAL]

**The risk of deferring it:** If the team builds the extractor in Wave 1 but does not connect it to a real Etendo instance until Wave 2 or 3, they will make all design decisions based on an idealized view of Etendo metadata. When they connect it to real Etendo, they will find inconsistencies that will force them to refactor the extractor.

**What should happen on day 1:** Write the minimal SQL query that extracts AD_Window, AD_Tab, AD_Field, and AD_Column for the Sales Order. Execute it against a real Etendo instance. Save the result. Look at it. Find the 5 things that were not expected. Make design decisions based on that.

**This does not require the complete extractor to be ready.** It requires someone with access to an Etendo instance to execute 4 SQL queries and share the results with the team.

---

### 7.3 Manually generate the minimal module that compiles [HIGH]

**What it is:** Before building the backend generator, manually create (without templates, without generation) the simplest possible Etendo module — a GET /orders endpoint that returns hardcoded data, an event handler that logs the save. Compile it with gradlew. Deploy it to Etendo. Verify that it responds.

**Why:** This validates the `build.gradle` template, module structure, classpath, XML format, and Application Dictionary registration — all before the backend generator attempts to generate them automatically. Format, classpath, and module registration problems are much easier to debug in a minimal manual module than in one generated with 50 files.

**Expected deliverable:** A directory `artifacts/sales-order/generated-minimal/` with the minimal module that compiles and works. This would take 1-2 days. It saves 1-2 weeks of backend generator debugging.

---

### 7.4 Manually define the schema-curated.json for 10 fields [MEDIUM]

**What it is:** Before building the Decision Panel UI, manually create the `schema-curated.json` for 10 Sales Order fields (the most representative: a simple editable, a system field with derivation, a readOnly, a foreignKey, an accounting-category system field). Run that manual schema through the validator and contract generator.

**Why:** This validates the formal JSON Schema and the contract generator without the UI complexity. If the validator has bugs or the contract generator produces incorrect tests, they are discovered with 10 fields instead of 60.

---

## 8. Things I have seen go wrong in similar projects

### 8.1 The "generated code looks right" fallacy

In an Oracle EBS module generation project some years ago, the team was convinced for 3 weeks that the generated code was correct because it "looked right" and compiled. The problem was that the generated mappers used Oracle's internal ID (ROWID) instead of the business ID in relationships between entities. All tests passed because the integration tests used test data with IDs that happened to match. Only when the system was run with real production data, where the IDs did not match, did the failure appear — in production, on go-live day.

**For Schema Forge:** The generated mapper that converts OBDal entity to DTO uses `order.getBusinessPartner().getId()`. If this ID is Etendo's internal UUID and the frontend uses it to display the business partner name, but the name is looked up by a different ID (the customer ID in the ERP, not the table UUID), the result is that the frontend displays incorrect data or cannot perform the search.

---

### 8.2 The "implicit decisions that become explicit late" problem

In a metadata-driven customization project for SAP, the team explicitly modeled visibility, validation, and workflow decisions. But they did not explicitly model *data format* decisions. When the system went to production, date fields in the frontend used European format (DD/MM/YYYY) and the backend expected ISO (YYYY-MM-DD). This format decision was implicit — no one made it consciously because "obviously" the system would handle dates correctly.

**For Schema Forge:** The schema defines `type: date` and `type: datetime`. The generated DTO uses `Date` in Java. The frontend uses `string` for date fields. The conversion between these three formats — and the timezone — is a decision not explicitly captured in any pipeline artifact.

---

### 8.3 The "first customer effect" problem

In several ERP code generation tool projects, the tool works perfectly for the pilot client because it was built *thinking specifically about that client*. The second client has data, configurations, or customizations that the first client did not have, and the tool fails in ways that seem obvious in retrospect.

**For Schema Forge:** The Sales Order vertical slice will be successful. The first real client will have a Sales Order with their own customizations — additional callouts added by previous consultants, additional fields in their own modules, references to module tables that Schema Forge does not know about. The extractor will find these customizations and will not know what to do with them.

**This is not a failure that can be completely prevented.** It is a failure that can be planned for: the extractor needs an "unknown rule" mechanism for rules it cannot classify in any known category, and the pipeline needs a "skip and warn" path for unknown components instead of "fail hard."

---

### 8.4 The "spec is not the implementation" problem

I have seen projects where the TDD is excellent — complete, coherent, well thought out — and the code does not implement it correctly because there are implementation details the TDD assumed were obvious and the developer assumed differently.

**Specific example from the Schema Forge TDD:** The section on event handlers says the `OrderDerivationHandler` is registered for the `beforeSave` event. The TDD does not specify whether this is `EntityPersistenceEvent.Type.INITIALIZED`, `EntityPersistenceEvent.Type.NEW`, or both. In Etendo, the difference between these two event types is significant — a handler for `NEW` only executes on the first insertion, a handler for `INITIALIZED` executes on insertions and updates. A system field that needs derivation only at creation (like the document number) needs a different event type than a field that is re-derived on every modification (like the calculated total).

**The EventHandler.java.hbs template needs this decision embedded.** If it is not, the developer who writes the template makes the decision on their own, possibly incorrectly.

---

## 9. Risk summary by priority

| # | Risk | Severity | Required action |
|---|------|-----------|------------------|
| 1 | Decision preservation becomes semantically invalid | CRITICAL | Define decision invalidation mechanism before Day-2 |
| 2 | Event handler ordering with Etendo Core handlers | CRITICAL | Inventory existing C_Order handlers before generating |
| 3 | Classification honeypot may reveal precision < 70% | CRITICAL | Build honeypot on day 1 before trusting the classifier |
| 4 | 4 developers without edge case alignment produce incompatibilities | CRITICAL | Edge case alignment session before Wave 1 |
| 5 | Code that compiles but fails at runtime (lazy loading, OBContext) | CRITICAL | Minimal manual module working in real Etendo before generating |
| 6 | Template drift relative to Etendo version | HIGH | Version pinning of templates from day one |
| 7 | Auto-classification of complex callouts with incorrect high confidence | HIGH | Manually review all "high confidence" callouts |
| 8 | Delta detection does not detect semantic changes in Day-2 | HIGH | Explicitly document limitation in the design |
| 9 | The last 20% of Sales Order takes 80% of remaining time | HIGH | Timebox the vertical slice and define what "done enough" means |
| 10 | Reference data XML format incompatible with DBSourceManager | HIGH | Compare generated template with real XML of a working module |
| 11 | 3-hour estimate valid only for expert users | HIGH | Redefine target as "< 3 hours for second window onwards" |
| 12 | Scaling to other windows reveals Sales-Order-specific assumptions | HIGH | Identify and document those assumptions during the vertical slice |
| 13 | Insufficient token budget in UI Generator for complex schemas | MEDIUM | Implement compressed schema for system prompt |
| 14 | The "245 tests" gives false sense of coverage | MEDIUM | Add 5-10 hand-written golden path tests |
| 15 | Inconsistent metadata in real Etendo breaks extractors | MEDIUM | Define graceful degradation policy for the extractor |
| 16 | Date and timezone format not captured in schema | MEDIUM | Add `format` field to schema for date/datetime fields |
| 17 | React hallucination: payload field names do not match schema | MEDIUM | Add contract test that verifies frontend serialization |
| 18 | Vertical slice accumulates shortcuts that do not scale | MEDIUM | `VERTICAL-SLICE-SHORTCUT` comment convention from day 1 |
| 19 | OBDal accesslevel filtering not handled in generated endpoints | HIGH | Verify that `OBCriteria` in endpoint template includes org filters |

---

## 10. A final observation

Schema Forge has an intelligent design. The separation of responsibilities is clear, the two-loop approach is pragmatic, and the focus on generated source code (instead of low-code) is correct. The documentation is of high quality.

The danger is not the design. The danger is that the quality of the design generates excessive confidence that the implementation will go well. Code generation projects fail in implementation, not in concept.

The team should begin with the mindset that the vertical slice is a learning experiment, not a demo. The goal of the vertical slice is not to have the Sales Order working — it is to discover the 5 design assumptions that were wrong before building the complete system. If at the end of the vertical slice they have identified and documented those 5 incorrect assumptions, the vertical slice was successful, regardless of whether the code compiles or not.

---

*End of document*
