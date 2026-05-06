# Onboarding Guide — Schema Forge

| Property | Value |
|-----------|-------|
| Date | 2026-03-05 |
| Author | Sage (Documentation) |
| Status | Final |
| Audience | New developer joining the project |

---

## Welcome to the project

This guide gives you the context needed to understand Schema Forge, orient yourself in the architecture, and start contributing from day one. It is written for someone with software development experience who does not know the project or the Etendo platform.

---

## 1. What is Schema Forge

Schema Forge is a tool that transforms Etendo ERP metadata and business logic into complete web applications. The output is not configuration or visual blocks: it is real source code — a standard Etendo module that runs on the platform, uses the same database transaction, and can be deployed like any Etendo module.

The central premise is to change where the human fits in the development process. Today, building a new interface for an Etendo window requires writing Java, compiling, testing, and deploying. With Schema Forge, the human makes business decisions (which fields to show, which rules to keep, how the order completion process works), and the AI generates the code. If Schema Forge disappears tomorrow, the generated module keeps working — it is normal Etendo code.

The first MVP goal is the Sales Order window: extract its metadata, allow a human to make all relevant decisions, and generate a functional Etendo module with a React frontend, Etendo RX endpoints, and automated tests. This first use case demonstrates that the approach scales to any ERP window.

---

## 2. The Pipeline

The pipeline transforms inputs into artifacts at each phase. Each phase consumes what the previous one produced.

```
Etendo (DB + Java source)
        │
        ├─── Field Extractor ──────────> schema-raw.json
        │
        └─── Rule Extractor ───────────> rules-raw.json
                                              │
                              ┌───────────────┘
                              │
                    AI Pre-classifier
                    (auto ~60% of rules)
                              │
                    Decision Panel (Web UI)
                    ┌─────────┴──────────┐
                    │                    │
              schema-curated.json   rules-curated.json
                    │                    │
                    └─────────┬──────────┘
                              │
                    + processes.json (manual)
                              │
                    Contract Generator
                              │
               ┌──────────────┴──────────────┐
               │                             │
        Backend Generator              UI Generator
               │                             │
        Java Etendo Module             React SPA
        (event handlers,
         RX endpoints,
         JUnit tests)
               │                             │
               └─────────────┬───────────────┘
                             │
               Deployable Etendo Module
               + ~245 automated tests
```

### Two work loops

The pipeline has two iteration speeds:

| Loop | What it covers | Speed | When it runs |
|------|----------------|-------|--------------|
| **Fast loop** | UI design (React, mocks) | Seconds per turn | During UI decisions, without backend |
| **Validation loop** | Real backend (Java, OBDal, JUnit) | 3-5 min (compilation) | Once, at the end of decisions |

The fast loop allows the UI designer to iterate 20+ times against mock data without touching the backend. The validation loop compiles the real Java module, runs integration tests against Etendo, and validates that everything works in production.

---

## 3. What we are building now: the Vertical Slice

The vertical slice is the first end-to-end demonstration of the complete pipeline. It covers:

- **Order header**: the Sales Order header
- **Order Lines**: the order lines (master-detail relationship)
- **completeOrder**: the process that reserves inventory, calculates taxes, posts accounting, and updates status — all in a single OBDal transaction

The slice has a precise objective: prove that the pipeline works from start to finish with real Etendo data. If the slice works, the approach is validated and extensible to any other ERP window.

### Slice success criteria

| Criterion | Target |
|-----------|--------|
| Extract Sales Order fields from real Etendo | schema-raw.json with all fields |
| Extract rules (callouts, handlers, validations) | complete rules-raw.json |
| Auto-classify > 50% of rules | Tier auto with correct decisions |
| Human decisions via web panel | schema-curated.json + rules-curated.json |
| Generate contract tests | Node.js tests pass against contract.json |
| Generate Java module | Compiles as Etendo module |
| Generate React SPA | Renders order list + form + lines |
| completeOrder process defined | processes.json with preconditions, steps, edge cases |
| End-to-end traceability | Any generated file is traceable to decisions |

