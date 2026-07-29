import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as onboardingState from '../src/onboarding/state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packages = join(__dirname, '..', '..');
const onboardingSrc = join(__dirname, '..', 'src', 'onboarding');

const state = readFileSync(join(onboardingSrc, 'state.js'), 'utf8');
const barrel = readFileSync(join(onboardingSrc, 'index.js'), 'utf8');
const flow = readFileSync(join(onboardingSrc, 'OnboardingFlow.jsx'), 'utf8');
const envSelect = readFileSync(join(onboardingSrc, 'steps', 'EnvSelectStep.jsx'), 'utf8');
const setupProgress = readFileSync(join(onboardingSrc, 'steps', 'SetupProgressStep.jsx'), 'utf8');
const authBarrel = readFileSync(join(packages, 'app-shell-core', 'src', 'auth', 'index.js'), 'utf8');

// ETP-4576 — the `sf_auth_*` localStorage keys were never onboarding state: they
// were a HANDOFF CHANNEL between two page loads. The onboarding flow wrote them,
// did a full-page redirect (`window.location.href = ...`), and the main app
// booted cold reading them back through createLocalAuthStorage().read() to
// hydrate AuthContext.
//
// With the server-side __Host- session cookie that channel is obsolete: the
// cookie survives the full-page navigation by itself, and the app's new boot
// asks the server (GET /sws/go/session, wired as restoreSession in the host).
// So the three handoff exports — ENVIRONMENT_SESSION_KEYS,
// buildEnvironmentSessionStorage and clearEnvironmentSession — are deleted
// outright, not rewritten, and every consumer stops writing to localStorage.
//
// The complementary change is on the response side: loginEnvironment is now
// POST /sws/go/session/environment and answers
// { status, environment, roleList, csrfToken } with NO `token` field, so the
// consumers' `if (data.token)` guards are dead code and must branch on
// `data.status === 'success'`.
//
// TDD red step: these assertions target the NEW contract. They are expected to
// fail against today's sources.
//
// Structural/source-reading style is the established convention for this
// package (see onboardingDefaultView / onboardingAuthSuccess): there is no
// jsdom or React test harness here, and the .jsx files are internal (not in
// package.json#exports), so they cannot be mounted or imported.

const SURVIVING_STATE_EXPORTS = [
  'SETUP_STEP_DEFINITIONS',
  'initialSetupSteps',
  'mapBackendStepStatus',
  'applyProgressMessage',
  'buildOnboardingPayload',
  'selectPreferredOrg',
  'isProfileStepValid',
  'isCompanyStepValid',
];

const REMOVED_HANDOFF_EXPORTS = [
  'ENVIRONMENT_SESSION_KEYS',
  'buildEnvironmentSessionStorage',
  'clearEnvironmentSession',
];

describe('state.js drops the localStorage session handoff (ETP-4576)', () => {
  it('no longer exports any of the three handoff members', () => {
    for (const name of REMOVED_HANDOFF_EXPORTS) {
      assert.equal(
        name in onboardingState,
        false,
        `state.js must not export ${name} — the cookie replaced the handoff channel`,
      );
    }
  });

  it('keeps every export that is not part of the handoff', () => {
    for (const name of SURVIVING_STATE_EXPORTS) {
      assert.equal(name in onboardingState, true, `state.js must still export ${name}`);
    }
  });

  it('has no leftover reference to the removed helpers or the sf_auth_ keys', () => {
    // Guards against a partial removal that leaves the constant, a comment
    // pointing at the old writer, or a stray key name behind.
    for (const name of REMOVED_HANDOFF_EXPORTS) {
      assert.doesNotMatch(state, new RegExp(name), `state.js still mentions ${name}`);
    }
    assert.doesNotMatch(state, /sf_auth_/);
    assert.doesNotMatch(state, /localStorage/);
  });

  it('is no longer re-exported from the onboarding barrel', () => {
    assert.doesNotMatch(barrel, /buildEnvironmentSessionStorage/);
    assert.doesNotMatch(barrel, /ENVIRONMENT_SESSION_KEYS/);
    assert.doesNotMatch(barrel, /clearEnvironmentSession/);
    // The surviving state exports must stay in the barrel.
    for (const name of SURVIVING_STATE_EXPORTS) {
      assert.match(barrel, new RegExp(name), `barrel must still re-export ${name}`);
    }
  });
});

