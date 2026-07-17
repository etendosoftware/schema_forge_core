import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOnboardingLogout } from '../src/onboarding/logout.js';

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
});
