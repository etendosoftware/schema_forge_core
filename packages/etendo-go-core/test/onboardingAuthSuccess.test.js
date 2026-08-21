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
// __Host- cookie. The backend responses for POST /sws/go/session (login),
// /session/register and /session/sso/{provider} carry { status, account, csrfToken }
// and NEVER a `token` field. handleAuthSuccess in both LoginStep and RegisterStep
// must stop persisting anything to localStorage, drop the now-unused `authMethod`
// parameter, and every call site must branch on `data.csrfToken` instead of
// `data.token`.
//
// TDD red step: this test targets the NEW contract, not the current code. It is
// expected to fail against today's LoginStep.jsx/RegisterStep.jsx (which still
// take `authMethod`, still write to localStorage, and still check `data.token`).
// LoginStep.jsx and RegisterStep.jsx are NOT touched by this change — implementation
// is a separate follow-up.

function extractFunctionBlock(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.notEqual(start, -1, `"${startMarker}" not found`);
  const end = src.indexOf(endMarker, start);
  assert.notEqual(end, -1, `"${endMarker}" not found after "${startMarker}"`);
  return src.slice(start, end);
}

describe('LoginStep handleAuthSuccess contract (ETP-4576, cookie session migration)', () => {
  it('handleAuthSuccess no longer accepts an authMethod parameter', () => {
    assert.match(
      loginStep,
      /handleAuthSuccess\s*=\s*useCallback\(\s*\(\s*\w+\s*,\s*account\s*,\s*\{\s*route\s*=\s*true\s*\}\s*=\s*\{\}\s*\)/,
      'handleAuthSuccess signature must be (token-like, account, { route = true } = {}) with no authMethod',
    );
    const handlerBlock = extractFunctionBlock(loginStep, 'const handleAuthSuccess', 'const handleSsoProviderLogin');
    assert.doesNotMatch(handlerBlock, /authMethod/);
  });

  it('no longer persists the session token/auth method to localStorage', () => {
    assert.doesNotMatch(loginStep, /localStorage\.setItem\('sf_platform_token'/);
    assert.doesNotMatch(loginStep, /localStorage\.setItem\('sf_platform_auth_method'/);
  });

  it('still calls setToken and routeByEnvironments with the first argument', () => {
    const handlerBlock = extractFunctionBlock(loginStep, 'const handleAuthSuccess', 'const handleSsoProviderLogin');
    assert.match(handlerBlock, /if \(setToken\) setToken\(\w+\)/);
    assert.match(handlerBlock, /if \(route && routeByEnvironments\)/);
  });

  // The epic (ETP-4969's block) routed both login paths through
  // `completeAuthentication`, which centralises persist + hand-off. Its `token`
  // parameter is the generic credential slot; what must travel in it here is the
  // CSRF proof, because both endpoints these paths call belong to the session
  // family and the session itself is the `__Host-` cookie the page cannot read.
  it('handleSsoProviderLogin hands completeAuthentication the CSRF proof, not a bearer token', () => {
    const block = extractFunctionBlock(loginStep, 'const handleSsoProviderLogin', 'useEffect(() => {\n    if (view');
    assert.match(block, /if \(data\.csrfToken\)/);
    assert.doesNotMatch(block, /if \(data\.token\)/);
    assert.match(block, /completeAuthentication\(\{[\s\S]*?token: data\.csrfToken/);
    assert.doesNotMatch(block, /token: data\.token/);
  });

  it('handleLogin hands completeAuthentication the CSRF proof, not a bearer token', () => {
    const block = extractFunctionBlock(loginStep, 'const handleLogin =', 'const handleForgotPassword');
    assert.match(block, /if \(data\.csrfToken\)/);
    assert.doesNotMatch(block, /if \(data\.token\)/);
    assert.match(block, /completeAuthentication\(\{[\s\S]*?token: data\.csrfToken/);
    assert.doesNotMatch(block, /token: data\.token/);
  });

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
  it('handleAuthSuccess no longer accepts an authMethod parameter', () => {
    assert.match(
      registerStep,
      /handleAuthSuccess\s*=\s*useCallback\(\s*\(\s*\w+\s*,\s*account\s*,\s*\{\s*route\s*=\s*true\s*\}\s*=\s*\{\}\s*\)/,
      'handleAuthSuccess signature must be (token-like, account, { route = true } = {}) with no authMethod',
    );
    const handlerBlock = extractFunctionBlock(registerStep, 'const handleAuthSuccess', 'const handleSsoProviderLogin');
    assert.doesNotMatch(handlerBlock, /authMethod/);
  });

  it('no longer persists the session token/auth method to localStorage', () => {
    assert.doesNotMatch(registerStep, /localStorage\.setItem\('sf_platform_token'/);
    assert.doesNotMatch(registerStep, /localStorage\.setItem\('sf_platform_auth_method'/);
  });

  it('still calls setToken and handleRegisterSuccess with the first argument', () => {
    const handlerBlock = extractFunctionBlock(registerStep, 'const handleAuthSuccess', 'const handleSsoProviderLogin');
    assert.match(handlerBlock, /if \(setToken\) setToken\(\w+\)/);
    assert.match(handlerBlock, /if \(route && handleRegisterSuccess\)/);
    assert.match(handlerBlock, /handleRegisterSuccess\(\w+,\s*account\)/);
  });

  it('handleSsoProviderLogin checks data.csrfToken, not data.token, and drops the authMethod override', () => {
    const block = extractFunctionBlock(registerStep, 'const handleSsoProviderLogin', 'useEffect(() => {');
    assert.match(block, /if \(data\.csrfToken\)/);
    assert.doesNotMatch(block, /if \(data\.token\)/);
    assert.match(block, /handleAuthSuccess\(data\.csrfToken,\s*data\.account[,)]/);
    assert.doesNotMatch(block, /handleAuthSuccess\(data\.(csrfToken|token),\s*data\.account,\s*\{\s*authMethod:\s*'sso'\s*\}\)/);
  });

  // The SSO branch above stays cookie-only: it posts to `/sws/go/session/sso/*`,
  // which always issues the cookie. Password registration is different, because
  // a host may supply its own `registerHandler` fronting an endpoint that never
  // joined the session family and still answers with a bearer `token` (Etendo
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

describe('No lingering sf_platform_token/sf_platform_auth_method references (ETP-4576)', () => {
  it('LoginStep.jsx has no references to the removed localStorage keys', () => {
    assert.doesNotMatch(loginStep, /sf_platform_token/);
    assert.doesNotMatch(loginStep, /sf_platform_auth_method/);
  });

  it('RegisterStep.jsx has no references to the removed localStorage keys', () => {
    assert.doesNotMatch(registerStep, /sf_platform_token/);
    assert.doesNotMatch(registerStep, /sf_platform_auth_method/);
  });
});
