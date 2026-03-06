# F8 Live Preview — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `/preview` route that renders generated JSX components in a sandboxed iframe using Babel standalone + CDN React, with mock data, no compilation needed.

**Architecture:** A static `preview.html` in Vite's public/ loads React+Babel+Tailwind from CDN and listens for postMessage. A `PreviewPage.jsx` reads generated JSX as raw text, sends it to the iframe with mock data. Route added to App.jsx.

**Tech Stack:** React 18 CDN, Babel standalone CDN, Tailwind CDN, Vite `?raw` imports, postMessage API

---

### Task 1: Preview HTML Template (iframe sandbox)

**Files:**
- Create: `tools/app-shell/public/preview.html`

**Context:** This HTML file is served by Vite from the `public/` directory. It's loaded inside an iframe. It must be self-contained — no imports from the app shell, everything from CDN. The generated components use Shadcn/ui imports like `@/components/ui/table`, so this file must provide stub implementations as globals.

**Step 1: Create the preview HTML**

Create `tools/app-shell/public/preview.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Component Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 16px; background: #fff; }
    .preview-error { color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0; white-space: pre-wrap; font-family: monospace; font-size: 13px; }
    .preview-loading { color: #6b7280; padding: 32px; text-align: center; }
  </style>
</head>
<body>
  <div id="root"><div class="preview-loading">Waiting for component code...</div></div>
  <script>
    // Stub implementations for @/components/ui/* that generated components import
    const UI = {
      Table: (props) => React.createElement('table', { className: 'w-full caption-bottom text-sm ' + (props.className || ''), ...props }),
      TableHeader: (props) => React.createElement('thead', { className: '[&_tr]:border-b ' + (props.className || ''), ...props }),
      TableBody: (props) => React.createElement('tbody', { className: '[&_tr:last-child]:border-0 ' + (props.className || ''), ...props }),
      TableRow: (props) => React.createElement('tr', { className: 'border-b transition-colors hover:bg-muted/50 ' + (props.className || ''), onClick: props.onClick, ...props }),
      TableHead: (props) => React.createElement('th', { className: 'h-10 px-2 text-left align-middle font-medium text-muted-foreground ' + (props.className || ''), ...props }),
      TableCell: (props) => React.createElement('td', { className: 'p-2 align-middle ' + (props.className || ''), ...props }),
      Input: (props) => React.createElement('input', { className: 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ' + (props.className || ''), ...props }),
      Button: ({ variant, children, ...props }) => React.createElement('button', { className: 'inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 ' + (variant === 'outline' ? 'border border-input bg-background hover:bg-accent ' : 'bg-primary text-primary-foreground hover:bg-primary/90 ') + (props.className || ''), ...props }, children),
      Label: (props) => React.createElement('label', { className: 'text-sm font-medium leading-none ' + (props.className || ''), ...props }),
      Badge: ({ children, ...props }) => React.createElement('span', { className: 'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ' + (props.className || ''), ...props }, children),
      Separator: (props) => React.createElement('hr', { className: 'shrink-0 bg-border h-[1px] w-full ' + (props.className || ''), ...props }),
    };

    // Mock data and component code will be received via postMessage
    let currentMockData = {};

    window.addEventListener('message', (event) => {
      const { type, code, mockData } = event.data || {};
      if (type !== 'preview-render') return;

      currentMockData = mockData || {};
      const root = document.getElementById('root');

      try {
        // Transform JSX to JS using Babel
        const transformed = Babel.transform(code, {
          presets: ['react'],
          filename: 'preview.jsx',
        }).code;

        // Create a module-like scope with all UI stubs and mock data available
        const moduleExports = {};
        const moduleFunc = new Function(
          'React', 'exports', 'mockData',
          'Table', 'TableHeader', 'TableBody', 'TableRow', 'TableHead', 'TableCell',
          'Input', 'Button', 'Label', 'Badge', 'Separator',
          'useState', 'useEffect',
          transformed
        );

        moduleFunc(
          React, moduleExports, currentMockData,
          UI.Table, UI.TableHeader, UI.TableBody, UI.TableRow, UI.TableHead, UI.TableCell,
          UI.Input, UI.Button, UI.Label, UI.Badge, UI.Separator,
          React.useState, React.useEffect
        );

        // Render the default export or the first exported component
        const Component = moduleExports.default || Object.values(moduleExports)[0];
        if (!Component) {
          root.innerHTML = '<div class="preview-error">No component exported. Make sure the code has export default.</div>';
          return;
        }

        const reactRoot = ReactDOM.createRoot(root);
        reactRoot.render(React.createElement(Component, {
          token: 'mock-token',
          apiBaseUrl: '/mock-api',
          data: currentMockData,
        }));
      } catch (err) {
        root.innerHTML = '<div class="preview-error">Error: ' + err.message + '</div>';
      }
    });
  </script>
</body>
</html>
```

**Step 2: Verify the file is served**

Run: `cd tools/app-shell && npx vite &` then `curl -s http://localhost:3100/preview.html | head -5`
Expected: Returns the HTML content. Kill the dev server after.

**Step 3: Commit**

```bash
git add tools/app-shell/public/preview.html
git commit -m "feat: add preview.html sandbox with React+Babel CDN and UI stubs"
```

---

### Task 2: PreviewPage Component

**Files:**
- Create: `tools/app-shell/src/preview/PreviewPage.jsx`

