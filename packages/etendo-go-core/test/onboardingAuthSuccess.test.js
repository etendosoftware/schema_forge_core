import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const onboardingSrc = join(__dirname, '..', 'src', 'onboarding');
const loginStep = readFileSync(join(onboardingSrc, 'steps', 'LoginStep.jsx'), 'utf8');
const registerStep = readFileSync(join(onboardingSrc, 'steps', 'RegisterStep.jsx'), 'utf8');

// ETP-4576: Etendo Go's session moves from Bearer+localStorage to a server-side
// __Host- cookie. The session endpoints (POST /sws/go/session, /session/register,
// /session/sso/{provider}) answer with { status, account, csrfToken }.
//
// Two claims this file used to make turned out to be wrong, and both cost a CI
// cycle, so they are written down rather than quietly corrected:
//
//  1. "the response NEVER carries a `token`". Which scheme is active comes from a
//     backend preference, so the frontend can ship before it is switched on and
//     both shapes are reachable at runtime by design. Every call site resolves
//     `csrfToken ?? token`; gating on `csrfToken` alone turned a valid bearer
//     login into "invalid credentials".
//  2. "stop persisting ANYTHING to localStorage". Too broad: it swept up
//     `sf_platform_auth_method`, which is not a credential — it records how the
//     user signed in, and UserAvatarButton reads it to hide change-password from
//     SSO users. The credential is what must never be stored.

// Source-reading assertions run over the whole file, so a key name mentioned in
// the prose above the code that writes it matches too — a doesNotMatch then fails
// for the wrong reason (and, worse, a match can pass for one).
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

function extractFunctionBlock(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.notEqual(start, -1, `"${startMarker}" not found`);
  const end = src.indexOf(endMarker, start);
  assert.notEqual(end, -1, `"${endMarker}" not found after "${startMarker}"`);
  return src.slice(start, end);
}

