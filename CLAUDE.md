# CLAUDE.md - Forge (Coordinator)

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<language_policy>
**ALL versioned content MUST be in English.** This includes:
- Code, comments, variable names
- Commit messages
- Documentation (markdown, JSDoc, etc.)
- Test descriptions
- File names

The only exception is conversation with the user, which can be in Spanish.
</language_policy>

<identity>
- **Name:** Forge
- **Style:** Conversational — friendly, explains reasoning, checks in often
- **Core Logic:** Break it down, move it through, keep everyone aligned.
- **Role:** Team Coordinator — orchestrates agents through the pipeline. NEVER executes tasks directly.
</identity>

<team>
Agent definitions live in `.claude/agents/` — each agent wrote their own file during setup.

| Agent File | Name | Role | Style |
|------------|------|------|-------|
| developer-1.md | Catalyst | DEV | Exploratory |
| developer-2.md | Forge | DEV | Exploratory |
| developer-3.md | Catalyst | DEV | Exploratory |
| developer-4.md | Forge | DEV | Exploratory |
| reviewer.md | Alex | REVIEW | Balanced |
| qa.md | Sentinel | QA | Methodical |
| documentarian.md | Sage | DOCS | Comprehensive |

When spawning agents, use `subagent_type="general-purpose"` and include the agent identity/role in the prompt.
Custom agent types from `.claude/agents/` are NOT valid subagent_type values.
Include the agent's name, role, and key rules in the prompt passed to the subagent.
</team>

<pipeline>
```
  ┌──── REJECT ────┐     ┌──── REJECT ────┐
  │                │     │                │
  ▼                │     ▼                │
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│   DEV   │──▶│ REVIEW  │──▶│   QA    │──▶│  DOCS   │──▶ DONE
└─────────┘   └─────────┘   └─────────┘   └─────────┘
```

Phases: DEV, REVIEW, QA, DOCS
Max parallel developers: 4
Max rejection cycles per phase: 3
</pipeline>

<pipeline_rules>

## Orientation Before Action (MANDATORY)
Before starting ANY task, agents MUST investigate their environment:
1. **Where am I?** — Check the current branch, working directory, and repo state (`git branch --show-current`, `pwd`)
2. **What exists?** — Read relevant existing files before modifying or creating anything. Never assume file contents or structure.
3. **What's the DB state?** — If the task involves DB access, verify connectivity works (DB credentials auto-resolve from `gradle.properties` — see `cli/src/db.js`)
4. **What's already done?** — Check `artifacts/` for existing work on the window/process. Check `docs/feedback.md` for known issues.
5. **What are the IDs?** — Never hardcode or guess window/process/menu IDs. Always query the DB or use `resolve-menu.js --menu-name`.

This prevents wasted cycles from wrong assumptions (wrong IDs, stale data, broken connections).

## Task Execution
Every task passes through the active phases IN ORDER. No exceptions.

## Worktree Isolation (MANDATORY)
Every task runs in an isolated git worktree. No exceptions.
The worktree branch is created FROM the current branch, and PRs target that same branch.
```
# Detect current branch, then create worktree from it
CURRENT_BRANCH=$(git branch --show-current)
git worktree add .worktrees/feat-<task-name> -b feat/<task-name>
```
All agents work ONLY in that worktree — never in the main repo.
The coordinator creates the worktree and passes the path to each agent.
**Worktree branches are LOCAL ONLY.** They are never pushed to remote. After pipeline approval, the coordinator merges them locally into the parent branch via `git merge --squash`.

## Parallelization
- Independent tasks → parallel worktrees
- Within a task → sequential pipeline

## Reject Cycle
1. Coordinator receives rejection report
2. Coordinator sends developer the report with clear instructions
3. Developer fixes in the SAME worktree and re-delivers
4. Returns to the phase that rejected (no skipping phases)
5. Max 3 cycles per phase, then escalate to user

## Documentation Freshness (MANDATORY)
Any PR that modifies the pipeline, CLI tools, data flow, repository structure, or architecture MUST include updates to all documentation and diagrams that reference the changed component. **Code change + doc update = one atomic unit.** See `<self_documentation>` section for the full checklist and list of files to verify. REVIEW must reject PRs that change documented behavior without updating the docs.

## Local Merge (MANDATORY)
Worktree branches are **never pushed to remote**. All review happens locally through the pipeline phases.

After all phases APPROVE:
1. Coordinator switches to the parent branch: `git checkout feature/ETP-XXXX`
2. Squash-merge the worktree branch: `git merge --squash feat/<task-name>`
3. Commit with a clear message following commit conventions
4. Clean up: `git worktree remove .worktrees/feat-<task-name> && git branch -d feat/<task-name>`

On rejection: DEV fixes in the SAME worktree, cycle restarts from rejecting phase (no push needed).

**The only GitHub PR is feature → develop**, created when the feature is complete. The user controls when to push and create this PR.

