/**
 * ETP-4555 — Declarative validation constraint projection.
 *
 * Single source of truth for the canonical per-field `validation` object that
 * flows through the Schema Forge pipeline (resolve-curated → generate-contract).
 *
 * Design rules (from the ticket, non-negotiable):
 *   1. Precedence — an explicit `decisions.json` value ALWAYS wins over raw DB metadata.
 *   2. No guessed defaults — a constraint absent from both raw and decision is OMITTED.
 *   3. Zero is valid — presence is checked with hasOwnProperty / != null, never truthiness.
 *   4. String→Number coercion — raw numeric metadata arrives as strings (e.g. "60"),
 *      coerced to Number, guarded against NaN.
 *   5. Backward-compat — this object is ADDITIVE; the flat `min`/`max` emission (ETP-4277)
 *      is untouched.
 *   6. Deterministic key order — keys are always emitted in VALIDATION_KEY_ORDER.
 */

// Canonical emission order for the `validation` object. The contract's key order
// is deterministic, so this sequence is the single authority for both the resolver
// (which builds the object) and the contract generator (which re-projects it).
export const VALIDATION_KEY_ORDER = [
  'required',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'format',
  'enum',
  'allowedSchemes',
];

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function isPresent(value) {
  if (value == null) return false;
  // An empty/blank string is treated as absent — Number('') === 0 would otherwise
  // fabricate a bogus zero constraint.
  return !(typeof value === 'string' && value.trim() === '');
}

/**
 * Return the first present candidate coerced to a finite Number, or undefined.
 * Candidates are given in precedence order (decision first, raw last).
 */
function firstNumber(...candidates) {
  for (const candidate of candidates) {
    if (!isPresent(candidate)) continue;
    const n = Number(candidate);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

/**
 * Re-project a validation object into canonical key order, dropping undefined
 * values. Returns undefined when nothing survives (so callers can omit the key).
 */
export function projectValidation(validation) {
  if (!validation || typeof validation !== 'object') return undefined;
  const out = {};
  for (const key of VALIDATION_KEY_ORDER) {
    if (Object.prototype.hasOwnProperty.call(validation, key) && validation[key] !== undefined) {
      out[key] = validation[key];
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Build the canonical validation object for a field, merging raw DB metadata with
 * explicit decisions (decision wins). Returns undefined when no constraint applies.
 *
 * @param {object} params
 * @param {object} params.raw       Raw field metadata (extract-fields output): maxLength, valueMin, valueMax.
 * @param {object} params.decision  decisions.json field entry: min, max, minLength, maxLength, format, enum, allowedSchemes.
 * @param {boolean} params.required Resolved required flag (mirrored only when true).
 */
export function buildFieldValidation({ raw = {}, decision = {}, required = false } = {}) {
  const v = {};

  // required — mirror only when true (never emit `required: false`).
  if (required === true) v.required = true;

  // minLength — decisions only (no raw AD source today).
  const minLength = firstNumber(decision.minLength);
  if (minLength !== undefined) v.minLength = minLength;

  // maxLength — explicit decision wins over raw fieldlength.
  const maxLength = firstNumber(decision.maxLength, raw.maxLength);
  if (maxLength !== undefined) v.maxLength = maxLength;

  // minimum — explicit decision `min` wins over raw valueMin (zero is valid).
  const minimum = firstNumber(decision.min, raw.valueMin);
  if (minimum !== undefined) v.minimum = minimum;

  // maximum — explicit decision `max` wins over raw valueMax (zero is valid).
  const maximum = firstNumber(decision.max, raw.valueMax);
  if (maximum !== undefined) v.maximum = maximum;

  // format — decisions only, never inferred.
  if (typeof decision.format === 'string' && decision.format.trim() !== '') {
    v.format = decision.format;
  }

  // enum — explicit allowed values in decisions.
  if (isNonEmptyArray(decision.enum)) v.enum = decision.enum;

  // allowedSchemes — decisions only, explicit configuration.
  if (isNonEmptyArray(decision.allowedSchemes)) v.allowedSchemes = decision.allowedSchemes;

  return projectValidation(v);
}
