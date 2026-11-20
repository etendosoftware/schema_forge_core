// ETP-5138 — the core is swept by the same request policy as the functional repo
// (docs/request-policy.md): a bare `fetch(` skips apiFetch's 401 -> logout handling. The
// functional `no-raw-fetch` test stops at tools/app-shell/src, which is how the bare fetch in
// useDistinctValues survived in the core. Only the transport layer may call fetch directly.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// vitest runs with the package as its root (see vitest.config.js).
const SRC = join(process.cwd(), 'src');

// Files that ARE the transport (or deliberately probe it). Keep this list exact.
// The rest are raw-fetch call sites that predate this guard; migrating them changes request
// behaviour and is out of scope for ETP-5138, so they are pinned here instead. Do NOT add
// to this list: a new call site goes through useApiFetch.
const ALLOWED = new Set([
  'auth/api.js', // the transport itself
  'observability/nestedSecretFixtures.js', // "fetch (" inside a fixture stack-trace string
  'pages/AuthorizePage.jsx', // OAuth consent POST, runs before an app session exists
  'hooks/useNeoImage.js', // legacy: binary image GET with a Bearer header (to migrate)
  'lib/simSearch.js', // legacy: simsearch GET (to migrate)
]);

const TEST_FILE = /(\.test\.|\.vitest\.|[\\/]__tests__[\\/])/;
// A call to the global fetch: not a member (`.fetch(`), not an identifier suffix (`apiFetch(`).
const RAW_FETCH = /(?<![\w$.])fetch\s*\(/;

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(js|jsx)$/.test(name) && !TEST_FILE.test(full) ? [full] : [];
  });
}

export function findRawFetch(text) {
  return text.split('\n')
    .map((line, i) => ({ line: i + 1, text: line }))
    .filter(({ text: t }) => !/^\s*(\/\/|\*|\/\*)/.test(t) && RAW_FETCH.test(t));
}

describe('core request policy: no raw fetch', () => {
  it('flags the pre-ETP-5138 useDistinctValues call', () => {
    const old = "const res = await fetch(buildUrl(startRow, endRow, search), {\n  headers: buildHeaders(),\n});";
    expect(findRawFetch(old)).toHaveLength(1);
    expect(findRawFetch('await apiFetch(buildUrl(a))')).toHaveLength(0);
  });

  it('finds no bare fetch( outside the transport allowlist', () => {
    const offenders = [];
    for (const file of sourceFiles(SRC)) {
      const rel = relative(SRC, file).split(sep).join('/');
      if (ALLOWED.has(rel)) continue;
      for (const hit of findRawFetch(readFileSync(file, 'utf8'))) {
        offenders.push(`${rel}:${hit.line}: ${hit.text.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
