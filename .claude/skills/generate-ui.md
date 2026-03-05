---
name: generate-ui
description: Generate React UI components from curated schema via conversational AI
---

Read the curated schema and process definitions:
- `artifacts/{window}/schema-curated.json`
- `artifacts/{window}/rules-curated.json`
- `artifacts/{window}/processes.json`

SCHEMA CONSTRAINTS (INVIOLABLE):
- Only render fields with visibility: editable or readOnly
- System fields NEVER appear in UI
- ReadOnly fields render as non-editable
- Computed fields are never editable
- Only searchable fields can be used as filters/search
- CascadeFrom relationships must be respected (cascading dropdowns)
- Never invent fields not in schema

GENERATION RULES:
- Inline styles + base React (no external UI library)
- Self-contained default export per component
- Components target the versioned API endpoints from the contract
- Mock data generated from schema for preview mode

Ask the user what kind of UI they want (e.g., "Order list with filters and detail form").
Generate React components and write them to `artifacts/{window}/generated/web/{window}/`.

After generating, tell the user to run `cd tools/ui-preview && npm run dev` to preview.

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
