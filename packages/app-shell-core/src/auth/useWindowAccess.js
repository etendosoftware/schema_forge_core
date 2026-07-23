import { useAuth } from './AuthContext.jsx';

const VALID_ACCESS_TIERS = new Set(['none', 'read-only', 'full']);

/**
 * ETP-4520 — Resolves the current user's access tier for a given AD Window.
 *
 * Reads the `windowAccess` map populated on `AuthContext` at role-selection
 * time (see `AuthProvider`'s `fetchWindowAccess`). Fails CLOSED, never open:
 * - the map hasn't loaded yet (still `{}`) → `"none"`
 * - `windowId` is missing/falsy → `"none"`
 * - `windowId` has no entry in the map → `"none"` (matches the backend
 *   contract: a missing key means no access, same as an explicit `"none"`)
 * - the resolved value is anything other than one of the three known tiers
 *   (backend bug, typo, a future tier not yet handled here) → `"none"`
 *
 * This return value gates both button/field visibility (cosmetic) and the
 * route guard (`"none"` blocks the render before any data fetch) — so a
 * caller must never treat an unresolved/loading/unrecognized state as
 * `"full"`.
 *
 * @param {string|null|undefined} windowId - AD_Window_ID to look up.
 * @returns {"none"|"read-only"|"full"}
 */
export function useWindowAccess(windowId) {
  const { windowAccess } = useAuth();
  if (!windowId) return 'none';
  const tier = windowAccess?.[windowId];
  return VALID_ACCESS_TIERS.has(tier) ? tier : 'none';
}

/**
 * ETP-4520 — Resolves a named capability flag (e.g. `"showAccountingFields"`)
 * from the `capabilities` map populated on `AuthContext` at role-selection
 * time. Fails CLOSED: an unloaded map, a missing key, or any value that
 * isn't strictly the boolean `true` (e.g. the string `"false"`, `1`, a
 * non-empty object) all resolve `false`.
 *
 * @param {string|null|undefined} key - Capability key to look up.
 * @returns {boolean}
 */
export function useHasCapability(key) {
  const { capabilities } = useAuth();
  if (!key) return false;
  return capabilities?.[key] === true;
}
