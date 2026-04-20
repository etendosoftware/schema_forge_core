# Apps SDK — Mock Installer

**Status:** Draft · 2026-04-20
**Related:** [etendo-apps-sdk.md](etendo-apps-sdk.md), [apps-sdk-styling.md](apps-sdk-styling.md)

## Context

SDK-hosted apps (`quick-order`, `spike-hello-app`) used to live as hardcoded
entries in `tools/app-shell/src/menu.json`. That made them look like any
other first-class shell window, which hides the fact that they are
**external artifacts** — served by their own Vite+BFF processes, talking to
Etendo through the JWT bridge.

We need a visible boundary: users (and demos) should see these apps as
*installable extensions*, not as shell features.

## Objective

Ship a minimal, mocked installer that makes the external nature of SDK apps
obvious, without building any backend. A real app lifecycle (upload,
permissions, registry sync) is out of scope — the goal is only to change
*what the shell shows* based on an install toggle.

## Design

### App catalog (single source of truth)

`tools/app-shell/src/apps-registry.js` exposes `APP_CATALOG`:

```js
{
  appId: 'quick-order',
  displayName: 'Quick Order',
  description: '...',
  version: '0.2.0',
  author: 'Etendo Apps SDK team',
  icon: 'ShoppingCart',
  iframeUrl: 'http://localhost:5174',
  menuGroup: 'Marketplace',
  menuEntries: [
    { name: 'quick-order-sales', label: 'Quick Order — Sales' },
    { name: 'quick-order-purchase', label: 'Quick Order — Purchase' },
  ],
}
```

`INTERNAL_APPS` and `findAppById` are kept as backward-compat exports for
the Vite token-minting plugin and the iframe-host windows.

### Installed state

`tools/app-shell/src/hooks/useInstalledApps.js` persists a list of
installed `appId`s in `localStorage` under `etendo.installedApps`. It
exposes:

- `useInstalledApps()` — React hook using `useSyncExternalStore`
- `installApp(appId)` / `uninstallApp(appId)` / `isInstalled(appId)`

Cross-tab syncing uses the browser's native `storage` event; same-tab
updates dispatch a custom `etendo:installed-apps-changed` event (the
`storage` event does not fire in the writing tab).

### Dynamic menu

`buildMenuGroups(installedAppIds)` merges catalog-declared menu entries
into the shell menu at the group named in `menuGroup` (currently only the
`Marketplace` group is targeted). `App.jsx` subscribes via
`useInstalledApps()` and rebuilds `menuGroups` on every change, so
installing or uninstalling takes effect immediately.

`buildWindowMap()` still registers loaders for every SDK app entry even
when the app is not installed, so a stale link or direct URL navigation
never falls through to `PlaceholderWindow`.

### App Store page

`tools/app-shell/src/pages/AppStorePage.jsx` renders the catalog as cards:
description, version, author, iframe origin, menu entries it will inject,
and an Install / Uninstall toggle with a simulated spinner (~900 ms). The
route `/app-store` is always present; the menu entry lives in the new
`Marketplace` group.

## Out of scope

- Real backend registry, descriptor uploads, permissions, signatures
- Third-party origin support (catalog is hardcoded to our own dev servers)
- Version/update flows
- Per-user install state (localStorage is per-browser)

## Migration

- Removed `Spike Apps` group and `quick-order-sales`/`quick-order-purchase`
  items from `menu.json`
- Added `Marketplace` group with the single `App Store` entry
- SDK app menu entries now come from `APP_CATALOG` via `buildMenuGroups`
