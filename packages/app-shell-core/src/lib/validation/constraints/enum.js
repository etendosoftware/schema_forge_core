import { ERROR_CODES } from '../errorCodes.js';

/**
 * `enum` evaluator. A malformed enum (not a non-empty array) is a contract
 * error. Membership is checked with SameValueZero via Array.prototype.includes.
 *
 * @returns {object|null} NOT_IN_ENUM / INVALID_CONSTRAINT / null
 */
export function evaluateEnum(value, allowed) {
  if (!Array.isArray(allowed) || allowed.length === 0) {
    return { code: ERROR_CODES.INVALID_CONSTRAINT, constraint: 'enum' };
  }
  return allowed.includes(value) ? null : { code: ERROR_CODES.NOT_IN_ENUM, allowed };
}
