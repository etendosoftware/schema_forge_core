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
 *     (bearer tokens, JWTs, opaque high-entropy blobs, emails), and the query string
 *     and fragment of every URL or path embedded in it are stripped. This catches a
 *     secret that leaked into an otherwise-legitimate field (an error `message` or a
 *     stack trace embedding a token).
 *
 * Depth, key-count, array-length, string-length, node-count and total-size limits protect
 * against both accidental giant payloads and pathological structures (cycles, shared
 * references fanning out). Every limit is enforced with a deterministic replacement
 * marker, and `sanitizeValue()` never throws — not even for a throwing getter or a hostile
 * Proxy: sanitization must never be the reason a request or a render fails.
 */

export const REDACTED = '[REDACTED]';
export const DEPTH_LIMIT_MARKER = '[DEPTH_LIMIT]';
export const SIZE_LIMIT_MARKER = '[SIZE_LIMIT]';
export const CIRCULAR_MARKER = '[CIRCULAR]';

export const DEFAULT_MAX_DEPTH = 6;
export const DEFAULT_MAX_KEYS = 50;
export const DEFAULT_MAX_ARRAY_LENGTH = 50;
export const DEFAULT_MAX_STRING_LENGTH = 500;
// Belt-and-suspenders on top of the per-field limits above: a wide array of objects can
// pass maxKeys/maxArrayLength/maxStringLength individually while still summing to a huge
// payload. Measured in UTF-8 bytes, which is what a provider's envelope actually costs.
export const DEFAULT_MAX_SERIALIZED_BYTES = 32 * 1024;
// Caps the work itself, not just the output: shared references are walked every time they
// appear (a DAG is not a cycle), so without a budget 6 levels of a 50-wide shared array
// would mean 50^6 visits.
export const DEFAULT_MAX_NODES = 5000;

const TRUNCATED_KEY = '__truncated__';
const OVERSIZED_KEY = '__oversized__';
// Never emitted as output keys: assigning `__proto__` would rewrite the output object's
// prototype (and let an inherited payload dodge the size cap), `constructor`/`prototype`
// are prototype-pollution vectors, and the last two are this module's own markers.
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype', TRUNCATED_KEY, OVERSIZED_KEY]);

// Matched against the key normalized to [a-z0-9] only, so `x-api-key`, `access_key`,
// `refreshToken` and full-width `ｔｏｋｅｎ` all reach the same comparison.
const SENSITIVE_KEY_FRAGMENTS =
  /token|secret|passw|passphrase|cookie|authoriz|apikey|accesskey|credential|session|privatekey|creditcard|cardnumber|bearer|body|payload/;
// Too short to match as fragments without false positives (`className` holds "ssn",
// `footprint` holds "otp"), so these only match a whole word of the key.
const SENSITIVE_KEY_WORDS = new Set(['pwd', 'otp', 'totp', 'jwt', 'ssn', 'iban', 'cvv']);

