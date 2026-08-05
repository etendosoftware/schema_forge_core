import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const onboardingSrc = join(__dirname, '..', 'src', 'onboarding');
const flow = readFileSync(join(onboardingSrc, 'OnboardingFlow.jsx'), 'utf8');
const envSelect = readFileSync(join(onboardingSrc, 'steps', 'EnvSelectStep.jsx'), 'utf8');

// ETP-4443: Login must be the default onboarding view (post-logout and cold entry). The product
// evolved so the login flow is the main entry point; register is only a secondary action.
describe('Onboarding default view (ETP-4443)', () => {
  it('defaults to login when there is no session token', () => {
    // The only accepted opt-out is an explicit initialView === "register"; everything else is login.
    assert.match(flow, /goToStep\(\s*initialView === 'register'\s*\?\s*'register'\s*:\s*'login'\s*\)/);
    assert.doesNotMatch(flow, /goToStep\(initialView === 'login' \? 'login' : 'register'\)/);
  });

  // ETP-4576: this test used to assert that "no token" and "invalid token" resolved
  // to two different views (register-eligible vs. always-login). With the __Host-
  // session cookie, the frontend can no longer tell those two cases apart — both
  // "never had a session" and "had one but it expired/is invalid" surface as the
  // exact same 401 from GET /sws/go/session, handled by the exact same .catch().
  // The distinction this test verified no longer exists in the code, so the test
  // is removed rather than updated. The unified behavior (both cases respect
  // initialView) is covered by 'defaults to login when there is no session token'
  // above, since it now applies to the single shared catch branch too.

  it('does not fall back to register anywhere in the mount routing', () => {
    // The two former register fallbacks (invalid token + non-promise mock) are now login.
    // The remaining goToStep('register') calls belong to the login->register switch link only.
    assert.doesNotMatch(flow, /default to registering/);
  });

  it('sends the user to login after logging out from the env-select step', () => {
    assert.match(envSelect, /onLogout=\{onLogout\}/);
    assert.doesNotMatch(envSelect, /const handleLogout/);
    assert.doesNotMatch(envSelect, /localStorage\.removeItem\('sf_platform_token'\)/);
  });

  // ETP-4576: the mount bootstrap no longer reads a client-visible token to decide
  // whether a session exists — it always asks the server via fetchSession(), which
  // rides the __Host- cookie and returns 401 when there is none/it is invalid.
  it('bootstraps the session via fetchSession instead of reading the old localStorage token', () => {
    assert.match(flow, /fetchSession\(fetch, apiBase\)/);
    assert.doesNotMatch(flow, /localStorage\.getItem\('sf_platform_token'\)/);
  });
});
