# Schema Forge

## The Human Decides, The Machine Generates

### Product Requirements Document

| Property | Value |
|----------|-------|
| Version | MVP 2.1 |
| Author | Etendo Software |
| Date | March 2026 |
| Status | Final |
| Scope | Sales Order window (extensible to all ERP windows) |
| Target | Internal validation + pilot customers |

---

## 1. Executive Summary

**Schema Forge** transforma la metadata y lógica de negocio de Etendo en aplicaciones web completas. El humano toma decisiones de negocio. La IA genera código de producción. El output es código fuente real — un módulo Etendo estándar que corre en la plataforma, usa OBDal, comparte la transacción y el classloader.

**Esto no es low-code.** Low-code le da al humano bloques para armar. Schema Forge le da al humano decisiones y genera código real. El humano no construye — decide. No está más cerca del código, está más cerca del negocio. Si mañana Schema Forge desaparece, el código sigue funcionando — es un módulo Etendo normal.

**Premisa arquitectural:** El backend generado es un módulo Etendo nativo. Las reglas Java existentes que el humano decide conservar siguen funcionando tal cual — ya están en el classloader, no se invocan desde afuera. Las reglas que se reemplazan se generan como código Etendo nuevo. El frontend es un React SPA independiente que habla con el back vía Etendo RX. Son dos loops de trabajo separados: uno rápido (UI, segundos, mocks) y uno de validación (backend, minutos, compilación real).

**El primer objetivo no es generar un ERP.** Es generar una herramienta que cambie el lugar del humano en el desarrollo: de escribir código a tomar decisiones. Zero código, pero lejos del anterior low-code.

---

## 2. The Pipeline

```
Etendo Metadata + Codebase
         │
    ┌────┴─────────────────┐
    ▼                      ▼
Field Extractor      Rule Extractor
(automático)         (automático)
    │                      │
    ▼                      ▼
Schema crudo         Rule Catalog crudo
    │                      │
    │               ┌──────┴──────┐
    │               ▼             ▼
    │          IA pre-classifies  Complex rules
    │          trivial rules      surface to human
    │          (auto ~60%)        (~40%)
    │               │             │
    │               └──────┬──────┘
    ▼                      ▼
Decision Editor      Rule Catalog
(human: campos)      (human: validates complex)
    │                      │
    ▼                      ▼
Schema curado        Rules curadas
    │                      │
    └──────────┬───────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
UI Generator  Process    Permission
(human + IA)  Designer   Matrix
    │          │          │
    └──────────┼──────────┘
               ▼
      Contract Generator
      (~240 auto tests)
               │
        ┌──────┴──────┐
        ▼             ▼
    Frontend      Backend
    generado      generado
    (React SPA)   (módulo Etendo)
        │          │
        │          ├── Etendo RX endpoints
        │          ├── Event handlers (new/replaced)
        │          ├── Processes (new/replaced)
        │          └── Keeps existing rules untouched
        │              │
        └──── REST ────┘
               │
      Versioned, traceable
      production source code
```

---

## 3. Problem Statement

### 3.1 La metadata no se aprovecha

Etendo tiene un Application Dictionary con miles de definiciones de ventanas, tabs, campos, referencias y validaciones. Solo se usa para renderizar la UI legacy. No existe un camino para generar aplicaciones modernas a partir de ella.

### 3.2 La lógica invisible

Un Sales Order tiene ~60 campos. El usuario ve ~20. Los otros ~40 alimentan contabilidad, inventario, costes y auditoría. Si se ignoran, el documento no se puede procesar.

### 3.3 Las reglas están dispersas

