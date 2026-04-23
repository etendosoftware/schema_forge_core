/**
 * Module-level store for copilot-emitted prefill payloads.
 *
 * The copilot can emit a `prefill_form` ui_action alongside a `navigate` to
 * `/{window}/new`. The navigate happens first; by the time the form mounts
 * the payload is already waiting here, keyed by window name. The form reads
 * it once and clears it.
 *
 * Consume-on-read semantics prevent stale values from leaking into a later
 * unrelated new-record session for the same window.
 */

const _pending = new Map();

/**
 * @param {string} windowName
 * @param {Record<string, unknown>} values
 */
export function setPrefill(windowName, values) {
  if (!windowName || !values || typeof values !== 'object') return;
  _pending.set(windowName, values);
}

/**
 * Returns the pending values for a window and clears the entry.
 * @param {string} windowName
 * @returns {Record<string, unknown>|null}
 */
export function consumePrefill(windowName) {
  if (!windowName || !_pending.has(windowName)) return null;
  const values = _pending.get(windowName);
  _pending.delete(windowName);
  return values;
}
