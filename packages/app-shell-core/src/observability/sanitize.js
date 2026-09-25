/**
 * Deny-by-default recursive sanitizer for the telemetry egress gateway (ETP-4577, PRD WS-3).
 *
 * Two independent layers apply to every value, regardless of caller intent:
 *
 *  1. Key gate — a key survives only if it is in the caller's `allowedKeys` allowlist,
 *     at ANY nesting depth. There is no per-path schema (yet, see ETP-4578): the same
 *     allowlist governs the whole payload, so a nested `password` under an approved
 *     container key is dropped exactly like a top-level one would be.
 *  2. Value scrub — even an ALLOWED key's string value is pattern-checked for secrets
 *     (bearer tokens, JWTs, opaque high-entropy blobs, emails) and for URLs, whose
 *     query string and fragment are stripped. This catches a secret that leaked into
 *     an otherwise-legitimate field (e.g. an error `message` embedding a token).
 *
 * Depth, key-count, array-length and string-length limits protect against both
 * accidental giant payloads (a whole request body attached to `details`) and
 * pathological/circular structures. Every limit is enforced with a deterministic
 * replacement marker, never a thrown error — sanitization must never be the reason a
 * request or a render fails.
 */

export const REDACTED = '[REDACTED]';
export const DEPTH_LIMIT_MARKER = '[DEPTH_LIMIT]';
export const SIZE_LIMIT_MARKER = '[SIZE_LIMIT]';
export const CIRCULAR_MARKER = '[CIRCULAR]';
export const OVERSIZED_MARKER = { __oversized__: SIZE_LIMIT_MARKER };

export const DEFAULT_MAX_DEPTH = 6;
export const DEFAULT_MAX_KEYS = 50;
export const DEFAULT_MAX_ARRAY_LENGTH = 50;
export const DEFAULT_MAX_STRING_LENGTH = 500;
// Belt-and-suspenders on top of the per-field limits above: a wide array of objects can
// pass maxKeys/maxArrayLength/maxStringLength individually while still summing to a huge
// payload (Jira scope: "límites de tamaño/profundidad" — size, not just per-field size).
export const DEFAULT_MAX_SERIALIZED_BYTES = 32 * 1024;

// Key-name substrings that force redaction of their value even when the key itself was
// explicitly allowlisted — defense in depth against an over-broad caller allowlist.
// `body`/`payload` cover request/response bodies, their own named category in scope
// (PRD WS-3, Jira alcance) alongside tokens/cookies/headers, not just a size concern.
const SENSITIVE_KEY_PATTERN =
  /token|secret|passw|cookie|authoriz|apikey|api_key|credential|session|privatekey|private_key|\bssn\b|creditcard|cvv|body|payload/i;