| Ubicación | Tipo | Descubrible? | Ejemplo |
|-----------|------|-------------|---------|
| AD_Callout | Java class | Sí | BP → auto-fill address, price list |
| Event Handler | Java class | Parcial | After save line → recalc header totals |
| AD_Validation_Rule | SQL dinámico | Sí | Filter warehouses by user org |
| Display Logic | JavaScript | Sí | Show freight only if delivery = shipper |
| Read Only Logic | JavaScript | Sí | Lock all if status = Completed |
| DB constraints | SQL | Sí | CHECK, FK, triggers |
| Document Process | Java class | Parcial | Complete → reserve + post + update |

Las reglas existen y son descubribles. El problema es que nadie ha decidido cuáles son necesarias para el nuevo sistema y cuáles son legacy.

### 3.4 El humano está en el lugar equivocado

Hoy el humano escribe código. Debería tomar decisiones de negocio. Toda modificación a una ventana de Etendo requiere tocar Java, compilar, testear, deployar.

---

## 4. Core Principle

**El humano sale del código y entra en las decisiones. La IA sale de la asistencia y entra en la generación. El código fuente es el output, no el medio.**

### 4.1 Complete Decision Map

| # | Decision | Who | Tool | Artifact |
|---|----------|-----|------|----------|
| 1 | Qué ventana generar | Project lead | Extractor config | Window selection |
| 2 | Qué campos son visibles/system/descartados | UI Decisor | Decision Editor | Schema curado |
| 3 | Cómo se ve la UI | UI Decisor | UI Generator (conversacional) | Código React |
| 4 | Qué reglas complejas continúan | Rule Decisor | Rule Catalog | Rules curadas |
| 5 | Cómo simplificar reglas complejas | Rule Decisor | Rule Catalog | Simplified specs |
| 6 | Qué reglas se omiten (con justificación) | Rule Decisor | Rule Catalog | Omission log |
| 7 | Qué procesos se habilitan | API Decisor | Process Designer | Process definitions |
| 8 | Qué comportamiento espero de cada proceso | API Decisor | Behavioral Editor | Behavioral contracts |
| 9 | Qué edge cases cubre cada proceso | API Decisor | Behavioral Editor | Edge case declarations |
| 10 | Qué roles existen y qué ventanas ven | Access Decisor | Permission Matrix | Access rules |
| 11 | Qué document flows se habilitan | Flow Decisor | Flow Selector | Enabled flows |

**Si una decisión no está en esta tabla, o es automática o falta.**

### 4.2 Role Consolidation

| Perfil real | Roles |
|------------|-------|
| Consultor funcional senior | UI Decisor + Rule Decisor + Access Decisor + Flow Decisor |
| Consultor técnico-funcional | Rule Decisor + API Decisor |

---

## 5. Architecture: Everything Runs on Etendo

### 5.1 Stack

| Layer | What | Where it Runs |
|-------|------|---------------|
| Frontend | React SPA | Browser (independent, talks REST to back) |
| API | Etendo RX endpoints | Etendo platform |
| Business rules (Keep) | Existing Java code | Etendo platform — untouched |
| Business rules (Replace/Simplify) | Generated Java code | Etendo platform — new module |
| System field derivation | Generated event handler | Etendo platform — new module |
| Process orchestration | Generated AD_Process class | Etendo platform — registered in AD |
| Transactions | OBDal / Hibernate | Etendo platform — single transaction |
| Permissions | AD_Role / AD_Window_Access | Etendo platform — configured, not generated |

### 5.2 Why This Matters

There is no bridge, no external system. The generated backend is a standard Etendo module:

- **Rules marked Keep are already there.** The callout stays registered in AD_Column_Callout. Etendo executes it normally.
- **Rules marked Replace generate new Etendo code** that replaces the existing AD registration.
- **Transactions are OBDal transactions.** One Connection, one Hibernate Session. If any step fails, the entire transaction rolls back. No Saga, no compensation.
- **Permissions use Etendo's existing system.** AD_Window_Access, AD_Role. The Permission Matrix writes records to those tables.

### 5.3 What Happens for Each Rule Decision

