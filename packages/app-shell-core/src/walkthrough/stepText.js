/**
 * Locale resolution for walkthrough copy.
 *
 * Flow JSON stores KEYS, never sentences — so every hint, title and label is
 * locale-resolved. `useUI()` echoes the key back when it is missing, which is an
 * acceptable developer signal but is NOT acceptable to show a client: a Spanish
 * user must never read `walkthroughSalesOrderPickPartnerBody` on screen.
 *
 * `resolveStepText` therefore does an explicit presence check and, on a miss,
 * falls back to a generic translated sentence (and warns once per key in dev).
 * The complementary guarantee — that a test FAILS when a key is missing from a
 * shipped locale — is `findMissingFlowLabelKeys` in `flowSchema.js`.
 */

/** Key that must exist in every shipped locale; shown when a step key is missing. */
export const MISSING_TEXT_FALLBACK_KEY = 'walkthroughMissingText';

const warned = new Set();

function hasLabel(dictionary, key) {
  const labels = dictionary?.genericLabels;
  return !!labels && Object.prototype.hasOwnProperty.call(labels, key);
}

/**
 * @param {object} dictionary locale dictionary (`{genericLabels: {...}}`)
 * @param {string|null|undefined} key
 * @param {{warn?: boolean}} [options]
 * @returns {string} the translated text, the translated generic fallback, or
 *   `''` — never the raw key.
 */
export function resolveStepText(dictionary, key, options = {}) {
  const { warn = true } = options;
  if (typeof key !== 'string' || key.trim().length === 0) return '';

  if (hasLabel(dictionary, key)) return dictionary.genericLabels[key];

  if (warn && !warned.has(key)) {
    warned.add(key);
    // eslint-disable-next-line no-console
    console.warn(`[walkthrough] missing locale key "${key}" — showing generic fallback`);
  }

  if (hasLabel(dictionary, MISSING_TEXT_FALLBACK_KEY)) {
    return dictionary.genericLabels[MISSING_TEXT_FALLBACK_KEY];
  }
  // Both the key and the fallback are missing: render nothing rather than leak
  // an internal identifier into the UI.
  return '';
}

/** Test helper: forgets which keys have already been warned about. */
export function resetStepTextWarnings() {
  warned.clear();
}
