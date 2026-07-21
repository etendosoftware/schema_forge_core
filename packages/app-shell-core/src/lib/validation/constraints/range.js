import { ERROR_CODES } from '../errorCodes.js';
import { coerceFiniteNumber } from '../normalize.js';

function invalidConstraint(constraint) {
  return { code: ERROR_CODES.INVALID_CONSTRAINT, constraint };
}

// A present value that cannot be coerced to a finite number is a type mismatch
// against a numeric bound. There is no dedicated NOT_A_NUMBER code, so this is
// reported as INVALID_FORMAT with the synthetic format 'number'.
function invalidNumber() {
  return { code: ERROR_CODES.INVALID_FORMAT, format: 'number' };
}

/**
 * `minimum` evaluator. Zero is a valid bound and a valid value.
 * @returns {object|null} MINIMUM / INVALID_FORMAT / INVALID_CONSTRAINT / null
 */
export function evaluateMinimum(value, minimum) {
  if (!Number.isFinite(minimum)) return invalidConstraint('minimum');
  const n = coerceFiniteNumber(value);
  if (Number.isNaN(n)) return invalidNumber();
  return n < minimum ? { code: ERROR_CODES.MINIMUM, min: minimum, actual: n } : null;
}

/**
 * `maximum` evaluator. Zero is a valid bound and a valid value.
 * @returns {object|null} MAXIMUM / INVALID_FORMAT / INVALID_CONSTRAINT / null
 */
export function evaluateMaximum(value, maximum) {
  if (!Number.isFinite(maximum)) return invalidConstraint('maximum');
  const n = coerceFiniteNumber(value);
  if (Number.isNaN(n)) return invalidNumber();
  return n > maximum ? { code: ERROR_CODES.MAXIMUM, max: maximum, actual: n } : null;
}