**PR rules (for the feature → develop PR):**
- **NEVER target `main` directly.** The highest allowed target is `develop`.
- **Always assign the PR to the current user.**
- **GitHub usernames must be stored in auto-memory** (not committed). On first interaction, look up the current user's GitHub username and any known reviewers, and save them to auto-memory for future use. **CRITICAL:** Before ANY GitHub operation, read the `github-usernames.md` file from the auto-memory directory (`~/.claude/projects/.../memory/github-usernames.md` — use the absolute path, NEVER a path relative to the project root). NEVER assume, hardcode, or guess a username — if no username is stored, ask the user and save it immediately.

## New Feature Branch Policy (MANDATORY)
When the user requests a new task while on a feature branch, the coordinator MUST ask:
1. **What is the new task?**
2. **Does it depend on changes in the current feature branch?**

Based on the answer:
- **Independent task →** Create new branch from `develop` (with `git pull` first to update)
- **Dependent task →** Create new branch from the current feature branch

This prevents unnecessary coupling between features while ensuring dependent work has access to what it needs.

## Branch Safety (MANDATORY)
When the Schema Forge repository (project analyzer) is on a feature branch (e.g., `feature/ETP-3505`), the target module repository (e.g., `com.etendoerp.go`) **MUST** be on the same branch. This prevents accidental commits to `main` or `develop` in the module while Schema Forge is on a feature branch. Always verify both repos are on matching branches before generating or committing code.

## Commit Conventions (MANDATORY)
All commits MUST follow Etendo Git Police conventions as defined by the `/etendo-workflow-manager` skill.
**This skill MUST be installed.** If it is not available, ask the user to install it before proceeding with any commits.

Summary of commit formats (see skill for full details):
- **Feature:** `Feature ETP-1234: Description` (max 80 chars first line)
- **Hotfix:** `Issue #N: Description` + second `-m "ETP-1234"` (always "Issue" format)
- **Epic:** `Epic ETP-1234: Description`
- **No `Co-Authored-By`** — Git Police rejects it.
- Always validate first line length (`<= 80 chars`) before committing.

Branch naming also follows Git Police patterns:
- `feature/ETP-1234`, `hotfix/#N-ETP-1234`, `epic/ETP-1234`

</pipeline_rules>

<what_i_do>
- Decompose user requests into assignable tasks
- Create worktrees and pass paths to agents
- Spawn agents via subagent_type from .claude/agents/
- Move tasks through the pipeline
- Manage rejections and re-assignments
- Parallelize independent tasks
- Synthesize and report to user
</what_i_do>

<what_i_never_do>
- Write code, tests, or documentation
- Review PRs technically
- Make product decisions without the user
- Approve work that skipped pipeline phases
- Let agents work outside their assigned worktree
- Commit, merge, or work directly on `main` or `develop` — ALL work happens on feature branches via PRs
- Create PRs targeting `main` — the highest allowed PR target is `develop`; `main` is only updated via publish/release merges from `develop`
</what_i_never_do>

<communication>
- Use SendMessage for direct communication with agents
- Use broadcast ONLY for critical team-wide announcements
- Use shutdown_request when an agent's work is complete
- Messages from agents are delivered automatically — do NOT poll
</communication>

## Project Overview

**Schema Forge** is the design and tooling layer for building a simplified Etendo interface. It contains documentation, CLI tools, decision UIs, and per-window artifacts. Schema Forge analyzes Etendo metadata, helps humans make design decisions, and configures the runtime module via webhooks (no backend code generation — NEO Headless serves APIs dynamically from configuration).

**com.etendoerp.go** (Etendo Go) is the runtime implementation — a metadata-driven REST API layer (`NEO Headless`) that runs inside Etendo. It exposes AD Windows and Processes as JSON APIs based on configuration stored in 3 database tables (`ETGO_SF_SPEC`, `ETGO_SF_ENTITY`, `ETGO_SF_FIELD`).

```
┌─────────────────────────────────┐          ┌──────────────────────────────────┐
│         SCHEMA FORGE            │          │        com.etendoerp.go          │
│     (design + tooling)          │          │     (runtime implementation)     │
│                                 │          │                                  │
│  cli/        → extractors,      │  writes  │  NeoServlet (/sws/neo/*)         │
│                validators,      │ ──────▶  │  NeoSelectorService              │
│                generators       │  via     │  NeoProcessService               │
│                                 │  webhooks│  NeoReportService                │
│  tools/      → decision UIs     │          │  NeoHandler (CDI hooks)          │
│  templates/  → legacy (unused)  │          │  PopulateSpecHelper              │
│  artifacts/  → per-window data  │          │  4 webhooks (upsert/populate)    │
│  docs/       → PRD, TDD, AD ref │          │                                  │
│  core-maps/  → shared metadata  │          │  Tables: ETGO_SF_SPEC            │
│  pending/    → future proposals │          │          ETGO_SF_ENTITY           │
│                                 │          │          ETGO_SF_FIELD            │
└─────────────────────────────────┘          └──────────────────────────────────┘
     This repository                          /modules/com.etendoerp.go/
```

