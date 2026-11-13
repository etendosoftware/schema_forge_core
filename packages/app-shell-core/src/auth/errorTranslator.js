/**
 * The translator registry core's own errors resolve their user-facing message through.
 *
 * Two core errors are built outside React and must carry a message the USER can read:
 *
 *  - {@link module:auth/networkError} — a request that never got an HTTP answer (ETP-5424);
 *  - {@link module:auth/staleSessionError} — a request whose session was replaced (ETP-5763).
 *
 * Each of them used to carry hardcoded English prose that reached the screen verbatim through
 * `err.message` (~150 UI sites render it as-is). They need the SAME translator, and they need
 * it to be ONE translator: two registries would leave whichever error registered second
 * permanently English, silently, with no error anywhere.
 *
 * Hence this module: the registry lives here and both error modules import it. The public
 * surface (`registerErrorTranslator` / `resetErrorTranslatorForTests`) is re-exported by
 * `networkError.js` and by `auth/index.js` unchanged, so every existing import site keeps
 * working.
 *
 * The host app registers the translator ONCE (`installErrorTranslator` in the app shell's
 * `i18n/errorTranslator.js`) and re-registers it on every locale change, so the message
 * follows the RENDERED locale.
 *
 * Core ships only the English fallbacks. It deliberately does not import the host's
 * dictionaries: the translator is registered once by the app shell, the same ambient pattern
 * as `registerApiSession`, so a plain module that throws needs no React context.
 */

let errorTranslator = null;

/**
 * Registers the function that turns a message key into user-facing text. Called by the host app
 * once its i18n is ready, and again on a locale switch — a later registration replaces the
 * earlier one.
 *
 * The translator follows the app's own `translate(key, params)` contract: returning the key
 * unchanged means "missing", and the caller falls back to its English default.
 *
 * @param {(key: string, params?: object) => string} fn
 * @returns {() => void} unregister — only drops the translator if it is still this one
 */
export function registerErrorTranslator(fn) {
  const registration = typeof fn === 'function' ? fn : null;
  errorTranslator = registration;
  return function unregister() {
    if (errorTranslator === registration) errorTranslator = null;
  };
}

/** Test seam: drops the registered translator so one suite cannot decide the next one's text. */
export function resetErrorTranslatorForTests() {
  errorTranslator = null;
}

/**
 * Resolves a message key to user-facing text, or `null` when it cannot be resolved.
 *
 * Never throws: a translator that is not ready yet, returns nothing, or returns the key itself
 * all mean "no translation" — the caller falls back to its English default. A translator that
 * throws is treated the same way: an error thrown while BUILDING an error message would
 * replace the failure it describes with an unrelated one.
 *
 * @param {string} key the message key
 * @param {object} [params] interpolation parameters for the translator
 * @returns {string|null} the translated text, or `null` when there is none
 */
export function resolveErrorMessage(key, params = {}) {
  if (!errorTranslator) return null;
  try {
    const text = errorTranslator(key, params);
    return typeof text === 'string' && text !== '' && text !== key ? text : null;
  } catch {
    return null;
  }
}
