# Schema Forge

Transforms Etendo ERP metadata and business rules into complete web applications (Java backend + React SPA frontend) that run natively on the Etendo platform.

## Prerequisites

- **Node.js >= 22** (check with `node -v`)
- **PostgreSQL** — access to an Etendo database (staging/dev, never production)
- **Etendo instance** — a working Etendo environment with the Application Dictionary populated

## Installation and Configuration

### 1. Clone and install dependencies

```bash
git clone git@github.com:etendosoftware/schema_forge.git
cd schema_forge
npm install
```

This installs all workspaces: `cli/`, `tools/app-shell`, `tools/decision-panel`, `tools/ui-preview`.

### 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Etendo Database (staging/development - NEVER production)
ETENDO_DB_HOST=localhost
ETENDO_DB_PORT=5416
ETENDO_DB_USER=tad
ETENDO_DB_PASSWORD=tad
ETENDO_DB_NAME=etendo27

# Etendo Java source directory (for Rule Extractor callout analysis)
ETENDO_SOURCE_DIR=/path/to/your/etendo/src
```

| Variable | Description | Example |
|----------|-------------|---------|
| `ETENDO_DB_HOST` | PostgreSQL host | `localhost` |
| `ETENDO_DB_PORT` | PostgreSQL port | `5416` |
| `ETENDO_DB_USER` | DB user with read access to AD tables | `tad` |
| `ETENDO_DB_PASSWORD` | DB password | `tad` |
| `ETENDO_DB_NAME` | Database name | `etendo27` |
| `ETENDO_SOURCE_DIR` | Path to Etendo Java sources (for callout analysis) | `/Users/you/Workspace/etendo_develop` |

> **Tip:** You can find these values in your Etendo's `gradle.properties` file, under `bbdd.host`, `bbdd.port`, `bbdd.user`, `bbdd.password`, and `bbdd.sid`.

### 3. Verify database connection

Quick check that the CLI can reach the DB:

```bash
node cli/src/extract-from-db.js <windowId> <windowName>
# Example with Sales Order:
node cli/src/extract-from-db.js 143 sales-order
```

If it works, you'll see extracted JSON files in `artifacts/sales-order/`.

## Project Structure

```
schema-forge/
├── cli/                        # Node.js CLI tools (extractors, validators, generators)
│   └── src/
│       ├── extract-from-db.js  # Extract field metadata from Etendo DB
│       ├── extract-fields.js   # Field extraction logic
│       ├── extract-rules.js    # Business rule + callout extraction
│       ├── validate-schema.js  # Schema validation (4 levels)
│       ├── pre-classify.js     # Auto-classify rules (deterministic + AI)
│       ├── generate-contract.js # Generate frontend/backend contracts
│       ├── generate-backend.js # Generate Etendo Java module
│       ├── generate-frontend.js # Generate React SPA
│       ├── run-contract-tests.js # Run contract tests
│       ├── pipeline.js         # Full pipeline orchestrator
│       └── db.js               # Database connection pool
├── tools/                      # React web apps for human decisions
│   ├── app-shell/              # Main UI shell (Vite + React + Tailwind)
│   ├── decision-panel/         # Field visibility + rule curation UI
│   └── ui-preview/             # Live UI preview with mock data
├── templates/etendo-module/    # Handlebars templates for Java/XML generation
├── artifacts/{window-name}/    # Per-window: schemas, rules, decisions, generated code
├── core-maps/                  # system-columns.json, impact-messages.json
├── docs/                       # PRD, TDD, and reference documents
└── .env                        # Local environment config (not committed)
```

## CLI Commands

All commands are defined as `bin` entries in `cli/package.json`:

| Command | Description |
|---------|-------------|
| `sf-extract-db <windowId> <windowName>` | Extract fields from Etendo DB |
| `sf-extract <windowId> <windowName>` | Extract field metadata |
| `sf-extract-rules <windowId> <windowName>` | Extract business rules and callouts |
| `sf-validate` | Validate schema (4 levels) |
| `sf-classify` | Pre-classify rules (deterministic + AI) |
| `sf-contract` | Generate contracts + test manifest |
| `sf-generate` | Generate Etendo Java module |
| `sf-pipeline <windowId> [windowName]` | Run full pipeline end-to-end |
| `sf-test` | Run contract tests |

Run them with `npx`:

```bash
npx sf-pipeline 143 sales-order
```

## Pipeline Overview

```
Extract from DB --> Validate Schema --> Pre-classify Rules
    --> Human Decisions (Decision Panel) --> Generate Contract
    --> Generate Backend --> Run Contract Tests
```

The pipeline pauses at the "Human Decisions" step, where you open the Decision Panel (`tools/decision-panel`) to review and curate field visibility and rule classifications.

## Running the UI Tools

```bash
# App Shell (main UI)
cd tools/app-shell
npm run dev          # http://localhost:5173

# Decision Panel
cd tools/decision-panel
npm run dev          # http://localhost:5174

# UI Preview
cd tools/ui-preview
npm run dev          # http://localhost:5175
```

The app-shell has an additional env var in `.env.development`:

```env
VITE_MOCK=true    # Use mock data instead of live backend
```

## Documentation

Full docs are in `docs/` — see [docs/index.md](docs/index.md) for the complete index.

| Doc | What it covers |
|-----|---------------|
| [PRD.md](docs/PRD.md) | Product requirements, decision map, pipeline, scope |
| [TDD.md](docs/TDD.md) | Technical design, data models, validation rules, generators |
| [etendo-ad/](docs/etendo-ad/index.md) | How Etendo AD actually works (schema mappings, processes, display logic) |