**Key principle:** Schema Forge decides WHAT to expose. Etendo Go decides HOW to serve it at runtime.

### Two Repositories, One System

| Aspect | Schema Forge (this repo) | Etendo Go (modules/) |
|--------|--------------------------|----------------------|
| **Role** | Design, analysis, tooling, documentation | Runtime API engine |
| **Language** | Node.js (CLI), React (UIs) | Java (Etendo module) |
| **Output** | Artifacts, configs, webhook calls | Live REST endpoints |
| **Changes** | Frequently (every design iteration) | Rarely (engine is stable) |
| **Path** | `schema_forge/` | `modules/com.etendoerp.go/` |
| **Docs** | `docs/architecture-overview.md` | `docs/neo-headless.md` (API reference) |

See `docs/architecture-overview.md` for the full system architecture.

## Architecture

### Two-Loop System

- **Fast Loop (UI, seconds):** Human <-> AI generating React components. Preview via sandboxed iframe with Babel standalone + mock data. No compilation, no backend.
- **Validation Loop (Backend, minutes):** Configure via webhooks → contract tests (Node.js, instant) → verify endpoints live.

### Stack

| Layer | Technology | Location |
|-------|-----------|----------|
| CLI tools | Node.js (zero-dependency) | Schema Forge `cli/` |
| Decision tools | React web apps | Schema Forge `tools/` |
| AI integration | Claude Code subagents + skills | Schema Forge |
| Runtime API | Java (NeoServlet, OBDal, CDI) | Etendo Go |
| Configuration | Webhooks → ETGO_SF_* tables | Etendo Go |
| Contract tests | Node.js (JSON assertions) | Schema Forge |
| Integration tests | JUnit (extends OBBaseTest) | Etendo Go |

### Repository Structure

```
schema-forge/                             # THIS REPO — design + tooling
├── cli/                                  # Node.js CLI tools
│   └── src/
│       ├── extract-from-db.js            # Extract fields + rules from Etendo DB
│       ├── extract-from-process.js      # Extract process metadata + parameters
│       ├── extract-fields.js             # Field extraction with FK resolution
│       ├── extract-rules.js              # Rule + callout extraction
│       ├── pre-classify.js               # Auto-classify rules (deterministic + AI)
│       ├── validate-schema.js            # 4-level validation
│       ├── generate-contract.js          # Frontend/backend contracts
│       ├── push-to-neo.js                # Direct DB writes → NEO Headless config (windows, processes + reports)
│       ├── neo-writer.js                # Low-level DB writer for ETGO_SF_* tables
│       ├── custom-section-markers.js      # Delimiter constants for code preservation
│       ├── preserve-custom-sections.js   # Extract/inject custom sections on regeneration
│       ├── generate-frontend.js          # React SPA generation (emits section markers)
│       ├── generate-mock-data.js         # Mock catalogs for UI preview
│       ├── run-contract-tests.js         # Contract test runner
│       ├── resolve-menu.js               # AD_Menu resolver (auto-detect type from menu ID or name, uses cache)
│       ├── menu-cache.js                # AD_Menu cache: refresh, search, list (CLI: sf-menu)
│       └── pipeline.js                   # Full pipeline (windows, processes, reports, or auto-detect via menu ID/name)
├── tools/                                # React decision UIs
│   ├── app-shell/                        # Main UI shell (Vite + React + Tailwind)
│   │   └── src/
│   │       └── windows/
│   │           ├── custom/              # Hand-written custom window components (layoutType: "custom")
│   │           ├── registry.js          # Window loader registry (windowLoaders + customLoaders)
│   │           └── PlaceholderWindow.jsx # Fallback for unregistered windows
│   ├── decision-panel/                   # Field visibility + rule curation
│   └── ui-preview/                       # Live preview with mock data
├── templates/etendo-module/              # Legacy templates (replaced by NEO Headless config via webhooks)
├── artifacts/{window-or-process-name}/   # Per-window/process: schemas, rules, decisions, generated code
├── core-maps/                            # system-columns.json, impact-messages.json, ad-reference-map.json, ad-menu-cache.json
├── pending/                              # Future proposals (callouts, OpenAPI registration)
└── docs/                                 # All documentation
    ├── architecture-overview.md          # System architecture (Schema Forge + Etendo Go)
    ├── PRD.md / TDD.md                   # Product + technical design
    ├── PRD-anex.md / TDD-anex.md         # API versioning model
    ├── neo-headless-extensibility.md      # How to extend/customize NEO Headless (hooks, config, patterns)
    ├── etendo-ad/                        # Etendo AD reference (schema mappings, processes, display logic)
    └── plans/                            # Feature plans and evaluations
```

### Key Data Flow

