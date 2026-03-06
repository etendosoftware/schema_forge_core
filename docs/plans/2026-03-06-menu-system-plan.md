# Menu System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat hardcoded menu with a 2-level JSON-driven menu (groups > items) rendered as collapsible sidebar sections, and integrate menu placement into the AI generation skill.

**Architecture:** A `menu.json` file becomes the single source of truth for navigation structure. `registry.js` reads from it instead of maintaining hardcoded lists. `Sidebar.jsx` renders collapsible groups with per-group icons. The `generate-ui` skill is updated so the AI decides which group a new window belongs to (or creates a new group).

**Tech Stack:** React, react-router-dom, lucide-react icons, Node.js test runner

---

### Task 1: Create menu.json

**Files:**
- Create: `tools/app-shell/src/menu.json`

**Step 1: Create the menu JSON file**

```json
{
  "menu": [
    {
      "group": "Sales",
      "icon": "ShoppingCart",
      "items": [
        { "name": "sales-order", "label": "Sales Order" }
      ]
    },
    {
      "group": "Procurement",
      "icon": "Truck",
      "items": [
        { "name": "purchase-order", "label": "Purchase Order" },
        { "name": "requisition", "label": "Requisition" },
        { "name": "manage-requisitions", "label": "Manage Requisitions" },
        { "name": "requisition-to-order", "label": "Requisition to Order" },
        { "name": "goods-receipt", "label": "Goods Receipt" },
        { "name": "pending-goods-receipts", "label": "Pending Goods Receipts" },
        { "name": "inbound-receipt", "label": "Inbound Receipt" },
        { "name": "purchase-invoice", "label": "Purchase Invoice" },
        { "name": "matched-purchase-invoices", "label": "Matched Purchase Invoices" },
        { "name": "return-to-vendor", "label": "Return to Vendor" },
        { "name": "return-to-vendor-shipment", "label": "Return to Vendor Shipment" },
        { "name": "landed-cost", "label": "Landed Cost" }
      ]
    },
    {
      "group": "Master Data",
      "icon": "Database",
      "items": [
        { "name": "business-partner", "label": "Business Partner" },
        { "name": "bp-location", "label": "BP Location" },
        { "name": "product", "label": "Product" },
        { "name": "product-category", "label": "Product Category" },
        { "name": "warehouse", "label": "Warehouse" }
      ]
    },
    {
      "group": "Finance",
      "icon": "DollarSign",
      "items": [
        { "name": "price-list", "label": "Price List" },
        { "name": "payment-term", "label": "Payment Term" },
        { "name": "payment-method", "label": "Payment Method" },
        { "name": "tax", "label": "Tax" }
      ]
    },
    {
      "group": "System",
      "icon": "Settings",
      "items": [
        { "name": "uom", "label": "UOM" },
        { "name": "user", "label": "User" }
      ]
    }
  ]
}
```

**Step 2: Commit**

```bash
git add tools/app-shell/src/menu.json
git commit -m "feat: add menu.json with 2-level grouped menu structure"
```

---

### Task 2: Rewrite registry.js to read from menu.json

**Files:**
- Modify: `tools/app-shell/src/windows/registry.js`
- Modify: `tools/app-shell/src/windows/__tests__/registry.test.js`

**Step 1: Write the failing tests**

Replace the existing test file with tests that validate the new behavior:

```js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildMenuGroups, buildWindowMap, getAllWindowNames } from '../registry.js';

describe('buildMenuGroups', () => {
  it('returns groups from menu.json', () => {
    const groups = buildMenuGroups();
    assert.ok(Array.isArray(groups));
    assert.ok(groups.length >= 4);
    assert.equal(groups[0].group, 'Sales');
    assert.ok(Array.isArray(groups[0].items));
    assert.ok(groups[0].icon);
  });

  it('each item has name and label', () => {
    const groups = buildMenuGroups();
    for (const group of groups) {
      for (const item of group.items) {
        assert.ok(item.name, `missing name in group ${group.group}`);
        assert.ok(item.label, `missing label in group ${group.group}`);
      }
    }
  });
});

describe('getAllWindowNames', () => {
  it('returns flat array of all window slugs', () => {
    const names = getAllWindowNames();
    assert.ok(names.includes('sales-order'));
    assert.ok(names.includes('business-partner'));
    assert.ok(names.includes('uom'));
    assert.ok(names.length >= 11);
  });
});

describe('buildWindowMap', () => {
  it('creates a loader entry for every window in menu.json', () => {
    const map = buildWindowMap();
    const names = getAllWindowNames();
    for (const name of names) {
      assert.ok(map[name], `missing window map entry for ${name}`);
      assert.ok(map[name].loader, `missing loader for ${name}`);
      assert.ok(map[name].label, `missing label for ${name}`);
    }
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `node --test tools/app-shell/src/windows/__tests__/registry.test.js`
Expected: FAIL (buildMenuGroups not exported)

**Step 3: Rewrite registry.js**

```js
import menuConfig from '../menu.json';