| Decision | Generated | Original |
|----------|----------|---------|
| **Keep** | Nothing | Stays registered, runs normally |
| **Replace** | New Java class + updated AD registration | Class stays, AD config points to new |
| **Simplify** | New Java class (subset) + updated AD registration | Same as Replace, reduced scope |
| **Omit** | Nothing + omission in decision log | AD registration removed in module dataset |
| **Auto-Keep (JS)** | Declarative rule in schema → frontend handles it | Original JS irrelevant (new UI doesn't use Etendo's JS engine) |

### 5.4 Transactions

One model: OBDal. All process steps write in the same Hibernate Session. If any step throws, the DB rolls back everything. The "rollback" definitions in process schemas are documentation for behavioral tests, not code that executes.

### 5.5 Search and Filtering

Etendo RX endpoints only support filtering by fields marked `searchable` in the schema. The frontend cannot issue arbitrary queries. If the UI Decisor wants a new filter, they mark the field `searchable` in the Decision Editor, the endpoint is regenerated with that filter, and the contract test verifies it exists. Required joins are known at generation time from the schema's `reference` definitions, preventing N+1 queries.

---

## 6. Two-Loop Workflow

The work splits into two independent loops with different speeds:

### 6.1 Fast Loop: UI Design (seconds)

```
UI Decisor → tells IA what they want
     ↓
IA generates React component
     ↓
Preview renders in iframe (Babel standalone, mock data)
     ↓
UI Decisor validates visually → iterate or accept
     ↓
Accepted code → saved to module's web/ directory
```

No compilation. No backend. No database. The UI Decisor iterates in seconds against mock data from the schema. This loop can run 20+ turns without touching the backend.

### 6.2 Validation Loop: Backend Integration (minutes)

```
Schema curado + rules curadas + processes
     ↓
Backend generator → Java files + XML reference data
     ↓
Contract tests (Node.js, JSON, no compile) → instant
     ↓
Module compilation (gradlew) → minutes
     ↓
Integration tests (JUnit, OBBaseTest) → seconds after compile
     ↓
All green → ready to deploy
```

This loop runs once after all decisions are finalized, not during iteration. The compilation cost (~minutes) is paid once, not per change.

### 6.3 Time Budget

| Phase | Activity | Target | Loop |
|-------|----------|--------|------|
| Extraction | Run extractors | 5 min | Neither (setup) |
| Field decisions | Decision Editor | 15 min | Neither (setup) |
| Rule decisions | Rule Catalog | 30 min | Neither (setup) |
| UI design | UI Generator conversations | 30-60 min | Fast loop (seconds/turn) |
| Process definitions | Process Designer | 60-90 min | Neither (setup) |
| Permissions | Permission Matrix | 10 min | Neither (setup) |
| Contract tests | Node.js assertions | 5 sec | Validation loop |
| Module compilation | gradlew | 3-5 min | Validation loop |
| Integration tests | JUnit on Etendo | 60 sec | Validation loop |
| **Total** | | **< 3 hours** | |

The 3-hour target is dominated by human decision time (~2.5 hours). Compilation and testing add ~10 minutes total. The fast loop (UI design) takes 30-60 minutes of human time but each turn is seconds.

---

## 7. Field Decisions (Decision Editor)

### 7.1 Extraction

Query SQL contra AD_Window, AD_Tab, AD_Field, AD_Column, AD_Reference. Pre-clasificación automática:

- `IsDisplayed = N` → **system**
- `IsDisplayed = Y` + `IsReadOnly = Y` → **readOnly**
- `IsDisplayed = Y` + `IsReadOnly = N` → **editable**
- `DefaultValue = @AD_Client_ID@` → derivation `fromConfig`

~75% queda bien clasificado automáticamente.

### 7.2 Visibility Model

| Visibility | Frontend | Backend | User Sees |
|------------|---------|---------|-----------|
| editable | Input component | Accepts in payload | Yes, can edit |
| readOnly | Display text | Returns in response | Yes, read only |
| system | Hidden | Auto-derived in event handler | No |
| discarded | Ignored | Not in endpoint | No |