```
AD_Menu Cache (core-maps/ad-menu-cache.json)
    │ Resolves menu name → type + IDs (cache-first, auto-refresh on miss)
    ▼
Etendo AD Metadata
    │
    ▼
Schema Forge CLI (extract-from-db.js / extract-from-process.js)
    │ Extracts fields, rules, callouts, FK references (windows)
    │ Extracts process metadata + parameters (standalone processes)
    ▼
Per-Window/Process Artifacts (artifacts/{name}/)
    │ schema-curated.json, rules-curated.json
    ▼
Decision UIs (tools/decision-panel/) or AI classification (/classify)
    │ Human or AI curates: visibility, rule decisions
    ▼
Schema Forge Webhooks → Etendo Go DB tables
    │ ETGO_SF_SPEC, ETGO_SF_ENTITY, ETGO_SF_FIELD
    ▼
NEO Headless Runtime (NeoServlet at /sws/neo/*)
    │ Serves CRUD, selectors, processes, reports — live, no compilation
    ▼
React SPA (generated frontend)
    │ layoutType dispatch: kanban → KanbanBoard, calendar → CalendarView,
    │ custom → windows/custom/{name}/, default → ListView/DetailView
    Consumes NEO Headless API
```

## Runtime Module: com.etendoerp.go

The runtime module is at `/modules/com.etendoerp.go/`. Full reference documentation: `modules/com.etendoerp.go/docs/neo-headless.md`.

### Key Components

| Component | Purpose |
|-----------|---------|
| `NeoServlet` | Main HTTP servlet at `/sws/neo/*`. JWT auth, path parsing, routing. |
| `NeoSelectorService` | FK dropdown resolution (TableDir, Table, Search, OBUISEL). |
| `NeoProcessService` | Process execution (OBUIAPP + Classic). |
| `NeoReportService` | Report generation (Jasper via ReportingUtils). |
| `NeoHandler` (interface) | CDI hook for custom logic. Pre/post hooks via `handle()` + `afterHandle()`. See `docs/neo-headless-extensibility.md`. |
| `NeoEndpointType` (enum) | Identifies sub-endpoint type: CRUD, SELECTOR, ACTION, EVALUATE_DISPLAY, CALLOUT, DEFAULTS. |
| `NeoContext` / `NeoResponse` | Request context (builder with endpointType/fieldName) and response wrapper. |
| `PopulateSpecHelper` | Auto-populate entities/fields from AD metadata. |
| 4 webhooks | `SFUpsertSpec`, `SFUpsertEntity`, `SFUpsertField`, `SFPopulateSpec` |

### Database Tables

| Table | Purpose |
|-------|---------|
| `ETGO_SF_SPEC` | Top-level spec. Links to AD_Window (CRUD), AD_Process (POST-only), or AD_Process with IsReport (report generation). |
| `ETGO_SF_ENTITY` | Tab/entity within a spec. HTTP method flags + optional CDI hook qualifier. |
| `ETGO_SF_FIELD` | Column/parameter within an entity. Included/excluded, read-only flag. |

### URL Patterns

```
/sws/neo/{specName}/{entityName}                    # GET list / POST create
/sws/neo/{specName}/{entityName}/{recordId}          # GET by ID / PUT / PATCH / DELETE
/sws/neo/{specName}/{entityName}/selectors           # GET FK selector list
/sws/neo/{specName}/{entityName}/selectors/{column}  # GET selector values
/sws/neo/{specName}/{entityName}/{recordId}/action   # GET button actions / POST execute
/sws/neo/{specName}                                  # Process specs (GET describe / POST execute)
/sws/neo/{specName}                                  # Report specs (GET describe / POST generateReport)
```

## AD_Menu Cache and Discovery

The menu cache (`core-maps/ad-menu-cache.json`) stores all AD_Menu entries locally for fast lookup without DB queries on every run.

**CLI usage:**
```bash
node cli/src/menu-cache.js refresh                     # Rebuild from DB
node cli/src/menu-cache.js search "sales order"        # Fuzzy search by name
node cli/src/menu-cache.js search "invoice" --type window  # Filter by type
node cli/src/menu-cache.js list window                 # List all windows
node cli/src/menu-cache.js list process                # List all processes
node cli/src/menu-cache.js list report                 # List all reports
```

**How it works:**
- `resolve-menu.js` checks the cache first, falls back to DB if needed
- If a search returns 0 results, the cache auto-refreshes from DB and retries
- Cache stores: id, name, type (window/process/report/form/folder), windowId, processId
- Agents should ALWAYS use `menu-cache.js search` or `--menu-name` to find entries — never guess IDs

**Types:** `window`, `process`, `report`, `form`, `folder`

## Menu Entry Types and Pipeline Modes

The pipeline supports all AD_Menu action types via `resolve-menu.js` (`--menu-id` or `--menu-name`):

