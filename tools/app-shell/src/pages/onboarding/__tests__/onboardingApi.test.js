import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuthHeaders,
  registerAccount,
  loginAccount,
  fetchAccount,
  fetchEnvironments,
  loginEnvironment,
  runOnboardingStream,
} from '../onboardingApi.js';

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
  };
}

function streamResponse(lines) {
  const encoder = new TextEncoder();
  const chunks = lines.map(line => encoder.encode(`${JSON.stringify(line)}\n`));
  let index = 0;
  return {
    ok: true,
    status: 200,
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) return { done: true, value: undefined };
            return { done: false, value: chunks[index++] };
          },
        };
      },
    },
  };
}

describe('onboardingApi', () => {
  it('buildAuthHeaders includes content type and optional bearer token', () => {
    assert.deepEqual(buildAuthHeaders('platform-token'), {
      'Content-Type': 'application/json',
      Authorization: 'Bearer platform-token',
    });
    assert.deepEqual(buildAuthHeaders(null), {
      'Content-Type': 'application/json',
    });
  });

  it('registerAccount posts the registration form to /sws/go/register', async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ token: 'platform-token', account: { email: 'new@example.com' } });
    };

    const result = await registerAccount(fetchImpl, '/etendo', {
      name: 'New User',
      email: 'new@example.com',
      password: 'secret',
    });

    assert.equal(result.token, 'platform-token');
    assert.equal(calls[0].url, '/etendo/sws/go/register');
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
    assert.equal(calls[0].options.body, JSON.stringify({
      name: 'New User',
      email: 'new@example.com',
      password: 'secret',
    }));
  });

  it('loginAccount posts credentials to /sws/go/login', async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ token: 'platform-token', account: { email: 'user@example.com' } });
    };

    const result = await loginAccount(fetchImpl, '', {
      email: 'user@example.com',
      password: 'secret',
    });

    assert.equal(result.token, 'platform-token');
    assert.equal(calls[0].url, '/sws/go/login');
    assert.equal(calls[0].options.method, 'POST');
  });

  it('fetchAccount uses the platform token against /sws/go/me', async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ email: 'user@example.com', name: 'User' });
    };

    const account = await fetchAccount(fetchImpl, '', 'platform-token');

    assert.equal(account.name, 'User');
    assert.equal(calls[0].url, '/sws/go/me');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer platform-token');
  });

  it('fetchEnvironments returns an empty array when the backend omits environments', async () => {
    const fetchImpl = async () => jsonResponse({});

    const envs = await fetchEnvironments(fetchImpl, '', 'platform-token');

    assert.deepEqual(envs, []);
  });

  it('loginEnvironment calls /sws/go/login with the environment admin user id', async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ token: 'env-token', roleList: [] });
    };

    const result = await loginEnvironment(fetchImpl, '', 'platform-token', {
      adminUserId: 'AD_USER_1',
    });

    assert.equal(result.token, 'env-token');
    assert.equal(calls[0].url, '/sws/go/login?userId=AD_USER_1');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer platform-token');
  });

  it('runOnboardingStream posts payload and emits every NDJSON message', async () => {
    const calls = [];
    const messages = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      return streamResponse([
        { type: 'progress', step: 'client', status: 'in_progress' },
        { type: 'progress', step: 'client', status: 'done', ms: 20 },
        { type: 'result', success: true },
      ]);
    };

    const result = await runOnboardingStream(fetchImpl, '', 'platform-token', {
      clientName: 'QA Company',
      currency: 'EUR',
      language: 'es_ES',
      countryCode: 'ES',
      fiscalIdValue: 'B12345678',
    }, message => messages.push(message));

    assert.equal(result.success, true);
    assert.equal(calls[0].url, '/sws/go/onboarding');
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer platform-token');
    assert.equal(calls[0].options.body, JSON.stringify({
      clientName: 'QA Company',
      currency: 'EUR',
      language: 'es_ES',
      countryCode: 'ES',
    }));
    assert.equal(messages.length, 3);
  });
});
