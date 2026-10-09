/**
 * Scanner used by `__tests__/provider-import-guard.test.js` (ETP-4577) to fail CI when
 * a source file imports a known observability provider SDK directly, bypassing
 * `createTelemetryGateway()` (./gateway.js). Kept as a small standalone module (rather
 * than inline in the test) so the detection logic itself has its own self-test —
 * mirroring `no-raw-fetch.test.js` in the schema_forge host, the existing precedent
 * for a regex-over-source-tree architectural guard in this codebase.
 *
 * Limitation, accepted for a lint-level guard: the scanner does not parse regex literals,
 * so a quote character inside one (e.g. /'/) is read as the start of a string.
 */

// Providers named in the PRD (SEC-14) plus common alternatives, so the guard already
// covers a swap without waiting for a new ticket. Add here FIRST if a new provider is
// evaluated, before any adapter code references it.
export const BANNED_PROVIDER_SCOPES = [
  '@sentry/',
  '@sentry-internal/',
  '@datadog/',
  '@amplitude/',
  '@segment/',
  '@fullstory/',
];
export const BANNED_PROVIDER_PACKAGES = ['mixpanel-browser', 'aws-rum-web', 'posthog-js', 'logrocket'];

/** Every banned specifier prefix, for error messages. */
export const BANNED_PROVIDER_PREFIXES = [...BANNED_PROVIDER_SCOPES, ...BANNED_PROVIDER_PACKAGES];

export function isBannedProviderSpecifier(specifier) {
  if (BANNED_PROVIDER_SCOPES.some((scope) => specifier.startsWith(scope))) return true;
  return BANNED_PROVIDER_PACKAGES.some((pkg) => specifier === pkg || specifier.startsWith(`${pkg}/`));
}

// One pattern for every form: `from '…'` (import/export … from), `import '…'` (side
// effect), `import('…')` / `import(`…`)` (dynamic, including a template literal) and
// `require ('…')`. A template specifier is captured up to its closing backtick, so an
// interpolated `@sentry/${x}` still starts with the banned scope.
const SPECIFIER_RE = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*(['"`])([^'"`\n]*)\1/g;

function endOfString(source, start, quote) {
  let i = start + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) return i + 1;
    if (ch === '\n' && quote !== '`') return i;
    i += 1;
  }
  return source.length;
}

function blank(text) {
  return text.replace(/[^\n]/g, ' ');
}

/**
 * Blanks out comments while preserving line count, so a package name mentioned in prose
 * never reads as an import. Strings are skipped over FIRST: `'/app/*'` inside a string is
 * not the start of a block comment, and treating it as one used to hide the code after it.
 */
function blankComments(source) {
  const parts = [];
  let plainStart = 0;
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    let end = -1;
    let isComment = false;

    if (ch === '/' && next === '/') {
      const newline = source.indexOf('\n', i);
      end = newline === -1 ? source.length : newline;
      isComment = true;
    } else if (ch === '/' && next === '*') {
      const close = source.indexOf('*/', i + 2);
      end = close === -1 ? source.length : close + 2;
      isComment = true;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      end = endOfString(source, i, ch);
    }

    if (end === -1) {
      i += 1;
      continue;
    }
    parts.push(source.slice(plainStart, i));
    parts.push(isComment ? blank(source.slice(i, end)) : source.slice(i, end));
    i = end;
    plainStart = end;
  }
  parts.push(source.slice(plainStart));
  return parts.join('');
}

/**
 * @param {string} source File contents.
 * @returns {string[]} One entry per banned specifier found, e.g. `"@sentry/react"`.
 */
export function findBannedProviderImports(source) {
  const code = blankComments(source);
  const hits = [];
  for (const match of code.matchAll(SPECIFIER_RE)) {
    if (isBannedProviderSpecifier(match[2])) hits.push(match[2]);
  }
  return hits;
}
