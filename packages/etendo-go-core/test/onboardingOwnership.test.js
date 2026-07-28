import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuthHeaders,
  changePassword,
  fetchOnboardingDraft,
  loginWithSsoProvider,
  runOnboardingStream,
  saveOnboardingDraft,
} from '../src/onboarding/api.js';
import {
  applyProgressMessage,
  buildEnvironmentSessionStorage,
  buildOnboardingPayload,
  initialSetupSteps,
  isCompanyStepValid,
  isProfileStepValid,
  selectPreferredOrg,
} from '../src/onboarding/state.js';
import {
  buildGoogleSsoPayload,
  getConfiguredSsoProviders,
  readCookie,
} from '../src/onboarding/sso.js';
import {
  MIN_PASSWORD_LENGTH,
  getPasswordChecks,
  isStrongPassword,
} from '../src/onboarding/passwordPolicy.js';

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

function streamResponse(messages) {
  const encoder = new TextEncoder();
  const payload = encoder.encode(`${messages.map(JSON.stringify).join('\n')}\n`);
  let read = false;
  return {
    body: {
      getReader: () => ({
        read: async () => {
          if (read) return { done: true };
          read = true;
          return { done: false, value: payload };
        },
      }),
    },
  };
}

describe('Core-owned onboarding API contract', () => {
  it('sends only allowlisted SSO and password-change payload fields', async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ token: 'rotated' });
    };

    await loginWithSsoProvider(fetchImpl, '/etendo', 'google', {
      credential: 'id-token', email: 'untrusted@example.com', provider: 'google',
    });
    await changePassword(fetchImpl, '/etendo', 'platform-token', {
      currentPassword: 'old', newPassword: 'new', ignored: 'not-sent',
    });

    assert.equal(calls[0].url, '/etendo/sws/go/sso/google');
    assert.equal(calls[0].options.body, JSON.stringify({ credential: 'id-token' }));
    assert.equal(calls[1].options.headers.Authorization, 'Bearer platform-token');
    assert.equal(calls[1].options.body, JSON.stringify({ currentPassword: 'old', newPassword: 'new' }));
    assert.deepEqual(buildAuthHeaders(null), { 'Content-Type': 'application/json' });
  });

  it('persists, restores, and streams onboarding data through the Core implementation', async () => {
    const calls = [];
    const fetchImpl = async (url, options = {}) => {
      calls.push({ url, options });
      if (options.method === 'POST' && url.endsWith('/onboarding')) {
        return streamResponse([{ type: 'progress', step: 'client' }, { type: 'result', success: true }]);
      }
      if (options.method === 'POST') return jsonResponse({ saved: true });
      return jsonResponse({ draft: { fullName: 'Ada' } });
    };
    const messages = [];

    await saveOnboardingDraft(fetchImpl, '', 'token', { fullName: 'Ada' });
    assert.deepEqual(await fetchOnboardingDraft(fetchImpl, '', 'token'), { fullName: 'Ada' });
    assert.deepEqual(await runOnboardingStream(fetchImpl, '', 'token', {
      clientName: 'Core', currency: 'EUR', language: 'en_US', countryCode: 'ES',
    }, (message) => messages.push(message)), { type: 'result', success: true });

    assert.equal(calls[0].url, '/sws/go/onboarding/draft');
    assert.equal(calls[0].options.body, JSON.stringify({ draft: { fullName: 'Ada' } }));
    assert.deepEqual(messages.map(({ type }) => type), ['progress', 'result']);
  });
});

describe('Core-owned onboarding state and SSO helpers', () => {
  it('creates isolated progress state and keeps only provisioning contract fields', () => {
    const first = initialSetupSteps();
    const second = initialSetupSteps();
    first[0].status = 'done';
    assert.equal(second[0].status, 'pending');
    assert.equal(applyProgressMessage(second, { type: 'progress', step: 'client', status: 'error', message: 'failed' })[1].status, 'failed');
    assert.deepEqual(buildOnboardingPayload({ clientName: 'Core', currency: 'EUR', language: 'en_US', countryCode: 'ES', fiscalIdValue: 'private' }), {
      clientName: 'Core', currency: 'EUR', language: 'en_US', countryCode: 'ES', address: undefined,
    });
    assert.equal(isProfileStepValid({ fullName: 'Ada', countryCode: 'ES' }), true);
    assert.equal(isCompanyStepValid({ clientName: 'Core' }), true);
  });

  it('selects the non-star organization and serializes the environment session', () => {
    const role = { id: 'role', orgList: [{ id: 'star', name: '*' }, { id: 'org', name: 'Core' }] };
    assert.deepEqual(selectPreferredOrg(role), { id: 'org', name: 'Core' });
    const session = buildEnvironmentSessionStorage({ adminUserName: 'Ada' }, { token: 'env', roleList: [role] });
    assert.equal(session.sf_auth_token, 'env');
    assert.deepEqual(JSON.parse(session.sf_auth_selected_org), { id: 'org', name: 'Core' });
  });

  it('uses the SSO and password policy implementations from Core', () => {
    assert.deepEqual(getConfiguredSsoProviders({ VITE_GOOGLE_CLIENT_ID: ' client-id ' }), [{ id: 'google', clientId: 'client-id' }]);
    assert.equal(readCookie('token', { cookie: 'token=abc; other=value' }), 'abc');
    assert.deepEqual(buildGoogleSsoPayload({ credential: 'id-token', email: 'untrusted@example.com' }), { credential: 'id-token' });
    assert.equal(MIN_PASSWORD_LENGTH, 8);
    assert.equal(isStrongPassword('Aa1!aaaa'), true);
    assert.equal(getPasswordChecks('Abcdef12').special, false);
  });
});