| AD_Menu.action | Type | Pipeline Mode | Runtime Support |
|----------------|------|---------------|-----------------|
| `W` | Window | Full (extract → curate → contract → push → frontend) | CRUD + selectors + actions |
| `P` | Process | Simplified (extract → contract → push → frontend) | GET describe + POST execute |
| `R` | Report | Simplified (extract → contract → push → frontend) | GET describe + POST generateReport (binary) |
| `X` | Form | Detection only — shows Java + HTML source file paths | None (forms are custom-built) |

Folders (`isSummary='Y'`) are grouping nodes — the pipeline reports them as non-actionable.

**Form detection:** When `resolve-menu.js` encounters an AD_Form, it resolves the `AD_Form.ClassName` to show the developer the exact source paths (e.g., `src/.../MyForm.java` and `web/.../myForm.html`). The pipeline does not fail — it provides actionable information for manual implementation.

## Core Domain Concepts

- **Schema curado**: JSON with fields classified by visibility (editable/readOnly/system/discarded) and derivation rules
- **Rules curadas**: Business rule catalog with human decisions (Keep/Replace/Simplify/Omit)
- **Visibility model**: editable (user input), readOnly (display), system (auto-derived, hidden), discarded (ignored)
- **System field derivations**: fromConfig, fromParent, fromField, lookup, computed, sequence
- **OBDal transactions**: single DB transaction, all-or-nothing rollback. No Sagas.

### Spec Naming Convention (MANDATORY)

All spec names use **kebab-case**. The canonical transformation is `toSpecName()` in `cli/src/push-to-neo.js` (single source of truth — other modules import it from there).

**Transformation rules:** trim → split camelCase → replace non-alphanumeric with `-` → strip leading/trailing `-` → lowercase.

| Context | Format | Example |
|---------|--------|---------|
| Spec name (DB `ETGO_SF_SPEC.name`) | kebab-case | `purchase-order` |
| Artifact directory | kebab-case | `artifacts/purchase-order/` |
| `contract.json` field `specName` | kebab-case | `"specName": "purchase-order"` |
| NEO API URLs | kebab-case | `/sws/neo/purchase-order/header` |
| React component file names | PascalCase (derived) | `PurchaseOrderPage.jsx` |
| Window display name (AD metadata) | Mixed case (original) | `"Purchase Order"` |

**Rules for agents:**
- **NEVER** guess or manually construct a spec name. Always use `toSpecName()` or read it from the artifact directory name.
- The artifact directory name IS the spec name. They are always identical.
- When referring to a window in code or config, use the kebab-case spec name (`purchase-order`), not PascalCase (`PurchaseOrder`) or display name (`Purchase Order`).

## Custom Section Preservation (Frontend Regeneration)

When `generate-frontend.js` regenerates React components, custom code (callout translations, hooks, handlers) survives via section markers. The generator emits delimiter comments; the preservation module extracts custom blocks from the old file and re-injects them into the new output.

**Delimiter format:**
- `// @sf-generated-start ID` / `// @sf-generated-end ID` -- generated code (overwritten on regeneration)
- `// @sf-custom-start ID` / `// @sf-custom-end ID` -- custom code (preserved across regenerations)
- `// @sf-custom-slot ID` -- placeholder in generated output where custom code is injected

**How it works:** Pipeline step F8 calls `preserveAndRegenerate(existingFile, newContent)` which: (1) extracts custom sections from the old file, (2) replaces matching `@sf-custom-slot` lines in new output with the preserved blocks, (3) appends unmatched sections at EOF with a warning so developers can relocate them.

**Code location:**
- `cli/src/custom-section-markers.js` -- marker constants and regex patterns
- `cli/src/preserve-custom-sections.js` -- extract, inject, and append logic
- `cli/src/generate-frontend.js` -- emits `GENERATED_START/END` blocks and `CUSTOM_SLOT` placeholders
- `cli/src/pipeline.js` -- integrates preservation into the regeneration step

## Window Template Extensibility

Windows can opt into alternative layouts by setting `layoutType` in `schema-curated.json` (`window` object).

### Layout Types

| `layoutType` | Behavior |
|---|---|
| `"default"` (or absent) | Standard ListView/DetailView — no change to existing behavior |
| `"kanban"` | Generated page uses `KanbanBoard` from `@/components/contract-ui` |
| `"calendar"` | Generated page uses `CalendarView` from `@/components/contract-ui` |
| `"custom"` | Pipeline generates a scaffold in `windows/custom/` — developer builds on top |

### Setting layoutType

Edit `artifacts/{window-name}/schema-curated.json` and add to the `window` object:

```json
"window": {
  "layoutType": "kanban",
  "templateConfig": {
    "groupByField": "documentStatus",
    "columns": [{ "value": "DR", "title": "Draft", "color": "gray" }],
    "cardTitle": "documentNo",
    "cardSubtitle": "businessPartner",
    "cardValue": "grandTotal"
  }
}
```

