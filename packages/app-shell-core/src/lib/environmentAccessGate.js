/**
 * Environment-access gate (ETP-5443 follow-up, moved to the core by ETP-5642).
 *
 * When an environment's commercial access is cut — the demo trial expired or the
 * subscription's payment grace elapsed — com.etendoerp.go answers HTTP 402 to EVERY request
 * that touches the environment (NEO, Copilot, MCP, the account endpoints acting on the
 * session's tenant), with a message shaped `"Environment access is not available: <DECISION>"`
 * where `<DECISION>` is one of `EnvironmentAccessPolicy.Decision` — `DEMO_TRIAL_EXPIRED`,
 * `SUBSCRIPTION_REQUIRED`, or `MEMBERSHIP_REQUIRED` (that last one is a different kind of
 * "no access" — the caller isn't a member of the environment at all — and is deliberately
 * NOT treated as a commercial block here; see `isBlockingAccessDecision`). NEO nests the text
 * under `error.message`; Copilot and MCP send it as a plain string `error`.
 *
 * This module is a module-level store the app shell reads to replace the whole UI with the
 * blocked-access screen. Two writers feed it:
 *
 *  - **Every response, through `apiFetch`** (`observeEnvironmentAccessResponse`, called from
 *    `auth/api.js`'s single response exit). ETP-5642: the block used to be detected only from
 *    `/sws/neo/windowaccessmap`, which runs on the bootstrap and on a silent refresh. A tab
 *    already open when the trial expired kept rendering: every list and dashboard widget got
 *    its 402 and showed an empty state ("0 contacts", "all caught up"), and the silent refresh
 *    itself stopped at `/sws/neo/refreshtoken`'s 402, so it never reached `windowaccessmap`
 *    and the blocked screen never came. Watching the transport makes the first blocked
 *    response of any kind show the screen. This writer only ever SETS a block — a 200 from
 *    some unrelated endpoint (the account API stays reachable while ERP access is blocked)
 *    says nothing about whether the environment is usable again.
 *  - **`/sws/neo/windowaccessmap`** (`fetchWindowAccess()` in the app shell, via
 *    `setEnvironmentAccessDecision`). It also CLEARS the block: a successful call proves the
 *    environment is reachable again (the owner paid, the trial was extended).
 *
 * Kept free of React imports so it stays loadable by a plain `node --test` module; the React
 * binding lives in the app shell's `hooks/useEnvironmentAccessGate.js`. There must be exactly
 * one copy of this store: the app shell's `@/lib/environmentAccessGate.js` re-exports this
 * module instead of keeping its own.
 */

const ENVIRONMENT_ACCESS_ERROR_PREFIX = 'Environment access is not available:';
const HTTP_PAYMENT_REQUIRED = 402;

// MEMBERSHIP_REQUIRED intentionally excluded — it means "you aren't a member of this
// environment", not "this environment's commercial access was cut off". The existing
// NoAccessScreen company-switch flow already covers that case well enough.
const BLOCKING_DECISIONS = new Set(['DEMO_TRIAL_EXPIRED', 'SUBSCRIPTION_REQUIRED']);

let currentDecision = null;
const listeners = new Set();

function notify() {
  // Copy before iterating: a listener may unsubscribe itself while being notified.
  for (const listener of [...listeners]) listener();
}

/**
 * Extracts the `EnvironmentAccessPolicy.Decision` name from a 402 error message
 * (`"Environment access is not available: <DECISION>"`). Returns `null` when the message
 * does not carry a recognized decision (a differently-worded 402, or none at all).
 */
export function parseEnvironmentAccessDecision(message) {
  const text = String(message ?? '');
  if (!text.startsWith(ENVIRONMENT_ACCESS_ERROR_PREFIX)) return null;
  const decision = text.slice(ENVIRONMENT_ACCESS_ERROR_PREFIX.length).trim();
  return decision || null;
}

/** Whether `decision` should replace the normal UI with the blocked-access screen. */
export function isBlockingAccessDecision(decision) {
  return BLOCKING_DECISIONS.has(decision);
}

/**
 * Reads the human-readable error text out of a parsed error body, whatever envelope the
 * surface uses: NEO's `{ error: { message } }`, Copilot's and MCP's `{ error: "<text>" }`, or
 * a top-level `{ message }`. Returns `''` when there is none.
 */
export function readAccessErrorMessage(data) {
  if (typeof data?.error === 'string') return data.error;
  if (data?.error && typeof data.error === 'object') return data.error.message || '';
  return data?.message || '';
}

/**
 * Records the outcome of the latest windowaccessmap call. Pass `null` (or any
 * non-blocking value, e.g. `MEMBERSHIP_REQUIRED`) when the call succeeded, or failed for a
 * reason other than a recognized commercial-access 402, so a later-restored or
 * unrelated-error session does not keep showing a stale block. No-op (and no listener
 * notification) when the resolved value is unchanged, since this is called on every silent
 * refresh (bootstrap, focus, the 5-min poll), not just on state transitions.
 */
export function setEnvironmentAccessDecision(decision) {
  const next = isBlockingAccessDecision(decision) ? decision : null;
  if (next === currentDecision) return;
  currentDecision = next;
  notify();
}

/**
 * Transport-level detection (ETP-5642): records a block when `response` is a 402 whose
 * message carries a blocking decision. Never clears a recorded block — see the module doc.
 *
 * Reads a CLONE of the body, so the caller still gets an unread response, and never throws:
 * an unreadable or non-JSON body simply records nothing. Resolves once the body was read, so
 * a caller that wants to (a test) can await it; `apiFetch` does not.
 *
 * `isCurrent` is re-checked AFTER the body is read: the read is asynchronous, and a 402 that
 * belonged to the environment the user just left must not block the one they switched to.
 *
 * @param {Response} response any fetch response
 * @param {() => boolean} [isCurrent] whether the session that sent the request is still live
 * @returns {Promise<void>}
 */
export async function observeEnvironmentAccessResponse(response, isCurrent = () => true) {
  if (response?.status !== HTTP_PAYMENT_REQUIRED || typeof response.clone !== 'function') return;
  try {
    const data = await response.clone().json();
    const decision = parseEnvironmentAccessDecision(readAccessErrorMessage(data));
    if (isBlockingAccessDecision(decision) && isCurrent()) setEnvironmentAccessDecision(decision);
  } catch {
    // Not a JSON body (or an aborted stream): not a commercial-access answer we can read.
  }
}

/** The current blocking decision (`'DEMO_TRIAL_EXPIRED'` | `'SUBSCRIPTION_REQUIRED'`), or `null`. */
export function getEnvironmentAccessDecision() {
  return currentDecision;
}

/** Subscribe to changes in the recorded decision. Returns the unsubscribe function. */
export function subscribeEnvironmentAccessDecision(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test seam: forget the recorded decision so one test cannot leak into the next. */
export function resetEnvironmentAccessGateForTest() {
  currentDecision = null;
  listeners.clear();
}
