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

  it('centralizes token access through the session instead of props', () => {
    // `useAuthOptional` rather than `useAuth` since ETP-5022: the hook must not throw in a
    // tree with no AuthProvider, because it replaced a raw `fetch` in ~105 components whose
    // tests render them bare. It still reads the credential from the session, never from
    // a prop — and since ETP-4576 what it reads is the csrfToken, the only thing the
    // client holds once the session itself lives in the `__Host-` cookie.
    assert.match(src, /useAuthOptional\(\)/);
    assert.match(src, /auth\?\.csrfToken/);
    assert.match(src, /createApiFetch/);
  });

  it('falls back to the ambient session when there is no provider', () => {
    // ETP-4576 — the fallback for the CSRF slot is the active scheme's proof, not the
    // ambient bearer: that slot ends up in `X-Go-CSRF`, so handing it a credential both
    // leaked the bearer and put a non-proof where the proof belongs.
    assert.match(src, /getSessionCsrfToken/);
    assert.match(src, /notifyAmbientUnauthorized/);
  });

  it('wires the global unauthorized handler to logout', () => {
    // Matched across the whole createApiFetch(...) argument list, which spans several lines
    // and contains arrow functions — so this cannot be a `[^)]*` scan.
    const call = src.slice(src.indexOf('createApiFetch('));
    assert.match(call, /logout \|\| notifyAmbientUnauthorized/);
  });
});

// ETP-4576 cycle 3 — useApiFetch must feed createApiFetch's `getCsrfToken`
// slot from the in-memory csrfToken (AuthContext), not the legacy bearer
// token. The bearer token is gone from this hook's job entirely.
describe('useApiFetch — csrfToken wiring (ETP-4576)', () => {
  // ETP-5022 moved this hook onto the optional context so a module used outside a
  // provider still gets an authenticated request. What ETP-4576 asserts is unchanged:
  // the value handed to createApiFetch is the csrfToken, never a client-held credential.
  it('reads csrfToken (not token) off the auth context', () => {
    assert.match(src, /csrfToken\s*=\s*auth\?\.csrfToken/);
  });

  it("passes csrfToken as createApiFetch's second argument", () => {
    assert.match(src, /createApiFetch\(\s*\n?\s*baseUrl,\s*\n?\s*hasSession \? \(\) => csrfToken/);
  });

  it('never references a bare "token" as the value read from useAuth() for CSRF purposes', () => {
    // \btoken\b (case-insensitive) does NOT match inside `csrfToken` or
    // `getCsrfToken` — camelCase boundaries are plain word characters, so
    // there is no \b between "csrf"/"get" and "Token". Any surviving match
    // means the old bearer-token wiring (`token`, `getToken`) is still here.
    // Comments are stripped first: prose explaining WHY the bearer must not be wired here
    // necessarily names it, and a comment must never be what makes a test fail.
    const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(codeOnly, /\btoken\b/i);
  });
});
