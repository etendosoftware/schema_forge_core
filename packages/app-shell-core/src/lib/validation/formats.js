/**
 * ETP-4556 — Named format validators + URL scheme validation.
 *
 * Pure, reusable format checks with ZERO field-name inference (name-based
 * inference lives only in the temporary compatAdapter.js). A format validator
 * receives an already-present, non-empty value and returns `true` when it
 * conforms.
 *
 * URL scheme validation is exposed separately (`parseUrlScheme`) because it is
 * driven by the `allowedSchemes` constraint, not by `format`.
 */

// Kept in sync with the functional heuristic's EMAIL_PATTERN
// (schema_forge/tools/app-shell/src/components/contract-ui/recipientEdits.js).
const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

// Phone: digits plus the separator charset, with at least one digit. This is a
// charset guard, not full E.164 validation (mirrors the functional isValidPhone).
const PHONE_PATTERN = /^[\d+()\-.\s]+$/;

/**
 * Named format validators. `email`, `phone` and `url` are the formats the engine
 * knows today; any other `format` value is a contract error (INVALID_CONSTRAINT),
 * handled by the format constraint evaluator.
 */
export const FORMAT_VALIDATORS = Object.freeze({
  email(value) {
    const s = String(value).trim();
    // Lowercase only the domain part, matching normalizeEmailAddress upstream.
    const at = s.lastIndexOf('@');
    const normalized = at < 0 ? s : s.slice(0, at) + '@' + s.slice(at + 1).toLowerCase();
    return EMAIL_PATTERN.test(normalized);
  },
  phone(value) {
    const s = String(value).trim();
    return PHONE_PATTERN.test(s) && /\d/.test(s);
  },
  url(value) {
    const url = parseUrl(value);
    return url !== null && hasDomainShapedHost(url.hostname);
  },
});

// ETP-4557 — a URL must carry a domain-SHAPED host: at least two dot-separated DNS labels and a
// 2+ letter TLD (or an IPv4 literal). "https://asda" parses as a URL but is not a usable website.
// Split-and-test with single-use regexes (no nested quantifiers) to stay ReDoS-safe.
const DOMAIN_LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
const TLD_RE = /^[a-z]{2,}$/i;
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

function hasDomainShapedHost(hostname) {
  if (IPV4_RE.test(hostname)) return true;
  const labels = hostname.split('.');
  if (labels.length < 2) return false;
  if (!TLD_RE.test(labels[labels.length - 1]) && !labels[labels.length - 1].startsWith('xn--')) return false;
  return labels.every((label) => DOMAIN_LABEL_RE.test(label));
}

export const KNOWN_FORMATS = Object.freeze(Object.keys(FORMAT_VALIDATORS));

/**
 * Parse a value as a WHATWG URL after trimming surrounding whitespace.
 * @param {*} value
 * @returns {URL|null} the parsed URL, or null when unparseable.
 */
export function parseUrl(value) {
  const s = String(value).trim();
  if (s === '') return null;
  try {
    return new URL(s);
  } catch {
    return null;
  }
}

/**
 * Extract the lowercase scheme (protocol without the trailing ":") from a URL
 * value, or null when the value is not a parseable URL.
 *
 * Embedded credentials (`user:pass@host`) are irrelevant to the scheme and are
 * intentionally ignored — such URLs PASS. Comparison against an allowlist is the
 * caller's job.
 *
 * @param {*} value
 * @returns {string|null}
 */
export function parseUrlScheme(value) {
  const url = parseUrl(value);
  if (url === null) return null;
  // url.protocol is e.g. "https:" — strip the colon and lowercase (already lower
  // per spec, but normalize defensively).
  return url.protocol.replace(/:$/, '').toLowerCase();
}
