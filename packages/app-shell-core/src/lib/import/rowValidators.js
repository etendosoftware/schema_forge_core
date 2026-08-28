/**
 * Registry of per-window row validators for the CSV import review queue.
 *
 * `validateRow` covers what the import config can express generically: required, email
 * format, numeric format, and already-resolved foreign keys. What it cannot express is
 * knowledge that lives in a window's own descriptor — an AD List column's accepted
 * synonyms ("Servicio" → 'S'), or any cross-field rule.
 *
 * Before this registry, that knowledge only ran inside `buildOperations`, i.e. at SEND
 * time: `ImportDialog` hands the descriptor the raw row, so a cell the descriptor would
 * reject showed up in the review queue as **Correcta** and only failed once the user had
 * already confirmed the import. A validator registered here runs in the same pass as
 * `validateRow`, so the same rule decides the row's status BEFORE the send.
 *
 * A validator must stay a pure function of the row (no network, no writes): it runs once
 * per row on every mapping change, for files of up to `limit.maxRows` rows.
 *
 * Registered under the same name as the descriptor (`decisions.json` →
 * `window.import.descriptor`), so a window declares one name and gets both halves.
 */
const rowValidators = new Map();

/**
 * @param {string} name Descriptor name, matching `window.import.descriptor`.
 * @param {(row: object, ctx: { translate?: Function, config?: object }) => Array<{target: string, message: string}>} fn
 *   Returns one entry per problem found; an empty array means the row is valid.
 */
export function registerImportRowValidator(name, fn) {
  rowValidators.set(name, fn);
}

export function getImportRowValidator(name) {
  return name ? rowValidators.get(name) : undefined;
}

/**
 * Run the descriptor's validator for one row, if it declares one.
 *
 * A validator that throws must never take the whole review pass down with it — the row
 * is reported as invalid with the thrown message, which is exactly how the send path
 * already treats a descriptor that throws.
 *
 * @returns {Array<{target: string, message: string}>} Extra errors, or `[]`.
 */
export function runImportRowValidator(name, row, ctx = {}) {
  const validator = getImportRowValidator(name);
  if (!validator) return [];
  try {
    return validator(row, ctx) ?? [];
  } catch (error) {
    return [{ target: '', message: error?.message || String(error) }];
  }
}