// Unanchored on purpose — these must catch a secret EMBEDDED in a longer string (an
// error message, a log line), not just a value that is nothing but the secret.
const BEARER_RE = /bearer\s+\S+/i;
const JWT_RE = /[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const URL_RE = /^[a-z][a-z0-9+.-]*:\/\/\S+$/i;
// A long run of base64/hex-ish characters with no separators reads as an opaque secret
// (API key, session id) even without a recognizable prefix. Trade-off: a long-enough
// UUID-like identifier is redacted too — acceptable for a deny-by-default boundary.
const OPAQUE_TOKEN_RE = /[A-Za-z0-9+/_=-]{40,}/;
// Real tokens mix case and digits; a low-variety run ('aaaa…', a repeated pattern) is
// far more likely to be padding or a stress-test fixture than a secret.
const MIN_DISTINCT_CHARS_FOR_OPAQUE_TOKEN = 10;

function stripUrlQueryAndFragment(value) {
  const idx = value.search(/[?#]/);
  return idx === -1 ? value : value.slice(0, idx);
}

function hasOpaqueTokenRun(value) {
  const match = value.match(OPAQUE_TOKEN_RE);
  if (!match) return false;
  return new Set(match[0]).size >= MIN_DISTINCT_CHARS_FOR_OPAQUE_TOKEN;
}

function containsSecret(value) {
  return BEARER_RE.test(value) || JWT_RE.test(value) || hasOpaqueTokenRun(value) || EMAIL_RE.test(value);
}

function scrubString(value, maxStringLength) {
  // A URL is stripped down to origin+path FIRST: a secret living only in its query
  // string or fragment is gone once that part is removed, so the remainder does not
  // need to be redacted wholesale.
  let result = URL_RE.test(value) ? stripUrlQueryAndFragment(value) : value;

  if (containsSecret(result)) return REDACTED;

  if (result.length > maxStringLength) {
    result = `${result.slice(0, maxStringLength)}…${SIZE_LIMIT_MARKER}`;
  }
  return result;
}

function isPlainObject(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Sanitizes an arbitrary value for telemetry egress.
 *
 * @param {unknown} value
 * @param {object} [options]
 * @param {Iterable<string>} [options.allowedKeys] Deny-by-default: object keys not in
 *   this set are dropped at every depth. Omit (or pass an empty list) to strip every
 *   object key — a bare top-level string/number still passes through value-scrubbed.
 * @param {number} [options.maxDepth]
 * @param {number} [options.maxKeys] Per object, not cumulative across the whole tree.
 * @param {number} [options.maxArrayLength]
 * @param {number} [options.maxStringLength]
 * @param {number} [options.maxSerializedBytes] Cap on the TOTAL result, checked once
 *   after sanitization — catches a payload that stays within every per-field limit but
 *   is still huge in aggregate (many objects, each individually small).
 */
export function sanitizeValue(value, options = {}) {
  const {
    allowedKeys,
    maxDepth = DEFAULT_MAX_DEPTH,
    maxKeys = DEFAULT_MAX_KEYS,
    maxArrayLength = DEFAULT_MAX_ARRAY_LENGTH,
    maxStringLength = DEFAULT_MAX_STRING_LENGTH,
    maxSerializedBytes = DEFAULT_MAX_SERIALIZED_BYTES,
  } = options;

  const allowed = allowedKeys instanceof Set ? allowedKeys : new Set(allowedKeys ?? []);
  const seen = new WeakSet();

  function walk(input, depth) {
    if (input === null || input === undefined) return input;
    if (typeof input === 'string') return scrubString(input, maxStringLength);
    if (typeof input === 'number') return Number.isFinite(input) ? input : null;
    if (typeof input === 'boolean') return input;
    if (typeof input === 'function' || typeof input === 'symbol') return undefined;

    if (depth >= maxDepth) return DEPTH_LIMIT_MARKER;

    if (Array.isArray(input)) {
      const limited = input.slice(0, maxArrayLength);
      const out = limited.map((item) => walk(item, depth + 1));
      if (input.length > maxArrayLength) out.push(SIZE_LIMIT_MARKER);
      return out;
    }

    if (isPlainObject(input)) {
      if (seen.has(input)) return CIRCULAR_MARKER;
      seen.add(input);

      const out = {};
      let count = 0;
      for (const [key, val] of Object.entries(input)) {
        if (!allowed.has(key)) continue;
        if (count >= maxKeys) {
          out.__truncated__ = SIZE_LIMIT_MARKER;
          break;
        }
        count += 1;

        if (SENSITIVE_KEY_PATTERN.test(key)) {
          out[key] = REDACTED;
          continue;
        }
        const sanitized = walk(val, depth + 1);
        if (sanitized !== undefined) out[key] = sanitized;
      }
      return out;
    }

    // A non-plain object (Date, Error, Map, a class instance, …) is never passed through
    // as-is: its own fields were never vetted against the allowlist.
    return REDACTED;
  }

  const result = walk(value, 0);

  if ((Array.isArray(result) || isPlainObject(result)) && JSON.stringify(result).length > maxSerializedBytes) {
    return OVERSIZED_MARKER;
  }

  return result;
}