### 7.3 System Field Derivations

System fields are auto-filled by a generated Etendo event handler (beforeSave):

| Type | Runtime Behavior |
|------|-----------------|
| fromConfig | Reads from OBContext |
| fromParent | Reads from parent record via OBDal |
| fromField | Copies from related record |
| lookup | OBDal query |
| computed | Expression evaluation |
| sequence | Etendo AD_Sequence |

### 7.4 System Categories

| Category | Impact if Missing |
|----------|-------------------|
| accounting | Document cannot be posted |
| inventory | MRP fails, deliveries break |
| costing | No cost visibility |
| audit | No change history |
| internal | Processing errors |

### 7.5 Searchable Fields

Fields marked `searchable` in the schema are the only fields available as filters in the generated Etendo RX endpoints. This is a human decision in the Decision Editor: marking a field searchable adds it to the API filter capability and to the frontend search UI. The generated endpoint pre-computes the necessary joins from schema references, so no N+1 queries occur at runtime.

---

## 8. Rule Decisions (Rule Catalog)

### 8.1 Two-Tier Classification

**Tier 1 — Auto-classified by IA (~60%):**

| Rule Type | Auto Decision | Rationale |
|-----------|--------------|-----------|
| Display Logic (JS) | Auto-Keep → translate to declarative | Deterministic, frontend-only |
| Read Only Logic (JS) | Auto-Keep → translate to declarative | Deterministic |
| Simple validations (SQL) | Auto-Keep → schema validation | Parseable SQL |
| Standard lookups | Auto-Keep → reference | Mechanical |
| Audit triggers | Auto-Keep | Always needed |

If translation fails (function calls, unknown syntax), the rule escalates to Tier 2 automatically. Never injects a partial translation.

**Tier 2 — Human validates (~40%):**

| Rule Type | Why Human Needed |
|-----------|-----------------|
| Complex callouts (multi-branch, DML inside) | Business decisions, hidden side effects |
| Event handlers (cross-entity) | Side effects on other entities |
| Document processes | Full business workflows |
| Callouts with direct DB access (OBDal/PreparedStatement detected) | Cannot be treated as pure field setters |

### 8.2 Human Decisions

| Decision | Generated | Original |
|----------|----------|---------|
| **Keep** | Nothing | Stays as-is |
| **Replace** | New Java (Etendo handler/callout/process) + AD update | Class stays, config points to new |
| **Simplify** | New Java (subset) + AD update | Same as Replace, reduced |
| **Omit** | AD registration removed + omission log | Documented removal |

### 8.3 Impact Cross-Reference

| Situation | Severity |
|-----------|----------|
| Omitted callout set a `system` field | Error — nobody fills it |
| Omitted handler computed a `readOnly` field | Error — shows empty |
| Omitted callout set a `required` + `editable` field | Warning — user fills manually |
| Omitted validation on a field still in schema | Warning — accepts any value |

### 8.4 Rule Catalog UX

IA generates descriptions in business language:

```
✅ "Cuando cambiás el cliente, se auto-completan la dirección de
    entrega y la lista de precios. Si la omitís, el usuario tiene
    que elegir esos campos manualmente cada vez que crea un pedido."
```

---

## 9. Process Decisions

### 9.1 Single Transaction

All processes use OBDal. One transaction. If any step throws, everything rolls back. No Saga, no compensation, no reverse operations. The rollback definitions in the schema are documentation for behavioral tests, not executable code.

### 9.2 Process Anatomy

```
Process: completeOrder
  ├── Preconditions (all must pass or 400)
  ├── Steps (sequential, single OBDal transaction)
  │     ├── 1. validateDocument
  │     ├── 2. assignDocumentNumber
  │     ├── 3. reserveInventory
  │     ├── 4. calculateTax
  │     ├── 5. postAccounting
  │     └── 6. updateStatus
  └── If ANY step throws → DB rolls back everything
```

