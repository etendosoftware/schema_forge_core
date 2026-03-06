---
name: generate-ui
description: Generate or customize React UI components from curated schema using Shadcn/ui + Tailwind
---

## Automatic Generation (start here)

Run the generator first to produce the base components:

```bash
node cli/src/generate-frontend.js artifacts/{window}/contract.json
```

This produces Table, Form, Page, and index components at:
`artifacts/{window}/generated/web/{window}/`

## Customization (conversational)

After running the generator, ask the user what they want to customize:
- Layout changes (column order, field grouping, responsive breakpoints)
- Custom logic (conditional field rendering, computed displays)
- Visual tweaks (status badges, color coding, icons)

Read the generated files and modify them based on user requests.

## SCHEMA CONSTRAINTS (INVIOLABLE)

- Only render fields with visibility: editable or readOnly
- System fields NEVER appear in UI
- ReadOnly fields render as non-editable (readOnly or disabled inputs with bg-muted)
- Computed fields are never editable
- Only searchable fields can be used as filters/search
- CascadeFrom relationships must be respected (cascading dropdowns)
- Never invent fields not in schema

## UI LIBRARY RULES

- Use Shadcn/ui components from `@/components/ui/` (button, input, card, table, badge, label, select, dialog, separator)
- Use Tailwind CSS for layout and spacing -- NO inline styles
- Use `cn()` from `@/lib/utils` for conditional classes
- Use `lucide-react` for icons

## Component Props Contract

Generated components MUST accept these props from the app shell:

```jsx
export default function WindowName({ token, apiBaseUrl, window }) {
  // token: JWT string for Authorization header
  // apiBaseUrl: base URL for API calls (e.g., '/etendo/api')
  // window: { name, label, entityConfig } from contract
}
```

When making API calls, use:
```javascript
const res = await fetch(`${apiBaseUrl}/v1/${window.name}`, {
  headers: { 'Authorization': `Bearer ${token}` },
});
```

NEVER hardcode API URLs or tokens. Always use the props.

## Output Location

Write generated/modified components to:
`artifacts/{window}/generated/web/{window}/`

## Generation Log (after F8, before F9)

After regenerating frontend files, run the generation log to track changes:

```bash
node cli/src/generation-log.js <window-name> "<trigger-description>"
```

This:
1. Diffs current files (disk) against the previous version (git HEAD)
2. Appends structured entries to `artifacts/generation-log.json`
3. Generates per-window view: `artifacts/{window}/GENERATION-LOG.md`
4. Generates transversal view: `artifacts/GENERATION-RUNS.md`

The generation log captures field additions, removals, type changes, new/removed files,
and component-level changes. The JSON log is the source of truth; markdown views are derived.

Flow: F8 (generate-frontend) -> Log (generation-log) -> F9 (contract tests)

After generating, tell the user to preview with: `cd tools/app-shell && npm run dev`