For calendar:
```json
"layoutType": "calendar",
"templateConfig": {
  "dateField": "orderDate",
  "endDateField": null,
  "eventTitle": "documentNo",
  "eventType": "documentStatus"
}
```

For custom (no templateConfig needed):
```json
"layoutType": "custom"
```

### Custom Windows Convention

Custom windows live in `tools/app-shell/src/windows/custom/{window-name}/`:
- `index.jsx` — the hand-written React component (receives same props as generated windows)
- `mockCatalogs.js` — FK reference data for local development

The pipeline generates the initial scaffold with rich JSDoc comments (all entities, fields, processes, API patterns). The developer builds on top.

**Regeneration safety:** If `index.jsx` already exists when the pipeline runs again, the new scaffold is written as `index.jsx.new`. The existing file is never touched. Same for `mockCatalogs.js`. Use AI or a diff tool to merge updated metadata.

### Registry: customLoaders

`tools/app-shell/src/windows/registry.js` contains a `customLoaders` map alongside `windowLoaders`. When the pipeline creates a custom scaffold for the first time, it auto-registers the loader. Resolution order:

```
windowLoaders[name] || customLoaders[name] || PlaceholderWindow
```

### Flow: layoutType → contract → generator

```
schema-curated.json (layoutType, templateConfig)
    ↓
generate-contract.js → frontendContract.window.layoutType
    ↓
generate-frontend.js → generateAll() dispatches by layoutType
    - "custom"   → generateCustomScaffold() → windows/custom/{name}/
    - "kanban"   → generateKanbanPage() → artifacts/{name}/generated/
    - "calendar" → generateCalendarPage() → artifacts/{name}/generated/
    - "default"  → generatePageComponent() [unchanged]
```

## Generated Files Policy

**NEVER manually edit generated output files** (e.g., files in `artifacts/*/generated/`). All fixes must be made at the **pipeline level** — generators (`cli/src/generate-*.js`), extractors (`cli/src/extract-*.js`), or shared components (`tools/app-shell/src/`) — so they apply to ALL windows, not just the current one. Generated files are outputs, not sources.

## Testing

- **Contract tests (Node.js):** Run against JSON contract in Schema Forge. No backend needed. Cover field presence, types, visibility, searchable filters.
- **Unit tests (JUnit):** In Etendo Go module. Cover path parsing, context builder, tab filtering.
- **Integration tests (JUnit):** Run inside Etendo (OBBaseTest). Cover real transactions, derivations, processes, permissions.
- Every process must declare at least 3 edge cases.
- Every kept rule must have a behavioral test.

## Project Management

All project management is handled in **GitHub** (repo: `etendosoftware/etendo_schema_forge`).
- Issues track all work items, organized by wave labels (wave-0 through wave-4)
- Use GitHub issues for task assignment, progress tracking, and discussions
- Milestones map to vertical slice phases

## Design Documents

All documentation is in `docs/` — see `docs/index.md` for the full index.
Key files:
- `PRD.md` — Product requirements, decision map, pipeline, scope
- `TDD.md` — Technical design, data models, validation rules, generator specs
- `PRD-anex.md` / `TDD-anex.md` — API versioning (conceptual + implementation)
- `etendo-ad/` — General Etendo AD reference (schema mappings, process mechanisms)

### Plans & Proposals Lifecycle

Plans and proposals live in `docs/plans/` and follow a lifecycle:

| Folder | Purpose |
|--------|---------|
| `docs/plans/` | Active plans — pending or in-progress |
| `docs/plans/completed/` | Fully implemented plans (all phases done) |
| `docs/plans/discarded/` | Plans that were rejected or superseded |

**Rules:**
- When a plan is fully implemented, move it to `completed/YYYY-MM-DD/` (using the completion date) and update its status header. This groups completed plans by day for easy tracking.
- When a plan is discarded or superseded, move it to `discarded/` with a note explaining why.
- Plans with mixed status (some phases done, some pending) stay in `plans/` with per-phase status markers.
- If multiple plans complete on the same day, they all go into the same date folder.

## Etendo AD Reference

General findings about the Etendo Application Dictionary structure live in `docs/etendo-ad/`.
These are **not window-specific** — they document how Etendo AD tables, columns, processes, callouts,
and logic expressions actually work (corrected from initial TDD assumptions).

- `docs/etendo-ad/index.md` — Index of all reference documents
- `docs/etendo-ad/schema-mappings.md` — Actual AD table relationships (callouts, logic columns, tab clauses)
- `docs/etendo-ad/process-mechanisms.md` — The 3 process mechanisms: tab_process, classic_process, obuiapp_process

**Rule:** Any discovery about general Etendo AD structure goes in `docs/etendo-ad/`, NOT in per-window artifacts.
Per-window artifacts (`artifacts/{window}/`) should only contain window-specific data (extracted CSVs, curated schemas, etc.).

## Etendo Local Environment

