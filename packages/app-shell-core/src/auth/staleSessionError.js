/**
 * The error apiFetch throws when a request belongs to a session that has been superseded
 * (ETP-5763).
 *
 * ## What the error means
 *
 * The browser profile owns ONE session; every tab of it sends the same cookie. When the same
 * user has the same document open in two tabs, the first tab's action rotates the session (the
 * backend mints a fresh bearer / CSRF proof), and the SECOND tab's next request carries
 * credentials the server no longer honours. Core refuses to send it: the request is abandoned
 * before or right after it leaves, because acting under a session the user no longer holds is
 * exactly the write the serialisation exists to prevent (ETP-5195, ETP-5255).
 *
 * ## Why it is built here
 *
 * The message used to be the hardcoded English sentence `'The request belongs to a superseded
 * session.'`, and it reached the screen verbatim: ~150 UI sites render `err.message` as-is
 * (`toast.error(err?.message)`, `setError(err.message)`), so an English-only sentence showed
 * up in the middle of a Spanish interface — reported from production on 2026-10-15.
 *
 * The fix is the same one ETP-5424 applied to the network error: the message is resolved
 * through the host app's translator at CONSTRUCTION time, so every one of those sites shows the
 * right sentence without being touched. Core ships only the English fallback; the host app
 * registers the translator once and re-registers it on every locale change.
 *
 * ## Why it stays a `DOMException` named `AbortError`
 *
 * About ten call sites branch on `err.name === 'AbortError'` to SWALLOW a cancellation
 * (`useOcrExtraction`, `useAttachments`, `useCallout`, `useNeoResource`, `SearchPopup`, …), and
 * this error is one of the cancellations they swallow. Changing the error's identity would
 * change which errors those sites show — far beyond this ticket. The type and the name are
 * therefore preserved; only the MESSAGE changes.
 *
 * The `messageKey` is the locale-independent recognizer: a consumer that needs to tell this
 * error apart from a plain user-initiated abort reads it instead of matching the localized
 * text, which differs per locale.
 */

import { resolveErrorMessage } from './errorTranslator.js';

/** The i18n key the host app resolves this message with. */
export const STALE_SESSION_ERROR_KEY = 'staleSession';
/**
 * The English fallback, used when the host app has not registered a translator (the locale is
 * still loading) or when the dictionary has no entry for the key.
 *
 * It must stay byte-identical to the `en_US.json` value: an untranslated fallback has to read
 * with the same explanatory wording a translated one does, so the user is always told what to
 * do — reload the page, because the session moved to another tab.
 */
export const STALE_SESSION_ERROR_FALLBACK =
  'Your session was opened in another tab or window. Reload the page to continue.';

/**
 * Builds the error a request of a superseded session rejects with.
 *
 * The message is resolved EAGERLY, at construction: `err.message` is read synchronously by
 * `toast.error` and friends, so a getter that resolved the locale later would depend on
 * whichever locale happens to be active by then.
 *
 * @returns {DOMException} an `AbortError` carrying the localized message and its `messageKey`
 */
export function staleSessionError() {
  const message = resolveErrorMessage(STALE_SESSION_ERROR_KEY, {}) ?? STALE_SESSION_ERROR_FALLBACK;
  const error = new DOMException(message, 'AbortError');
  // The locale-independent recognizer. `DOMException` accepts an own property (verified in
  // Node and in every browser that ships it), and it survives serialization-free plumbing
  // because the error object itself is handed to the caller.
  error.messageKey = STALE_SESSION_ERROR_KEY;
  return error;
}
