/**
 * ETP-4557 — the per-target validation inputs `validateRow` needs, derived from the import fields
 * of a window's contract. Pure, so the review queue and its tests build them the same way.
 */

/**
 * Declarative `validation` per import target (the `window.import.fields[].validation` emitted by
 * generate-contract, already limited to constraints that apply to the raw cell).
 * @param {Array<{target:string, validation?:object}>} fields import fields.
 * @returns {Object<string, object>} validation object per target.
 */
export function buildFieldConstraints(fields = []) {
  return Object.fromEntries(fields.filter((f) => f.validation).map((f) => [f.target, f.validation]));
}

/**
 * Field identity per import target, for the engine's name-based format inference.
 * @param {Array<{target:string, column?:string, type?:string}>} fields import fields.
 * @returns {Object<string, {column?:string, type?:string}>} identity per target.
 */
export function buildFieldIdentities(fields = []) {
  return Object.fromEntries(fields.map((f) => [f.target, { column: f.column, type: f.type }]));
}