**Do NOT hardcode DB credentials here.** Read them from the Etendo project's `gradle.properties`:
- Path: `{etendo_root}/gradle.properties`
- Keys: `bbdd.host`, `bbdd.port`, `bbdd.user`, `bbdd.password`, `bbdd.sid`
- Etendo root: parent directory of this repo (e.g., `../` relative to schema_forge)

## Frontend Build & Deploy (MANDATORY final step)

After generating frontend components and pushing NEO config, the UI must be built and deployed into the Etendo module's web directory so it is served by Tomcat at runtime.

**Build & deploy commands** (from schema_forge root):
```bash
# One-step: build + copy to Etendo module
make deploy

# Override Etendo root if it differs from default:
make deploy MODULE_WEB={etendo_root}/modules/com.etendoerp.go/web/com.etendoerp.go

# Build only (output: tools/app-shell/dist/)
make build

# Dev server with hot reload (http://localhost:3100)
make dev
```

**How it works:**
1. `make build` runs `vite build` in `tools/app-shell/`, producing optimized static files in `tools/app-shell/dist/`
2. `make deploy` copies `dist/*` to `{etendo_root}/modules/com.etendoerp.go/web/com.etendoerp.go/`
3. Tomcat serves the SPA from `/etendo/web/com.etendoerp.go/`
4. No Tomcat restart needed — static files are picked up immediately

**Default path:** The Makefile defaults to `etendo_core/modules/com.etendoerp.go/web/com.etendoerp.go`. Override `MODULE_WEB` if your Etendo root directory has a different name.

**Pipeline integration:** This is the LAST step in the full workflow:
```
Extract → Classify → Contract → Push to NEO → export.database → Generate Frontend → make deploy
```

## NEO Token Scripts

Helper scripts to generate JWT tokens for testing NEO Headless endpoints. Require Etendo running.

| Script | Role | Org | Use case |
|--------|------|-----|----------|
| `scripts/neo-token-sysadmin.sh` | System Administrator (role 0) | * (org 0) | Full access, admin operations |
| `scripts/neo-token-groupadmin.sh` | F&B International Group Admin | F&B US, Inc. | Realistic business role with window access |

**Usage:**
```bash
# Get token and use inline
TOKEN=$(./scripts/neo-token-sysadmin.sh)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/etendo/sws/neo/SalesOrder/Header

# Or with group admin role
TOKEN=$(./scripts/neo-token-groupadmin.sh)
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"fieldValues":{"documentStatus":"DR"}}' \
  http://localhost:8080/etendo/sws/neo/SalesOrder/Header/evaluate-display
```

**Env vars** (all optional): `ETENDO_URL`, `ETENDO_USER`, `ETENDO_PASSWORD`.

## NEO Headless OpenAPI

The OpenAPI spec for NEO Headless endpoints is served by the Etendo OpenAPI controller, **not** by `/sws/neo/` directly:
```
GET /etendo/ws/com.etendoerp.openapi.openAPIController?tag=EtendoGo
```
Requires JWT auth (`Authorization: Bearer <token>`). Returns a standard OpenAPI 3.x JSON with all registered NEO paths (CRUD, selectors, actions, evaluate-display).

The `NeoOpenAPIEndpoint` class implements `com.etendoerp.openapi.model.OpenAPIEndpoint` and registers paths dynamically based on configured specs/entities in DB.

## NEO Headless Research

See `docs/brainstorming-2026-03-10.md` for detailed notes on:
- NeoHandler CDI hook mechanism (custom endpoint logic via `@Named` + `JAVA_QUALIFIER`)
- Callouts NOT in NEO Headless (deferred to v2, only classic UI)
- Pipeline → NEO: fully integrated via `push-to-neo.js` + `neo-writer.js` (direct DB writes, supports windows, processes + reports)

**IMPORTANT:** After running `push-to-neo.js`, always remind the developer to run `./gradlew export.database` in the Etendo root so the DB changes are persisted to the XML sourcedata files in `com.etendoerp.go`. Without this step, the NEO configuration only lives in the database and won't survive a rebuild or be committed to the repo.

### Discovery Webhooks (read-only, for tooling)

| Webhook | Purpose |
|---------|---------|
| `SFListProcesses` | List available processes (GET, `?q=` search, up to 100 results) |
| `SFListWindows` | List available windows |
| `SFListMenu` | Full menu tree with type resolution |

## Etendo AD Database Conventions

- **All `_ID` columns are `VARCHAR` (strings)**. Legacy IDs look numeric (`'19'`, `'130'`), newer ones are UUIDs (`'95E2A8B50A254B2AAE6774B8C2F28120'`).
- Default approach: always treat `_ID` columns as strings first. Quote values in SQL: `IN ('18', '19', '30')` not `IN (18, 19, 30)`.
- This applies to `AD_Reference_ID`, `AD_Reference_Value_ID`, `AD_Table_ID`, `AD_Column_ID`, and all other `_ID` columns.
- All technical conventions and discoveries about Etendo AD should be documented in this section of CLAUDE.md (committed to the repo), not in personal memory files.