### 9.3 Edge Cases (Required)

Each process must declare at least 3 edge cases. The process validator enforces this.

### 9.4 MVP Processes

| Process | Steps | Preconditions | Behavioral Tests | Edge Cases |
|---------|-------|---------------|------------------|------------|
| completeOrder | 6 | 5 | 4 | 3+ required |
| voidOrder | 3 | 3 | 2 | 3+ required |
| openPeriod | 3 | 3 | 2 | 3+ required |

### 9.5 Document Flows

Inherited from Etendo's existing configuration. The Flow Decisor enables or disables existing flows. No custom flows in MVP.

---

## 10. Access Decisions

Window-level permissions via Etendo's existing AD_Window_Access / AD_Process_Access. The Permission Matrix writes records to those tables. Etendo's security engine enforces them. No permission code is generated.

Post-MVP: field-level permissions via AD_Field_Access.

---

## 11. Testing Strategy

### 11.1 Test Pyramid

All tests auto-generated from curated artifacts.

| Level | Validates | Count (SO MVP) | Runtime |
|-------|-----------|----------------|---------|
| Unit: field-presence | Visible fields in API response | 30 | Node.js (instant) |
| Unit: field-type | Types match front/back | 30 | Node.js |
| Unit: system-field | System fields have derivation | 25 | Node.js |
| Unit: visibility | System fields hidden from frontend | 25 | Node.js |
| Unit: form-completeness | Required editable in create form | ~15 | Node.js |
| Unit: rule-declared | Kept rule exists in schema | ~8 | Node.js |
| Unit: searchable-filters | Endpoint supports exactly searchable fields | ~5 | Node.js |
| Integration: required-validation | POST without required → 400 | 25 | JUnit (Etendo) |
| Integration: system-derivation | POST without system → 201 | 19 | JUnit (Etendo) |
| Integration: business-rule | CRUD rules execute | 8 | JUnit (Etendo) |
| Integration: rule-behavior | Kept/replaced rules correct | ~8 | JUnit (Etendo) |
| Contract: interface-match | Frontend ⊆ backend fields | 3 | Node.js |
| Contract: type-compatibility | Types match across contracts | 3 | Node.js |
| Behavioral: process-happy | Process produces correct state | 5 | JUnit (Etendo) |
| Behavioral: process-failure | Invalid states rejected | 3 | JUnit (Etendo) |
| Behavioral: process-rollback | Failure → DB state unchanged | 1 | JUnit (Etendo) |
| Behavioral: process-edge | Edge cases handled | ~9 | JUnit (Etendo) |
| Behavioral: rule-parity | Replaced rules match original | ~5 | JUnit (Etendo) |
| Access: window-permission | Role sees/doesn't see window | ~6 | JUnit (Etendo) |
| Access: process-permission | Role can/can't execute process | ~6 | JUnit (Etendo) |
| **Total** | | **~245** | |

### 11.2 Two Test Runtimes

**Contract tests (Node.js):** ~145 tests. Run against JSON contract file. No backend, no compilation, instant. Cover structural consistency, visibility, types, filters, interface match. Run during the fast loop and before compilation.

**Integration + behavioral tests (JUnit):** ~100 tests. Run inside Etendo test context (OBBaseTest). Require module compilation. Cover real transactions, derivations, processes, permissions. Run once in the validation loop.

### 11.3 Error Contract

Exceptions from Etendo processes are serialized to a standard format in Etendo RX endpoints:

```json
{
  "error": {
    "code": "PROCESS_PRECONDITION_FAILED",
    "message": "Cannot complete an order without lines",
    "field": null,
    "severity": "error",
    "process": "completeOrder",
    "preconditionId": "pre.hasLines"
  }
}
```

---

## 12. Versioning & Deploy

### 12.1 Breaking Change Detection