/**
 * Convert a window name to a URL-safe slug.
 */
function toSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Known window loaders -- maps slug to dynamic import.
 * Windows not listed here fall back to PlaceholderWindow.
 */
const windowLoaders = {
  'sales-order': () => import('@generated/sales-order/generated/web/sales-order/index.jsx'),
  'business-partner': () => import('@generated/business-partner/generated/web/business-partner/index.jsx'),
  'warehouse': () => import('@generated/warehouse/generated/web/warehouse/index.jsx'),
  'price-list': () => import('@generated/price-list/generated/web/price-list/index.jsx'),
  'payment-term': () => import('@generated/payment-term/generated/web/payment-term/index.jsx'),
  'payment-method': () => import('@generated/payment-method/generated/web/payment-method/index.jsx'),
  'product': () => import('@generated/product/generated/web/product/index.jsx'),
  'product-category': () => import('@generated/product-category/generated/web/product-category/index.jsx'),
  'tax': () => import('@generated/tax/generated/web/tax/index.jsx'),
  'uom': () => import('@generated/uom/generated/web/uom/index.jsx'),
  'user': () => import('@generated/user/generated/web/user/index.jsx'),
};

/**
 * Return the 2-level menu groups from menu.json.
 */
export function buildMenuGroups() {
  return menuConfig.menu;
}

/**
 * Flat list of all window slugs from menu.json.
 */
export function getAllWindowNames() {
  return menuConfig.menu.flatMap(g => g.items.map(i => i.name));
}

/**
 * Build window map with loaders for all windows in menu.json.
 */
export function buildWindowMap() {
  const map = {};
  for (const group of menuConfig.menu) {
    for (const item of group.items) {
      map[item.name] = {
        name: item.name,
        label: item.label,
        contract: null,
        loader: windowLoaders[item.name] || (() => import('./PlaceholderWindow.jsx')),
      };
    }
  }
  return map;
}
```

**Step 4: Run tests to verify they pass**

Run: `node --test tools/app-shell/src/windows/__tests__/registry.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/app-shell/src/windows/registry.js tools/app-shell/src/windows/__tests__/registry.test.js
git commit -m "feat: rewrite registry to read from menu.json"
```

---

### Task 3: Update Sidebar.jsx for collapsible groups

**Files:**
- Modify: `tools/app-shell/src/layout/Sidebar.jsx`

**Step 1: Rewrite Sidebar with collapsible group sections**

```jsx
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Eye, ChevronRight, ShoppingCart, Truck, Database, DollarSign, Settings } from 'lucide-react';

const ICON_MAP = {
  ShoppingCart,
  Truck,
  Database,
  DollarSign,
  Settings,
};

