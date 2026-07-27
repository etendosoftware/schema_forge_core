import { useWindowAccess } from './useWindowAccess.js';
import { useUI } from '../i18n/useUI.js';

/**
 * ETP-4520 — Generic route guard for the per-window access tier.
 *
 * Renders the "no access" message when the current user's tier for `windowId`
 * resolves to `"none"` (including while the map hasn't loaded yet — fails
 * closed, see `useWindowAccess`), blocking the render before any children
 * mount — so no data fetch happens for a window the user has no access to.
 * Otherwise renders `children` unchanged.
 *
 * Wired generically into every generated window's Page component by
 * `generate-frontend.js` (`cli/src/generate-frontend.js`) whenever the
 * contract carries a real AD_Window_ID (`window.id`).
 *
 * Consumers must add a `windowAccessDenied` key to their locale dictionaries'
 * `genericLabels` (both `en_US.json` and `es_ES.json`) — this package does not
 * ship its own locale files (see `docs/i18n-guide.md` in the functional repo).
 */
export function WindowAccessGuard({ windowId, children = null }) {
  const tier = useWindowAccess(windowId);
  const ui = useUI();
  if (tier === 'none') {
    return (
      <div
        className="flex h-full w-full items-center justify-center p-10 text-center text-sm text-muted-foreground"
        data-testid="window-access-denied"
      >
        {ui('windowAccessDenied')}
      </div>
    );
  }
  return children;
}