| Change Type | Breaking? | Deploy Strategy |
|-------------|-----------|-----------------|
| Add optional field | No | Rolling |
| Add required field | Yes | Blue-green |
| Remove visible field | Yes | Blue-green |
| Change field type | Yes | Blue-green |
| Add rule (Keep) | No | Rolling |
| Remove rule (Omit) | Yes | Blue-green |
| Add searchable field | No | Rolling |
| Remove searchable field | Yes | Blue-green |
| Add role permission | No | Rolling |
| Remove role permission | Yes | Blue-green |

### 12.2 Multi-Version Backend

Etendo RX endpoints support versioned paths (`/v1/orders`, `/v2/orders`). Old endpoints maintained during grace period. Frontend targets a single version.

### 12.3 Code Provenance

Every generated file includes provenance header linking to schema, rules, decisions, and processes versions with checksums.

---

## 13. Lifecycle: Day 2

### 13.1 When Etendo Updates

```
1. Re-run extractors → new raw artifacts
2. Diff against previous raw
3. IA pre-processes deltas
4. Human sees ONLY new/changed items
5. Previous decisions preserved as baseline
6. Regenerate module with merged decisions
7. Attempt compilation → if fails, report Java API incompatibility
8. Contract tests (instant, no compile needed)
9. If compiled: integration tests
10. Version checker → breaking/non-breaking report
```

**Step 7 is critical.** If Etendo changed a method signature that the generated module calls, the compilation fails before the human sees a green result. The delta report includes: "Etendo changed API X used by process Y — requires review."

### 13.2 When the Client Requests Changes

Same pipeline, different trigger. Change visibility → regenerate. Change rule decision → regenerate. Mark field searchable → regenerate endpoint with new filter. Each change produces a versioned diff.

### 13.3 Conflict Resolution

| Scenario | Response |
|----------|----------|
| New field from Etendo | IA pre-classifies, human confirms |
| Removed field | Warning, decision marked removed-in-source |
| Changed field type | Warning, human re-decides |
| Modified callout (Keep) | Behavioral test may fail, human re-validates |
| New callout | IA pre-classifies, human decides |
| Changed Java API signature | Compilation fails, reported as API incompatibility |

---

## 14. MVP Scope

> **MVP Target:** Generate a functional web application for Sales Order as an Etendo module, end-to-end, with all decision layers covered. Two loops: fast (UI, seconds) and validation (backend, minutes).

### 14.1 In Scope

| Component | Deliverable |
|-----------|------------|
| Field Extractor | SQL for Sales Order. Auto pre-classification. |
| Rule Extractor | Full catalog with DML detection in callouts. |
| IA Pre-classifier | Auto-classifies ~60%. Surfaces ~40% with recommendations in business language. |
| Schema Validator | CLI: structural + semantic + visibility + cross-reference. |
| Decision Editor | Web UI. Four buttons. Impact warnings. Searchable field marking. |
| Rule Catalog | Web UI. IA recommendations in business language. Impact cross-reference. |
| UI Generator | Conversational IA. Schema as guardrails. Live preview against mocks. Code export. |
| Process Definitions | 3 processes with preconditions, steps, behavioral contracts, edge cases. |
| Process Validator | CLI: structure, coverage, edge cases. |
| Permission Matrix | Writes to AD_Window_Access / AD_Process_Access. |
| Document Flows | Enable/disable existing Etendo flows. |
| Contract Generator | ~245 auto-generated tests (Node.js + JUnit). Error contract. |
| Version Checker | Breaking change detection. Deploy plan. |
| Generated Module | Standard Etendo module: event handlers, Etendo RX endpoints, React frontend, reference data, JUnit tests. |
| Lifecycle | Diff-based updates. Compilation gate in Day-2. Previous decisions preserved. |

### 14.2 Out of Scope (Post-MVP)

