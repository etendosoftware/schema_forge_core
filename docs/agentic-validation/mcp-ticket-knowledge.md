# MCP Ticket Knowledge Base — Internal (Tracer)

**Audience:** the `mcp-ticket-resolver` (Tracer) agent itself — institutional memory to resolve MCP tickets faster.
**Inward-facing.** The outward report for the bot team is `ticket-feedback.md` — keep the two distinct.

> Read this FIRST on every ticket (orientation step 2). Append a dated bullet whenever you learn something durable. Never delete a correction; supersede it with a newer dated note.

---

## Recurring root-cause categories

How a reported symptom usually maps to a real cause. The point: **not every "failure" is an MCP code bug.**

| Symptom pattern | Most likely category | Where to look first |
|---|---|---|
| Tool/entity "not found" / "access denied" | RBAC gap **or** module not installed | role's window/process access; is the module deployed? |
| Selector / defaults returns empty or wrong rows | upstream context metadata **or** `McpSelectorContextHelper` | contract `context.required`; selector context builder |
| 500 / stack trace on a tool call | MCP code bug | the router branch for that tool + its handler |
| Field unexpectedly editable/hidden/required | upstream contract (decisions/generators) | `decisions.json` → `make regen`, not the MCP |
| Action/process not discoverable or rejected | contract `apiPrediction.actions[]` **or** RBAC | generated contract; role process access |

**The canonical 6 root-cause categories** are defined in `.claude/agents/mcp-ticket-resolver.md` `<ticket_quality_rubric>`: code-bug, upstream-config, RBAC/scope, missing-module/data, **validator-side/agent-knowledge**, **test-data/environment gap**. Only the first two are code fixes in this repo pair.

- **2026-06-23 — Evidenced baseline (ETP-3938 / JuanCarlos Round 1):** of 15 reported findings, **5 were NOT code bugs** — `bp-location` access denied (RBAC), `verifactu-config` / `tbai-facturas-enviadas` entity not found (modules not installed), dashboard widgets + report specs not agent-accessible (API not exposed). → When triaging, *always* rule out RBAC / missing-module / un-exposed-API before reading MCP code.

- **2026-06-23 — Round 3 (Juan Carlos, 2026-06-19, 15 tickets, label `validacion-agentica`) categorized (analysis only — NOT resolved):**
  - **code-bug (MCP/NEO Java):** ETP-4274 (neo_create ignores non-mandatory defaults — defaults/create asymmetry, `NeoDefaultsService.injectMandatoryDefaults:824-825`), ETP-4275 (no generic process-precondition validation), ETP-4285 (document actions not semantically exposed), ETP-4286 (neo_selectors lacks recordContext passthrough), ETP-4287 (GET-only entities not flagged in discovery), ETP-4284 (widgets not wrapped as `neo_widget`; were misrouted through CRUD), ETP-4255 (Jasper runtime must be removed; report callability metadata).
  - **upstream-config (schema_forge decisions/generators):** ETP-4278 (empty `prompt` field on contacts/financial-account), ETP-4276 (assets conditional userRequired not declared), ETP-4254 (W-vs-R spec misclassification), ETP-4288 (`defaultExpression="0"` surfaced in schema).
  - **validator-side / agent-knowledge:** **ETP-4279** — the validating agent claimed FIN_Financial_Account has 2 types (read from `SeedReferenceDataStep.java`) instead of querying `neo_selectors` (3 types: B/C/CA). Pure bot defect, no product fix. Pattern: agents assuming enum/list cardinality from source/docs instead of runtime selectors.
  - **test-data / environment gap:** ETP-4289 — 6 specs (`return-from-customer`, `return-to-vendor`, `sii-config`, `sii-monitor`, `simple-g-l-journal`, `tbai-config`) unevaluable for lack of records.
  - **opaque / diagnostic gap:** ETP-4280 — Card financial-account create failed but the validator captured NO error message/HTTP status/body. The ticket is itself about the missing diagnostic. Canonical evidence for rubric #3/#4.
  - **under-specified:** ETP-4242 — "no W spec for ERP entities" with no entity/tool/repro named.

---

## MCP code map (where tools resolve)

(See the table in `.claude/agents/mcp-ticket-resolver.md` `<where_fixes_live>` for the authoritative file→responsibility map.)

- _Append durable findings about specific router branches, scope mappings, session/context behavior as you learn them._

---

## Misclassifications corrected

- _None yet._

---

## MCP code / config quirks

- _None recorded yet._

---

## User corrections

- _None yet._
