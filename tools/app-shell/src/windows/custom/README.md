# Custom Window Components

This directory contains hand-written React components for windows that use
`layoutType: "custom"` in their curated schema.

## Convention

Each custom window lives in its own subdirectory:

```
custom/
  {window-name}/
    index.jsx        # The custom React component (never overwritten by pipeline)
    mockCatalogs.js  # FK reference data for local development
```

## How it works

1. Set `layoutType: "custom"` in `artifacts/{window-name}/schema-curated.json`
2. Run the pipeline — it generates a scaffold at `custom/{window-name}/index.jsx`
   with rich JSDoc metadata (all fields, entities, processes, API patterns)
3. Build on top of the scaffold using any `contract-ui` component or custom code

## Regeneration safety

If `index.jsx` already exists when the pipeline runs again, the new scaffold is
written as `index.jsx.new` instead. The existing component is never touched.
Use AI or a diff tool to merge updated metadata from `index.jsx.new` into your
existing `index.jsx`.

The same applies to `mockCatalogs.js` → `mockCatalogs.js.new`.

## Registry

Each custom window is auto-registered in `registry.js` under `customLoaders`
when the pipeline generates the scaffold for the first time.
You can also add entries manually:

```js
const customLoaders = {
  'my-window': () => import('./custom/my-window/index.jsx'),
};
```

## Props

Custom window components receive the same props as any generated window:

```jsx
import { useApiFetch } from '@/auth/useApiFetch.js';

export default function MyWindowCustom({ apiBaseUrl, windowName, recordId, window }) {
  const apiFetch = useApiFetch(apiBaseUrl);

  // Use apiFetch(...) for authenticated requests.
}
```
