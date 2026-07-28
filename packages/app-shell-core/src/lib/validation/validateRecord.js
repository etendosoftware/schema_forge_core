/**
 * ETP-4556 — Declarative validation engine (public API).
 *
 * Pure and reusable: given a set of field descriptors carrying `validation`
 * objects (as emitted into contract.json — see
 * `schema_forge_core/cli/src/lib/field-validation.js`), a values map and an
 * operation, it returns machine-readable error codes with parameters. No i18n,
 * no presentation, no field-name inference (that lives in the temporary
 * compatAdapter.js), no destructive sanitization of caller data.
 *
 * @typedef {Object} FieldDescriptor
 * @property {string} name            Value key + errors key.
 * @property {string} [key]           AD column key (used only by compatAdapter).
 * @property {string} [column]        AD column (used only by compatAdapter).
 * @property {string} [type]          Field type hint.
 * @property {string} [visibility]    'editable'|'readOnly'|'system'|'discarded'.
 * @property {boolean} [readOnly]     Skip when true.
 * @property {boolean} [hidden]       Skip when true.
 * @property {Object} [validation]    Constraint object (required, minLength, …).
 *
 * @typedef {Object} ValidateOptions
 * @property {Object} [previousValues]        Prior values, for the unchanged policy.
 * @property {boolean} [skipUnchangedInvalid] When true (the DEFAULT), a field
 *   whose value equals its previousValue is NOT validated — legacy-invalid
 *   untouched data can still save. Only takes effect when `previousValues` is
 *   supplied; with no previous values there is nothing to compare, so everything
 *   is validated. Set to false to force full validation even of unchanged values.
 *
 * @typedef {Object} ValidateResult
 * @property {boolean} valid
 * @property {Object.<string, Array<{code:string}>>} errors  Keyed by field name.
 */

import { evaluateRequired } from './constraints/required.js';
import { evaluateMinLength, evaluateMaxLength } from './constraints/length.js';
import { evaluateMinimum, evaluateMaximum } from './constraints/range.js';
import { evaluateFormat } from './constraints/format.js';
import { evaluateEnum } from './constraints/enum.js';
import { evaluateAllowedSchemes } from './constraints/schemes.js';
import { isValuePresent } from './normalize.js';

// Canonical evaluation order. Mirrors VALIDATION_KEY_ORDER in
// schema_forge_core/cli/src/lib/field-validation.js (replicated to avoid a
// dependency across the cli/ package boundary). `required` is handled first and
// separately because an absent value short-circuits the rest.
const VALUE_CONSTRAINT_EVALUATORS = [
  ['minLength', evaluateMinLength],
  ['maxLength', evaluateMaxLength],
  ['minimum', evaluateMinimum],
  ['maximum', evaluateMaximum],
  ['format', evaluateFormat],
  ['enum', evaluateEnum],
  ['allowedSchemes', evaluateAllowedSchemes],
];

const SKIPPED_VISIBILITY = new Set(['readOnly', 'system', 'discarded']);

function isSkipped(field) {
  return field.readOnly === true
    || field.hidden === true
    || SKIPPED_VISIBILITY.has(field.visibility);
}

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Validate a single field's value, returning an array of error objects (possibly
 * empty). `required` runs first; an absent value only ever produces REQUIRED and
 * skips every other constraint (optional-empty ⇒ valid).
 */
function validateField(value, validation) {
  const requiredError = evaluateRequired(value, validation.required);
  if (requiredError) return [requiredError];

  // Optional-empty: an absent, non-required value is valid and skips all other
  // constraints — the only rule that applies to an absent value is `required`.
  if (!isValuePresent(value)) return [];

  const errors = [];
  for (const [key, evaluate] of VALUE_CONSTRAINT_EVALUATORS) {
    if (!has(validation, key)) continue;
    const error = evaluate(value, validation[key]);
    if (error) errors.push(error);
  }
  return errors;
}

/**
 * Validate a record against its field descriptors.
 *
 * @param {Object} params
 * @param {FieldDescriptor[]} params.fields
 * @param {Object} params.values
 * @param {'create'|'update'|'partial-update'} [params.operation='create']
 * @param {ValidateOptions} [params.options]
 * @returns {ValidateResult}
 */
export function validateRecord({ fields = [], values = {}, operation = 'create', options = {} } = {}) {
  const { previousValues, skipUnchangedInvalid = true } = options;
  const errors = {};

  for (const field of fields) {
    if (!field || typeof field.name !== 'string') continue;
    if (isSkipped(field)) continue;

    const present = has(values, field.name);
    // partial-update only validates fields actually present in the payload.
    if (operation === 'partial-update' && !present) continue;

    // Unchanged legacy-invalid policy: skip validation for a field whose value
    // is byte-identical to its previous value, when the caller opts in.
    if (skipUnchangedInvalid && previousValues && has(previousValues, field.name)
        && Object.is(values[field.name], previousValues[field.name])) {
      continue;
    }

    const validation = (field.validation && typeof field.validation === 'object') ? field.validation : {};
    const fieldErrors = validateField(values[field.name], validation);
    if (fieldErrors.length > 0) errors[field.name] = fieldErrors;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
