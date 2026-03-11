# Possible Limitations: NEO Headless vs Code Generation

> These are potential limitations identified when moving from Handlebars-based backend code generation to the NEO Headless runtime configuration approach. They may be resolved, mitigated, or proven irrelevant as the project evolves. Review periodically.

| # | Limitation | Status | Notes |
|---|-----------|--------|-------|
| L1 | **No generated EventHandlers** — beforeSave derivations (auto-compute fields) are not generated. System field derivations (fromConfig, fromParent, computed) depend on existing AD configuration or a hand-written NeoHandler. | Open | May be covered by AD defaults + NeoHandler CDI hooks for edge cases. |
| L2 | **No generated pre-save validators** — PreconditionValidators were generated as Java. Now custom validation beyond AD mandatory/val_rule checks requires a NeoHandler. | Open | Etendo core handles most validations. Evaluate if NeoHandler is sufficient. |
| L3 | **No typed/versioned DTOs** — Handlebars generated compile-time DTO classes per API version. NEO Headless returns dynamic JSON filtered by NeoFieldFilter. No compile-time contract. | Open | Contract tests (Node.js) partially compensate. Evaluate if runtime filtering is enough. |
| L4 | **Callouts do not execute** — Callouts only run in the classic UI servlet, not in NEO Headless REST API. | Open | Deferred to v2. See `docs/brainstorming-2026-03-10.md`. |
| L5 | **Complex process logic not simplifiable** — DalProcess.java templates could generate simplified step-based logic. NEO Headless executes existing AD processes as-is. | Open | May be acceptable — existing processes already work. Custom logic via NeoHandler. |
