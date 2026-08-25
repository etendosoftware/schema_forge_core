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
    // The fetchAccount().catch branch clears the token and must land on login. Anchored on the
    // fetchAccount call rather than "the first .catch in the file": the mount effect grew other
    // awaited calls with their own catch blocks (ETP-4798's confirmation link), and slicing from
    // the first one silently started asserting against the wrong branch.
    const bootstrap = flow.slice(flow.indexOf('fetchAccount(fetch, apiBase, currentToken)'));
    const catchBlock = bootstrap.slice(bootstrap.indexOf('.catch('), bootstrap.indexOf('.catch(') + 260);
    assert.match(catchBlock, /goToStep\('login'\)/);
    assert.doesNotMatch(catchBlock, /goToStep\('register'\)/);
  });

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
});
