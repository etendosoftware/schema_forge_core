/**
 * Merges callout result updates into the current inline-row state.
 *
 * Rules (in priority order):
 * 1. Fields in `forceFields` always win — touched state and empty-value guards are bypassed.
 * 2. The trigger field (`triggerKey`) always wins — it was just changed by the user.
 * 3. Touched fields with a non-empty user value are preserved (callout cannot overwrite them).
 * 4. Callout results that are empty/null do not overwrite an existing non-empty user value.
 *
 * @param {Record<string, unknown>} prev         Current row state
 * @param {Record<string, unknown>} updates      Callout result fields
 * @param {Set<string>}             forceFields  Fields that always get the callout value
 * @param {string}                  triggerKey   Field that triggered the callout
 * @param {Set<string>}             touched      Fields the user has manually set this session
 * @returns {Record<string, unknown>} New row state (shallow copy of prev with updates applied)
 */
export function applyCalloutUpdates(prev, updates, forceFields, triggerKey, touched) {
  const next = { ...prev };
  for (const [field, value] of Object.entries(updates)) {
    const isForced    = forceFields.has(field);
    const isTrigger   = field === triggerKey;
    const isTouched   = touched.has(field);
    const hasUserValue = prev[field] !== '' && prev[field] != null;

    if (!isForced && !isTrigger && isTouched && hasUserValue) continue;
    if (!isForced && (value === '' || value == null) && hasUserValue) continue;
    next[field] = value;
  }
  return next;
}
