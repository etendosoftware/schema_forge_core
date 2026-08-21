import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { completeAuthentication } from '../src/onboarding/postAuth.js';

const TOKEN = 'session-token';
const ACCOUNT = { name: 'Ada Lovelace', email: 'ada@example.com' };

/**
 * Records the ordered sequence of side effects so the tests can assert not just
 * *that* each step ran, but that persistence completes before the caller-owned
 * continuation is handed control.
 */
function makeRecorder({ onAuthenticated = null, persistDelayMs = 0 } = {}) {
  const calls = [];
  const persistAuth = async (token, account, options) => {
    if (persistDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, persistDelayMs));
    }
    calls.push({ step: 'persistAuth', token, account, options });
  };
  const continuation = onAuthenticated
    ? async (token, account) => {
      calls.push({ step: 'onAuthenticated', token, account });
      await onAuthenticated(token, account);
    }
    : undefined;
  return { calls, persistAuth, continuation };
}

describe('Post-authentication continuation (ETP-4958)', () => {
  describe('when the caller owns the continuation', () => {
    it('skips default environment routing', async () => {
      const { calls, persistAuth, continuation } = makeRecorder({ onAuthenticated: async () => {} });

      await completeAuthentication({
        token: TOKEN,
        account: ACCOUNT,
        authMethod: 'sso',
        persistAuth,
        onAuthenticated: continuation,
      });

      const persist = calls.find((call) => call.step === 'persistAuth');
      assert.equal(persist.options.route, false);
    });

    it('invokes the caller continuation with the authenticated session', async () => {
      const { calls, persistAuth, continuation } = makeRecorder({ onAuthenticated: async () => {} });

      await completeAuthentication({
        token: TOKEN,
        account: ACCOUNT,
        authMethod: 'sso',
        persistAuth,
        onAuthenticated: continuation,
      });

      const handoff = calls.find((call) => call.step === 'onAuthenticated');
      assert.ok(handoff, 'caller continuation was never invoked');
      assert.equal(handoff.token, TOKEN);
      assert.deepEqual(handoff.account, ACCOUNT);
    });

    it('persists the authentication state before handing over control', async () => {
      // The invitation page reads sf_platform_token straight from localStorage
      // when it POSTs the acceptance, so persistence must be awaited first.
      const { calls, persistAuth, continuation } = makeRecorder({
        onAuthenticated: async () => {},
        persistDelayMs: 5,
      });

      await completeAuthentication({
        token: TOKEN,
        account: ACCOUNT,
        authMethod: 'sso',
        persistAuth,
        onAuthenticated: continuation,
      });

      assert.deepEqual(calls.map((call) => call.step), ['persistAuth', 'onAuthenticated']);
    });

    it('propagates a failing continuation instead of swallowing it', async () => {
      const { persistAuth } = makeRecorder();
      const boom = new Error('acceptance failed');

      await assert.rejects(
        completeAuthentication({
          token: TOKEN,
          account: ACCOUNT,
          authMethod: 'sso',
          persistAuth,
          onAuthenticated: async () => { throw boom; },
        }),
        boom,
      );
    });
  });

  describe('when no caller continuation is provided', () => {
    it('keeps the default environment routing', async () => {
      const { calls, persistAuth } = makeRecorder();

      await completeAuthentication({
        token: TOKEN,
        account: ACCOUNT,
        authMethod: 'password',
        persistAuth,
      });

      assert.deepEqual(calls.map((call) => call.step), ['persistAuth']);
      assert.equal(calls[0].options.route, true);
    });
  });

  describe('regardless of the branch that authenticated', () => {
    for (const authMethod of ['password', 'sso']) {
      it(`applies the identical contract for the ${authMethod} branch`, async () => {
        const withCaller = makeRecorder({ onAuthenticated: async () => {} });
        await completeAuthentication({
          token: TOKEN,
          account: ACCOUNT,
          authMethod,
          persistAuth: withCaller.persistAuth,
          onAuthenticated: withCaller.continuation,
        });

        assert.deepEqual(
          withCaller.calls.map((call) => call.step),
          ['persistAuth', 'onAuthenticated'],
          `${authMethod} branch must reach the caller continuation`,
        );
        assert.equal(withCaller.calls[0].options.authMethod, authMethod);
        assert.equal(withCaller.calls[0].options.route, false);
      });
    }
  });
});
