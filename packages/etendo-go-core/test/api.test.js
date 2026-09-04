import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ONBOARDING_ERROR_CODES,
  buildAuthHeaders,
  changePassword,
  fetchAccount,
  fetchEnvironments,
  fetchOnboardingDraft,
  fetchSession,
  loginAccount,
  loginEnvironment,
  loginWithSsoProvider,
  registerAccount,
  runOnboardingStream,
  saveOnboardingDraft,
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

// ETP-4576 (cycle 11): resource-access cluster. These 6 functions build
// `Authorization: Bearer` by hand today. Under the cookie-session contract:
//   - the 3 GETs (fetchAccount/fetchEnvironments/fetchOnboardingDraft) drop their auth
//     param entirely — the cookie rides alone via credentials:'include', GET is CSRF-exempt.
//   - the 3 POSTs (changePassword/saveOnboardingDraft/runOnboardingStream) keep a 3rd
//     param but it becomes a CSRF token sent as `X-Go-CSRF`, never `Authorization`.
// buildAuthHeaders(csrfToken) itself only ever emits `X-Go-CSRF`, never `Authorization`.
// This is RED against the current api.js implementation (still Bearer-only, no credentials).
describe('onboarding session API — resource-access cluster (ETP-4576)', () => {
  describe('buildAuthHeaders', () => {
    // ETP-5022 added Accept-Language here: without it the backend resolves AD_Message
    // text in the account's language, so auth errors arrived in English under a Spanish
    // UI. It rides along with every call; what matters to ETP-4576 is unchanged — no
    // Authorization, and X-Go-CSRF only when a proof is held.
    it('carries no credential header when no csrfToken is provided', () => {
      for (const headers of [buildAuthHeaders(), buildAuthHeaders(null), buildAuthHeaders(undefined)]) {
        assert.equal(headers['Content-Type'], 'application/json');
        assert.ok(headers['Accept-Language']);
        assert.equal('Authorization' in headers, false);
        assert.equal('X-Go-CSRF' in headers, false);
      }
    });

    it('adds X-Go-CSRF (never Authorization) when a csrfToken is provided', () => {
      const headers = buildAuthHeaders('csrf-abc');
      assert.equal(headers['Content-Type'], 'application/json');
      assert.equal(headers['X-Go-CSRF'], 'csrf-abc');
      assert.ok(headers['Accept-Language']);
      assert.equal('Authorization' in headers, false);
    });
  });

  describe('fetchAccount', () => {
    it('GETs /sws/go/me with credentials included and no Authorization header, returning the parsed JSON', async () => {
      const { calls, fetchImpl } = recordingFetch(jsonResponse({ id: 'user-1', name: 'Ada' }));

      const result = await fetchAccount(fetchImpl, '/etendo');

      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, '/etendo/sws/go/me');
      assert.equal(calls[0].options.credentials, 'include');
      assert.equal('Authorization' in (calls[0].options.headers || {}), false);
      assert.deepEqual(result, { id: 'user-1', name: 'Ada' });
    });

    it('throws with the invalidSession code on an HTTP error', async () => {
      const { fetchImpl } = recordingFetch(
        jsonResponse({ error: { message: 'nope' } }, { ok: false, status: 401 }),
      );

      await assert.rejects(
        () => fetchAccount(fetchImpl, '/etendo'),
        (error) => {
          assert.equal(error.code, ONBOARDING_ERROR_CODES.invalidSession);
          assert.equal(error.status, 401);
          return true;
        },
      );
    });
  });

  describe('fetchSession', () => {
    // ETP-4576 (cycle 12): OnboardingFlow's mount bootstrap replaces the old
    // fetchAccount(fetch, apiBase, currentToken) call (which read
    // localStorage.getItem('sf_platform_token')) with this GET. There is no
    // more client-readable token — the __Host- session cookie rides alone.
    it('GETs /sws/go/session with credentials included and no Authorization/Bearer header anywhere', async () => {
      const { calls, fetchImpl } = recordingFetch(
        jsonResponse({
          status: 'active',
          account: { name: 'Ada' },
          environment: null,
          roleList: [],
          csrfToken: 'csrf-restored',
        }),
      );

      const result = await fetchSession(fetchImpl, '/etendo');

      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, '/etendo/sws/go/session');
      assert.equal(calls[0].options.credentials, 'include');
      assert.equal('Authorization' in (calls[0].options.headers || {}), false);
      assert.doesNotMatch(JSON.stringify(calls[0].options.headers || {}), /Bearer/);
      assert.deepEqual(result, {
        status: 'active',
        account: { name: 'Ada' },
        environment: null,
        roleList: [],
        csrfToken: 'csrf-restored',
      });
    });

    it('throws with the invalidSession code on an HTTP error (e.g. 401 — no cookie or an expired one)', async () => {
      const { fetchImpl } = recordingFetch(
        jsonResponse({ error: { message: 'no session' } }, { ok: false, status: 401 }),
      );

      await assert.rejects(
        () => fetchSession(fetchImpl, '/etendo'),
        (error) => {
          assert.equal(error.code, ONBOARDING_ERROR_CODES.invalidSession);
          assert.equal(error.status, 401);
          return true;
        },
      );
    });
  });

  describe('fetchEnvironments', () => {
    it('GETs /sws/go/environments with credentials included and no Authorization header', async () => {
      const { calls, fetchImpl } = recordingFetch(jsonResponse({ environments: [{ id: 'env-1' }] }));

      const result = await fetchEnvironments(fetchImpl, '/etendo');

      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, '/etendo/sws/go/environments');
      assert.equal(calls[0].options.credentials, 'include');
      assert.equal('Authorization' in (calls[0].options.headers || {}), false);
      assert.deepEqual(result, [{ id: 'env-1' }]);
    });

    it('falls back to an empty array when the response has no environments', async () => {
      const { fetchImpl } = recordingFetch(jsonResponse({}));
      assert.deepEqual(await fetchEnvironments(fetchImpl, '/etendo'), []);
    });

    it('throws with the loadEnvironmentsFailed code on an HTTP error', async () => {
      const { fetchImpl } = recordingFetch(
        jsonResponse({ error: { message: 'boom' } }, { ok: false, status: 500 }),
      );

      await assert.rejects(
        () => fetchEnvironments(fetchImpl, '/etendo'),
        (error) => {
          assert.equal(error.code, ONBOARDING_ERROR_CODES.loadEnvironmentsFailed);
          return true;
        },
      );
    });
  });

  describe('fetchOnboardingDraft', () => {
    it('GETs /sws/go/onboarding/draft with credentials included and no Authorization header', async () => {
      const { calls, fetchImpl } = recordingFetch(jsonResponse({ draft: { fullName: 'Ada' } }));

      const result = await fetchOnboardingDraft(fetchImpl, '/etendo');

      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, '/etendo/sws/go/onboarding/draft');
      assert.equal(calls[0].options.credentials, 'include');
      assert.equal('Authorization' in (calls[0].options.headers || {}), false);
      assert.deepEqual(result, { fullName: 'Ada' });
    });

    it('returns null when there is no stored draft', async () => {
      const { fetchImpl } = recordingFetch(jsonResponse({}));
      assert.equal(await fetchOnboardingDraft(fetchImpl, '/etendo'), null);
    });

    it('throws with the invalidSession code on an HTTP error', async () => {
      const { fetchImpl } = recordingFetch(
        jsonResponse({ error: { message: 'nope' } }, { ok: false, status: 401 }),
      );

      await assert.rejects(
        () => fetchOnboardingDraft(fetchImpl, '/etendo'),
        (error) => {
          assert.equal(error.code, ONBOARDING_ERROR_CODES.invalidSession);
          return true;
        },
      );
    });
  });

  describe('changePassword', () => {
    it('POSTs to /sws/go/change-password with credentials included and the X-Go-CSRF header', async () => {
      const { calls, fetchImpl } = recordingFetch(jsonResponse({ ok: true }));
      const form = { currentPassword: 'old', newPassword: 'new', ignored: 'not-sent' };

      const result = await changePassword(fetchImpl, '/etendo', 'csrf-abc', form);

      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, '/etendo/sws/go/change-password');
      assert.equal(calls[0].options.method, 'POST');
      assert.equal(calls[0].options.credentials, 'include');
      assert.equal(calls[0].options.headers['X-Go-CSRF'], 'csrf-abc');
      assert.equal('Authorization' in calls[0].options.headers, false);
      assert.equal(calls[0].options.body, JSON.stringify({ currentPassword: 'old', newPassword: 'new' }));
      assert.deepEqual(result, { ok: true });
    });

    it('omits the X-Go-CSRF header (without throwing) when csrfToken is null or undefined', async () => {
      const { calls, fetchImpl } = recordingFetch(jsonResponse({ ok: true }));
      const form = { currentPassword: 'old', newPassword: 'new' };

      await changePassword(fetchImpl, '/etendo', null, form);
      await changePassword(fetchImpl, '/etendo', undefined, form);

      assert.equal('X-Go-CSRF' in calls[0].options.headers, false);
      assert.equal('X-Go-CSRF' in calls[1].options.headers, false);
    });

    it('throws with the credentialChangeFailed code on an HTTP error', async () => {
      const { fetchImpl } = recordingFetch(
        jsonResponse({ error: { message: 'boom' } }, { ok: false, status: 400 }),
      );

      await assert.rejects(
        () => changePassword(fetchImpl, '/etendo', 'csrf-abc', { currentPassword: 'a', newPassword: 'b' }),
        (error) => {
          assert.equal(error.code, ONBOARDING_ERROR_CODES.credentialChangeFailed);
          assert.equal(error.status, 400);
          return true;
        },
      );
    });
  });

  describe('saveOnboardingDraft', () => {
    it('POSTs to /sws/go/onboarding/draft with credentials included and the X-Go-CSRF header', async () => {
      const { calls, fetchImpl } = recordingFetch(jsonResponse({ saved: true }));
      const draft = { fullName: 'Ada' };

      const result = await saveOnboardingDraft(fetchImpl, '/etendo', 'csrf-abc', draft);

      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, '/etendo/sws/go/onboarding/draft');
      assert.equal(calls[0].options.method, 'POST');
      assert.equal(calls[0].options.credentials, 'include');
      assert.equal(calls[0].options.headers['X-Go-CSRF'], 'csrf-abc');
      assert.equal('Authorization' in calls[0].options.headers, false);
      assert.equal(calls[0].options.body, JSON.stringify({ draft }));
      assert.deepEqual(result, { saved: true });
    });

    it('omits the X-Go-CSRF header (without throwing) when csrfToken is null or undefined', async () => {
      const { calls, fetchImpl } = recordingFetch(jsonResponse({ saved: true }));

      await saveOnboardingDraft(fetchImpl, '/etendo', null, { fullName: 'Ada' });
      await saveOnboardingDraft(fetchImpl, '/etendo', undefined, { fullName: 'Ada' });

      assert.equal('X-Go-CSRF' in calls[0].options.headers, false);
      assert.equal('X-Go-CSRF' in calls[1].options.headers, false);
    });

    it('throws with the invalidSession code on an HTTP error', async () => {
      const { fetchImpl } = recordingFetch(
        jsonResponse({ error: { message: 'nope' } }, { ok: false, status: 401 }),
      );

      await assert.rejects(
        () => saveOnboardingDraft(fetchImpl, '/etendo', 'csrf-abc', { fullName: 'Ada' }),
        (error) => {
          assert.equal(error.code, ONBOARDING_ERROR_CODES.invalidSession);
          return true;
        },
      );
    });
  });

  describe('runOnboardingStream', () => {
    it('POSTs to /sws/go/onboarding with credentials included, the X-Go-CSRF header, and the allowlisted body', async () => {
      const calls = [];
      const fetchImpl = async (url, options = {}) => {
        calls.push({ url, options });
        return streamResponse([{ type: 'progress', step: 'client' }, { type: 'result', success: true }]);
      };
      const form = {
        clientName: 'Acme', currency: 'EUR', language: 'en_US', countryCode: 'ES',
        address: '123 Main St', fullName: 'Ada', extra: 'not-sent',
      };
      const messages = [];

      const result = await runOnboardingStream(fetchImpl, '/etendo', 'csrf-abc', form, (message) => {
        messages.push(message);
      });

      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, '/etendo/sws/go/onboarding');
      assert.equal(calls[0].options.method, 'POST');
      assert.equal(calls[0].options.credentials, 'include');
      assert.equal(calls[0].options.headers['X-Go-CSRF'], 'csrf-abc');
      assert.equal('Authorization' in calls[0].options.headers, false);
      assert.deepEqual(JSON.parse(calls[0].options.body), {
        clientName: 'Acme', currency: 'EUR', language: 'en_US', countryCode: 'ES',
        address: '123 Main St', fullName: 'Ada',
      });
      assert.deepEqual(result, { type: 'result', success: true });
      assert.deepEqual(messages.map(({ type }) => type), ['progress', 'result']);
    });

    it('omits the X-Go-CSRF header (without throwing) when csrfToken is null or undefined', async () => {
      const calls = [];
      const fetchImpl = async (url, options = {}) => {
        calls.push({ url, options });
        return streamResponse([{ type: 'result', success: true }]);
      };
      const form = { clientName: 'Acme', currency: 'EUR', language: 'en_US', countryCode: 'ES' };

      await runOnboardingStream(fetchImpl, '/etendo', null, form, () => {});
      await runOnboardingStream(fetchImpl, '/etendo', undefined, form, () => {});

      assert.equal('X-Go-CSRF' in calls[0].options.headers, false);
      assert.equal('X-Go-CSRF' in calls[1].options.headers, false);
    });
  });

  describe('resource-access cluster security', () => {
    it('never sends an Authorization/Bearer header across any of the 6 resource-access functions', async () => {
      const calls = [];
      const fetchImpl = async (url, options = {}) => {
        calls.push({ url, options });
        if (options.method === 'POST' && url.endsWith('/sws/go/onboarding')) {
          return streamResponse([{ type: 'result', success: true }]);
        }
        return jsonResponse({ environments: [], draft: null, ok: true });
      };
      const form = { clientName: 'Acme', currency: 'EUR', language: 'en_US', countryCode: 'ES' };

      await fetchAccount(fetchImpl, '/etendo');
      await fetchEnvironments(fetchImpl, '/etendo');
      await fetchOnboardingDraft(fetchImpl, '/etendo');
      await changePassword(fetchImpl, '/etendo', 'csrf-abc', { currentPassword: 'a', newPassword: 'b' });
      await saveOnboardingDraft(fetchImpl, '/etendo', 'csrf-abc', { fullName: 'Ada' });
      await runOnboardingStream(fetchImpl, '/etendo', 'csrf-abc', form, () => {});

      assert.equal(calls.length, 6);
      for (const { options } of calls) {
        assert.equal('Authorization' in (options.headers || {}), false);
        assert.doesNotMatch(JSON.stringify(options.headers || {}), /Bearer/);
        assert.equal(options.credentials, 'include');
      }
    });
  });
});
