/**
 * Hardcoded registry of internal apps allowed to mint tokens via
 * /sws/apps/token and be embedded by the iframe host.
 *
 * v1 per docs/proposals/etendo-apps-sdk.md §9. A DB-backed registry is future
 * work — this module becomes the fallback/seed at that point.
 */
export const INTERNAL_APPS = [
  {
    appId: 'spike-hello-app',
    iframeUrl: 'http://localhost:5173',
    displayName: 'Spike Hello App',
  },
  {
    appId: 'quick-order',
    iframeUrl: 'http://localhost:5174',
    displayName: 'Quick Order',
  },
];

export function findAppById(appId) {
  return INTERNAL_APPS.find((a) => a.appId === appId) || null;
}
