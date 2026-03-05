# Vertical Slice Design: Sales Order End-to-End

| Property | Value |
|----------|-------|
| Date | 2026-03-05 |
| Status | Approved |
| Scope | Order + Order Lines + completeOrder process |
| Approach | Pipeline-first (8 phases) |
| Data Source | Real Etendo instance |
| Decision Tools | Web UI minima (single panel) |

---

## 1. Objective

Build an end-to-end vertical slice that demonstrates the full Schema Forge pipeline for the Sales Order window. This covers: extraction from Etendo, human decisions via web UI, code generation (Java backend + React frontend), and automated testing.

The slice includes Order header, Order Lines (master-detail), and the completeOrder process.

---

## 2. Approach: Pipeline-First

Build components in the order they appear in the pipeline. Each phase produces artifacts that feed the next.

### 2.1 Phase Overview

| Phase | Component | Output | Dependencies |
|-------|-----------|--------|-------------|
| 1a | Field Extractor | schema-raw.json | Etendo BD access |
| 1b | Rule Extractor | rules-raw.json | Etendo BD access + Java source |
| 2 | JSON Schemas + Validators | Formal schemas, validate-schema.js, validate-processes.js | F1 |
| 3 | IA Pre-classification | rules with tier auto/human, translated expressions | F1 + F2 |
| 4 | Decision Panel (Web UI) | schema-curated.json, rules-curated.json | F2 + F3 |
| 5 | Process Definitions | processes.json for completeOrder | F2 (parallel with F3/F4) |
| 6 | Contract Generator | ~245 generated tests (Node.js + JUnit stubs) | F4 + F5 |
| 7 | Backend Generator | Etendo Java module (event handlers, endpoints, processes) | F6 |
| 8 | UI Generator | React SPA from curated schema | F4 (parallel with F7) |

### 2.2 Dependency Graph

```
F1a: extract-fields ──┐
                       ├──> F2: schemas + validators ──> F3: IA pre-classify ──┐
F1b: extract-rules ───┘                                                        │
                                                                                ├──> F4: decision-panel
F5: process definitions (manual JSON) ─────────────────────────────────────────┤
                                                                                │
                                                                                ├──> F6: contract generator
                                                                                │         │
                                                                                │         ├──> F7: backend generator
                                                                                │         │
                                                                                └─────────├──> F8: UI generator
                                                                                          │
                                                                                          v
                                                                                       DONE
```

### 2.3 Parallelization (4 developers)

| Wave | Tasks | Devs |
|------|-------|------|
| 1 | F1a (extract-fields) + F1b (extract-rules) + F5 (process JSON) + core-maps/schemas | 4 |
| 2 | F2 (validators) + F3 (pre-classify) | 2 |
| 3 | F4 (decision-panel) + F6 (contract generator) | 2 |
| 4 | F7 (backend generator) + F8 (UI generator) | 2 |

---

## 3. Repository Structure

```
schema-forge/
├── package.json                    # Monorepo root (npm workspaces)
├── cli/                            # Node.js CLI tools
│   ├── package.json
│   ├── src/
│   │   ├── extract-fields.js       # Etendo BD -> schema-raw.json
│   │   ├── extract-rules.js        # Etendo BD + Java source -> rules-raw.json
│   │   ├── pre-classify.js         # IA auto-classifies ~60% rules
│   │   ├── validate-schema.js      # 4-level validation
│   │   ├── validate-processes.js   # Structure + coverage + edge cases
│   │   ├── generate-contract.js    # Generates ~245 tests
│   │   ├── generate-backend.js     # Templates -> Java module
│   │   └── check-version.js        # Breaking change detection
│   └── test/
│
├── schemas/                        # Formal JSON Schemas
│   ├── schema-raw.schema.json
│   ├── schema-curated.schema.json
│   ├── rules.schema.json
│   ├── processes.schema.json
│   └── contract.schema.json
│
├── tools/                          # Web UIs (React)
│   ├── decision-panel/             # Combined Decision Editor + Rule Catalog
│   │   ├── package.json
│   │   └── src/
│   └── ui-generator/               # Conversational AI UI design
│       ├── package.json
│       └── src/
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
├── artifacts/                      # Per-window output
│   └── sales-order/
│       ├── schema-raw.json
│       ├── rules-raw.json
│       ├── schema-curated.json
│       ├── rules-curated.json
│       ├── processes.json
│       ├── contract.json
│       ├── decisions-log.json
│       └── generated/              # Generated Etendo module
│
└── docs/
    ├── PRD.md, TDD.md, etc.
    └── plans/
```

### 3.1 Simplifications for Vertical Slice

- Decision Editor + Rule Catalog combined into single `decision-panel`
- Process Designer is manual JSON editing (per PRD: "MVP: JSON")
- Permission Matrix is manual XML
- No complex monorepo manager — npm workspaces basic
- No UI Generator AI integration in first pass — generate a static React component

---

## 4. Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| DB driver for extractors | pg (PostgreSQL) | Etendo runs on PostgreSQL |
| Template engine | Handlebars | Simple, logic-less, well-known |
| JSON validation | Ajv | Standard JSON Schema validator for Node.js |
| Decision panel framework | React + Vite | Fast dev server, same ecosystem as generated frontend |
| Test runner (contract tests) | Node.js built-in test runner | Zero dependency, per TDD |
| IA integration | Anthropic Claude API | Per TDD specification |

---

## 5. Day-1 Evaluation Pipeline

Before writing code, 3 evaluators + Sage review the design in parallel:

| Evaluator | Focus | Output |
|-----------|-------|--------|
| Product Owner | Scope vs PRD, priorities, success criteria achievability | scope-review.md |
| Architect | Tech stack viability, repo structure, dependency risks | architecture-review.md |
| External Advisor | Risks from similar projects, questionable assumptions, common traps | risk-assessment.md |
| Sage (Docs) | Day-1 decisions record, project onboarding doc | day-1-decisions.md, onboarding.md |

Reports synthesized into a consolidated Risk Register before development starts.

---

## 6. Success Criteria for Vertical Slice

| Criteria | Target |
|----------|--------|
| Extract Sales Order fields from real Etendo | schema-raw.json with all fields |
| Extract Sales Order rules from real Etendo | rules-raw.json with callouts, handlers, validations |
| Auto-classify >50% of rules | Tier auto with correct decisions |
| Human decides remaining rules via web panel | schema-curated.json + rules-curated.json |
| Generate contract tests | Node.js tests pass against contract JSON |
| Generate Java module | Compiles as Etendo module |
| Generate React SPA | Renders Order list + form + lines |
| completeOrder process defined | processes.json with preconditions, steps, edge cases |
| End-to-end traceability | Any generated file traceable to decisions |
