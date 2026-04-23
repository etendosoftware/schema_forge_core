# App Shell Functional Flows

## Scope

`tools/app-shell` is the user-facing Schema Forge SPA shell. It owns:

- public onboarding and environment entry
- authenticated shell navigation and layout chrome
- dynamic loading of generated/custom windows
- shared entity list/detail data behavior through `useEntity`
- OAuth2 consent and OAuth2 client administration pages
- PWA update detection and cache recovery behavior

This document is intentionally functional, not architectural. Every statement below is grounded in the current worktree code or tests.

Automated coverage note: the current automated evidence is mostly source-shape, hook-level, and build-level `node:test` coverage. It is not full browser E2E coverage, so each flow below explicitly says when manual verification is still required.

## Route surface

| Area | Entry path | Current behavior | Evidence |
|---|---|---|---|
| Public access | `/onboarding`, `/login` | `/onboarding` is the only public entry page. `/login` redirects to `/onboarding`. | `tools/app-shell/src/App.jsx` |
| Authenticated shell | `/dashboard`, `/first-steps`, `/sales`, `/inventory`, `/purchases`, `/accounting`, `/reports`, `/report-viewer`, `/crm`, `/hr`, `/projects`, `/smart-scan`, `/oauth2-clients`, `/authorize`, `/quick-sales-order`, `/quick-purchase-order`, `/artifacts`, `/artifacts/:windowName` | These routes render inside `AppLayout` and require `AuthGuard`. | `tools/app-shell/src/App.jsx`, `tools/app-shell/src/layout/AppLayout.jsx` |
| Generated/custom windows | `/:windowName`, `/:windowName/:recordId` | Loads the matching generated or custom window and optionally passes a record context. | `tools/app-shell/src/windows/WindowLoader.jsx`, `tools/app-shell/src/windows/registry.js` |
| Menu-driven report links | `/report-viewer?category=purchases|inventory|finance` | Menu items can override the route with `item.path`, so report entries navigate to the shared report viewer instead of the generic window route. | `tools/app-shell/src/menu.json`, `tools/app-shell/src/components/layout/SideMenu/SideMenu.jsx` |

Any authenticated route can also be opened with `?embedded=1`; in that mode the shell keeps the routed page but hides the side menu, top bar, command palette, and copilot widget.

## Testable flows

### 1. Onboarding and access entry

- **User goal / entry point:** Open `/onboarding`, sign in or register, then enter the first available environment.
- **Main path behavior:**
  - `AuthGuard` redirects unauthenticated protected traffic to `/onboarding`.
  - `OnboardingPage` validates the platform token in `localStorage`.
  - Register/login calls the `/sws/go/register` or `/sws/go/login` endpoints.
  - After platform auth, the page fetches `/sws/go/environments`.
  - If at least one environment exists, it auto-enters the first one, stores `sf_auth_token`, user, role, and org context, clears caches, and redirects to `/dashboard`.
  - If no environments exist, the page switches to the environment creation flow.
- **Failure or edge behavior:**
  - An invalid stored platform token is removed and the page falls back to the register view.
  - Register/login failures stay on the onboarding page and surface inline errors.
  - Environment login failures currently surface browser `alert()` messages.
- **Automated evidence:**
  - `tools/app-shell/test/pwa.test.js` verifies that `OnboardingPage.jsx` clears caches on environment login.
  - Route protection and onboarding branching are code-backed in `tools/app-shell/src/App.jsx` and `tools/app-shell/src/pages/OnboardingPage.jsx`, but are not covered by a full browser test.
- **Manual verification path:**
  1. Open `/onboarding` with no `sf_platform_token` or `sf_auth_token` in `localStorage`.
  2. Complete register or login.
  3. If the account already has an environment, confirm the browser lands on `/dashboard`.
  4. Clear `sf_auth_token`, open `/dashboard`, and confirm the browser is redirected back to `/onboarding`.

### 2. Authenticated shell and navigation chrome

- **User goal / entry point:** Work inside the authenticated app shell after login.
- **Main path behavior:**
  - Protected routes render inside `AppLayout`.
  - `AppLayout` provides the side menu, top bar, command palette, copilot widget, favorites provider, page metadata provider, and sidebar provider.
  - The side menu resolves links with `item.path || item.name`, so report entries can point to `/report-viewer?category=...` while standard windows use `/<slug>`.
  - The shell always exposes an artifacts entry via `/artifacts`.
- **Failure or edge behavior:**
  - `?embedded=1` removes shell chrome and left-margin spacing while still rendering the current route content.
  - Hidden groups/items from `menu.json` are filtered out of the visible menu.