function MenuGroup({ group, icon, items, isOpen, onToggle }) {
  const Icon = ICON_MAP[icon] || Database;

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white/40 hover:text-white/60 transition-colors"
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1 text-left">{group}</span>
        <ChevronRight className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-90')} />
      </button>
      {isOpen && (
        <div className="ml-4 space-y-0.5">
          {items.map(item => (
            <NavLink
              key={item.name}
              to={`/${item.name}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ menuGroups }) {
  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    for (const g of menuGroups) {
      initial[g.group] = true;
    }
    return initial;
  });

  const toggle = (group) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  return (
    <aside className="w-60 flex flex-col" style={{ backgroundColor: 'hsl(var(--sidebar-bg))' }}>
      <div className="px-5 py-5 border-b border-white/10">
        <h1 className="text-lg font-bold tracking-tight text-white">Schema Forge</h1>
        <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--sidebar-text))' }}>ERP Generator</p>
      </div>
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {menuGroups.map(g => (
          <MenuGroup
            key={g.group}
            group={g.group}
            icon={g.icon}
            items={g.items}
            isOpen={openGroups[g.group]}
            onToggle={() => toggle(g.group)}
          />
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <NavLink
          to="/preview"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
              isActive
                ? 'bg-white/15 text-white'
                : 'text-white/40 hover:bg-white/10 hover:text-white/80'
            )
          }
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </NavLink>
      </div>
    </aside>
  );
}
```

**Step 2: Commit**

```bash
git add tools/app-shell/src/layout/Sidebar.jsx
git commit -m "feat: collapsible 2-level sidebar with group icons"
```

---

### Task 4: Update App.jsx and AppLayout.jsx to use new API

**Files:**
- Modify: `tools/app-shell/src/App.jsx`
- Modify: `tools/app-shell/src/layout/AppLayout.jsx`

**Step 1: Update AppLayout to accept menuGroups instead of menuItems**

```jsx
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';

export default function AppLayout({ menuGroups }) {
  return (
    <div className="h-screen flex">
      <Sidebar menuGroups={menuGroups} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

**Step 2: Update App.jsx to use buildMenuGroups and buildWindowMap**

Key changes:
- Import `buildMenuGroups` and `buildWindowMap` (no longer needs contract to build menu)
- `menuGroups` state replaces `menuItems`
- `buildMenuGroups()` is called directly (synchronous, reads from JSON)
- `buildWindowMap()` is called directly (no contract arg)
- The default route uses the first item of the first group
- Remove `buildMenuFromContract` import (deleted)

```jsx
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import LoginPage from './auth/LoginPage.jsx';
import AppLayout from './layout/AppLayout.jsx';
import WindowLoader from './windows/WindowLoader.jsx';
import PreviewPage from './preview/PreviewPage.jsx';
import { buildMenuGroups, buildWindowMap } from './windows/registry.js';
import { createMockFetch } from './lib/mockFetch.js';

const API_BASE_URL = '/etendo_sf/api';

/**
 * Load mock data for all entity windows and merge into a single store.
 */
async function loadAllMockData() {
  const modules = await Promise.all([
    import('@generated/sales-order/generated/web/sales-order/mockData.js'),
    import('@generated/business-partner/generated/web/business-partner/mockData.js'),
    import('@generated/warehouse/generated/web/warehouse/mockData.js'),
    import('@generated/price-list/generated/web/price-list/mockData.js'),
    import('@generated/payment-term/generated/web/payment-term/mockData.js'),
    import('@generated/payment-method/generated/web/payment-method/mockData.js'),
    import('@generated/product/generated/web/product/mockData.js'),
    import('@generated/product-category/generated/web/product-category/mockData.js'),
    import('@generated/tax/generated/web/tax/mockData.js'),
    import('@generated/uom/generated/web/uom/mockData.js'),
    import('@generated/user/generated/web/user/mockData.js'),
  ]);

  const merged = {};
  for (const mod of modules) {
    for (const [key, value] of Object.entries(mod)) {
      if (key !== 'default') {
        merged[key] = value;
      }
    }
  }
  return merged;
}

function AuthGuard({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes({ menuGroups, windowMap }) {
  const { isAuthenticated } = useAuth();

  if (menuGroups.length === 0) {
    return <div className="p-8 text-muted-foreground">Loading...</div>;
  }

  const firstWindow = menuGroups[0].items[0].name;

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        element={
          <AuthGuard>
            <AppLayout menuGroups={menuGroups} />
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to={`/${firstWindow}`} replace />} />
        <Route path="preview" element={<PreviewPage />} />
        <Route
          path=":windowName"
          element={<WindowLoader windowMap={windowMap} apiBaseUrl={API_BASE_URL} />}
        />
      </Route>
    </Routes>
  );
}

export default function App() {
  const [menuGroups] = useState(() => buildMenuGroups());
  const [windowMap] = useState(() => buildWindowMap());

  useEffect(() => {
    if (import.meta.env.VITE_MOCK === 'true') {
      loadAllMockData().then(mockData => {
        const mockFetch = createMockFetch(mockData, API_BASE_URL);
        const originalFetch = window.fetch;
        window.fetch = async (url, opts) => {
          const mockResult = await mockFetch(url, opts);
          if (mockResult !== undefined) return mockResult;
          return originalFetch(url, opts);
        };
      });
    }
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes menuGroups={menuGroups} windowMap={windowMap} />
      </AuthProvider>
    </BrowserRouter>
  );
}
```

**Step 3: Run all tests**

Run: `node --test 'cli/test/*.test.js'`
Expected: All existing tests pass (registry tests already updated in Task 2)

**Step 4: Commit**

```bash
git add tools/app-shell/src/App.jsx tools/app-shell/src/layout/AppLayout.jsx
git commit -m "feat: wire App and AppLayout to use grouped menu from menu.json"
```

---

### Task 5: Update generate-ui skill for AI menu placement

**Files:**
- Modify: `.claude/skills/generate-ui.md`

**Step 1: Add menu placement section to the skill**

Add the following section after the existing "### Registration" block in Step 0, and update the registration instructions:

Replace the current registration block:
```
### Registration
Add the new window to:
1. `tools/app-shell/src/windows/registry.js` -- windowLoaders + REFERENCE_WINDOWS
2. `tools/app-shell/src/App.jsx` -- mockData import in `loadAllMockData()`
```

With:
```
### Registration

Add the new window to these files:

1. **`tools/app-shell/src/menu.json`** -- Add the window to the correct menu group.

   **AI Menu Placement Rules:**
   - Read `tools/app-shell/src/menu.json` to see current groups and items.
   - Classify the window into the best-fit group based on its domain:
     | Domain pattern | Group |
     |----------------|-------|
     | Sales documents (orders, invoices, shipments) | Sales |
     | Purchasing, requisitions, goods receipts, vendor returns | Procurement |
     | Entities referenced by FK (partners, products, warehouses) | Master Data |
     | Pricing, payments, taxes, currencies | Finance |
     | Configuration, units, users, roles | System |
   - If no existing group fits, create a new group with an appropriate `icon` from lucide-react.
   - Place the item at a logical position within the group (transactional docs first, supporting entities after).
   - Use the window slug as `name` and a human-readable title as `label`.

   Example -- adding "Credit Note" to Sales:
   ```json
   { "name": "credit-note", "label": "Credit Note" }
   ```

2. **`tools/app-shell/src/windows/registry.js`** -- Add a loader entry in `windowLoaders`:
   ```js
   '<window-slug>': () => import('@generated/<window-slug>/generated/web/<window-slug>/index.jsx'),
   ```

3. **`tools/app-shell/src/App.jsx`** -- Add a mockData import in `loadAllMockData()`:
   ```js
   import('@generated/<window-slug>/generated/web/<window-slug>/mockData.js'),
   ```
```

**Step 2: Update the "Regenerate All Entities" section**

The loop at the bottom of the skill should list all windows from menu.json. Replace the hardcoded list with a note:

```
## Regenerate All Entities

After generator changes, regenerate all windows listed in `tools/app-shell/src/menu.json`:

```bash
# Extract all window slugs from menu.json
WINDOWS=$(node -e "
import m from './tools/app-shell/src/menu.json' with { type: 'json' };
console.log(m.menu.flatMap(g => g.items.map(i => i.name)).join(' '));
")

for dir in $WINDOWS; do
  [ -f "artifacts/$dir/schema-curated.json" ] || continue
  node cli/src/generate-contract.js "artifacts/$dir/schema-curated.json" \
    "artifacts/$dir/rules-curated.json"
  node cli/src/generate-frontend.js "artifacts/$dir/contract.json"
  node cli/src/generation-log.js "$dir" "<trigger>"
done
```
```

**Step 3: Commit**

```bash
git add .claude/skills/generate-ui.md
git commit -m "feat: update generate-ui skill with AI menu placement rules"
```

---

### Task 6: Verify in browser

**Files:** None (verification only)

**Step 1: Start the dev server**

```bash
cd tools/app-shell && npm run dev
```

**Step 2: Verify with chrome-devtools MCP**

- Navigate to localhost:3102
- Login
- Verify sidebar shows 5 collapsible groups
- Click group headers to collapse/expand
- Click a window item to navigate
- Take a screenshot to confirm

**Step 3: Run all tests**

```bash
node --test 'cli/test/*.test.js'
```

Expected: all pass