// Every quantifier is bounded, and the JWT pattern may only start at the beginning of a
// run (`^` or a non-token character), so no pattern backtracks quadratically — an 80KB
// string used to take ~20s. The run anchor is written without lookbehind on purpose:
// nothing else shipped in this package uses it, and older Safari fails to parse it.
// A bearer credential is a long token, so prose ("the bearer of bad news") is not one.
const BEARER_RE = /\bbearer\s{1,32}[\w.~+/=-]{16,}/i;
// Every JWT header is base64url JSON, so it starts with `eyJ` (`{"`); without that a
// dotted package name such as `com.etendoerp.salesorderhandler.headervalidation` matched.
const JWT_RE = /(?:^|[^\w-])eyJ[\w-]{7,2048}\.[\w-]{10,2048}\.[\w-]{10,2048}/;
const EMAIL_RE = /[\w.%+-]{1,64}@[\w.-]{1,253}\.[a-z]{2,24}/i;
// A long run of base64/hex-ish characters reads as an opaque secret (API key, session id)
// even without a recognizable prefix. Trade-off: a long-enough high-entropy identifier
// (e.g. a 64-char hash) is redacted too — acceptable for a deny-by-default boundary.
const OPAQUE_RUN_RE = /[A-Za-z0-9+/_=-]{40,512}/g;
// Inside a URL or a path, '/' separates segments instead of being base64 alphabet, so the
// run is measured per segment: otherwise any route with a few kebab-case segments, or a
// stack frame such as `…/go/assets/SalesOrderEditor-DkP09aZq.js`, reads as one token.
const OPAQUE_SEGMENT_RUN_RE = /[A-Za-z0-9+_=-]{40,512}/g;
// Real tokens mix letters and digits with high variety; English words (kebab-case or
// not) have no digits, and a low-variety run ('aaaa…') is padding, not a secret.
const MIN_DISTINCT_CHARS_FOR_OPAQUE_TOKEN = 10;
// A token: anything between whitespace, quotes, parentheses or angle brackets — the
// delimiters around a URL in prose, JSON, HTML and stack frames.
const TOKEN_RE = /[^\s'"()<>]+/g;
// '?' always opens a query; '#' opens a fragment unless it starts a hash-router path
// (`#/sales-order/123`), which is route, not payload.
const QUERY_OR_FRAGMENT_RE = /\?|#(?!\/)/;
// A query with no path in front of it (`?password=x`, a bare `location.search`).
const BARE_QUERY_RE = /^[?#][^\s=&]+=/;
// Characters scanned past the output cut, so a secret straddling it is still detected.
const SCAN_MARGIN = 128;

function isPathToken(token) {
  return token.startsWith('/') || token.includes('://');
}

function isOpaqueRun(run) {
  return /[A-Za-z]/.test(run) && /\d/.test(run) && new Set(run).size >= MIN_DISTINCT_CHARS_FOR_OPAQUE_TOKEN;
}

function hasOpaqueToken(text) {
  for (const [token] of text.matchAll(TOKEN_RE)) {
    for (const [run] of token.matchAll(isPathToken(token) ? OPAQUE_SEGMENT_RUN_RE : OPAQUE_RUN_RE)) {
      if (isOpaqueRun(run)) return true;
    }
  }
  return false;
}

function containsSecret(value) {
  return BEARER_RE.test(value) || JWT_RE.test(value) || EMAIL_RE.test(value) || hasOpaqueToken(value);
}

/**
 * `https://x/p?token=a`, `/api?password=b`, `(https://x/app.js?sid=c:1:1)` and a bare
 * `?code=d` lose everything from the query or fragment. A trailing `?` or `#` carries
 * nothing and is kept, so prose like "50/50?" survives.
 */
function stripQueryFromPathLike(token) {
  const queryStart = token.search(QUERY_OR_FRAGMENT_RE);
  if (queryStart === -1 || queryStart === token.length - 1) return token;
  const slash = token.indexOf('/');
  const followsPath = slash !== -1 && slash < queryStart;
  return followsPath || BARE_QUERY_RE.test(token.slice(queryStart)) ? token.slice(0, queryStart) : token;
}

// Route segments that identify a record rather than name a screen, collapsed to ':id' so
// page analytics group by screen: numeric ids, hex ids of 12+ characters (Etendo's
// 32-char ids, UUIDs) and mixed-case opaque ids. Unlike the host's `normalizeRoute`, a
// long kebab-case slug is NOT an id — only a segment mixing upper, lower and digits is.
const ID_SEGMENT_MIN_LENGTH = 12;

function isIdSegment(segment) {
  if (/^\d+$/.test(segment)) return true;
  const compact = segment.replaceAll('-', '');
  if (compact.length >= ID_SEGMENT_MIN_LENGTH && /^[\da-f]+$/i.test(compact) && /\d/.test(compact)) return true;
  return segment.length >= ID_SEGMENT_MIN_LENGTH && /^[\w-]+$/.test(segment)
    && /[a-z]/.test(segment) && /[A-Z]/.test(segment) && /\d/.test(segment);
}

/**
 * Turns a raw route into a page-analytics key: drops the query and fragment (keeping a
 * hash-router path) and collapses record-id segments to ':id'. It does not scrub — run the
 * result through `sanitizeValue()` as well.
 *
 * @param {string} path
 * @returns {string}
 */
export function normalizeRoute(path) {
  const queryStart = path.search(QUERY_OR_FRAGMENT_RE);
  const pathOnly = queryStart === -1 ? path : path.slice(0, queryStart);
  return pathOnly
    .split('/')
    .map((segment) => (isIdSegment(segment) ? ':id' : segment))
    .join('/');
}

function scrubString(value, maxStringLength) {
  // Only what can reach the output is scanned, which bounds the cost by maxStringLength
  // instead of by the input length.
  const scanLength = maxStringLength + SCAN_MARGIN;
  const scanned = value.length > scanLength ? value.slice(0, scanLength) : value;
  // Query strings go FIRST: a secret living only in one is gone once it is stripped, so
  // the remainder does not need to be redacted wholesale.
  const stripped = scanned.replace(TOKEN_RE, stripQueryFromPathLike);

  if (containsSecret(stripped)) return REDACTED;

  const truncated = scanned.length < value.length || stripped.length > maxStringLength;
  return truncated ? `${stripped.slice(0, maxStringLength)}…${SIZE_LIMIT_MARKER}` : stripped;
}

function keyWords(key) {
  return key
    .normalize('NFKC')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function isSensitiveKey(key) {
  const words = keyWords(key);
  return SENSITIVE_KEY_FRAGMENTS.test(words.join('')) || words.some((word) => SENSITIVE_KEY_WORDS.has(word));
}

function toAllowedKeySet(allowedKeys) {
  if (allowedKeys == null) return new Set();
  if (typeof allowedKeys === 'string') return new Set([allowedKeys]);
  if (allowedKeys instanceof Set) return allowedKeys;
  try {
    return new Set(Array.from(allowedKeys).filter((key) => typeof key === 'string'));
  } catch {
    return new Set();
  }
}

function createState(options) {
  const {
    allowedKeys,
    maxDepth = DEFAULT_MAX_DEPTH,
    maxKeys = DEFAULT_MAX_KEYS,
    maxArrayLength = DEFAULT_MAX_ARRAY_LENGTH,
    maxStringLength = DEFAULT_MAX_STRING_LENGTH,
    maxSerializedBytes = DEFAULT_MAX_SERIALIZED_BYTES,
    maxNodes = DEFAULT_MAX_NODES,
  } = options ?? {};

  return {
    allowed: toAllowedKeySet(allowedKeys),
    maxDepth,
    maxKeys,
    maxArrayLength,
    maxStringLength,
    maxSerializedBytes,
    maxNodes,
    nodes: 0,
    // Ancestors of the node being walked, not every node seen: a reference repeated in
    // two sibling branches is data, only one pointing back up the current path is a cycle.
    path: new Set(),
  };
}

/** 'array', 'object' (plain), or null for anything else — including a Proxy whose trap throws. */
function containerKind(input) {
  try {
    if (Array.isArray(input)) return 'array';
    const proto = Object.getPrototypeOf(input);
    return proto === Object.prototype || proto === null ? 'object' : null;
  } catch {
    return null;
  }
}

function isOwnEnumerable(target, key) {
  try {
    return Object.prototype.propertyIsEnumerable.call(target, key);
  } catch {
    return false;
  }
}

function walkEntry(target, key, depth, state) {
  let value;
  try {
    value = target[key];
  } catch {
    return REDACTED;
  }
  return walk(value, depth + 1, state);
}

function walkArray(input, depth, state) {
  const length = input.length;
  const limit = Math.min(length, state.maxArrayLength);
  const out = [];
  for (let i = 0; i < limit; i += 1) {
    out.push(walkEntry(input, i, depth, state));
  }
  if (length > state.maxArrayLength) out.push(SIZE_LIMIT_MARKER);
  return out;
}

function walkObject(input, depth, state) {
  const out = {};
  let kept = 0;
  // Iterating the allowlist, not the input, keeps the cost bounded by the allowlist even
  // for an object with a million keys — and never touches a key that would be dropped.
  for (const key of state.allowed) {
    if (RESERVED_KEYS.has(key) || !isOwnEnumerable(input, key)) continue;
    if (kept >= state.maxKeys) {
      out[TRUNCATED_KEY] = SIZE_LIMIT_MARKER;
      break;
    }
    kept += 1;

    if (isSensitiveKey(key)) {
      out[key] = REDACTED;
      continue;
    }
    const value = walkEntry(input, key, depth, state);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function walkContainer(input, depth, state) {
  if (depth >= state.maxDepth) return DEPTH_LIMIT_MARKER;
  if (state.path.has(input)) return CIRCULAR_MARKER;

  // A non-plain object (Date, Error, Map, a class instance, …) is never passed through
  // as-is: its own fields were never vetted against the allowlist.
  const kind = containerKind(input);
  if (kind === null) return REDACTED;

  state.path.add(input);
  try {
    return kind === 'array' ? walkArray(input, depth, state) : walkObject(input, depth, state);
  } catch {
    return REDACTED;
  } finally {
    state.path.delete(input);
  }
}

function walk(input, depth, state) {
  state.nodes += 1;
  if (state.nodes > state.maxNodes) return SIZE_LIMIT_MARKER;

  switch (typeof input) {
    case 'string':
      return scrubString(input, state.maxStringLength);
    case 'number':
      return Number.isFinite(input) ? input : null;
    case 'boolean':
      return input;
    case 'undefined':
    case 'function':
    case 'symbol':
      return undefined;
    case 'bigint':
      return REDACTED;
    default:
      return input === null ? null : walkContainer(input, depth, state);
  }
}

function utf8ByteLength(text) {
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

function exceedsSerializedBudget(result, maxSerializedBytes) {
  const json = JSON.stringify(result);
  if (json === undefined) return false;
  // A UTF-16 unit is 1–3 UTF-8 bytes, so these two bounds settle most cases for free.
  if (json.length > maxSerializedBytes) return true;
  if (json.length * 3 <= maxSerializedBytes) return false;
  return utf8ByteLength(json) > maxSerializedBytes;
}

/**
 * Sanitizes an arbitrary value for telemetry egress. Never throws.
 *
 * @param {unknown} value
 * @param {object} [options]
 * @param {Iterable<string>|string} [options.allowedKeys] Deny-by-default: object keys not
 *   in this set are dropped at every depth. Omit (or pass an empty list) to strip every
 *   object key — a bare top-level string/number still passes through value-scrubbed.
 * @param {number} [options.maxDepth]
 * @param {number} [options.maxKeys] Per object, not cumulative across the whole tree.
 * @param {number} [options.maxArrayLength]
 * @param {number} [options.maxStringLength]
 * @param {number} [options.maxSerializedBytes] UTF-8 size cap on the WHOLE result, checked
 *   once after sanitization.
 * @param {number} [options.maxNodes] Cap on values visited, including repeated references.
 * @param {(error: unknown) => void} [options.onInternalError] Called when sanitization
 *   itself fails as a whole and the value degrades to `[REDACTED]` — a bug in this module,
 *   not a hostile value (those are contained per key, silently, by design).
 */
export function sanitizeValue(value, options = {}) {
  try {
    const state = createState(options);
    const result = walk(value, 0, state);
    if (!exceedsSerializedBudget(result, state.maxSerializedBytes)) return result;
    // A fresh object every time: a provider SDK may mutate the payload it receives.
    return typeof result === 'object' && result !== null ? { [OVERSIZED_KEY]: SIZE_LIMIT_MARKER } : SIZE_LIMIT_MARKER;
  } catch (error) {
    reportInternalError(options, error);
    return REDACTED;
  }
}

function reportInternalError(options, error) {
  try {
    options?.onInternalError?.(error);
  } catch {
    // The report is best effort: it must not break the never-throws contract it serves.
  }
}