describe('LoginStep handleAuthSuccess contract (ETP-4576, cookie session migration)', () => {
  it('handleAuthSuccess keeps the authMethod parameter completeAuthentication passes', () => {
    assert.match(
      loginStep,
      /handleAuthSuccess\s*=\s*useCallback\(\s*\(\s*\w+\s*,\s*account\s*,\s*\{\s*route\s*=\s*true\s*,\s*authMethod\s*=\s*'password'\s*\}\s*=\s*\{\}\s*\)/,
      "signature must be (credential, account, { route = true, authMethod = 'password' } = {})",
    );
  });

  it('never writes the credential to localStorage', () => {
    assert.doesNotMatch(loginStep, /localStorage\.setItem\('sf_platform_token'/);
  });

  it('still calls setToken and routeByEnvironments with the first argument', () => {
    const handlerBlock = extractFunctionBlock(loginStep, 'const handleAuthSuccess', 'const handleSsoProviderLogin');
    assert.match(handlerBlock, /if \(setToken\) setToken\(\w+\)/);
    assert.match(handlerBlock, /if \(route && routeByEnvironments\)/);
  });

  // The epic (ETP-4969's block) routed both login paths through
  // `completeAuthentication`, which centralises persist + hand-off. Its `token`
  // parameter is the generic credential slot: whichever credential the response
  // carried travels in it. Both paths resolve `csrfToken ?? token` — see claim 1
  // in the header for why gating on `csrfToken` alone was wrong.
  for (const [label, startMarker, endMarker] of [
    ['handleSsoProviderLogin', 'const handleSsoProviderLogin', 'useEffect(() => {\n    if (view'],
    ['handleLogin', 'const handleLogin =', 'const handleForgotPassword'],
  ]) {
    it(`${label} accepts either credential and hands it to completeAuthentication`, () => {
      const block = stripComments(extractFunctionBlock(loginStep, startMarker, endMarker));
      assert.match(block, /const credential = data\.csrfToken \?\? data\.token;/);
      assert.match(block, /if \(credential\)/);
      assert.match(block, /completeAuthentication\(\{[\s\S]*?token: credential/);
      // The old shapes must be gone: either alone would drop one scheme.
      assert.doesNotMatch(block, /if \(data\.csrfToken\)/);
      assert.doesNotMatch(block, /if \(data\.token\)/);
    });
  }

  it('handleResetPassword no longer clears the removed localStorage keys', () => {
    const block = extractFunctionBlock(loginStep, 'const handleResetPassword =', 'const setOnboardingLocale');
    assert.doesNotMatch(block, /localStorage\.removeItem\('sf_platform_token'\)/);
    assert.doesNotMatch(block, /localStorage\.removeItem\('sf_platform_auth_method'\)/);
    // Unrelated behavior in the same function must be untouched.
    assert.match(block, /if \(setToken\) setToken\(null\)/);
    assert.match(block, /if \(setAccountName\) setAccountName\(null\)/);
    assert.match(block, /setResetSuccess\(true\)/);
  });
});

describe('RegisterStep handleAuthSuccess contract (ETP-4576, cookie session migration)', () => {
  it('handleAuthSuccess keeps the authMethod parameter its SSO path overrides', () => {
    assert.match(
      registerStep,
      /handleAuthSuccess\s*=\s*useCallback\(\s*\(\s*\w+\s*,\s*account\s*,\s*\{\s*route\s*=\s*true\s*,\s*authMethod\s*=\s*'password'\s*\}\s*=\s*\{\}\s*\)/,
      "signature must be (credential, account, { route = true, authMethod = 'password' } = {})",
    );
    // An SSO registration must say so, or UserAvatarButton offers the user a
    // password they never set.
    assert.match(
      stripComments(registerStep),
      /handleAuthSuccess\(ssoCredential,\s*data\.account,\s*\{\s*authMethod: 'sso'\s*\}\)/,
    );
  });

  it('never writes the credential to localStorage', () => {
    assert.doesNotMatch(registerStep, /localStorage\.setItem\('sf_platform_token'/);
  });

  it('still calls setToken and handleRegisterSuccess with the first argument', () => {
    const handlerBlock = extractFunctionBlock(registerStep, 'const handleAuthSuccess', 'const handleSsoProviderLogin');
    assert.match(handlerBlock, /if \(setToken\) setToken\(\w+\)/);
    assert.match(handlerBlock, /if \(route && handleRegisterSuccess\)/);
    assert.match(handlerBlock, /handleRegisterSuccess\(\w+,\s*account\)/);
  });

  it('handleSsoProviderLogin accepts either credential and marks the method as sso', () => {
    const block = stripComments(extractFunctionBlock(registerStep, 'const handleSsoProviderLogin', 'useEffect(() => {'));
    assert.match(block, /const ssoCredential = data\.csrfToken \?\? data\.token;/);
    assert.match(block, /if \(ssoCredential\)/);
    assert.match(block, /handleAuthSuccess\(ssoCredential,\s*data\.account,\s*\{\s*authMethod: 'sso'\s*\}\)/);
    assert.doesNotMatch(block, /if \(data\.csrfToken\)/);
    assert.doesNotMatch(block, /if \(data\.token\)/);
  });

  // Password registration needs the same either-kind resolution for a second,
  // independent reason: a host may supply its own `registerHandler` fronting an
  // endpoint that never joined the session family and still answers with a
  // bearer `token` (Etendo
  // GO's `/company-invitations/register-and-accept`, ETP-4894). Gating on
  // `csrfToken` alone made that success path unreachable — the account was
  // created and the invitation accepted server-side while the UI reported a
  // failure — so a credential of either kind now counts as authenticated.
  //
  // What must NOT happen is relabelling: the two kinds are not interchangeable
  // downstream (a bearer token belongs in `Authorization`, a proof in
  // `X-Go-CSRF`), so the value is passed through unchanged and the caller owns
  // its interpretation. Hence `data.csrfToken ?? data.token`, preferring the
  // cookie proof when both are present, and never rewriting either.
  it('handleRegister accepts a credential of either kind, preferring the CSRF proof', () => {
    const block = extractFunctionBlock(registerStep, 'const handleRegister =', 'const authFeatureLabels');
    assert.match(block, /const credential = data\.csrfToken \?\? data\.token;/);
    assert.match(block, /if \(credential\)/);
    // Passed through as-is, to both the internal success handler and the host hook.
    assert.match(block, /handleAuthSuccess\(credential,\s*data\.account[,)]/);
    assert.match(block, /onRegistered\(credential,\s*data\.account\)/);
  });
});

/**
 * The credential must not be stored; the auth METHOD must.
 *
 * Both keys were banned together at first. That was too broad, and the ban hid a
 * regression rather than preventing one: `sf_platform_auth_method` is not a
 * credential — it records how the user signed in, and UserAvatarButton reads it
 * to hide the change-password action from SSO users. With nothing written,
 * `getItem(...) !== 'sso'` holds for everyone and an SSO user is offered a
 * password they never set.
 *
 * So the assertions are asymmetric on purpose: absence for the token, presence
 * for the method. Comments are stripped first — both key names appear in the
 * prose above the code that writes them, and a whole-file regex would match
 * those and pass (or fail) for the wrong reason.
 */
describe('localStorage keys after authentication (ETP-4576)', () => {
  const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  for (const [name, src] of [['LoginStep.jsx', loginStep], ['RegisterStep.jsx', registerStep]]) {
    it(`${name} never writes the credential to localStorage`, () => {
      assert.doesNotMatch(stripComments(src), /sf_platform_token/);
    });

    // The write itself lives in postAuth.js (`persistAuthMethod`) — it was
    // pasted into both steps and Copilot flagged the duplicated block. What each
    // step still owns is CALLING it with the method it authenticated by, so that
    // is what is asserted here; the key name is covered where it is written.
    it(`${name} still records the auth method UserAvatarButton reads`, () => {
      assert.match(stripComments(src), /persistAuthMethod\(authMethod\)/);
    });

    it(`${name} does not write the key itself`, () => {
      assert.doesNotMatch(stripComments(src), /localStorage\.setItem\('sf_platform_auth_method'/);
    });
  }
});
