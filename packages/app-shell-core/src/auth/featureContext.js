/**
 * ETP-5646 — the feature a request is made on behalf of, as bounded attribution.
 *
 * A feature key names an actionable menu entry: `window.sales-order`, `process.not-posted-documents`,
 * `report.tax-report`, `custom.invoice-inbox`. It is a stable, low-cardinality label the SPA sends
 * on first-party NEO requests in {@link FEATURE_HEADER}, so a backend log line can be joined to the
 * RUM view that caused it.
 *
 * It is ATTRIBUTION ONLY. The backend never takes user or tenant from it (they come from the
 * authenticated session) and drops it when it does not match {@link FEATURE_KEY_PATTERN}.
 *
 * State is module-level on purpose: one JS realm is one browser tab, so two tabs never share a
 * feature, and concurrent requests of one tab each read it at the moment they are dispatched.
 * The feature is bound to the account it was set under (`scope`): a request of another account, or
 * of none (logout, identity switch), never carries it, so a label cannot cross identities. A
 * feature set before an account is bound is adopted by the first one.
 */

export const FEATURE_HEADER = 'X-Etendo-Feature';
export const FEATURE_KINDS = Object.freeze(['window', 'process', 'report', 'custom']);
export const FEATURE_KEY_MAX_LENGTH = 80;
export const FEATURE_KEY_PATTERN = /^(window|process|report|custom)\.[a-z0-9][a-z0-9-]{0,62}$/;

let active = null;

/** True for a well-formed, bounded feature key. */
export function isValidFeatureKey(key) {
  return typeof key === 'string'
    && key.length <= FEATURE_KEY_MAX_LENGTH
    && FEATURE_KEY_PATTERN.test(key);
}

/**
 * Builds `<kind>.<id>` from a menu name; the id is lower-cased and anything outside `[a-z0-9-]`
 * becomes `-`. `null` when the kind is unknown or nothing usable is left.
 */
export function buildFeatureKey(kind, id) {
  if (!FEATURE_KINDS.includes(kind) || typeof id !== 'string') return null;
  const slug = id.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  const key = `${kind}.${slug}`;
  return isValidFeatureKey(key) ? key : null;
}

/**
 * Sets the feature of this tab, bound to `scope` (the account the tab is signed in as). An invalid
 * key clears it (never keeps a stale one).
 */
export function setActiveFeature(key, scope = null) {
  active = isValidFeatureKey(key) ? { key, scope: scope ?? null } : null;
  return active ? active.key : null;
}

/**
 * The tab's feature, or null when none is set or it belongs to another `scope`. A feature set
 * before any account was bound (a direct URL opened before the session resolved) has no scope and
 * applies to the account that binds next; once bound, a different account never inherits it.
 */
export function getActiveFeature(scope = null) {
  return active && (active.scope === null || active.scope === (scope ?? null)) ? active.key : null;
}

export function clearActiveFeature() {
  active = null;
}

/**
 * Whether `url` is first-party for `base`: a relative URL, or one on the base's own origin.
 * Anything else (a third-party host, an unparsable URL) never receives the header, so a feature
 * label does not leak to another service nor turn its request into a CORS preflight.
 */
export function isFirstPartyUrl(url, base) {
  if (typeof url !== 'string') return false;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return !url.startsWith('//');
  try {
    const origin = typeof location !== 'undefined' ? location.origin : undefined;
    const target = new URL(url).origin;
    if (base && /^[a-z][a-z0-9+.-]*:\/\//i.test(base)) return target === new URL(base).origin;
    return Boolean(origin) && target === origin;
  } catch {
    return false;
  }
}

/**
 * `{ [FEATURE_HEADER]: key }` for a first-party request, else `{}`. `explicit` (the `feature`
 * request option) wins over the tab's active feature (which must match `scope`); an invalid one is dropped, not repaired.
 */
export function featureRequestHeaders({ url, base, explicit, scope = null } = {}) {
  const key = explicit !== undefined ? (isValidFeatureKey(explicit) ? explicit : null) : getActiveFeature(scope);
  if (!key || !isFirstPartyUrl(url, base)) return {};
  return { [FEATURE_HEADER]: key };
}
