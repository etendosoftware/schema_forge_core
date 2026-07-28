/**
 * ETP-4556 — Stable, machine-readable validation error codes.
 *
 * These codes are the ONLY contract between the validation engine and its
 * consumers. They carry NO presentation: a consumer maps a code (+ its params)
 * to an i18n message. Codes must stay stable across releases — never rename an
 * existing value, only add new ones.
 *
 * Param shapes per code (all params live alongside `code` on the error object):
 *   REQUIRED            — {}
 *   MIN_LENGTH          — { min:number, actual:number }
 *   MAX_LENGTH          — { max:number, actual:number }
 *   MINIMUM             — { min:number, actual:number }
 *   MAXIMUM             — { max:number, actual:number }
 *   INVALID_FORMAT      — { format:string }        // e.g. 'email' | 'url' | 'phone' | 'number'
 *   NOT_IN_ENUM         — { allowed:Array }
 *   DISALLOWED_SCHEME   — { scheme:string, allowed:string[] }
 *   INVALID_CONSTRAINT  — { constraint:string, reason?:string }  // malformed/unknown constraint definition
 */
export const ERROR_CODES = Object.freeze({
  REQUIRED: 'REQUIRED',
  MIN_LENGTH: 'MIN_LENGTH',
  MAX_LENGTH: 'MAX_LENGTH',
  MINIMUM: 'MINIMUM',
  MAXIMUM: 'MAXIMUM',
  INVALID_FORMAT: 'INVALID_FORMAT',
  NOT_IN_ENUM: 'NOT_IN_ENUM',
  DISALLOWED_SCHEME: 'DISALLOWED_SCHEME',
  INVALID_CONSTRAINT: 'INVALID_CONSTRAINT',
});