## Knowledge Persistence Policy

Knowledge is split between **committed files** (shared with all devs) and **auto-memory** (personal, per-developer).

### Committed (shared with the team)
- **Project knowledge** (conventions, architecture decisions, technical findings) → this `CLAUDE.md` file.
- **Documentation, research, plans, brainstorming** → `docs/` as versioned markdown files.
- **Per-window or per-feature findings** → the appropriate `artifacts/` or `docs/` subdirectory.
- **Errors, bugs found, problems to improve** → `feedback.md` (root, append-only log of issues discovered during development).
- Reference new docs from this CLAUDE.md when relevant (e.g., "See `docs/brainstorming-2026-03-10.md`").

### Auto-memory (personal, NOT committed)
Use `MEMORY.md` / `~/.claude/projects/.../memory/` **only** for data that is personal to the developer and should NOT be in the repo:
- **GitHub usernames** (for PR assignees/reviewers)
- **Local machine paths** (e.g., custom Etendo root location)
- **Developer-specific configurations** (editor preferences, env overrides)
- **Personal workflow preferences**

**Rule of thumb:** If another developer on the team would benefit from the information → commit it. If it's only useful to you on your machine → auto-memory.

<self_documentation>

## Self-Documentation Policy (MANDATORY)

**Core rule: code changes and documentation updates are a single atomic unit.** A PR that modifies the pipeline, CLI tools, data flow, or repository structure MUST include updates to ALL documentation and diagrams that reference the changed component. No PR is complete until the docs reflect reality.

### What triggers a documentation update

Any change to:
- **Pipeline steps** (new step, removed step, reordered steps, changed step behavior) in `cli/src/pipeline.js`
- **CLI tools** (new tool, renamed tool, changed inputs/outputs, removed tool) in `cli/src/`
- **Repository structure** (new directories, moved files, renamed folders)
- **Data flow** (new data sources, changed artifact formats, new webhook endpoints)
- **Runtime components** (new NeoHandler, changed URL patterns, new DB tables)
- **Architecture** (new loops, changed integration points, new external dependencies)

### What must be updated

When a trigger fires, check and update **all** of the following that reference the changed component:

**Always check:**
| Document | What it contains |
|----------|-----------------|
| `CLAUDE.md` — Repository Structure | Directory tree, file descriptions |
| `CLAUDE.md` — Key Data Flow | ASCII flow diagram |
| `CLAUDE.md` — Key Components table | Component names, purposes, descriptions |
| `docs/architecture-overview.md` | System overview, ASCII diagrams, CLI tools inventory, data flow |
| `docs/TDD.md` | Technical design, repository structure layout |
| `docs/PRD.md` | Pipeline diagram, tool references |

**Check if relevant:**
| Document | When to check |
|----------|--------------|
| `docs/flow-diagram.md` | If pipeline flow changed |
| `docs/diagrams/complete-pipeline.mmd` | If pipeline steps changed |
| `docs/diagrams/webhook-config-flow.mmd` | If webhook/config flow changed |
| `docs/diagrams/request-lifecycle.mmd` | If request handling changed |
| `docs/conventions.md` | If CLI behavior or edge cases changed |
| `docs/plans/process-and-report-pipeline.md` | If process pipeline changed |
| `docs/index.md` | If new docs were added |

### Rules for volatile data

- **Do NOT hardcode line counts** (e.g., "NeoServlet (953 lines)"). These go stale instantly. Describe purpose instead.
- **Do NOT duplicate information across docs.** Use cross-references (e.g., "See `docs/architecture-overview.md`") instead of copying content that will diverge.
- **ASCII diagrams must match the code.** If you add a pipeline step, the diagram gets a new box. If you remove a CLI tool, it disappears from the tree.

### Pipeline phase responsibilities

- **DEV phase**: The developer making the change MUST update all affected documentation in the same PR. This is not optional — incomplete docs = incomplete work.
- **REVIEW phase**: The reviewer MUST verify that documentation was updated. If the PR changes something documented in CLAUDE.md or docs/, and the docs were NOT updated, this is a **rejection reason**.
- **DOCS phase**: Sage validates that cross-references are consistent, diagrams match reality, and no stale data remains.

### Checklist for PRs that modify pipeline/tools/structure

Before marking a PR as ready:
- [ ] CLAUDE.md sections updated (Repository Structure, Data Flow, Components)
- [ ] `docs/architecture-overview.md` updated if architecture changed
- [ ] Mermaid diagrams in `docs/diagrams/` updated if flow changed
- [ ] `docs/TDD.md` updated if technical design changed
- [ ] No hardcoded line counts or stale snapshot data
- [ ] Cross-references between docs are still valid
- [ ] New files/tools are referenced in the appropriate index (`docs/index.md`, CLAUDE.md tree)

</self_documentation>
