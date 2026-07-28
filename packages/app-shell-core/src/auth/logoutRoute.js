const DEFAULT_SAFE_DESTINATION = '/';
const URL_BASE = 'https://logout-route.invalid';

function isInternalPath(value) {
  return typeof value === 'string'
    && value.startsWith('/')
    && !value.startsWith('//')
    && !value.includes('\\');
}

function parseInternalPath(value) {
  if (!isInternalPath(value)) return null;

  try {
    // Reject malformed percent escapes instead of allowing URL to normalize them.
    decodeURIComponent(value);
    const url = new URL(value, URL_BASE);
    if (url.origin !== URL_BASE) return null;
    const normalized = `${url.pathname}${url.search}${url.hash}`;
    return normalized === value ? url : null;
  } catch {
    return null;
  }
}

function containsLogoutLoop(destination) {
  let current = destination;

  // A bounded traversal protects against nested returnTo values without making
  // the route responsible for product-specific redirect policies.
  for (let depth = 0; depth < 8; depth += 1) {
    const url = parseInternalPath(current);
    if (!url || url.pathname === '/logout') return true;

    const returnTo = url.searchParams.get('returnTo');
    if (!returnTo) return false;
    current = returnTo;
  }

  return true;
}

/**
 * Returns an internal, non-recursive destination suitable for a logout
 * redirect. Callers deliberately configure this value; request parameters are
 * never accepted as redirect destinations.
 */
export function resolveLogoutDestination(destination, fallback = DEFAULT_SAFE_DESTINATION) {
  const fallbackPath = parseInternalPath(fallback) && !containsLogoutLoop(fallback)
    ? fallback
    : DEFAULT_SAFE_DESTINATION;

  return parseInternalPath(destination) && !containsLogoutLoop(destination)
    ? destination
    : fallbackPath;
}
