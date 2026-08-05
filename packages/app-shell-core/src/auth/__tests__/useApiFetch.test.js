import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'useApiFetch.js'), 'utf8');

describe('useApiFetch', () => {
  it('exports a hook for authenticated API requests', () => {
    assert.match(src, /export function useApiFetch/);
  });

  it('centralizes token access through AuthContext instead of props', () => {
    assert.match(src, /useAuth\(\)/);
    assert.match(src, /createApiFetch/);
  });

  it('wires the global unauthorized handler to logout', () => {
    assert.match(src, /logout/);
    assert.match(src, /createApiFetch\([^)]*logout/s);
  });
});

// ETP-4576 cycle 3 — useApiFetch must feed createApiFetch's `getCsrfToken`
// slot from the in-memory csrfToken (AuthContext), not the legacy bearer
// token. The bearer token is gone from this hook's job entirely.
describe('useApiFetch — csrfToken wiring (ETP-4576)', () => {
  it('reads csrfToken (not token) from useAuth()', () => {
    assert.match(src, /const\s*\{[^}]*\bcsrfToken\b[^}]*\}\s*=\s*useAuth\(\)/);
  });

  it('defines getCsrfToken returning csrfToken and passes it as createApiFetch\'s second argument', () => {
    assert.match(src, /function\s+getCsrfToken\s*\(\s*\)\s*\{\s*return\s+csrfToken;?\s*\}/);
    assert.match(src, /createApiFetch\(\s*baseUrl\s*,\s*getCsrfToken\s*,\s*logout\s*\)/);
  });

  it('never references a bare "token" as the value read from useAuth() for CSRF purposes', () => {
    // \btoken\b (case-insensitive) does NOT match inside `csrfToken` or
    // `getCsrfToken` — camelCase boundaries are plain word characters, so
    // there is no \b between "csrf"/"get" and "Token". Any surviving match
    // means the old bearer-token wiring (`token`, `getToken`) is still here.
    assert.doesNotMatch(src, /\btoken\b/i);
  });
});