describe('No onboarding consumer writes the session to localStorage (ETP-4576)', () => {
  const consumers = [
    ['OnboardingFlow.jsx', flow],
    ['EnvSelectStep.jsx', envSelect],
    ['SetupProgressStep.jsx', setupProgress],
  ];

  for (const [name, source] of consumers) {
    it(`${name} neither imports the handoff helpers nor writes sf_auth_ keys`, () => {
      assert.doesNotMatch(source, /buildEnvironmentSessionStorage/, `${name} still uses the removed writer`);
      assert.doesNotMatch(source, /clearEnvironmentSession/, `${name} still uses the removed eraser`);
      assert.doesNotMatch(source, /sf_auth_/, `${name} still references a handoff key`);
      assert.doesNotMatch(source, /localStorage\.setItem/, `${name} still persists session data client-side`);
    });
  }
});

describe('OnboardingFlow purges legacy keys through app-shell-core (ETP-4576)', () => {
  it('imports purgeLegacyAuthStorage from the app-shell-core auth entry point', () => {
    assert.match(
      flow,
      /import \{[^}]*purgeLegacyAuthStorage[^}]*\} from '@etendosoftware\/app-shell-core\/auth';/,
    );
  });

  it('calls it during logout cleanup', () => {
    assert.match(flow, /purgeLegacyAuthStorage\(\)/);
  });

  it('is reachable: the app-shell-core auth barrel re-exports it', () => {
    // The import above only resolves if the barrel exposes the function; today
    // it only exports createLocalAuthStorage / createMemoryAuthStorage /
    // normalizeAuthSession, so this pins the missing re-export.
    assert.match(authBarrel, /purgeLegacyAuthStorage/);
  });
});

describe('Environment login consumers branch on status, not on a token (ETP-4576)', () => {
  const consumers = [
    ['EnvSelectStep.jsx', envSelect],
    ['SetupProgressStep.jsx', setupProgress],
  ];

  for (const [name, source] of consumers) {
    it(`${name} checks data.status === 'success' and never reads data.token`, () => {
      assert.match(
        source,
        /if \(data\.status === 'success'\)/,
        `${name} must gate the success path on the response status`,
      );
      assert.doesNotMatch(
        source,
        /data\.token/,
        `${name} still reads data.token — POST /sws/go/session/environment does not return one`,
      );
    });

    it(`${name} still passes the csrfToken as loginEnvironment's 3rd argument`, () => {
      // The `token` prop carries the csrfToken value (deliberate bridge from an
      // earlier cycle), so loginEnvironment keeps its 4-argument shape.
      assert.match(source, /loginEnvironment\(fetch, apiBase, token, env\)/);
    });
  }
});

describe('SetupProgressStep uses the cookie-era API signatures (ETP-4576)', () => {
  it('calls checkReadiness with two arguments (no bearer token)', () => {
    assert.match(setupProgress, /config\.checkReadiness\(fetch, apiBase\)/);
    assert.doesNotMatch(
      setupProgress,
      /config\.checkReadiness\(fetch, apiBase,/,
      'the host migrated checkReadiness to a 2-argument signature',
    );
  });

  it('calls fetchEnvironments with two arguments', () => {
    assert.match(setupProgress, /fetchEnvironments\(fetch, apiBase\)/);
    assert.doesNotMatch(
      setupProgress,
      /fetchEnvironments\(fetch, apiBase,/,
      'fetchEnvironments rides the session cookie and no longer takes an auth argument',
    );
  });
});
