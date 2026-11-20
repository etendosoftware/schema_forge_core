/**
 * ETP-4557 — the ONE mapping from an engine error to an i18n descriptor `{ key, params }`.
 * Shared by the app-shell form/grid adapter and the import review queue, so a code reads
 * identically in every flow. Presentation-free: callers resolve the key with their own `ui()`.
 */
import { ERROR_CODES } from './errorCodes.js';

/**
 * Map an engine error to its i18n descriptor.
 * @param {{code:string, max?:number, min?:number, format?:string}|null|undefined} error engine error.
 * @returns {{key:string, params:object}|null} i18n key plus interpolation params; null for no error.
 */
export function describeValidationError(error) {
  if (!error) return null;
  switch (error.code) {
    case ERROR_CODES.MAX_LENGTH: return { key: 'fieldMaxLengthError', params: { maxLength: error.max } };
    case ERROR_CODES.MIN_LENGTH: return { key: 'fieldMinLengthError', params: { minLength: error.min } };
    case ERROR_CODES.MINIMUM: return { key: 'fieldMinValueError', params: { min: error.min } };
    case ERROR_CODES.MAXIMUM: return { key: 'fieldMaxValueError', params: { max: error.max } };
    case ERROR_CODES.REQUIRED: return { key: 'importErrorRequiredGeneric', params: {} };
    case ERROR_CODES.DISALLOWED_SCHEME: return { key: 'websiteInsecureUrl', params: {} };
    case ERROR_CODES.INVALID_FORMAT:
      if (error.format === 'email') return { key: 'sendModalInvalidEmail', params: {} };
      if (error.format === 'phone') return { key: 'phoneInvalidChars', params: {} };
      if (error.format === 'url') return { key: 'websiteInsecureUrl', params: {} };
      return { key: 'fieldInvalidValue', params: {} };
    default: return { key: 'fieldInvalidValue', params: {} };
  }
}