- **Automated evidence:**
  - `tools/app-shell/src/windows/__tests__/registry.test.js` verifies that menu groups are built from `menu.json` and that items keep the expected name/label shape.
  - The shell chrome itself is code-backed in `tools/app-shell/src/layout/AppLayout.jsx` and `tools/app-shell/src/components/layout/SideMenu/SideMenu.jsx`; there is no browser automation for the layout behavior.
- **Manual verification path:**
  1. Sign in and open `/dashboard`.
  2. Confirm the side menu, top bar, command palette, and copilot widget are visible.
  3. Use the menu entry that targets `/report-viewer?category=purchases` and confirm the URL keeps the query string.
  4. Re-open the same route with `?embedded=1` and confirm the shell chrome is hidden while the routed page still renders.

### 3. Generated/custom window loading

- **User goal / entry point:** Open a generated or custom Schema Forge window by slug, optionally with a record id.
- **Main path behavior:**
  - `registry.js` builds a window map from `menu.json`.
  - Loader resolution order is: `customLoaders` → generated `windowLoaders` → `PlaceholderWindow`.
  - `WindowLoader` reads `:windowName` and optional `:recordId`, dynamically imports the component, and passes `token`, `apiBaseUrl`, `window`, `windowName`, and `recordId`.
- **Failure or edge behavior:**
  - If the slug is not present in the window map, the page shows `Window "<name>" not found`.
  - If the loader import fails, the page shows `Failed to load window ...` plus the hint to check whether the component was generated.
  - Menu entries with explicit `path` values bypass this generic route and land on their dedicated page instead.
- **Automated evidence:**
  - `tools/app-shell/src/windows/__tests__/registry.test.js` verifies that every menu slug gets a window-map entry and loader metadata.
  - Dynamic import success/failure UI is code-backed in `tools/app-shell/src/windows/WindowLoader.jsx`; there is no automated render test for those states.
- **Manual verification path:**
  1. Open a known window route such as `/sales-order`.
  2. Open `/sales-order/<record-id>` and confirm the window still loads with a record context.
  3. Open `/unknown-window` and confirm the not-found error state is rendered.
  4. Open `/report-viewer?category=inventory` and confirm it uses the explicit report viewer route rather than the generic `:windowName` loader.

### 4. Entity list/detail data flow

- **User goal / entry point:** Browse a window list, open a record, create/update/delete records, and work with child rows.
- **Main path behavior:**
  - `useEntity` fetches the first page in batches of 75 rows and exposes `loadMore()` for infinite pagination.
  - Sorting is tracked in hook state and can switch to the companion `$_identifier` field when present so foreign-key sorts are alphabetical.
  - Selecting a row or loading by id fetches the full record and its children.
  - `handleNew()` requests `/<entity>/defaults`, normalizes returned values, and pre-fills the form when defaults exist.
  - New records use `POST`; existing records use `PATCH` with changed fields only.
  - Child-row creation posts `parentId`, then refreshes both children and the header record so derived totals stay current.
- **Failure or edge behavior:**
  - List refresh and pagination logout on HTTP 401.
  - If the defaults endpoint fails, the form still opens with an empty object.
  - Partial or empty batches stop pagination.
  - Save/delete/process failures surface `saveError` and toast feedback.
- **Automated evidence:**
  - `tools/app-shell/src/hooks/__tests__/useEntity-pagination.test.js` verifies first-page and subsequent-page batch windows, sort handling, retry behavior for the default `creationDate` sort, empty datasets, and fetch failures.
  - `tools/app-shell/src/hooks/__tests__/useEntity-defaults.test.js` verifies the defaults URL, bearer header use, non-OK handling, network-error fallback, and missing-defaults fallback.
- **Manual verification path:**
  1. Open a generated window such as `/sales-order`.
  2. Scroll past the first page and confirm additional rows load after the first 75.
  3. Start a new record and confirm defaults appear when the backend exposes them; if the endpoint is unavailable, confirm the form still opens.
  4. Open a record with child lines, add a line, and confirm both the child list and header data refresh.
  5. Expire or remove the auth token, trigger a list refresh, and confirm the session is forced back through the auth flow.

### 5. OAuth2 authorization consent

- **User goal / entry point:** Approve or deny an OAuth2 client connection at `/authorize`.
- **Main path behavior:**
  - With `client_id`, `redirect_uri`, `code_challenge`, and `response_type=code`, the page renders a consent screen.
  - Missing `scope` defaults to `neo:read neo:write`.
  - Approve posts to `/oauth2/authorize` with the bearer token and PKCE parameters, then redirects to the returned `redirect_url`.
  - Without a full OAuth request, the page shows the generic connection landing screen and the derived MCP server URL.