---

## 4. Repository Structure

```
schema-forge/
├── package.json                    # Monorepo root (npm workspaces)
│
├── cli/                            # Node.js CLI tools
│   └── src/
│       ├── extract-fields.js       # Etendo DB -> schema-raw.json
│       ├── extract-rules.js        # Etendo DB + Java source -> rules-raw.json
│       ├── pre-classify.js         # AI auto-classifies ~60% of rules
│       ├── validate-schema.js      # 4-level validation
│       ├── validate-processes.js   # Validates structure, coverage, edge cases
│       ├── generate-contract.js    # Generates ~245 tests
│       ├── generate-backend.js     # Templates -> Java Etendo module
│       └── check-version.js        # Detects breaking changes
│
├── schemas/                        # Formal JSON Schemas
│   ├── schema-raw.schema.json
│   ├── schema-curated.schema.json
│   ├── rules.schema.json
│   ├── processes.schema.json
│   └── contract.schema.json
│
├── tools/                          # Web UIs (React)
│   ├── decision-panel/             # Unified Decision Editor + Rule Catalog
│   └── ui-generator/               # Conversational AI UI generator
│
├── templates/                      # Code generation templates
│   ├── EventHandler.java.hbs
│   ├── DalProcess.java.hbs
│   ├── RxEndpoint.java.hbs
│   ├── DTO.java.hbs
│   └── dataset.xml.hbs
│
├── core-maps/                      # Static configuration
│   ├── system-columns.json         # Known system columns
│   ├── ad-reference-map.json       # AD_Reference_ID -> schema type
│   └── impact-messages.json        # Impact messages by category
│
├── artifacts/                      # Output per window
│   └── sales-order/
│       ├── schema-raw.json         # Extracted from Etendo (input)
│       ├── rules-raw.json          # Extracted rules (input)
│       ├── schema-curated.json     # Post-human decisions (curated)
│       ├── rules-curated.json      # Rules with decisions (curated)
│       ├── processes.json          # Process definitions (manual)
│       ├── contract.json           # Generated contract
│       ├── decisions-log.json      # Log of omissions and decisions
│       └── generated/              # Generated Etendo module
│
└── docs/
    ├── PRD.md                      # Product Requirements Document
    ├── TDD.md                      # Technical Design Document
    └── plans/
        ├── 2026-03-05-vertical-slice-design.md
        └── evaluations/
            ├── day-1-decisions.md  # This directory
            └── onboarding.md       # This file
```

### Where to find what

| I want to find | Where to look |
|----------------|---------------|
| What the project does | `docs/PRD.md` |
| How it is technically built | `docs/TDD.md` |
| The vertical slice plan | `docs/plans/2026-03-05-vertical-slice-design.md` |
| Why each decision was made | `docs/plans/evaluations/day-1-decisions.md` |
| The Sales Order fields | `artifacts/sales-order/schema-raw.json` |
| The business rules | `artifacts/sales-order/rules-raw.json` |
| The completeOrder process | `artifacts/sales-order/processes.json` |
| The generation templates | `templates/*.hbs` |
| The CLI tools | `cli/src/` |

---

## 5. Key Concepts

### Curated schema

The `schema-curated.json` is the pipeline's central artifact. It contains all the window's fields classified by visibility. It is produced by the human using the Decision Panel after the extractor generates `schema-raw.json`.

#### Visibility model

| Visibility | Frontend | Backend | User sees |
|------------|---------|---------|-----------|
| `editable` | Input component | Accepts in payload | Yes, can edit |
| `readOnly` | Display text | Returns in response | Yes, read-only |
| `system` | Hidden | Auto-derived in event handler | No |
| `discarded` | Ignored | Does not exist in endpoint | No |

