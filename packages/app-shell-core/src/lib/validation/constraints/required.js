import { ERROR_CODES } from '../errorCodes.js';
import { isValuePresent } from '../normalize.js';

/**
 * `required` evaluator. Activates only when the constraint is exactly `true`
 * (never emit for `required: false`). A non-boolean value is ignored (lenient),
 * because the canonical projection only ever emits `true`.
 *
 * @returns {{code:string}|null} REQUIRED error when absent, else null.
 */
export function evaluateRequired(value, required) {
  if (required !== true) return null;
  return isValuePresent(value) ? null : { code: ERROR_CODES.REQUIRED };
}