- Generic extractor for arbitrary windows
- Field-level permissions per role
- Process Designer interactive UI (MVP: JSON)
- Rule Catalog conversational IA (MVP: button-based with IA recommendations)
- Custom document flows
- Multi-language UI generation
- Data migration tooling
- Report / dashboard / print document generation
- Notification / event rules
- Arbitrary query filters (only searchable fields supported)

---

## 15. Success Criteria

| Metric | Target | Loop |
|--------|--------|------|
| Field extraction + decision | < 30 min | Setup |
| Rule extraction + decision | < 30 min | Setup |
| UI design iterations | < 10 turns, each < 15 sec | Fast loop |
| UI total design time | < 60 min | Fast loop |
| Process definitions | 3 processes in < 2 hours | Setup |
| Permission setup | < 10 min | Setup |
| Contract tests | < 5 sec, 0 failures | Fast loop |
| Module compilation | < 5 min | Validation loop |
| Integration tests | < 60 sec, 0 failures | Validation loop |
| Auto-classification accuracy | > 90% correct | Setup |
| Test coverage (fields) | 100% | Both |
| Test coverage (rules) | Every kept rule has behavioral test | Validation loop |
| Test coverage (processes) | Every side effect + 3 edge cases | Validation loop |
| Rollback integrity | Failed process → DB unchanged | Validation loop |
| Code traceability | Any file traceable to decisions | Both |
| Day-2 delta review | < 30 min (including compilation gate) | Validation loop |
| **Total roundtrip** | **< 3 hours (setup + fast + validation)** | **All** |

---

## 16. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Rule extractor misses Java logic details | High | Confidence scores + DML detection + human review |
| IA auto-classification wrong | Medium | 90%+ target. Human sees summary, can override. Behavioral tests as safety net. |
| Cross-reference misses orphaned fields | Critical | Validator checks every system field. Zero tolerance. |
| Complex callout can't be simplified | Medium | Replace generates new implementation. Parity test optional. |
| Edge cases not declared | Medium | Validator enforces ≥ 3 per process. Warning if fewer. |
| Day-2 diffs overwhelming | Medium | IA pre-processes, presents only meaningful changes. |
| Etendo API change breaks generated module | High | Compilation gate in Day-2 pipeline catches before presenting to human. |
| Build time impacts iteration speed | Low | UI iterates against mocks (fast loop). Compilation only in validation loop. |
| Searchable field queries inefficient | Medium | Joins known at generation time from schema references. No arbitrary queries. |
| Scope creep into full ERP generation | High | Clear boundary: generate app layer. Not: generate accounting engine. |

---

## 17. Positioning

| | Traditional Dev | Low-Code | Schema Forge |
|-|----------------|----------|-------------|
| Human does | Writes code | Drags blocks | Takes decisions |
| Output | Source code | Platform config | Source code (Etendo module) |
| Lock-in | Framework | Platform runtime | None — standard Etendo module |
| Runs on | Whatever you build | Vendor platform | Etendo platform |
| Business logic | In code (implicit) | In config (limited) | In decisions (explicit) |
| Day-2 | Rewrite | Reconfigure | Re-decide deltas, regenerate |

---

## 18. Glossary

| Term | Definition |
|------|------------|
| Schema curado | JSON with fields classified by visibility, derivations, and system categories |
| Rules curadas | Business rule catalog with human decisions (Keep/Replace/Simplify/Omit) |
| Generated module | Standard Etendo module with event handlers, processes, endpoints, React frontend |
| Fast loop | UI design cycle: human ↔ IA, seconds per turn, mock data, no compilation |
| Validation loop | Backend verification: compile module, run JUnit, verify contracts |
| Searchable field | A field marked in Decision Editor that becomes available as API filter |
| Behavioral contract | State assertions after process execution |
| OBDal transaction | Single DB transaction — all steps succeed or all roll back |
| Compilation gate | Day-2 pipeline step that compiles before presenting results to human |
| Code provenance | Traceability from generated file to schema + rules + decisions versions |

---

*End of document*
