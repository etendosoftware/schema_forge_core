/**
 * Cross-tab session conflicts (ETP-5675).
 *
 * The `__Host-go_session` cookie belongs to the browser profile, not to a tab: every tab and
 * window of the profile sends the same one. Production is one domain for every customer, so a
 * person with two accounts (an accountant invited by several clients, a personal and a work
 * account) signs the whole browser in as whichever account logged in last. A tab still showing
 * the previous account then:
 *
 *  - READ the other account's tenant: a GET carries only the cookie, so lists and form defaults
 *    came back from the other tenant under the first tab's name and avatar;
 *  - could not write (its CSRF proof is the old session's) and hung on "Cargando…";
 *  - on a later 401, logged out with a stale proof whose ETP-5550 retry re-read the LIVE proof
 *    and revoked the OTHER account's session.
 *
 * Three signals feed this module, cheapest first:
 *
 *  1. **Broadcast** — the tab that signs in or out announces the account on a `BroadcastChannel`
 *     (same origin, every tab and window of the profile), so the others react before they send
 *     anything. Best effort: a discarded or frozen tab misses it.
 *  2. **Re-check on return** — a tab coming back to the foreground compares its account with
 *     `GET /sws/go/session` (throttled), which covers the tabs that missed the broadcast.
 *  3. **Transport** — every request carries `X-Go-Account` and the backend answers a mismatch
 *     with 403 {@link ACCOUNT_MISMATCH_MESSAGE}; `apiFetch` records it here. This one cannot be
 *     missed or raced, so it is the guarantee; the other two only make the screen show sooner.
 *
 * Kept free of React imports so plain `node --test` modules can load it; the AuthProvider and the
 * onboarding bind it to their own state.
 */

/** The backend's refusal for a request whose `X-Go-Account` is not the cookie's account. */
export const ACCOUNT_MISMATCH_MESSAGE = 'Session belongs to another account';

/** The channel every tab of the origin listens on. */
export const SESSION_CHANNEL_NAME = 'etendo-go-session';

/** Minimum gap between two foreground re-checks of the same tab. */
export const SESSION_RECHECK_INTERVAL_MS = 30 * 1000;

let currentConflict = null;
const listeners = new Set();

function notify() {
  for (const listener of [...listeners]) listener();
}

/**
 * Records that this document's account is no longer the browser's. The first report wins until
 * it is cleared: a burst of refused requests must not re-render the screen once per request.
 *
 * @param {{ reason?: string, accountId?: string|null }} [details] what revealed it, and the live
 *   account when the reporter knows it
 */
export function reportSessionConflict(details = {}) {
  if (currentConflict) return;
  currentConflict = { reason: details.reason || 'unknown', accountId: details.accountId ?? null };
  notify();
}

/** The recorded conflict (`{ reason, accountId }`), or `null`. */
export function getSessionConflict() {
  return currentConflict;
}

/** Forget the recorded conflict, e.g. after the page decided what to do about it. */
export function clearSessionConflict() {
  if (!currentConflict) return;
  currentConflict = null;
  notify();
}

/** Subscribe to changes of the recorded conflict. Returns the unsubscribe function. */
export function subscribeSessionConflict(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test seam. */
export function resetSessionConflictForTests() {
  currentConflict = null;
  listeners.clear();
}

/** Whether a refusal body is the account-mismatch answer, whatever envelope wrapped it. */
export function isAccountMismatchText(text) {
  return typeof text === 'string' && text.includes(ACCOUNT_MISMATCH_MESSAGE);
}

/**
 * Transport-level detection: records a conflict when `response` is the backend's 403 account
 * mismatch. Reads a CLONE, never throws, and re-checks `isCurrent` after the asynchronous read so
 * a refusal that belonged to a session this tab already left does not raise the screen.
 *
 * @param {Response} response any fetch response
 * @param {() => boolean} [isCurrent] whether the session that sent the request is still live
 * @returns {Promise<boolean>} whether the response was an account mismatch
 */
export async function observeSessionConflictResponse(response, isCurrent = () => true) {
  if (response?.status !== 403 || typeof response.clone !== 'function') return false;
  try {
    const mismatch = isAccountMismatchText(await response.clone().text());
    if (mismatch && isCurrent()) reportSessionConflict({ reason: 'request' });
    return mismatch;
  } catch {
    return false;
  }
}

function openChannel() {
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(SESSION_CHANNEL_NAME);
  } catch {
    return null;
  }
}

/**
 * Tells every other tab of the origin which account the browser session now belongs to. `null`
 * means signed out. Never throws: a browser without `BroadcastChannel` simply relies on the
 * re-check and on the transport.
 *
 * @param {string|null} accountId
 */
export function announceSessionAccount(accountId) {
  const channel = openChannel();
  if (!channel) return;
  try {
    channel.postMessage({ type: 'session-account', accountId: accountId ?? null });
  } catch {
    // A closed or unavailable channel: the other two signals still apply.
  } finally {
    channel.close();
  }
}

/**
 * Listens for the announcements of OTHER tabs (a channel never delivers a tab its own messages).
 *
 * @param {(accountId: string|null) => void} handler
 * @returns {() => void} stops listening
 */
export function listenSessionAccount(handler) {
  const channel = openChannel();
  if (!channel || typeof handler !== 'function') return () => {};
  channel.onmessage = (event) => {
    const data = event?.data;
    if (data?.type === 'session-account') handler(data.accountId ?? null);
  };
  return () => channel.close();
}

/**
 * Compares the account a document is bound to with the live session.
 *
 * - `'same'`    — the cookie is still this account's;
 * - `'other'`   — the cookie now belongs to another account (`accountId` says which);
 * - `'none'`    — there is no session any more;
 * - `'unknown'` — the session could not be read (network, deploy). NEVER a conflict: a backend
 *                 that does not answer must not sign anyone out.
 *
 * @param {string|null} expectedAccountId the account this document is bound to
 * @param {() => Promise<object|null>} readSession resolves GET /sws/go/session, null when there is
 *   none; rejects when the backend is unavailable
 * @returns {Promise<{ status: 'same'|'other'|'none'|'unknown', accountId?: string|null }>}
 */
export async function compareLiveSessionAccount(expectedAccountId, readSession) {
  let live;
  try {
    live = await readSession();
  } catch {
    return { status: 'unknown' };
  }
  const liveAccountId = live?.account?.id ?? null;
  if (!live) return { status: 'none' };
  if (!liveAccountId || !expectedAccountId) return { status: 'unknown' };
  return liveAccountId === expectedAccountId
    ? { status: 'same', accountId: liveAccountId }
    : { status: 'other', accountId: liveAccountId };
}
