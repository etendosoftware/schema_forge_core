import { useAuth } from './AuthContext.jsx';

/**
 * ETP-4520 — Resolves the current user's access tier for a given AD Window.
 *
 * Reads the `windowAccess` map populated on `AuthContext` at role-selection
 * time (see `AuthProvider`'s `fetchWindowAccess`). Fails CLOSED, never open:
 * - the map hasn't loaded yet (still `{}`) → `"none"`
 * - `windowId` is missing/falsy → `"none"`
 * - `windowId` has no entry in the map → `"none"` (matches the backend
 *   contract: a missing key means no access, same as an explicit `"none"`)
 *
 * This return value gates both button/field visibility (cosmetic) and the
 * route guard (`"none"` blocks the render before any data fetch) — so a
 * caller must never treat an unresolved/loading state as `"full"`.
 *
 * @param {string|null|undefined} windowId - AD_Window_ID to look up.
 * @returns {"none"|"read-only"|"full"}
 */
export function useWindowAccess(windowId) {
  const { windowAccess } = useAuth();
  if (!windowId) return 'none';
  return windowAccess?.[windowId] ?? 'none';
}

/**
 * ETP-4520 — Resolves a named capability flag (e.g. `"showAccountingFields"`)
 * from the `capabilities` map populated on `AuthContext` at role-selection
 * time. Fails CLOSED: an unloaded map or a missing key both resolve `false`.
 *
 * @param {string|null|undefined} key - Capability key to look up.
 * @returns {boolean}
 */
export function useHasCapability(key) {
  const { capabilities } = useAuth();
  if (!key) return false;
  return !!capabilities?.[key];
}
