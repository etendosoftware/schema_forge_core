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

  it('centralizes credential access through the session instead of props', () => {
    // `useAuthOptional` rather than `useAuth` since ETP-5022: the hook must not throw in a
    // tree with no AuthProvider, because it replaced a raw `fetch` in ~105 components whose
    // tests render them bare. Whatever the scheme, the credential comes from the session
    // and never from a prop — under the cookie scheme there is none to read and the
    // `__Host-` session travels on its own.
    assert.match(src, /useAuthOptional\(\)/);
    assert.match(src, /auth\?\.token/);
    assert.match(src, /createApiFetch/);
  });

  it('falls back to the ambient session when there is no provider', () => {
    assert.match(src, /getAmbientToken/);
    assert.match(src, /notifyAmbientUnauthorized/);
  });

  it('wires the global unauthorized handler to logout', () => {
    // Matched across the whole createApiFetch(...) argument list, which spans several lines
    // and contains arrow functions — so this cannot be a `[^)]*` scan.
    const call = src.slice(src.indexOf('createApiFetch('));
    assert.match(call, /logout \|\| notifyAmbientUnauthorized/);
  });
});

// ETP-4576 x ETP-5195 — what this hook may and may not hand to createApiFetch.
//
// Through cycle 3 the second slot WAS the CSRF getter, and these guards existed because a
// bearer passed into it shipped the credential as `X-Go-CSRF`: a non-proof where the proof
// belongs, which answered 403 on every unsafe request while reads kept working — the shape
// that took three confirm flows down in the integration suite.
//
// ETP-5195 took that slot for the token getter, because a scoped client has to re-read the
// bearer through the live session on every dispatch: that is what re-arms a write that sat
// in the queue while the token rotated. The proof moved to ./sessionCredentials.js and is
// read inside the dispatch, so the old failure is now structurally impossible — there is no
// slot left to put a credential in, and api.test.js pins the assignment. What remains for
// this hook is that it reads through the SCOPE rather than capturing a value.
describe('useApiFetch — session wiring (ETP-4576 x ETP-5195)', () => {
  it('reads the token through the scope, not from a value captured at render', () => {
    // A captured token is the bug ETP-5255 fixed: a queued write went out under the bearer
    // its render happened to see, which a refresh had since replaced.
    assert.match(src, /scope\s*\?\s*\(\)\s*=>\s*scope\.getSnapshot\(\)\.session\.token/);
  });

  it("passes the scope as createApiFetch's fourth argument", () => {
    const call = src.slice(src.indexOf('createApiFetch('));
    assert.match(call.slice(0, call.indexOf('), [')), /onUnauthorized|logout \|\| notifyAmbientUnauthorized[\s\S]{0,40}scope/);
  });

  it('never builds a credential or a proof header itself', () => {
    // Both belong to the shared builders, which resolve them from the active scheme. A hook
    // that spells either one out has forked the scheme decision, which is exactly how the
    // bearer fallback broke before the preference existed.
    // Comments are stripped first: prose explaining WHY neither is built here necessarily
    // names them, and a comment must never be what makes a test fail.
    const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(codeOnly, /Authorization/);
    assert.doesNotMatch(codeOnly, /Bearer/);
    assert.doesNotMatch(codeOnly, /X-Go-CSRF/);
  });

  it('re-derives the request function when the session revision changes', () => {
    // The memo depends on WHETHER there is a session and on its revision, never on the
    // context object's identity: a provider handing back a fresh object each render would
    // otherwise rebuild the request function on every render.
    assert.match(src, /auth\?\.authRevision/);
  });
});
