# Methodology Shift — Onboarding Deck

---

## SLIDE 1: Title

# From Manual Code to Generated Modules
### New Development Methodology for Etendo

---

## SLIDE 2: The Big Picture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  DEVELOPMENT    │    │  DEPLOYMENT     │    │ INFRASTRUCTURE  │
│                 │    │                 │    │                 │
│  Extract &      │───▶│  Versioned      │───▶│  99.5% Uptime   │
│  Generate       │    │  Modules        │    │  Guaranteed     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**One sentence:** We extract logic from Etendo, humans make decisions, AI generates production code, and the platform runs with uptime guarantees.

---

## SLIDE 3: Development — Before vs After

| | Before | After |
|--|--------|-------|
| **Role** | Write all the code | Make decisions, review generated code |
| **Per window** | 2-4 weeks | 1-3 days |
| **Tests** | Manual | ~245 auto-generated per window |
| **Knowledge** | Deep Etendo internals | Business domain + decision-making |

---

## SLIDE 4: Development — How It Works

```
  Etendo AD Metadata
         │
    ┌────┴────┐
    ▼         ▼
 Extract   Extract        ← AUTOMATIC
 Fields    Rules
    │         │
    ▼         ▼
 Human     Human           ← YOU DECIDE
 Curates   Curates
    │         │
    └────┬────┘
         ▼
   AI Generates             ← AUTOMATIC
   (Java + React + Tests)
         │
         ▼
   Etendo Module
```

**You decide.** AI builds. Pipeline validates.

---

## SLIDE 5: Development — Your New Workflow

1. **Extract** — CLI pulls metadata and rules from Etendo AD (automatic)
2. **Decide** — You classify fields and rules using web tools
3. **Generate** — AI produces the full module (backend + frontend + tests)
4. **Review** — Pipeline: DEV → REVIEW → QA → DOCS

The output is a **standard Etendo module**. Same Java, same OBDal, same Gradle. Just generated instead of handwritten.

---

## SLIDE 6: Deployment — Versioned Modules

### Three Independent Versions

| Version | Increments when... | Who cares |
|---------|-------------------|-----------|
| `moduleVersion` | Any regeneration | Deploy pipeline |
| `apiVersion` | DTO shape changes | Frontend consumers |
| `behavioralVersion` | Rules/processes change | Test suites |

Regenerate the UI without breaking API consumers.
Add a rule without forcing a frontend update.

---

## SLIDE 7: Deployment — Two Validation Loops

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Generate   │────▶│   Contract   │────▶│  Integration │
│   Module     │     │   Tests      │     │  Tests       │
│              │     │  ~145 tests  │     │  ~100 tests  │
│              │     │  (seconds)   │     │  (minutes)   │
└──────────────┘     └──────────────┘     └──────────────┘
```

| Loop | Speed | Needs Backend? |
|------|-------|---------------|
| **Fast** (contract) | Seconds | No — runs against JSON |
| **Full** (integration) | Minutes | Yes — real DB, OBBaseTest |

**80% of issues caught in seconds**, before touching the backend.

---

## SLIDE 8: Deployment — What Ships

```
com.etendo.schemaforge.{window}/
├── event/          # Event handlers
├── process/        # Processes
├── dto/v{n}/       # Versioned DTOs
├── api/v{n}/       # Versioned REST endpoints
├── mapper/v{n}/    # OBDal ↔ DTO
└── web/{window}/   # React SPA
```

Standard Etendo module. Installs with Gradle. Nothing exotic.

---

## SLIDE 9: Infrastructure — 99.5% Uptime SLA

| Metric | Target |
|--------|--------|
| **Uptime** | 99.5% (~3.65h max downtime/month) |
| **Incident response** | < 15 min acknowledgment |
| **Recovery time** | < 1h critical incidents |
| **Planned maintenance** | Excluded from SLA |

---

## SLIDE 10: Infrastructure — How We Get There

### Observability
- Health monitoring (response times, error rates)
- Structured logging + log aggregation
- Alerting with escalation chains

### Auto-Recovery
- Container orchestration with health checks
- Automatic restart on failure
- Graceful degradation under load

### Deployment Safety
- Blue-green deploys (zero downtime)
- Automatic rollback on failed health checks
- DB migrations versioned and reversible

### Disaster Recovery
- Automated backups (daily + incremental)
- Point-in-time recovery
- Documented runbooks + regular DR drills

---

## SLIDE 11: The Mental Model Shift

```
BEFORE:  "I build everything from the AD definition"
 AFTER:  "I make decisions, AI builds, I review"
```

```
BEFORE:  "I write tests for my code"
 AFTER:  "Tests are generated from the contract"
```

```
BEFORE:  "I deploy and hope"
 AFTER:  "Versioned, tested, monitored, auto-recoverable"
```

---

## SLIDE 12: Onboarding Path

| Week | Focus |
|------|-------|
| **1** | Walk through one complete window: extraction → generation |
| **2** | Practice with Decision Editor, Rule Catalog, Permission Matrix |
| **3** | Participate in code review of generated modules |
| **4** | Extract and generate a window independently |

---

## SLIDE 13: FAQ

**Do I still need to know Java?**
Yes. You review generated code and handle edge cases.

**What if the generated code is wrong?**
The pipeline catches it: DEV → REVIEW → QA. Contract tests catch structural issues instantly.

**What about existing windows in production?**
Extract and regenerate incrementally. No big-bang migration.