A Sales Order has ~60 fields in Etendo. The user sees ~20. The remaining ~40 feed accounting, inventory, costing, and auditing. If they are ignored without deriving them, the document cannot be processed. The `system` field with its derivation is the solution: the backend auto-completes them before saving.

### Curated rules

The `rules-curated.json` contains all system business rules with the human decision for each one:

| Decision | What it generates | Original |
|----------|-------------------|---------|
| **Keep** | Nothing | Stays registered in Etendo, runs normally |
| **Replace** | New Java + updates AD record | Original class remains but AD points to the new one |
| **Simplify** | New Java (subset) + updates AD | Same as Replace, reduced scope |
| **Omit** | Nothing + entry in omissions log | AD record removed in module dataset |

AI auto-classifies ~60% of rules (display logic, read-only logic, simple validations). The human decides the remaining 40%: complex callouts, event handlers, document processes.

### Two-loop model

```
Fast Loop (seconds):
  Human <-> UI generator AI
  React component rendered against mock data
  No compilation. No backend. No DB.
  20+ iterations without touching the backend.

Validation Loop (minutes):
  schema-curated + rules-curated + processes
  -> Backend generator -> Java module
  -> Contract tests (Node.js, instant)
  -> Module compilation (gradlew, ~3-5 min)
  -> Integration tests (JUnit, ~60 sec)
  -> All green -> ready to deploy
```

The two-loop model is fundamental: Java does not need to be compiled to iterate on visual design. Compilation happens only once, at the end, when all decisions have been made.

### The completeOrder process

The most critical process in the vertical slice. Runs in a single OBDal transaction:

```
completeOrder
  ├── Preconditions (all must pass or returns 400)
  │     ├── pre.isNotCompleted
  │     ├── pre.hasLines
  │     ├── pre.hasBusinessPartner
  │     ├── pre.hasWarehouse
  │     └── pre.periodIsOpen
  │
  └── Steps (sequential, single transaction)
        ├── 1. validateDocument
        ├── 2. assignDocumentNumber
        ├── 3. reserveInventory
        ├── 4. calculateTax
        ├── 5. postAccounting
        └── 6. updateStatus

  If ANY step throws an exception -> full DB rollback
```

No Saga, no compensation. Single transaction or nothing.

---

## 6. How the Team Works

### Roles

| Role | Responsibility |
|------|----------------|
| Exploratory Developers (x4) | Implement pipeline phases in parallel waves |
| Balanced Reviewer (x1) | Reviews PRs — correctness, scope alignment, test coverage |
| Methodical QA (x1) | Validates contract tests, integration tests, process edge cases |
| Sage — Docs (x1) | Captures decisions, produces documentation, maintains architectural record |

### Workflow

```
DEV: implements in isolated worktree
  │
  ▼
REVIEW: Balanced Reviewer approves PR
  │
  ▼
QA: Methodical QA validates tests and edge cases
  │
  ▼
DOCS: Sage updates decision record if there are architectural changes
```

### Worktree isolation

Each feature is developed in a separate git worktree (not on a long-lived branch). This prevents one developer's changes from blocking or interfering with another's during parallel waves. The reviewer integrates from the worktree to the main branch.

### Parallelization waves (4 developers)

| Wave | Tasks | Dependencies |
|------|-------|-------------|
| 1 | F1a (extract-fields) + F1b (extract-rules) + F5 (processes JSON) + core-maps/schemas | None (start) |
| 2 | F2 (validators) + F3 (pre-classify) | Wave 1 complete |
| 3 | F4 (decision-panel) + F6 (contract generator) | Wave 2 complete |
| 4 | F7 (backend generator) + F8 (UI generator) | Wave 3 complete |

Within each wave, the 4 developers work in parallel. Between waves, there is an integration and review checkpoint.

---