- **Failure or edge behavior:**
  - Deny redirects back to `redirect_uri` with `error=access_denied` and preserves `state` when present.
  - Failed authorization shows an inline error state.
  - Action buttons are disabled while authorization is in progress.
- **Automated evidence:**
  - `tools/app-shell/test/AuthorizePage.test.js` verifies route parameter parsing, default scopes, PKCE gating, consent-vs-landing branching, POST target and headers, redirect handling, deny handling, supported scopes, and disabled-button behavior.
- **Manual verification path:**
  1. Open `/authorize` with no query string and confirm the connection landing screen appears.
  2. Open `/authorize?client_id=test-client&redirect_uri=https://example.test/cb&code_challenge=abc&response_type=code&state=xyz` while authenticated.
  3. Click **Deny** and confirm the browser redirects to the callback URL with `error=access_denied` and `state=xyz`.
  4. Repeat and click **Authorize** against a live backend to confirm redirect to the backend-provided `redirect_url`.

### 6. OAuth2 client administration

- **User goal / entry point:** Manage MCP/OAuth2 clients at `/oauth2-clients`.
- **Main path behavior:**
  - The page fetches clients on mount and on manual refresh.
  - It shows either an empty-state call to action or a table with name, client id, user, role, scopes, and active status.
  - Row actions support edit, regenerate secret, revoke tokens, and delete.
  - Regenerating a secret can reveal a one-time secret dialog; deleting and token revocation use confirmation dialogs.
  - Client IDs are copyable from the table.
- **Failure or edge behavior:**
  - Fetch failures clear the list and show a toast error.
  - Regenerate/delete/revoke actions are explicitly destructive and warn that active integrations will stop working.
- **Automated evidence:**
  - `tools/app-shell/test/OAuth2ClientsPage.test.js` verifies the mounted fetch pattern, empty-state messaging, expected table columns, destructive confirmation usage, secret reveal dialog flow, row actions, client-id copy affordance, active/inactive badge behavior, and fetch-failure toast behavior.
- **Manual verification path:**
  1. Open `/oauth2-clients` while authenticated.
  2. Confirm either the empty state or the populated table appears.
  3. Create a client, regenerate its secret, and confirm the reveal dialog shows the new secret when the backend returns one.
  4. Use **Revoke Tokens** and **Delete** from the row menu and confirm the destructive confirmation copy matches the intended action.

### 7. PWA update and recovery behavior

- **User goal / entry point:** Keep the SPA fresh after deploys and avoid stale cached assets during environment entry.
- **Main path behavior:**
  - Vite PWA is configured in `autoUpdate` mode with outdated-cache cleanup.
  - `ServiceWorkerManager` calls `checkForUpdate()` on every route change.
  - `useServiceWorker()` also checks for updates when the tab becomes visible and reloads on `controllerchange` so the new worker takes over immediately.
  - Production builds fingerprint JS/CSS assets so the precache points at immutable filenames.
  - On environment login, `OnboardingPage` clears caches before redirecting to `/dashboard`.
- **Failure or edge behavior:**
  - If cache deletion fails during environment login, the code only warns in the console and continues.
  - `clearServiceWorkerStateAndReload()` exists as a last-resort recovery path, but it is a hook utility, not a currently exposed route action.
  - `UpdateToast.jsx` exists as a persistent update-notification helper, but `App.jsx` does not currently wire it into the visible shell flow.
- **Automated evidence:**
  - `tools/app-shell/test/pwa.test.js` verifies the PWA plugin configuration, route-based service-worker wiring in `App.jsx`, hook exports in `useServiceWorker.js`, cache-clearing code in `OnboardingPage.jsx`, build fingerprinting, and required public icon assets.
- **Manual verification path:**
  1. Run a production build and serve it with a registered service worker.
  2. Deploy or serve a newer build.
  3. Navigate to another route or refocus the tab and confirm the app reloads onto the new assets.
  4. Re-enter an environment from `/onboarding` and confirm the browser reaches `/dashboard` without serving stale cached shell assets.

## Current coverage gaps worth knowing

- There is no end-to-end browser test that walks from `/onboarding` through `/dashboard` into a generated window.
- There is no automated render test for `WindowLoader` error states or `AppLayout` embedded mode.
- `useEntity` child-row refresh behavior and 401 logout behavior are code-backed but not directly covered by a dedicated UI test.
- A fresh direct run of `tools/app-shell/src/auth/__tests__/api.test.js` currently fails because `tools/app-shell/src/auth/api.js` reads `window` during module import; treat that file as a pending test harness fix, not as a green automated proof point.
- OAuth2 and PWA coverage is strong at source/build level, but still not browser-level E2E.
