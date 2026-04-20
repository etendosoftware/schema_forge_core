/**
 * Catalog of external SDK apps the shell knows about.
 *
 * v1 per docs/proposals/etendo-apps-sdk.md §9 — hardcoded registry, DB-backed
 * is future work. This module also powers the mock App Store: each entry
 * advertises metadata (description, version, author, icon) and the menu
 * entries it should inject into the shell when installed.
 *
 * Apps are NOT listed in `menu.json` anymore — they appear in the sidebar
 * only after the user "installs" them from the App Store page.
 */
export const APP_CATALOG = [
  {
    appId: 'spike-hello-app',
    displayName: 'Hello App',
    description: 'Minimal spike that proves the SDK + JWT bridge end-to-end.',
    version: '0.1.0',
    author: 'Etendo Apps SDK team',
    icon: 'FlaskConical',
    iframeUrl: 'http://localhost:5173',
    menuGroup: 'Marketplace',
    menuEntries: [
      { name: 'spike-hello-app', label: 'Hello App (SDK)' },
    ],
  },
  {
    appId: 'quick-order',
    displayName: 'Quick Order',
    description: 'Lightweight POS-style draft creator for sales and purchase orders. Ships its own BFF, talks to NEO through the SDK.',
    version: '0.2.0',
    author: 'Etendo Apps SDK team',
    icon: 'ShoppingCart',
    iframeUrl: 'http://localhost:5174',
    menuGroup: 'Marketplace',
    menuEntries: [
      { name: 'quick-order-sales', label: 'Quick Order — Sales' },
      { name: 'quick-order-purchase', label: 'Quick Order — Purchase' },
    ],
  },
];

/**
 * Backward-compat export consumed by the Vite plugin that mints app tokens
 * and by the iframe host windows. Only the fields those callers need.
 */
export const INTERNAL_APPS = APP_CATALOG.map((a) => ({
  appId: a.appId,
  iframeUrl: a.iframeUrl,
  displayName: a.displayName,
}));

export function findAppById(appId) {
  return APP_CATALOG.find((a) => a.appId === appId) || null;
}

export function findAppByMenuEntry(menuName) {
  return APP_CATALOG.find((a) =>
    a.menuEntries.some((e) => e.name === menuName),
  ) || null;
}
