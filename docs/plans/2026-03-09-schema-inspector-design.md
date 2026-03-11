# Schema Inspector — Design Document

## Problem

Functional users need to modify `schema-curated.json` properties (visibility, required, grid/form presence, searchable) and add/remove fields — without editing JSON files manually. Changes should be reflected instantly in the generated frontend.

## Solution

An inspector mode embedded in the app-shell that lets functional users click on fields in the generated UI, edit their schema properties in a side panel, and save changes that trigger automatic regeneration of the full pipeline (contract + frontend code + HMR reload).

## Activation

- Toggle button "Edit Mode" in TopBar (next to theme switcher)
- When active: fields get interactive highlight borders, clickable
- When inactive: app looks normal, zero inspector UI

## Inspector Panel (Sheet)

On clicking a highlighted field in edit mode, a Sheet opens showing:

- **Field name** (read-only)
- **Column** (read-only)
- **Visibility**: select `editable | readOnly | discarded`
- **Required**: toggle
- **Grid**: toggle (show in grid)
- **Form**: toggle (show in form)
- **Searchable**: toggle
- **Delete field**: button to remove from schema

## Add Fields

- "Add Field" button shows fields from `schema-raw.json` that are not in `schema-curated.json`
- User selects a field and configures visibility/required/grid/form
- Field is added to the in-memory schema

## Data Flow

```
schema-curated.json  ──load──>  React state (in memory)
                                    |
                          User edits field properties
                                    |
                          Live preview (instant re-render)
                                    |
                          Click "Save"
                                    |
                              POST /api/schema/:window
                                    |
                    ┌───────────────┼───────────────┐
                    v               v               v
            Write schema    generateContract()  generateFrontend()
            curated.json    -> contract.json     -> JSX files
                                                        |
                                                   Vite HMR
                                                        |
                                                Browser updates
```

## Vite Middleware Plugin

File: `tools/app-shell/vite-plugins/schema-api.js`

Endpoints (dev mode only):
- `GET /api/schema/:window` — reads `artifacts/{window}/schema-curated.json`
- `GET /api/schema-raw/:window` — reads `artifacts/{window}/schema-raw.json`
- `POST /api/schema/:window` — writes schema, regenerates contract + frontend

The POST endpoint imports `generateContract()` from `cli/src/generate-contract.js` and `generateFrontend()` (or relevant exported function) from `cli/src/generate-frontend.js` as ESM modules — no child_process, no CLI invocation.

## New Components

| Component | Location | Purpose |
|---|---|---|
| `SchemaInspector` | `components/inspector/SchemaInspector.jsx` | Sheet panel with field property editors |
| `InspectorProvider` | `components/inspector/InspectorProvider.jsx` | React context: schema state, dirty tracking, save |
| `FieldHighlight` | `components/inspector/FieldHighlight.jsx` | Wrapper adding clickable border overlay in edit mode |
| `AddFieldDialog` | `components/inspector/AddFieldDialog.jsx` | Dialog to add fields from schema-raw |
| `schemaPlugin` | `vite-plugins/schema-api.js` | Vite dev middleware for read/write/regenerate |

## TopBar Changes

- New toggle button with `Pencil`/`PencilOff` icon
- "Save" button appears only when dirty (unsaved changes)
- Visual indicator when edit mode is active

## Regeneration Pipeline (on Save)

1. Write `schema-curated.json` to disk
2. Import and call `generateContract(schema)` → write `contract.json`
3. Import and call frontend generation → write JSX to `generated/web/{window}/`
4. Vite HMR detects JSX changes → browser hot-reloads

All steps run in the Vite dev server process. Total time estimate: <2s for typical windows.

## Scope Exclusions

- No editing of `aggregate-contract.json` (overview pages)
- No editing of `type`, `inputMode`, or `reference` properties
- No production build — inspector is dev-only
- No backend regeneration (Java) — only contract + frontend
