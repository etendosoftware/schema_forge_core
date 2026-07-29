import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ONBOARDING_ERROR_CODES,
  loginAccount,
  loginEnvironment,
  loginWithSsoProvider,
  registerAccount,
} from '../src/onboarding/api.js';

// ETP-4576: session migrates from Bearer+localStorage to a server-side __Host- cookie
// (ADR-0001). This "identity cluster" (register/login/sso/environment) must now hit the
// /sws/go/session* routes and always ride the cookie via credentials:'include' instead of
// (or, for loginEnvironment, alongside a CSRF header instead of) an Authorization: Bearer header.

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

function recordingFetch(response) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    return response;
  };
  return { calls, fetchImpl };
}

describe('onboarding session API — identity cluster (ETP-4576)', () => {
  describe('registerAccount', () => {
    it('posts to /sws/go/session/register with credentials included and returns the parsed JSON', async () => {
      const { calls, fetchImpl } = recordingFetch(jsonResponse({ token: 'new-account' }));
      const form = { fullName: 'Ada', email: 'ada@example.com', password: 'Aa1!aaaa' };

      const result = await registerAccount(fetchImpl, '/etendo', form);

      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, '/etendo/sws/go/session/register');
      assert.equal(calls[0].options.method, 'POST');
      assert.equal(calls[0].options.credentials, 'include');
      assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
      assert.equal(calls[0].options.body, JSON.stringify(form));
      assert.deepEqual(result, { token: 'new-account' });
    });

    it('throws with the registerFailed code on an HTTP error', async () => {
      const { fetchImpl } = recordingFetch(
        jsonResponse({ error: { message: 'boom' } }, { ok: false, status: 400 }),
      );

      await assert.rejects(
        () => registerAccount(fetchImpl, '/etendo', { email: 'ada@example.com' }),
        (error) => {
          assert.equal(error.code, ONBOARDING_ERROR_CODES.registerFailed);
          assert.equal(error.status, 400);
          return true;
        },
      );
    });
  });

  describe('loginAccount', () => {
    it('posts to /sws/go/session with credentials included and returns the parsed JSON', async () => {
      const { calls, fetchImpl } = recordingFetch(jsonResponse({ token: 'session-established' }));
      const form = { email: 'ada@example.com', password: 'Aa1!aaaa' };

      const result = await loginAccount(fetchImpl, '/etendo', form);

      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, '/etendo/sws/go/session');
      assert.equal(calls[0].options.method, 'POST');
      assert.equal(calls[0].options.credentials, 'include');
      assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
      assert.equal(calls[0].options.body, JSON.stringify(form));
      assert.deepEqual(result, { token: 'session-established' });
    });

    it('throws with the invalidCredentials code on an HTTP error', async () => {
      const { fetchImpl } = recordingFetch(
        jsonResponse({ error: { message: 'nope' } }, { ok: false, status: 401 }),
      );

      await assert.rejects(
        () => loginAccount(fetchImpl, '/etendo', { email: 'ada@example.com', password: 'wrong' }),
        (error) => {
          assert.equal(error.code, ONBOARDING_ERROR_CODES.invalidCredentials);
          assert.equal(error.status, 401);
          return true;
        },
      );
    });
  });

  describe('loginWithSsoProvider', () => {
    it('posts to /sws/go/session/sso/google with credentials included', async () => {
      const { calls, fetchImpl } = recordingFetch(jsonResponse({ token: 'sso-session' }));

      const result = await loginWithSsoProvider(fetchImpl, '/etendo', 'google', {
        credential: 'id-token',
      });

      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, '/etendo/sws/go/session/sso/google');
      assert.equal(calls[0].options.method, 'POST');
      assert.equal(calls[0].options.credentials, 'include');
      assert.deepEqual(result, { token: 'sso-session' });
    });

    it('still rejects unsupported providers with ssoFailed without calling fetch', async () => {
      const { calls, fetchImpl } = recordingFetch(jsonResponse({}));

      await assert.rejects(
        () => loginWithSsoProvider(fetchImpl, '/etendo', 'facebook', {}),
        (error) => {
          assert.equal(error.code, ONBOARDING_ERROR_CODES.ssoFailed);
          return true;
        },
      );
      assert.equal(calls.length, 0);
    });
  });

  describe('loginEnvironment', () => {
    it('POSTs to /sws/go/session/environment (no query string) with credentials included', async () => {
      const { calls, fetchImpl } = recordingFetch(jsonResponse({ token: 'env-session' }));

      const result = await loginEnvironment(fetchImpl, '/etendo', 'csrf-abc', {
        adminUserId: 'user-1',
      });

      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, '/etendo/sws/go/session/environment');
      assert.doesNotMatch(calls[0].url, /\?/);
      assert.equal(calls[0].options.method, 'POST');
      assert.equal(calls[0].options.credentials, 'include');
      assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
      assert.deepEqual(result, { token: 'env-session' });
    });

    it('sends the X-Go-CSRF header when a csrfToken is provided', async () => {
      const { calls, fetchImpl } = recordingFetch(jsonResponse({ token: 'env-session' }));

      await loginEnvironment(fetchImpl, '/etendo', 'csrf-abc', { adminUserId: 'user-1' });

      assert.equal(calls[0].options.headers['X-Go-CSRF'], 'csrf-abc');
    });

    it('omits the X-Go-CSRF header (without throwing) when csrfToken is null or undefined', async () => {
      const { calls, fetchImpl } = recordingFetch(jsonResponse({ token: 'env-session' }));

      await loginEnvironment(fetchImpl, '/etendo', null, { adminUserId: 'user-1' });
      await loginEnvironment(fetchImpl, '/etendo', undefined, { adminUserId: 'user-1' });

      assert.equal('X-Go-CSRF' in calls[0].options.headers, false);
      assert.equal('X-Go-CSRF' in calls[1].options.headers, false);
    });

    it('sends only userId in the body when the environment has no roleId/orgId', async () => {
      const { calls, fetchImpl } = recordingFetch(jsonResponse({ token: 'env-session' }));

      await loginEnvironment(fetchImpl, '/etendo', 'csrf-abc', { adminUserId: 'user-1' });

      assert.deepEqual(JSON.parse(calls[0].options.body), { userId: 'user-1' });
    });

    it('includes roleId and orgId in the body when present on the environment', async () => {
      const { calls, fetchImpl } = recordingFetch(jsonResponse({ token: 'env-session' }));

      await loginEnvironment(fetchImpl, '/etendo', 'csrf-abc', {
        adminUserId: 'user-1', roleId: 'role-1', orgId: 'org-1',
      });

      assert.deepEqual(JSON.parse(calls[0].options.body), {
        userId: 'user-1', roleId: 'role-1', orgId: 'org-1',
      });
    });

    it('throws with the environmentLoginFailed code on an HTTP error', async () => {
      const { fetchImpl } = recordingFetch(
        jsonResponse({ error: { message: 'boom' } }, { ok: false, status: 500 }),
      );

      await assert.rejects(
        () => loginEnvironment(fetchImpl, '/etendo', 'csrf-abc', { adminUserId: 'user-1' }),
        (error) => {
          assert.equal(error.code, ONBOARDING_ERROR_CODES.environmentLoginFailed);
          assert.equal(error.status, 500);
          return true;
        },
      );
    });

    it('never sends an Authorization/Bearer header for the identity cluster (cookie-based session)', async () => {
      const { calls, fetchImpl } = recordingFetch(jsonResponse({ token: 'env-session' }));

      await registerAccount(fetchImpl, '/etendo', { email: 'ada@example.com' });
      await loginAccount(fetchImpl, '/etendo', { email: 'ada@example.com', password: 'x' });
      await loginWithSsoProvider(fetchImpl, '/etendo', 'google', { credential: 'id-token' });
      await loginEnvironment(fetchImpl, '/etendo', 'csrf-abc', { adminUserId: 'user-1' });

      for (const { options } of calls) {
        assert.equal('Authorization' in (options.headers || {}), false);
        assert.doesNotMatch(JSON.stringify(options.headers || {}), /Bearer/);
      }
    });
  });
});
