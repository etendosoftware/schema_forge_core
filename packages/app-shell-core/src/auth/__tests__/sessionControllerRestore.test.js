import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch, registerApiSession, resetApiSessionForTests } from '../api.js';
import { createSessionController } from '../sessionController.js';
import { createLocalAuthStorage, createMemoryAuthStorage } from '../session.js';
import { deferred, jsonResponse, sessionFixture } from './refreshFixtures.js';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  resetApiSessionForTests();
});

const fakeStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
};

// The exact options the silent refresh passes (AuthContext.jsx, refresh() -> controller.replace).
const refreshOptions = () => ({
  refresh: false, status: 'refreshing', ready: true, bump: false,
  access: { windowAccess: {}, capabilities: {}, menuAccess: {} },
});

const storages = {
  memory: () => createMemoryAuthStorage(),
  'local (JSON round-trip)': () => createLocalAuthStorage({ storage: fakeStorage() }),
};

describe('cookie restore identity (ETP-5645)', () => {
  for (const [name, makeStorage] of Object.entries(storages)) {
    describe(`${name} storage`, () => {
      const restored = () => {
        const controller = createSessionController({}, makeStorage(), undefined, 'http://api');
        const session = sessionFixture();
        controller.replace(session, { refresh: false, persist: false });
        return { controller, session, snapshot: controller.capture() };
      };

      it('keeps the identity when the first silent refresh catches storage up', () => {
        const { controller, session, snapshot } = restored();
        assert.equal(controller.isSameIdentity(snapshot), true);
        controller.replace(session, refreshOptions());
        assert.equal(controller.isSameIdentity(snapshot), true);
      });

      it('keeps the identity across a second persisting refresh', () => {
        const { controller, session, snapshot } = restored();
        controller.replace(session, refreshOptions());
        controller.replace(sessionFixture({ revision: 1 }), refreshOptions());
        assert.equal(controller.isSameIdentity(snapshot), true);
      });

      it('still reports a different user, client or base URL', () => {
        for (const other of [sessionFixture({ tenant: 'Y' }), { ...sessionFixture(), clientId: 'other-client' }]) {
          const { controller, snapshot } = restored();
          controller.replace(other, refreshOptions());
          assert.equal(controller.isSameIdentity(snapshot), false);
        }
        const { controller, session, snapshot } = restored();
        controller.configure({ storage: makeStorage(), apiBaseUrl: 'http://other' });
        controller.replace(session, refreshOptions());
        assert.equal(controller.isSameIdentity(snapshot), false);
      });

      it('still reports a different identity after logout', () => {
        const { controller, snapshot } = restored();
        controller.logout();
        assert.equal(controller.isSameIdentity(snapshot), false);
      });
    });
  }

  it('does not abort a response in flight during the first silent refresh', async () => {
    const controller = createSessionController({}, createMemoryAuthStorage(), undefined, 'http://api');
    const session = sessionFixture();
    controller.replace(session, { refresh: false, persist: false });
    registerApiSession({
      getToken: () => controller.getSnapshot().session.token,
      onUnauthorized: () => controller.logout(),
      scope: controller,
      replaceSession: controller.replace,
    });
    const pending = deferred();
    globalThis.fetch = () => pending.promise;
    const request = apiFetch('/resource');
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.replace(session, refreshOptions());
    pending.resolve(jsonResponse({ ok: true }));
    const res = await request;
    assert.deepEqual(await res.json(), { ok: true });
  });
});
