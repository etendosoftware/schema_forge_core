# F8 Live Preview — Iframe with Babel Standalone — Design

> Approved design for live preview of generated components using Babel standalone in a sandboxed iframe.

## What

A preview route (`/preview`) in the app shell that reads generated JSX files from disk, injects them into a sandboxed iframe with React + Babel standalone from CDN, and renders them with mock data. No compilation needed — the fast loop from the PRD.

## Architecture

```
Generated JSX files (disk) → PreviewPage reads code → postMessage to iframe
                                                            ↓
                                                 iframe with React + Babel CDN
                                                 + mock data injected
                                                 + Tailwind CDN for styles
                                                 + UI component stubs
                                                 → renders component live
```

## Components

### 1. Preview HTML Template (`tools/app-shell/public/preview.html`)

Static HTML served by Vite from `public/`. Loaded inside an iframe.

- Loads React 18 + ReactDOM + Babel standalone from CDN
- Loads Tailwind CSS from CDN for styling
- Listens for `window.addEventListener('message')` to receive `{ code, mockData }`
- Provides stub implementations for `@/components/ui/*` (Table, Input, Button, Label, Badge, Separator, Select, Dialog) so JSX imports resolve
- Babel transforms received JSX at runtime
- Renders the default export into `<div id="root">`
- Displays errors inline if transformation or rendering fails

### 2. PreviewPage (`tools/app-shell/src/preview/PreviewPage.jsx`)

React component mounted at `/preview` route.

- Fetches generated JSX source files as text (using Vite's `?raw` import or fetch)
- Imports mock data from `@generated/web/sales-order/mockData.js`
- Renders an `<iframe src="/preview.html">` taking most of the viewport
- On load, sends code + mockData to the iframe via `postMessage`
- "Refresh" button to re-send code (after regeneration)
- Shows which component is being previewed

### 3. Route Integration

- Add `/preview` route in `App.jsx` inside the authenticated layout
- Add "Preview" link in the sidebar menu

## Stub Components in iframe

The iframe provides global stubs for Shadcn/ui components so the generated JSX can reference them:

| Component | Stub |
|---|---|
| Table, TableHeader, TableBody, TableRow, TableHead, TableCell | HTML table elements with Tailwind classes |
| Input | `<input>` with Tailwind classes |
| Button | `<button>` with Tailwind classes |
| Label | `<label>` with Tailwind classes |
| Badge | `<span>` with Tailwind classes |
| Separator | `<hr>` with Tailwind classes |

## YAGNI — Not Included

- No code editor in the UI
- No automatic hot reload (manual refresh button)
- No multi-window support (sales-order only for now)
- No sophisticated error overlay (errors shown inline in iframe)
- No saving from preview back to disk