**Context:** This React component is mounted at `/preview`. It reads the generated OrderPage.jsx source code as raw text, imports mock data, and sends both to the iframe via postMessage. The generated components are at `@generated/web/sales-order/` (Vite alias). The mock data is at `@generated/web/sales-order/mockData.js`.

The generated JSX uses ES module imports like `import { Separator } from '@/components/ui/separator'`. The iframe's Babel can't resolve these. So PreviewPage must **strip all import/export lines** from the JSX before sending it to the iframe, since the iframe provides all dependencies as globals. It must also convert `export default function X` to `exports.default = function X`.

**Step 1: Create PreviewPage.jsx**

Create `tools/app-shell/src/preview/PreviewPage.jsx`:

```jsx
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

// Import generated source as raw text
import orderPageSource from '@generated/web/sales-order/OrderPage.jsx?raw';
import orderTableSource from '@generated/web/sales-order/OrderTable.jsx?raw';
import orderFormSource from '@generated/web/sales-order/OrderForm.jsx?raw';
import orderLineTableSource from '@generated/web/sales-order/OrderLineTable.jsx?raw';
import * as mockDataModule from '@generated/web/sales-order/mockData.js';

/**
 * Strip ES module import/export statements and convert to iframe-compatible code.
 * The iframe provides React, UI components, and hooks as globals.
 */
function prepareCodeForIframe(source) {
  return source
    // Remove import lines
    .replace(/^import\s+.*?['"]\s*;?\s*$/gm, '')
    // Convert: export default function Name(...) {
    .replace(/export\s+default\s+function\s+(\w+)/g, 'exports.default = function $1')
    // Convert: export default Name
    .replace(/^export\s+default\s+/gm, 'exports.default = ')
    // Remove any remaining export keywords
    .replace(/^export\s+/gm, '');
}

/**
 * Combine multiple component sources into a single script.
 * Order matters: dependencies first, main component last.
 */
function buildPreviewCode(sources) {
  return sources.map(prepareCodeForIframe).join('\n\n');
}

export default function PreviewPage() {
  const iframeRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [activeComponent, setActiveComponent] = useState('OrderPage');

  const componentSources = {
    OrderPage: [orderTableSource, orderFormSource, orderLineTableSource, orderPageSource],
    OrderTable: [orderTableSource],
    OrderForm: [orderFormSource],
    OrderLineTable: [orderLineTableSource],
  };

  const mockData = {};
  for (const [key, value] of Object.entries(mockDataModule)) {
    mockData[key] = value;
  }

  function sendToIframe() {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const sources = componentSources[activeComponent] || [orderPageSource];
    const code = buildPreviewCode(sources);

    iframe.contentWindow.postMessage({
      type: 'preview-render',
      code,
      mockData,
    }, '*');
  }

  useEffect(() => {
    if (loaded) sendToIframe();
  }, [loaded, activeComponent]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
        <span className="text-sm font-medium">Preview:</span>
        {Object.keys(componentSources).map(name => (
          <Button
            key={name}
            variant={name === activeComponent ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveComponent(name)}
            className="h-7 text-xs"
          >
            {name}
          </Button>
        ))}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={sendToIframe} className="h-7 text-xs">
          Refresh
        </Button>
      </div>
      <iframe
        ref={iframeRef}
        src="/preview.html"
        onLoad={() => setLoaded(true)}
        className="flex-1 w-full border-0"
        sandbox="allow-scripts"
        title="Component Preview"
      />
    </div>
  );
}
```

**Step 2: Verify the file compiles**

Run: `cd tools/app-shell && npx vite build 2>&1 | tail -5`
Expected: Build succeeds (PreviewPage is tree-shaken if not imported yet, but no syntax errors)

**Step 3: Commit**

```bash
git add tools/app-shell/src/preview/PreviewPage.jsx
git commit -m "feat: add PreviewPage component with code preparation and iframe messaging"
```

---

### Task 3: Route Integration + Sidebar Link

**Files:**
- Modify: `tools/app-shell/src/App.jsx`
- Modify: `tools/app-shell/src/layout/AppLayout.jsx` (add Preview link to sidebar)

**Context:** The app shell's App.jsx defines routes. AppLayout.jsx renders the sidebar with menu items. We need to add a `/preview` route and a sidebar link.

**Step 1: Read current files**

Read `tools/app-shell/src/App.jsx` and `tools/app-shell/src/layout/AppLayout.jsx` to understand the current structure.

**Step 2: Modify App.jsx**

Add import at the top (after existing imports):
```javascript
import PreviewPage from './preview/PreviewPage.jsx';
```

Add a new route inside the authenticated layout routes, after the `:windowName` route:
```jsx
<Route path="preview" element={<PreviewPage />} />
```

**Step 3: Modify AppLayout.jsx**

Add a "Preview" link in the sidebar navigation. Find where menu items are rendered and add a link to `/preview` at the bottom of the sidebar, styled as a secondary/utility link.

The exact change depends on the current AppLayout structure — read the file first, then add a `<Link to="/preview">Preview</Link>` in the sidebar below the window menu items.

**Step 4: Verify**

Run: `cd tools/app-shell && npx vite build`
Expected: Build succeeds with PreviewPage included as a chunk.

**Step 5: Commit**

```bash
git add tools/app-shell/src/App.jsx tools/app-shell/src/layout/AppLayout.jsx
git commit -m "feat: add /preview route and sidebar link for live component preview"
```
