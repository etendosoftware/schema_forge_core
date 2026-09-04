/**
 * Minimal route-pattern matching for walkthrough steps.
 *
 * Deliberately NOT react-router's `matchPath`: a step pattern is authored in a
 * JSON file by a functional developer and only ever needs to answer one
 * question — "is the browser already on the screen this step lives on?".
 * Supporting `:param` and a trailing `*` covers every route shape this app
 * exposes (`/:windowName`, `/:windowName/:recordId`) and keeps this module
 * pure and directly unit-testable.
 */

function normalizePath(path) {
  if (typeof path !== 'string' || path.length === 0) return '/';
  const withLeading = path.startsWith('/') ? path : `/${path}`;
  // Drop a trailing slash (but keep the root "/") so "/contacts" and
  // "/contacts/" are the same screen.
  return withLeading.length > 1 && withLeading.endsWith('/')
    ? withLeading.slice(0, -1)
    : withLeading;
}

/**
 * @param {string} pattern e.g. "/contacts", "/sales-order/:recordId", "/reports/*"
 * @param {string} pathname the current `location.pathname`
 * @returns {boolean}
 */
export function matchRoutePattern(pattern, pathname) {
  if (typeof pattern !== 'string' || pattern.trim().length === 0) return false;

  const patternSegments = normalizePath(pattern).split('/');
  const pathSegments = normalizePath(pathname).split('/');

  for (let i = 0; i < patternSegments.length; i += 1) {
    const seg = patternSegments[i];
    if (seg === '*') return true; // wildcard swallows the rest
    if (i >= pathSegments.length) return false;
    if (seg.startsWith(':')) {
      // A named param must consume a NON-EMPTY segment.
      if (pathSegments[i].length === 0) return false;
      continue;
    }
    if (decodeSafe(pathSegments[i]) !== seg) return false;
  }

  return patternSegments.length === pathSegments.length;
}

function decodeSafe(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
