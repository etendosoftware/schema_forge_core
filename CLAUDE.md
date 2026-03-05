# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Schema Forge** transforms Etendo ERP metadata and business rules into complete web applications. Humans make business decisions; AI generates production code. The output is a standard Etendo module (Java backend + React SPA frontend) that runs natively on the Etendo platform.

This is NOT low-code. The human decides, the machine generates real source code.

## Architecture

### Two-Loop System

- **Fast Loop (UI, seconds):** Human <-> AI generating React components. Preview via sandboxed iframe with Babel standalone + mock data. No compilation, no backend.
- **Validation Loop (Backend, minutes):** Generate Java + XML -> contract tests (Node.js, instant) -> compile module (gradlew) -> integration tests (JUnit/OBBaseTest).

### Stack

| Layer | Technology |
|-------|-----------|
| CLI tools | Node.js (zero-dependency) |
| Decision tools | React web apps |
| AI integration | Anthropic Claude API (Sonnet) |
| Generated backend | Java (Etendo module: OBDal, event handlers, processes, Etendo RX endpoints) |
| Generated frontend | React SPA |
| Contract tests | Node.js (JSON assertions) |
| Integration tests | JUnit (extends OBBaseTest) |

### Repository Structure

```
schema-forge/
├── cli/                          # Node.js CLI tools (extractors, validators, generators)
├── tools/                        # React web apps for human decisions
│   ├── decision-editor/          # Field visibility decisions
│   ├── rule-catalog/             # Business rule decisions (Keep/Replace/Simplify/Omit)
│   ├── ui-generator/             # Conversational AI UI design
│   ├── process-designer/         # Process definition (JSON in MVP)
│   └── permission-matrix/        # Role-based access configuration
├── templates/etendo-module/      # Java/XML templates for code generation
├── artifacts/{window-name}/      # Per-window: schemas, rules, decisions, generated code
├── core-maps/                    # system-columns.json, impact-messages.json
└── docs/                         # PRD and TDD documents
```

### Key Data Flow (Pipeline)

```
Etendo Metadata -> Field Extractor + Rule Extractor (auto)
    -> Schema + Rule Catalog (AI pre-classifies ~60%, human reviews ~40%)
    -> Decision Editor + Rule Catalog (human curates)
    -> UI Generator + Process Designer + Permission Matrix
    -> Contract Generator (~245 auto tests)
    -> Generated Etendo Module (Java backend + React frontend)
```

### Three Independent Versions

- `moduleVersion`: increments on every regeneration
- `apiVersion`: increments when DTO shape changes (frontend cares about this)
- `behavioralVersion`: increments when rules/processes change (tests care about this)

## Core Domain Concepts

- **Schema curado**: JSON with fields classified by visibility (editable/readOnly/system/discarded) and derivation rules
- **Rules curadas**: Business rule catalog with human decisions (Keep/Replace/Simplify/Omit)
- **Visibility model**: editable (user input), readOnly (display), system (auto-derived, hidden), discarded (ignored)
- **System field derivations**: fromConfig, fromParent, fromField, lookup, computed, sequence — executed in generated event handlers (beforeSave)
- **OBDal transactions**: single DB transaction, all-or-nothing rollback. No Sagas.

## Generated Module Structure

```
com.etendo.schemaforge.{window}/
├── event/          # Event handlers (shared, not versioned)
├── process/        # AD_Process classes (shared)
├── callout/        # Callouts (shared)
├── validation/     # Precondition validators (shared)
├── dto/v{n}/       # Versioned DTOs
├── api/v{n}/       # Versioned Etendo RX endpoints
├── mapper/v{n}/    # OBDal entity <-> DTO mappers
├── referencedata/  # XML dataset
└── web/{window}/   # React SPA (targets one API version)
```

## Testing

- **Contract tests (~145, Node.js):** Run against JSON contract. No backend needed. Cover field presence, types, visibility, searchable filters, interface match.
- **Integration/behavioral tests (~100, JUnit):** Run inside Etendo (OBBaseTest). Cover real transactions, derivations, processes, permissions, edge cases.
- Every process must declare at least 3 edge cases.
- Every kept rule must have a behavioral test.

## Design Documents

All design specs are in `docs/`:
- `PRD.md` — Product requirements, decision map, pipeline, scope
- `TDD.md` — Technical design, data models, validation rules, generator specs
- `PRD-anex.md` — API versioning model (conceptual)
- `TDD-anex.md` — API versioning implementation details