## 7. Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| CLI tools | Node.js | Zero external dependencies, CI-friendly |
| Decision tools | React + Vite | Same ecosystem as the generated frontend |
| AI integration | Anthropic Claude API (Sonnet) | Schema as system prompt, conversational generation |
| DB driver for extractors | pg (PostgreSQL) | Etendo runs on PostgreSQL |
| Template engine | Handlebars | Logic-less, well-known, readable templates |
| JSON validation | Ajv | Standard JSON Schema validator for Node.js |
| Contract tests | Node.js built-in test runner | Zero dependencies, per TDD spec |
| Generated backend | Java (Etendo module) | OBDal, event handlers, processes, Etendo RX |
| Generated frontend | React SPA | Output of UI Generator |
| Integration tests | JUnit (OBBaseTest) | Standard Etendo test infrastructure |
| Monorepo | npm workspaces | No additional tooling, sufficient for the slice |

---

## 8. Further Reading

| Document | Contents | Path |
|-----------|----------|------|
| PRD v2.1 | What Schema Forge builds, why, product decisions, glossary | `docs/PRD.md` |
| TDD v2.1 | How it is built: technical structure, interfaces, JSON schemas, test pyramid, code generation | `docs/TDD.md` |
| Vertical Slice Design | The plan for the first slice: phases, dependencies, success criteria | `docs/plans/2026-03-05-vertical-slice-design.md` |
| Day-1 Decisions | Record of every decision made on day 1: what, why, what was rejected | `docs/plans/evaluations/day-1-decisions.md` |

---

## Quick Glossary

| Term | Definition |
|------|------------|
| Curated schema | JSON with fields classified by visibility, derivations, and system categories |
| Curated rules | Catalog of business rules with human decisions (Keep / Replace / Simplify / Omit) |
| Generated module | Standard Etendo module with event handlers, processes, endpoints, and React frontend |
| Fast loop | UI design cycle: human <-> AI, seconds per turn, mock data, no compilation |
| Validation loop | Backend verification: compiles module, runs JUnit, validates contracts |
| Searchable field | Field marked in the Decision Editor that becomes an available filter on the endpoint |
| Behavioral contract | State assertions after executing a process |
| OBDal transaction | A single DB transaction — all steps succeed or all roll back |
| Compilation gate | Day-2 pipeline step that compiles before presenting results to the human |
| Decision Panel | Single web UI combining Decision Editor + Rule Catalog for the vertical slice |
| system field | Field hidden from the user, auto-derived by the generated event handler before saving |

---

## Onboarding QA Validation

The onboarding material is validated through a documentation-led QA flow rather than strict numeric code coverage.

Use these QA assets:

- `docs/qa/user-onboarding-checklist.md` — manual validation checklist for a new user's first onboarding journey.
- `docs/qa/user-onboarding-rubric.md` — scoring rubric for conceptual understanding, repository orientation, and safety rules.
- `docs/qa/user-onboarding-session-template.md` — moderated session notes template for capturing friction and follow-up actions.
- `docs/qa/user-onboarding-multi-repo-analysis.md` — expanded analysis across Schema Forge, Etendo Core, and the NEO Headless module.

A successful onboarding session proves that a new user can:

1. Explain Schema Forge and the generated-module methodology.
2. Describe the extraction, decision, contract, generation, and validation pipeline.
3. Locate the main repository areas without ad hoc verbal guidance, including `schema-forge/`, `etendo_core/`, and `etendo_core/modules/com.etendoerp.go/`.
4. Complete one first-success journey using an existing generated window.
5. State the main safety rules, including not editing `artifacts/*/generated/` manually and not putting window-specific NEO behavior into shared NEO services.
6. Identify the next validation step for a generated window and the backend/runtime layer it depends on.

The QA result should be recorded as one of:

- Pass
- Pass with documentation fixes
- Needs another onboarding iteration
- Blocked

---

*Document produced as part of the Day-1 Evaluation Pipeline. Companion document: day-1-decisions.md (this directory).*
