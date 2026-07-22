import { ERROR_CODES } from '../errorCodes.js';
import { parseUrl, parseUrlScheme } from '../formats.js';

/**
 * `allowedSchemes` evaluator. The value is parsed as a WHATWG URL and its scheme
 * is compared (case-insensitively) against the allowlist.
 *
 * Policy:
 *   - allowlist must be a NON-EMPTY array of strings, else INVALID_CONSTRAINT
 *     (fail safe — an empty/malformed allowlist must never silently pass).
 *   - unparseable URL → INVALID_FORMAT (format 'url').
 *   - scheme not in allowlist → DISALLOWED_SCHEME.
 *   - embedded credentials (user:pass@host) are irrelevant and PASS.
 *
 * @returns {object|null}
 */
export function evaluateAllowedSchemes(value, allowedSchemes) {
  const valid = Array.isArray(allowedSchemes)
    && allowedSchemes.length > 0
    && allowedSchemes.every((s) => typeof s === 'string' && s.trim() !== '');
  if (!valid) {
    return { code: ERROR_CODES.INVALID_CONSTRAINT, constraint: 'allowedSchemes' };
  }

  if (parseUrl(value) === null) {
    return { code: ERROR_CODES.INVALID_FORMAT, format: 'url' };
  }

  const scheme = parseUrlScheme(value);
  const allowlist = allowedSchemes.map((s) => s.trim().toLowerCase());
  return allowlist.includes(scheme)
    ? null
    : { code: ERROR_CODES.DISALLOWED_SCHEME, scheme, allowed: allowedSchemes };
}
