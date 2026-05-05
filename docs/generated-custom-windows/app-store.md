# App Store

## Scope

The App Store is an app-shell surface, not a generated entity window. It is exposed through the hidden Marketplace menu group and the `/app-store` route, then installs or uninstalls SDK apps from the local catalog.

## Entry Points

- Route: `/app-store`
- Hidden menu item: Marketplace / App Store
- Unlock: typing `playstoreon` enables the Marketplace group for the current browser.
- Lock: typing `playstoreoff` hides the Marketplace group again.

## Behavior

The page reads available apps from `APP_CATALOG` and installed app ids from the installed-apps store. Installing an app persists the app id in browser storage, and `buildMenuGroups()` injects that app's menu entries into their configured shell groups.

The App Store does not use `artifacts/app-store`, generated mock data, or `windowLoaders`. Its menu entry is a direct route handled by `App.jsx`, similar to the quick order direct routes.

## Verification

- With the store locked, Marketplace is absent from the side menu.
- After `playstoreon`, Marketplace appears and includes App Store.
- Installing Quick Order adds its Sales and Purchases entries without requiring Marketplace to stay unlocked.
- Uninstalling Quick Order removes those injected menu entries.
- The app-shell wiring test treats `app-store` as a special page, so it must not require generated artifacts or registry window loaders.
