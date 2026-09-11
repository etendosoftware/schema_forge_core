import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOnboardingLogout } from '../src/onboarding/logout.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const onboardingSrc = join(__dirname, '..', 'src', 'onboarding');

// Source-reading assertions of the `doesNotMatch` kind must bind to real code,
// never to the comments that explain a removal — a tombstone comment naming the
// thing that was deleted would otherwise fail the very assertion that proves it
// was deleted.
function stripLineComments(source) {
  return source.replace(/^\s*\/\/.*$/gm, '');
}

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

  it('reduces cleanupSession to the single legacy key purge', () => {
    // ETP-4576: the environment session is now the __Host- cookie — there is no
    // client-written `sf_auth_*` channel left to clear. What remains is purging
    // the LEGACY keys a pre-cookie session may have left behind, which is
    // app-shell-core's purgeLegacyAuthStorage (it owns the canonical list of 9
    // legacy keys), not the removed local clearEnvironmentSession().
    //
    // Cycle 4b readaptation: this used to ALSO require
    // `authStorageRef.current.clear()` right next to the purge. That pairing was
    // pure redundancy — see the suite below for why the local ref is gone.
    const flow = readFileSync(join(onboardingSrc, 'OnboardingFlow.jsx'), 'utf8');
    const cleanupBlock = stripLineComments(flow.slice(
      flow.indexOf('cleanupSession: () =>'),
      flow.indexOf('resetState: () => logoutContextRef'),
    ));

    assert.match(cleanupBlock, /purgeLegacyAuthStorage\(\)/);
    assert.doesNotMatch(cleanupBlock, /authStorageRef/);
    assert.doesNotMatch(cleanupBlock, /clearEnvironmentSession\(\)/);
  });
});

// ETP-4576 cycle 4b — OnboardingFlow kept its OWN createLocalAuthStorage()
// instance in `authStorageRef`, and used it for exactly one thing in two places:
// `.clear()`. Both were redundant even before this cycle:
//
//   * in cleanupSession it sat immediately next to purgeLegacyAuthStorage(),
//     which is a strict SUPERSET of it — the purge removes 9 keys (the 7
//     `sf_auth_*` plus sf_platform_token / sf_platform_auth_method) while
//     clear() removes 8 (it misses sf_auth_client_name, the key onboarding
//     itself writes, because SESSION_KEYS has no clientName entry);
//   * in the bootstrap fetchSession().catch() it was the only cleanup, so the
//     purge has to take its place there.
//
// So the ref is deleted outright rather than migrated, and createLocalAuthStorage
// leaves this file's imports. The function itself stays exported by
// app-shell-core (published API, kept per the PRD for migration/tests) — this
// package just stops instantiating it.
describe('OnboardingFlow drops its own local auth storage (ETP-4576 cycle 4b)', () => {
  const flow = readFileSync(join(onboardingSrc, 'OnboardingFlow.jsx'), 'utf8');
  // Line comments are stripped before every doesNotMatch below: a tombstone
  // comment explaining WHY createLocalAuthStorage / authStorageRef are gone is
  // desirable, and it must not be what trips the assertion. Same pattern as
  // onboardingCookieHandoff.test.js and app-shell-core's
  // test/AuthorizePage.source.test.js.
  const flowCode = stripLineComments(flow);

  it('no longer creates or references a local auth storage of its own', () => {
    assert.doesNotMatch(
      flowCode,
      /createLocalAuthStorage/,
      'OnboardingFlow must not instantiate its own localStorage-backed auth storage',
    );
    assert.doesNotMatch(
      flowCode,
      /authStorageRef/,
      'the authStorageRef was entirely redundant with purgeLegacyAuthStorage() — it must be gone',
    );
  });

  it('keeps purgeLegacyAuthStorage as its only import from the app-shell-core auth entry point', () => {
    const authImport = flowCode.match(
      /import \{([^}]*)\} from '@etendosoftware\/app-shell-core\/auth';/,
    );

    assert.ok(authImport, 'OnboardingFlow must still import from @etendosoftware/app-shell-core/auth');
    assert.match(authImport[1], /purgeLegacyAuthStorage/);
    assert.doesNotMatch(authImport[1], /createLocalAuthStorage/);
  });

  it('purges the legacy keys when the bootstrap session fetch fails, where the ref clear() used to be', () => {
    // The `.catch()` of the mount-time fetchSession(): a 401 (no session, or an
    // expired one) must still wipe whatever a pre-cookie session left on disk
    // before routing to login/register.
    const bootstrapBlock = stripLineComments(flow.slice(
      flow.indexOf('fetchSession(fetch, apiBase)'),
      flow.indexOf("goToStep(initialView === 'register' ? 'register' : 'login')"),
    ));

    assert.match(bootstrapBlock, /\.catch\(/);
    assert.match(bootstrapBlock, /purgeLegacyAuthStorage\(\)/);
    assert.doesNotMatch(bootstrapBlock, /authStorageRef/);
    assert.doesNotMatch(bootstrapBlock, /\.clear\(\)/);
  });

  it('calls purgeLegacyAuthStorage at exactly the two cleanup sites', () => {
    // Pins both replacements at once: the logout cleanup and the bootstrap
    // catch. A partial migration (one site converted, the other silently left
    // without any cleanup) fails here.
    const callSites = flowCode.match(/purgeLegacyAuthStorage\(\)/g) || [];

    assert.equal(callSites.length, 2, `expected 2 purge call sites, found ${callSites.length}`);
  });
});

// ETP-4576: the `describe('clearEnvironmentSession')` suite that lived here was
// removed together with the function it covered. The 7 `sf_auth_*` keys were
// never state — they were a handoff channel between page loads (onboarding wrote
// them, did a full-page redirect, and the app booted reading them back). The
// __Host- session cookie survives that navigation on its own and the app now
// asks the server via GET /sws/go/session, so the channel — and its writer
// buildEnvironmentSessionStorage plus its eraser clearEnvironmentSession — are
// gone. Purging leftover legacy keys is now app-shell-core's
// purgeLegacyAuthStorage, covered by
// packages/app-shell-core/src/auth/__tests__/session.test.js.
