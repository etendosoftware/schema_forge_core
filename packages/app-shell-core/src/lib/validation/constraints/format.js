import { ERROR_CODES } from '../errorCodes.js';
import { FORMAT_VALIDATORS } from '../formats.js';

/**
 * `format` evaluator. An unknown format value is a contract error
 * (INVALID_CONSTRAINT) — fail safe, documented policy. A known format that the
 * value does not satisfy yields INVALID_FORMAT carrying the format name.
 *
 * @returns {object|null} INVALID_FORMAT / INVALID_CONSTRAINT / null
 */
export function evaluateFormat(value, format) {
  if (typeof format !== 'string' || !Object.prototype.hasOwnProperty.call(FORMAT_VALIDATORS, format)) {
    return { code: ERROR_CODES.INVALID_CONSTRAINT, constraint: 'format', reason: 'unknown-format' };
  }
  const ok = FORMAT_VALIDATORS[format](value);
  return ok ? null : { code: ERROR_CODES.INVALID_FORMAT, format };
}
