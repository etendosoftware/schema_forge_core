// @covers packages/etendo-go-core/src/onboarding/postAuth.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  completeAuthentication,
  persistAuthMethod,
  AUTH_METHOD_STORAGE_KEY,
} from '../src/onboarding/postAuth.js';

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

  // ETP-5806 — `completeAuthentication` forwards whatever `capabilities` the caller passed
  // straight into `persistAuth`'s options, unchanged. `LoginStep`/`RegisterStep`'s own
  // `handleAuthSuccess` (persistAuth here) is what applies the `?? {}` default before handing
  // the value to `setCapabilities` — this function itself does not default anything, it is a
  // pure pass-through.
  describe('capabilities forwarding (ETP-5806)', () => {
    it('forwards the caller-supplied capabilities object into persistAuth unchanged', async () => {
      const { calls, persistAuth } = makeRecorder();
      const capabilities = { structuredAddressForSepa: true };

      await completeAuthentication({
        token: TOKEN,
        account: ACCOUNT,
        authMethod: 'password',
        capabilities,
        persistAuth,
      });

      assert.deepEqual(calls[0].options.capabilities, capabilities);
    });

    it('forwards undefined as-is when the caller supplies no capabilities (no manufactured default)', async () => {
      const { calls, persistAuth } = makeRecorder();

      await completeAuthentication({
        token: TOKEN,
        account: ACCOUNT,
        authMethod: 'password',
        persistAuth,
      });

      assert.equal(calls[0].options.capabilities, undefined);
    });

    for (const authMethod of ['password', 'sso']) {
      it(`forwards capabilities identically for the ${authMethod} branch`, async () => {
        const { calls, persistAuth } = makeRecorder();
        const capabilities = { structuredAddressForSepa: false };

        await completeAuthentication({
          token: TOKEN,
          account: ACCOUNT,
          authMethod,
          capabilities,
          persistAuth,
        });

        assert.deepEqual(calls[0].options.capabilities, capabilities);
      });
    }

    // `completeAuthentication` itself applies no `??` default — it is a pure
    // pass-through, and `{}`/`null` are the two values that distinguish "passed
    // through unchanged" from "defaulted" once `LoginStep`/`RegisterStep`'s own
    // `capabilities ?? {}` runs on the other side of `persistAuth`.
    it('forwards an explicit empty capabilities object into persistAuth unchanged', async () => {
      const { calls, persistAuth } = makeRecorder();

      await completeAuthentication({
        token: TOKEN,
        account: ACCOUNT,
        authMethod: 'password',
        capabilities: {},
        persistAuth,
      });

      assert.deepEqual(calls[0].options.capabilities, {});
    });

    it('forwards an explicit null capabilities into persistAuth unchanged (no manufactured default)', async () => {
      const { calls, persistAuth } = makeRecorder();

      await completeAuthentication({
        token: TOKEN,
        account: ACCOUNT,
        authMethod: 'password',
        capabilities: null,
        persistAuth,
      });

      assert.equal(calls[0].options.capabilities, null);
    });
  });
});

/**
 * The auth method is the ONE thing authentication still puts in localStorage.
 * The credential does not go there; this key is metadata the host reads to hide
 * change-password from SSO users, so losing the write is a silent UI bug rather
 * than an error. Asserted behaviourally, since the write moved out of the steps
 * and a source-reading check on them can no longer see it.
 */
describe('persistAuthMethod (ETP-4576)', () => {
  const realLocalStorage = globalThis.localStorage;

  function withStubbedStorage(run) {
    const store = new Map();
    globalThis.localStorage = {
      setItem: (k, v) => store.set(k, String(v)),
      getItem: (k) => (store.has(k) ? store.get(k) : null),
    };
    try {
      return run(store);
    } finally {
      if (realLocalStorage === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = realLocalStorage;
    }
  }

  it('writes the method under the key the host reads', () => {
    withStubbedStorage((store) => {
      persistAuthMethod('sso');
      assert.equal(store.get(AUTH_METHOD_STORAGE_KEY), 'sso');
    });
  });

  it('records a password login as such, so change-password stays offered', () => {
    withStubbedStorage((store) => {
      persistAuthMethod('password');
      assert.notEqual(store.get(AUTH_METHOD_STORAGE_KEY), 'sso');
    });
  });

  it('exposes the exact key UserAvatarButton reads', () => {
    assert.equal(AUTH_METHOD_STORAGE_KEY, 'sf_platform_auth_method');
  });
});
