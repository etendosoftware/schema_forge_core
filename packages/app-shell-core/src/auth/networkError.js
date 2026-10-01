/**
 * The error {@link apiFetch} throws when a request never got an HTTP answer (ETP-5424).
 *
 * The browser reports a dropped connection as `TypeError('Failed to fetch')` — engine-specific
 * English prose that ~150 UI sites rendered verbatim through `err.message`. This error replaces
 * it, and its `message` is ALREADY the user-facing text, localized when the host app registered
 * a translator, so every one of those sites shows the right sentence without being touched.
 *
 * The message is resolved eagerly, at construction: `err.message` is read synchronously by
 * `toast.error`, `setError(err.message)` and friends, and a getter resolved later would depend on
 * whatever locale happens to be active by then. The key stays on `messageKey` for a caller that
 * prefers to translate it itself.
 *
 * Core ships only the English fallback. It deliberately does not import the host's dictionaries:
 * the translator is registered once by the app shell, the same ambient pattern as
 * `registerApiSession`, so a plain module that throws this needs no React context.
 */

export const NETWORK_ERROR_FALLBACK = 'Could not complete the action. Try again.';
export const NETWORK_ERROR_KEY = 'networkErrorRetry';
/**
 * Applied to an apiFetch READ (GET, HEAD, OPTIONS) that passes no `timeout` of its own. Writes get
 * no default — a cut-off write may still commit, and the retry would double-submit. `0` disables it.
 */
export const DEFAULT_API_TIMEOUT_MS = 60000;

let errorTranslator = null;

/**
 * Registers the function that turns {@link NETWORK_ERROR_KEY} into user-facing text. Called by
 * the host app once its i18n is ready, and again on a locale switch — a later registration
 * replaces the earlier one.
 *
 * The translator follows the app's own `translate(key, params)` contract: returning the key
 * unchanged means "missing", and falls back to {@link NETWORK_ERROR_FALLBACK}.
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
 * Never throws: an error constructor that throws would replace the failure it describes with an
 * unrelated one. A translator that is not ready yet, returns nothing, or returns the key itself
 * all mean the same thing — use the English fallback.
 */
function resolveMessage(key, params) {
  if (!errorTranslator) return NETWORK_ERROR_FALLBACK;
  try {
    const text = errorTranslator(key, params);
    return typeof text === 'string' && text !== '' && text !== key ? text : NETWORK_ERROR_FALLBACK;
  } catch {
    return NETWORK_ERROR_FALLBACK;
  }
}

export class NetworkError extends Error {
  /**
   * @param {object} [options]
   * @param {'offline'|'timeout'} [options.reason] `offline` — the transport failed (no network,
   *   DNS, CORS, connection reset, body stream cut); `timeout` — apiFetch's own timer gave up.
   * @param {unknown} [options.cause] the original error, kept for diagnostics
   */
  constructor({ reason = 'offline', cause } = {}) {
    super(resolveMessage(NETWORK_ERROR_KEY, {}), cause === undefined ? undefined : { cause });
    this.name = 'NetworkError';
    this.code = 'NETWORK';
    this.messageKey = NETWORK_ERROR_KEY;
    this.reason = reason;
  }
}

/**
 * True for a {@link NetworkError}. Checks `code` as well as the class, so an error built by a
 * second copy of this module (a duplicated bundle, another realm) is still recognized. An
 * AbortError is never one — a cancellation is not a network failure.
 */
export function isNetworkError(err) {
  return err instanceof NetworkError || err?.code === 'NETWORK';
}
