# UI Discovery Guide — agent-browser + Playwright

This guide explains how to explore the live UI interactively using `agent-browser`
and then translate discoveries into automated Playwright E2E tests.

## Workflow

```
1. Start dev server             →  make dev
2. Explore with agent-browser   →  discover selectors, flows, edge cases
3. Update selectors.js          →  record what you found
4. Write Playwright test        →  automate the discovered flow
5. Run tests                    →  make test-e2e
```

## Tool: agent-browser

[agent-browser](https://agent-browser.dev/) is a Rust CLI for browser automation designed for AI agents.
It outputs a compact accessibility tree where each element gets a unique ref (`@e1`, `@e2`).

**Install:** `npm install -g agent-browser && agent-browser install`

### Key commands

| Command | Purpose |
|---------|---------|
| `agent-browser open <url>` | Navigate to URL |
| `agent-browser snapshot -i` | Accessibility tree with refs (main discovery tool) |
| `agent-browser screenshot <path>` | Visual screenshot |
| `agent-browser click @eN` | Click element by ref |
| `agent-browser fill @eN "text"` | Fill input field |
| `agent-browser type @eN "text"` | Type into element |
| `agent-browser select @eN "value"` | Select dropdown option |
| `agent-browser press Enter` | Press a key |
| `agent-browser get url` | Get current URL |
| `agent-browser get text @eN` | Get text content |
| `agent-browser wait 2000` | Wait N milliseconds |
| `agent-browser eval "js code"` | Run JavaScript in page |
| `agent-browser network requests` | See API calls |
| `agent-browser close` | Close browser |

### Typical discovery session

```bash
# 1. Open and login
agent-browser open http://localhost:3100
agent-browser snapshot -i
# → textbox "Username" [ref=e2], textbox "Password" [ref=e3], button "Sign in" [ref=e4]
agent-browser fill @e2 "admin"
agent-browser fill @e3 "admin"
agent-browser click @e4

# 2. Navigate to window
agent-browser wait 2000
agent-browser snapshot -i
# → find menu items, links
agent-browser click @e14   # e.g. "+ Order"
agent-browser wait 2000

# 3. Discover list view
agent-browser snapshot -i
# → heading "Orders", button "New Order" [ref=e26], columnheaders, rows

# 4. Discover detail form
agent-browser click @e26   # New Order
agent-browser wait 2000
agent-browser snapshot -i
# → textbox "Business Partner*" [ref=e30], combobox "Warehouse*" [ref=e25], button "Save" [ref=e22]

# 5. Screenshot for visual reference
agent-browser screenshot artifacts/e2e-report/discovery-sales-order.png

# 6. Close
agent-browser close
```

## Discovery checklist for a window

For each window, discover and document:

- [ ] **Login flow** — fields, button, redirect URL
- [ ] **Navigation** — how to reach the window (menu items, direct URL)
- [ ] **List view** — table structure, row selector, column headers
- [ ] **Search/filter** — search input, filter buttons
- [ ] **New record** — "New" button ref, form fields that appear
- [ ] **Form fields** — all inputs with names, types (textbox/combobox/spinbutton), required flag
- [ ] **Field dependencies** — e.g. Partner Address disabled until Business Partner selected
- [ ] **Save/Cancel** — button refs, success/error feedback (toasts)
- [ ] **Tabs** — child entity tabs (e.g. "Order Line", "Others")
- [ ] **Child table** — columns, "Add" button for child records

## From discovery to selectors.js

After exploring, update `tests/helpers/selectors.js` with real selectors:

```js
// Before (generic/guessed)
export const list = {
  newButton: '[data-testid="new-button"], button:has-text("New")',
};

// After (discovered via agent-browser)
export const list = {
  newButton: 'button:has-text("New Order")',  // actual button text
};
```

**Tip:** Use accessible names from `snapshot -i` directly in Playwright:
```js
// agent-browser shows: button "New Order" [ref=e26]
// Playwright equivalent:
await page.getByRole('button', { name: 'New Order' }).click();
```

## From discovery to Playwright test

Use `tests/flows/` for full flow tests:

```js
import { test, expect } from '@playwright/test';

test.describe('Sales Order CRUD', () => {
  test.beforeEach(async ({ page }) => {
    // Login (discovered via agent-browser)
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Username' }).fill('admin');
    await page.getByRole('textbox', { name: 'Password' }).fill('admin');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/dashboard');
  });

  test('list view loads with columns', async ({ page }) => {
    await page.goto('/sales-order');
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Business Partner' })).toBeVisible();
  });

  test('can open new order form', async ({ page }) => {
    await page.goto('/sales-order');
    await page.getByRole('button', { name: 'New Order' }).click();
    await expect(page.getByRole('heading', { name: 'New Order' })).toBeVisible();
    // Required fields visible
    await expect(page.getByRole('textbox', { name: /Business Partner/ })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Warehouse/ })).toBeVisible();
  });
});
```

## Alternative: Chrome DevTools MCP

If `agent-browser` is not available, you can use Chrome DevTools MCP tools:

| MCP Tool | Equivalent agent-browser |
|----------|--------------------------|
| `navigate_page` | `agent-browser open <url>` |
| `take_snapshot` | `agent-browser snapshot -i` |
| `take_screenshot` | `agent-browser screenshot <path>` |
| `click` | `agent-browser click @eN` |
| `fill` | `agent-browser fill @eN "text"` |
| `evaluate_script` | `agent-browser eval "js"` |
| `list_network_requests` | `agent-browser network requests` |

**Prefer agent-browser** — it uses fewer tokens and provides direct element refs.

## Tips

- **Start with smoke tests** — just verify windows load. Then add flow tests.
- **One flow per file** in `tests/flows/` — keeps tests focused and easy to run individually.
- **Use role-based selectors** — `getByRole('button', { name: 'Save' })` is more stable than CSS selectors.
- **Re-discover after UI changes** — when the pipeline regenerates a window, run a quick `snapshot -i` to verify selectors.
- **Screenshots on failure** — Playwright auto-captures on failure. Check `artifacts/e2e-report/`.
