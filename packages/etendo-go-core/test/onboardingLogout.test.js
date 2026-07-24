import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOnboardingLogout } from '../src/onboarding/logout.js';
import { ENVIRONMENT_SESSION_KEYS, clearEnvironmentSession } from '../src/onboarding/state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const onboardingSrc = join(__dirname, '..', 'src', 'onboarding');

describe('createOnboardingLogout', () => {
  it('shares one in-flight logout operation, clears the session once, and tracks success once', async () => {
    let resolveCleanup;
    const cleanupSession = () => new Promise((resolve) => {
      resolveCleanup = resolve;
    });
    let resets = 0;
    let navigations = 0;
    const telemetry = [];
    const onLogout = createOnboardingLogout({
      cleanupSession,
      resetState: () => { resets += 1; },
      navigateToLogin: () => { navigations += 1; },
      track: (...args) => telemetry.push(args),
    });

    const firstLogout = onLogout();
    const repeatedLogout = onLogout();

    assert.strictEqual(repeatedLogout, firstLogout);
    resolveCleanup();
    await firstLogout;

    assert.equal(resets, 1);
    assert.equal(navigations, 1);
    assert.deepEqual(telemetry, [[
      'onboarding_auth_logout',
      { action: 'logout', status: 'success' },
    ]]);
  });

  it('resets local state, reaches Login, and tracks one failure when cleanup fails', async () => {
    let resets = 0;
    let navigations = 0;
    const telemetry = [];
    const onLogout = createOnboardingLogout({
      cleanupSession: async () => { throw new Error('storage unavailable'); },
      resetState: () => { resets += 1; },
      navigateToLogin: () => { navigations += 1; },
      track: (...args) => telemetry.push(args),
    });

    await onLogout();

    assert.equal(resets, 1);
    assert.equal(navigations, 1);
    assert.deepEqual(telemetry, [[
      'onboarding_auth_logout',
      { action: 'logout', status: 'failed' },
    ]]);
  });

  it('does not repeat cleanup, state reset, or navigation when telemetry throws', async () => {
    let cleanups = 0;
    let resets = 0;
    let navigations = 0;
    const onLogout = createOnboardingLogout({
      cleanupSession: () => { cleanups += 1; },
      resetState: () => { resets += 1; },
      navigateToLogin: () => { navigations += 1; },
      track: () => { throw new Error('telemetry unavailable'); },
    });

    await onLogout();

    assert.equal(cleanups, 1);
    assert.equal(resets, 1);
    assert.equal(navigations, 1);
  });

  it('flushes a pending draft before cleanup and still logs out when the flush fails', async () => {
    const calls = [];
    const onLogout = createOnboardingLogout({
      flushDraft: async () => {
        calls.push('flush');
        throw new Error('HTTP 429');
      },
      cleanupSession: () => calls.push('cleanup'),
      resetState: () => calls.push('reset'),
      navigateToLogin: () => calls.push('login'),
      track: () => calls.push('track'),
    });

    await onLogout();

    assert.deepEqual(calls, ['flush', 'cleanup', 'reset', 'login', 'track']);
  });

  it('provides the central callback to every onboarding step and leaves no concrete logout handler', () => {
    const flow = readFileSync(join(onboardingSrc, 'OnboardingFlow.jsx'), 'utf8');
    const envSelect = readFileSync(join(onboardingSrc, 'steps', 'EnvSelectStep.jsx'), 'utf8');

    assert.match(flow, /<StepComponent[\s\S]*onLogout=\{onLogout\}/);
    assert.match(envSelect, /onLogout=\{onLogout\}/);
    assert.doesNotMatch(envSelect, /const handleLogout/);
    assert.doesNotMatch(envSelect, /localStorage\.removeItem\('sf_platform_(token|auth_method)'\)/);
  });

  it('composes cleanupSession from both the platform and the environment session storage', () => {
    // cleanupSession must clear the generic app-shell-core auth storage AND the
    // Etendo environment session written by buildEnvironmentSessionStorage —
    // otherwise a logout leaves stale environment/role data behind.
    const flow = readFileSync(join(onboardingSrc, 'OnboardingFlow.jsx'), 'utf8');
    const cleanupBlock = flow.slice(
      flow.indexOf('cleanupSession: () =>'),
      flow.indexOf('resetState: () => logoutContextRef'),
    );

    assert.match(cleanupBlock, /authStorageRef\.current\.clear\(\)/);
    assert.match(cleanupBlock, /clearEnvironmentSession\(\)/);
  });
});

describe('clearEnvironmentSession', () => {
  let store;
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    store = new Map([['unrelated_key', 'keep-me']]);
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
  });

  afterEach(() => {
    globalThis.localStorage = originalLocalStorage;
  });

  it('clears every Etendo environment session key and preserves unrelated keys', () => {
    // Seed the full environment session (written by buildEnvironmentSessionStorage).
    for (const key of ENVIRONMENT_SESSION_KEYS) {
      store.set(key, `value-for-${key}`);
    }
    clearEnvironmentSession();
    for (const key of ENVIRONMENT_SESSION_KEYS) {
      assert.equal(store.has(key), false, `expected ${key} to be cleared`);
    }
    assert.equal(store.get('unrelated_key'), 'keep-me');
  });

  it('is fail-safe when localStorage.removeItem throws (private mode)', () => {
    globalThis.localStorage.removeItem = () => {
      throw new Error('QuotaExceededError: storage unavailable');
    };
    assert.doesNotThrow(clearEnvironmentSession);
  });

  it('is fail-safe when localStorage is undefined (SSR)', () => {
    globalThis.localStorage = undefined;
    assert.doesNotThrow(clearEnvironmentSession);
  });
});
