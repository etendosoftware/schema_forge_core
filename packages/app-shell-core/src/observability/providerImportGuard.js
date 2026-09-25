/**
 * Scanner used by `__tests__/provider-import-guard.test.js` (ETP-4577) to fail CI when
 * a source file imports a known observability provider SDK directly, bypassing
 * `createTelemetryGateway()` (./gateway.js). Kept as a small standalone module (rather
 * than inline in the test) so the detection logic itself has its own self-test —
 * mirroring `no-raw-fetch.test.js` in the schema_forge host, the existing precedent
 * for a regex-over-source-tree architectural guard in this codebase.
 */

// Providers named in the PRD (SEC-14) plus common alternatives, so the guard already
// covers a swap without waiting for a new ticket. Add here FIRST if a new provider is
// evaluated, before any adapter code references it.
export const BANNED_PROVIDER_PACKAGES = [
  '@sentry/react',
  '@sentry/browser',
  '@sentry/core',
  'mixpanel-browser',
  'aws-rum-web',
  'posthog-js',
  '@datadog/browser-rum',
  '@amplitude/analytics-browser',
  '@segment/analytics-next',
  '@fullstory/browser',
  'logrocket',
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const IMPORT_RE = new RegExp(
  `\\bfrom\\s+['"](${BANNED_PROVIDER_PACKAGES.map(escapeRegExp).join('|')})(?:/[^'"]*)?['"]`
    + `|\\brequire\\(\\s*['"](${BANNED_PROVIDER_PACKAGES.map(escapeRegExp).join('|')})(?:/[^'"]*)?['"]\\s*\\)`
    + `|\\bimport\\(\\s*['"](${BANNED_PROVIDER_PACKAGES.map(escapeRegExp).join('|')})(?:/[^'"]*)?['"]\\s*\\)`,
  'g',
);

/**
 * Blanks out comments while preserving line count, so a package name mentioned in
 * prose (like this file's own doc comment) never reads as an import.
 */
function blankComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

/**
 * @param {string} source File contents.
 * @returns {string[]} One entry per matched banned package, e.g. `"@sentry/react"`.
 */
export function findBannedProviderImports(source) {
  const code = blankComments(source);
  const hits = [];
  for (const match of code.matchAll(IMPORT_RE)) {
    hits.push(match[1] || match[2] || match[3]);
  }
  return hits;
}
