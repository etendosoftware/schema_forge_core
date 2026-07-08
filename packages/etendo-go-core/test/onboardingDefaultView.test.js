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

  it('routes to login (not register) when the stored token is invalid', () => {
    // The fetchAccount().catch branch clears the token and must land on login.
    const catchBlock = flow.slice(flow.indexOf('.catch('), flow.indexOf('.catch(') + 260);
    assert.match(catchBlock, /goToStep\('login'\)/);
    assert.doesNotMatch(catchBlock, /goToStep\('register'\)/);
  });

  it('does not fall back to register anywhere in the mount routing', () => {
    // The two former register fallbacks (invalid token + non-promise mock) are now login.
    // The remaining goToStep('register') calls belong to the login->register switch link only.
    assert.doesNotMatch(flow, /default to registering/);
  });

  it('sends the user to login after logging out from the env-select step', () => {
    const handleLogout = envSelect.slice(
      envSelect.indexOf('const handleLogout'),
      envSelect.indexOf('const handleLogout') + 400,
    );
    assert.match(handleLogout, /goToStep\('login'\)/);
    assert.doesNotMatch(handleLogout, /goToStep\('register'\)/);
  });
});
