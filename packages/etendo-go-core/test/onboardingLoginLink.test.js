// @covers packages/etendo-go-core/src/onboarding/api.js
// @covers packages/etendo-go-core/src/onboarding/OnboardingFlow.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/LoginLinkStep.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/index.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { consumeLoginLink, resolveAuthErrorMessage, AUTH_ERROR_UI_KEYS } from '../src/onboarding/api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = (...parts) => readFileSync(join(__dirname, '..', 'src', 'onboarding', ...parts), 'utf8');
const onboardingFlow = source('OnboardingFlow.jsx');
const stepsRegistry = source('steps', 'index.js');
const loginLinkStep = source('steps', 'LoginLinkStep.jsx');

const BASE = 'https://etendo.example.test';

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

describe('consumeLoginLink (ETP-5847)', () => {
  it('posts the token to /sws/go/session/link and keeps the session cookie it sets', async () => {
    let seen = null;
    const fetchImpl = async (url, init) => {
      seen = { url, init };
      return jsonResponse({ status: 'success', csrfToken: 'csrf-1', account: { email: 'a@b.c' } });
    };

    const data = await consumeLoginLink(fetchImpl, BASE, 'tok-1');

    assert.equal(seen.url, `${BASE}/sws/go/session/link`);
    assert.equal(seen.init.method, 'POST');
    // The session arrives as a cookie: without `include` the browser would drop it.
    assert.equal(seen.init.credentials, 'include');
    assert.deepEqual(JSON.parse(seen.init.body), { token: 'tok-1' });
    assert.equal(data.csrfToken, 'csrf-1');
  });

  it('a spent or expired link fails with a code the step translates', async () => {
    const fetchImpl = async () => jsonResponse(
      { error: { code: 'LOGIN_LINK_INVALID', message: 'This login link is invalid, already used or expired' } },
      { ok: false, status: 400 },
    );

    const err = await consumeLoginLink(fetchImpl, BASE, 'used').catch((e) => e);

    assert.equal(err.code, 'LOGIN_LINK_INVALID');
    assert.equal(AUTH_ERROR_UI_KEYS.LOGIN_LINK_INVALID, 'onboardingLoginLinkInvalid');
    assert.equal(resolveAuthErrorMessage((key) => key, err, 'fallback'), 'onboardingLoginLinkInvalid');
  });
});

describe('The login link lands on its own step (ETP-5847)', () => {
  it('registers the login-link step', () => {
    assert.match(stepsRegistry, /\{ id: 'login-link', component: LoginLinkStep \}/);
  });

  it('takes the token off the address bar and routes to the step instead of bootstrapping', () => {
    const block = onboardingFlow.slice(onboardingFlow.indexOf("search.get('loginToken')"));
    assert.match(block, /search\.delete\('loginToken'\)/);
    assert.match(block, /window\.history\.replaceState/);
    assert.match(block, /goToStep\('login-link'\)/);
    assert.ok(block.indexOf('return;') < block.indexOf('fetchSession('),
      'a link visit must not run the session bootstrap first');
  });

  it('never spends the link on load: only the button click calls the endpoint', () => {
    // A mail scanner that opens the URL must not use the link up.
    assert.doesNotMatch(onboardingFlow, /consumeLoginLink/);
    assert.match(loginLinkStep, /const handleEnter = useCallback\(async \(\) => \{[\s\S]*consumeLoginLink/);
    assert.match(loginLinkStep, /onClick=\{handleEnter\}/);
  });

  it('enters the environment the way a password login does', () => {
    assert.match(loginLinkStep, /routeByEnvironments\(data\.csrfToken\)/);
  });
});
