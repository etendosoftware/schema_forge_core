import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ETP-4576 cycle 4a — the `tools/etendo-go-ar/app-shell` host.
//
// This host is the reason `restoreSession` stopped being opt-in: it mounts
// <AuthProvider> with NO props, so when the onboarding flow stopped writing the
// `sf_auth_*` handoff keys there was nothing left for the legacy synchronous
// path to read — `isAuthenticated` was false forever and this AuthGuard bounced
// every navigation back to /onboarding. Defaulting `restoreSession` to the
// platform fetcher (app-shell-core/src/auth/api.js → fetchCookieSession) fixes
// the authentication itself, but it also introduces a boot window: for the
// duration of GET /sws/go/session, `status === 'booting'` and `isAuthenticated`
// is still false. A guard that only looks at `isAuthenticated` would therefore
// redirect on EVERY reload, before the restore had a chance to answer. So the
// guard must hold while booting.
//
// Source-reading, not mounting: `tools/etendo-go-ar/app-shell` is a private
// scaffold workspace with no test runner and no jsdom/React harness in its
// package.json (dev deps are vite/tailwind only), and its App.jsx is not an
// exported entry point of any package. Standing up a whole Vitest setup for a
// ~60-line scaffold is not worth it; this mirrors the established convention of
// this package's suite (onboardingRetry / onboardingCookieHandoff), which
// already reaches into that host by path.
const appSrc = readFileSync(
  join(
    __dirname, '..', '..', '..',
    'tools', 'etendo-go-ar', 'app-shell', 'src', 'App.jsx',
  ),
  'utf8',
);

// Isolate the AuthGuard component so the assertions cannot accidentally be
// satisfied by unrelated code elsewhere in the file.
const guardStart = appSrc.indexOf('function AuthGuard');
const guardEnd = appSrc.indexOf('function MainApp');
const authGuardSrc = appSrc.slice(guardStart, guardEnd === -1 ? undefined : guardEnd);

describe('etendo-go-ar AuthGuard handles the restore boot window (ETP-4576)', () => {
  it('still declares an AuthGuard component', () => {
    assert.notEqual(guardStart, -1, 'expected a function AuthGuard in App.jsx');
  });

  it('reads `status` from useAuth(), not just isAuthenticated', () => {
    assert.match(
      authGuardSrc,
      /const\s*\{[^}]*\bstatus\b[^}]*\}\s*=\s*useAuth\(\)/,
      'AuthGuard must destructure `status` from useAuth() to know it is still booting',
    );
    assert.match(
      authGuardSrc,
      /const\s*\{[^}]*\bisAuthenticated\b[^}]*\}\s*=\s*useAuth\(\)/,
      'AuthGuard must keep reading isAuthenticated',
    );
  });

  it('short-circuits while status === "booting"', () => {
    assert.match(
      authGuardSrc,
      /status\s*===\s*'booting'/,
      'AuthGuard must branch on the booting status',
    );
  });

  it('checks booting BEFORE the !isAuthenticated redirect, so a reload never bounces mid-restore', () => {
    const bootingIdx = authGuardSrc.indexOf("status === 'booting'");
    const redirectIdx = authGuardSrc.search(/if\s*\(\s*!isAuthenticated\s*\)/);
    assert.notEqual(bootingIdx, -1, 'expected a booting check');
    assert.notEqual(redirectIdx, -1, 'expected the !isAuthenticated redirect to survive');
    assert.ok(
      bootingIdx < redirectIdx,
      'the booting guard must come first — otherwise the redirect wins during the boot window',
    );
  });

  it('keeps redirecting to the onboarding return-to URL once the restore says anonymous', () => {
    assert.match(authGuardSrc, /<Navigate/);
    assert.match(authGuardSrc, /buildOnboardingReturnTo\(location\)/);
    assert.match(authGuardSrc, /replace/);
  });

  it('does NOT pass a restoreSession prop to AuthProvider — the platform default is the fix', () => {
    // The whole point of moving the fetcher into app-shell-core: this host is
    // repaired without being migrated. If a restoreSession prop shows up here,
    // the duplication the default was meant to remove has come back.
    assert.doesNotMatch(appSrc, /restoreSession/);
    assert.match(appSrc, /<AuthProvider>/, 'AuthProvider is still mounted prop-free');
  });
});
