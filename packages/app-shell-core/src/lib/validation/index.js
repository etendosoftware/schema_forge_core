/**
 * ETP-4556 — Declarative validation engine public entry point.
 *
 * Pure, reusable, presentation-free. See ./validateRecord.js for the API and
 * docs/validation-engine.md for the full contract (error-code table, semantics,
 * policies). compatAdapter is exported but documented as TEMPORARY.
 */
export { validateRecord } from './validateRecord.js';
export { ERROR_CODES } from './errorCodes.js';
export { inferFormatConstraints, applyCompatFormats } from './compatAdapter.js';
export { KNOWN_FORMATS } from './formats.js';
