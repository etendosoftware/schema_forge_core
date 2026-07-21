import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOnboardingLogout } from '../src/onboarding/logout.js';
import { ENVIRONMENT_SESSION_KEYS } from '../src/onboarding/state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const onboardingSrc = join(__dirname, '..', 'src', 'onboarding');
const read = (...parts) => readFileSync(join(onboardingSrc, ...parts), 'utf8');

const setupShell = read('components', 'SetupShell.jsx');
const profileStep = read('steps', 'ProfileStep.jsx');
const companyStep = read('steps', 'CompanyStep.jsx');
const envSelectStep = read('steps', 'EnvSelectStep.jsx');

// ETP-4427 — sign-out on the onboarding screen.
//
// The onboarding wizard previously left the user with no exit path on the
// data-entry steps (profile/company): a user who landed there with the wrong
// account was stuck. This adds a sign-out control to those steps, reusing the
// exact session-clearing logic that EnvSelectStep already had, now centralized
// in createOnboardingLogout so every screen exits identically.

describe('createOnboardingLogout (ETP-4427)', () => {
  let store;
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    store = new Map([
      ['sf_platform_token', 'tok-123'],
      ['sf_platform_auth_method', 'password'],
      ['unrelated_key', 'keep-me'],
    ]);
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
  });

  afterEach(() => {
    globalThis.localStorage = originalLocalStorage;
  });

  it('clears the platform session keys and leaves unrelated keys untouched', () => {
    const logout = createOnboardingLogout({ config: {} });
    logout();
    assert.equal(store.has('sf_platform_token'), false);
    assert.equal(store.has('sf_platform_auth_method'), false);
    assert.equal(store.get('unrelated_key'), 'keep-me');
  });

  it('resets flow state and returns to the login step', () => {
    const calls = { setToken: [], setAccountName: [], goToStep: [] };
    const logout = createOnboardingLogout({
      config: {},
      setToken: (v) => calls.setToken.push(v),
      setAccountName: (v) => calls.setAccountName.push(v),
      goToStep: (v) => calls.goToStep.push(v),
    });
    logout();
    assert.deepEqual(calls.setToken, [null]);
    assert.deepEqual(calls.setAccountName, [null]);
    assert.deepEqual(calls.goToStep, ['login']);
  });

  it('tracks the logout event through config.track', () => {
    const tracked = [];
    const config = { track: (event, props) => tracked.push({ event, props }) };
    createOnboardingLogout({ config })();
    assert.equal(tracked.length, 1);
    assert.equal(tracked[0].event, 'onboarding_auth_logout');
    assert.equal(tracked[0].props.action, 'logout');
  });

  it('is safe when optional state setters are omitted', () => {
    assert.doesNotThrow(() => createOnboardingLogout({ config: {} })());
  });

  it('clears every Etendo environment session key and preserves unrelated keys', () => {
    // Seed the full environment session (written by buildEnvironmentSessionStorage)
    // alongside the platform keys and an unrelated key that must survive.
    for (const key of ENVIRONMENT_SESSION_KEYS) {
      store.set(key, `value-for-${key}`);
    }
    const logout = createOnboardingLogout({ config: {} });
    logout();
    for (const key of ENVIRONMENT_SESSION_KEYS) {
      assert.equal(store.has(key), false, `expected ${key} to be cleared`);
    }
    // Platform keys are cleared too; the unrelated key is left untouched.
    assert.equal(store.has('sf_platform_token'), false);
    assert.equal(store.has('sf_platform_auth_method'), false);
    assert.equal(store.get('unrelated_key'), 'keep-me');
  });

  it('is fail-safe when localStorage.removeItem throws (private mode)', () => {
    // Simulate a storage backend that rejects writes (e.g. Safari private mode).
    globalThis.localStorage.removeItem = () => {
      throw new Error('QuotaExceededError: storage unavailable');
    };
    const calls = { setToken: [], setAccountName: [], goToStep: [] };
    const logout = createOnboardingLogout({
      config: {},
      setToken: (v) => calls.setToken.push(v),
      setAccountName: (v) => calls.setAccountName.push(v),
      goToStep: (v) => calls.goToStep.push(v),
    });
    // The thrown storage error must be swallowed.
    assert.doesNotThrow(logout);
    // State reset and login redirect still run despite the storage failure.
    assert.deepEqual(calls.setToken, [null]);
    assert.deepEqual(calls.setAccountName, [null]);
    assert.deepEqual(calls.goToStep, ['login']);
  });

  it('is fail-safe when localStorage is undefined (SSR)', () => {
    globalThis.localStorage = undefined;
    const calls = { setToken: [], setAccountName: [], goToStep: [] };
    const logout = createOnboardingLogout({
      config: {},
      setToken: (v) => calls.setToken.push(v),
      setAccountName: (v) => calls.setAccountName.push(v),
      goToStep: (v) => calls.goToStep.push(v),
    });
    assert.doesNotThrow(logout);
    assert.deepEqual(calls.setToken, [null]);
    assert.deepEqual(calls.setAccountName, [null]);
    assert.deepEqual(calls.goToStep, ['login']);
  });
});

describe('SetupShell renders an optional sign-out control (ETP-4427)', () => {
  it('renders the logout Button only when onLogout is provided', () => {
    assert.match(setupShell, /function SetupShell\(\{[^}]*onLogout[^}]*logoutLabel[^}]*\}\)/s);
    // Guard: the button is conditional on onLogout, so screens that don't pass
    // it (and the shell's other consumers) are unaffected.
    assert.match(setupShell, /\{onLogout &&\s*\(/);
    assert.match(setupShell, /onClick=\{onLogout\}/);
    assert.match(setupShell, /\{logoutLabel\}/);
    assert.match(setupShell, /data-testid="onboarding-setup-logout"/);
  });
});

describe('EnvSelectStep reuses the shared logout helper (ETP-4427)', () => {
  it('imports and uses createOnboardingLogout instead of an inline handler', () => {
    assert.match(envSelectStep, /import\s*\{\s*createOnboardingLogout\s*\}\s*from\s*'\.\.\/logout\.js'/);
    assert.match(envSelectStep, /const handleLogout = createOnboardingLogout\(\{[^}]*\}\)/);
    // The old inline token removal must be gone from the step (now centralized).
    const handlerArea = envSelectStep.slice(0, envSelectStep.indexOf('loginToEnvironment'));
    assert.doesNotMatch(handlerArea, /localStorage\.removeItem\('sf_platform_token'\)/);
  });
});

for (const [name, src] of [['ProfileStep', profileStep], ['CompanyStep', companyStep]]) {
  describe(`${name} wires sign-out into SetupShell (ETP-4427)`, () => {
    it('destructures the session state setters from props', () => {
      assert.match(src, /setToken/);
      assert.match(src, /setAccountName/);
    });

    it('builds the logout handler from the shared helper', () => {
      assert.match(src, /import\s*\{\s*createOnboardingLogout\s*\}\s*from\s*'\.\.\/logout\.js'/);
      assert.match(src, /const handleLogout = createOnboardingLogout\(\{\s*config,\s*setToken,\s*setAccountName,\s*goToStep\s*\}\)/);
    });

    it('passes onLogout and a translated logoutLabel to SetupShell', () => {
      assert.match(src, /onLogout=\{handleLogout\}/);
      assert.match(src, /logoutLabel=\{ui\('logout'\)\}/);
    });
  });
}
