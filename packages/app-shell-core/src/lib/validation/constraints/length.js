import { ERROR_CODES } from '../errorCodes.js';
import { codePointLength } from '../normalize.js';

function invalidConstraint(constraint) {
  return { code: ERROR_CODES.INVALID_CONSTRAINT, constraint };
}

/**
 * `minLength` evaluator (string length in Unicode code points).
 * @returns {object|null} MIN_LENGTH / INVALID_CONSTRAINT / null
 */
export function evaluateMinLength(value, minLength) {
  if (!Number.isFinite(minLength) || minLength < 0) return invalidConstraint('minLength');
  const actual = codePointLength(value);
  return actual < minLength ? { code: ERROR_CODES.MIN_LENGTH, min: minLength, actual } : null;
}

/**
 * `maxLength` evaluator (string length in Unicode code points).
 * @returns {object|null} MAX_LENGTH / INVALID_CONSTRAINT / null
 */
export function evaluateMaxLength(value, maxLength) {
  if (!Number.isFinite(maxLength) || maxLength < 0) return invalidConstraint('maxLength');
  const actual = codePointLength(value);
  return actual > maxLength ? { code: ERROR_CODES.MAX_LENGTH, max: maxLength, actual } : null;
}
