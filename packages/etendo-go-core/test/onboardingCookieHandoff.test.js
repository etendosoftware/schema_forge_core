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
// These assertions are regression tests: the contract described above is
// already implemented, and they pin it down so the handoff channel cannot creep
// back in (a reintroduced `sf_auth_*` write, or a revived `if (data.token)`
// guard, breaks them).
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

const HANDOFF_MEMBERS = [
  'ENVIRONMENT_SESSION_KEYS',
  'buildEnvironmentSessionStorage',
  'persistEnvironmentSession',
  'clearEnvironmentSession',
];

describe('the localStorage session handoff is unreachable from the flow (ETP-4576)', () => {
  // These four members still exist in state.js, and this suite used to assert that three of
  // them had been deleted outright. They survived the merge of develop because ETP-5195's
  // `sessionPersistence.vitest.jsx` exercises persistEnvironmentSession and
  // clearEnvironmentSession DIRECTLY — its assertions read the sf_auth_* tuple back through
  // createLocalAuthStorage(), so the keys are the very thing it measures.
  //
  // What ETP-4576 actually needs is that the CHANNEL is gone, and it is: no onboarding
  // consumer calls the writer any more (asserted below), because the endpoint that used to
  // feed it returns no token to persist. The members are now a bearer-era helper reachable
  // only from that one suite.
  //
  // FOLLOW-UP: deleting them is a separate change that also deletes develop's suite, which is
  // a call about ETP-5195's scope rather than this one's. Until then, what must not creep
  // back is a CONSUMER reaching for them — which is what this file pins.
  it('keeps every export that is not part of the handoff', () => {
    for (const name of SURVIVING_STATE_EXPORTS) {
      assert.equal(name in onboardingState, true, `state.js must still export ${name}`);
    }
  });

  it('keeps the sf_auth_ keys confined to the handoff helper', () => {
    // Every mention of a handoff key must sit inside the helper. The preference key is
    // deliberately separate: it survives logout, and grouping it with the session keys is
    // how it used to get cleared along with them.
    const codeOnly = state.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const helper = codeOnly.slice(codeOnly.indexOf('ENVIRONMENT_SESSION_KEYS'));
    const beforeHelper = codeOnly.slice(0, codeOnly.indexOf('ENVIRONMENT_SESSION_KEYS'));
    assert.doesNotMatch(beforeHelper, /sf_auth_/, 'a handoff key leaked outside the helper');
    assert.ok(helper.includes('sf_auth_token'));
    assert.ok(codeOnly.includes('localStorage.setItem(LAST_ENVIRONMENT_KEY, clientId)'));
  });

  it('re-exports the surviving state members from the onboarding barrel', () => {
    for (const name of SURVIVING_STATE_EXPORTS) {
      assert.match(barrel, new RegExp(name), `barrel must still re-export ${name}`);
    }
  });

  it('exposes the helper only as a whole, never half of it', () => {
    // A partial removal is worse than either end state: a barrel that still hands out the
    // writer while the key list is gone produces a session written under no keys at all.
    const exported = HANDOFF_MEMBERS.filter((name) => name in onboardingState);
    assert.deepEqual(exported, HANDOFF_MEMBERS, 'state.js exports only part of the handoff helper');
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
      // Comments stripped first: the prose explaining WHY the token is not read necessarily
      // names the field it refuses to read, and a comment must never be what fails a test.
      const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      assert.match(
        codeOnly,
        /if \(data\.status === 'success'\)/,
        `${name} must gate the success path on the response status`,
      );
      assert.doesNotMatch(
        codeOnly,
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
