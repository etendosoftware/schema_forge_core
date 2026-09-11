import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch, createApiFetch, registerApiSession, resetApiSessionForTests } from '../api.js';
import { createSessionController } from '../sessionController.js';
import { createMemoryAuthStorage } from '../session.js';
import { getRecordVersion, resetRecordVersionsForTests } from '../../lib/recordVersions.js';
import { deferred, jsonResponse, sessionFixture } from './refreshFixtures.js';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  resetApiSessionForTests();
  resetRecordVersionsForTests();
});

function setup() {
  const session = sessionFixture();
  const controller = createSessionController(session, createMemoryAuthStorage(session));
  let logouts = 0;
  const getToken = () => controller.getSnapshot().session.token;
  const logout = () => { logouts += 1; controller.logout(); };
  registerApiSession({ getToken, onUnauthorized: logout, scope: controller, replaceSession: controller.replace });
  return { controller, session, getToken, logout, logouts: () => logouts };
}

describe('request and response ownership (ETP-5195)', () => {
  for (const mode of ['ambient', 'legacy-three-argument', 'explicit-scope']) {
    it(`${mode} rejects an old 401 after same-token replacement and handles the current 401`, async () => {
      const { controller, session, getToken, logout, logouts } = setup();
      const request = mode === 'ambient' ? apiFetch : mode === 'legacy-three-argument'
        ? createApiFetch('', getToken, logout) : createApiFetch('', getToken, logout, controller);
      const pending = deferred();
      globalThis.fetch = () => pending.promise;
      const old = request('/resource').catch((error) => error);
      controller.replace(session);
      pending.resolve(jsonResponse({}, 401));
      assert.equal((await old).name, 'AbortError');
      assert.equal(logouts(), 0);
      globalThis.fetch = async () => jsonResponse({}, 401);
      await assert.rejects(request('/resource'), /Unauthorized/);
      assert.equal(logouts(), 1);
      assert.equal(controller.getSnapshot().session.token, null);
    });
  }

  it('a foreign explicit token 401 cannot log out the ambient session', async () => {
    const { session, controller, logouts } = setup();
    globalThis.fetch = async () => jsonResponse({}, 401);
    await assert.rejects(apiFetch('/resource', { token: sessionFixture({ tenant: 'Y' }).token }), /Unauthorized/);
    assert.equal(logouts(), 0);
    assert.equal(controller.getSnapshot().session.token, session.token);
  });

  for (const boundary of ['replacement', 'logout', 'same-batch logout continuation']) {
    it(`rejects a captured obsolete legacy token after ${boundary} before transport, body reads or version harvesting`, async () => {
      const { session, controller, logout } = setup();
      const legacy = createApiFetch('', () => session.token, logout);
      let transportCalls = 0;
      let bodyReads = 0;
      let cloneReads = 0;
      const payload = { response: { data: [{ id: 'logged-out-record', updated: 'obsolete-version' }] } };
      globalThis.fetch = async () => {
        transportCalls += 1;
        return {
          ok: true, status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => { bodyReads += 1; return payload; },
          clone: () => ({ json: async () => { cloneReads += 1; return payload; } }),
        };
      };
      const read = () => legacy('/fixture/records/logged-out-record').then((response) => response.json());
      let pending;
      if (boundary === 'same-batch logout continuation') {
        // Queue a captured client's continuation, then logout synchronously in the
        // same turn: no render or registration cleanup occurs before it resumes.
        pending = Promise.resolve().then(read);
        logout();
      } else {
        if (boundary === 'replacement') controller.replace(sessionFixture({ tenant: 'Y' }));
        else logout();
        pending = read();
      }
      const outcome = await pending.then(() => 'resolved', (error) => error.name);
      await Promise.resolve();
      assert.deepEqual({ outcome, transportCalls, bodyReads, cloneReads,
        harvestedVersion: getRecordVersion('logged-out-record', 'records') },
      { outcome: 'AbortError', transportCalls: 0, bodyReads: 0, cloneReads: 0, harvestedVersion: undefined });
      if (boundary !== 'replacement') assert.equal(controller.getSnapshot().session.token, null);
    });
  }

  for (const reader of ['json', 'text', 'blob', 'arrayBuffer', 'formData', 'bytes']) {
    it(`guards delayed ${reader} body resolution after replacement`, async () => {
      const { controller, session } = setup();
      const body = deferred();
      globalThis.fetch = async () => ({ ok: true, status: 200, [reader]: () => body.promise });
      const response = await apiFetch('/resource');
      const reading = response[reader]().catch((error) => error);
      controller.replace(session);
      body.resolve('obsolete');
      assert.equal((await reading).name, 'AbortError');
      await assert.rejects(response[reader](), { name: 'AbortError' });
    });
  }

  it('guards clones too, but permits current body reads', async () => {
    const { controller, session } = setup();
    globalThis.fetch = async () => new Response(JSON.stringify({ value: 'current' }));
    const response = await apiFetch('/resource');
    const clone = response.clone();
    assert.deepEqual(await response.json(), { value: 'current' });
    controller.replace(session);
    await assert.rejects(clone.json(), { name: 'AbortError' });
  });

  for (const method of ['GET', 'POST']) {
    it(`does not harvest obsolete ${method} record versions after a delayed clone body`, async () => {
      const { controller, session } = setup();
      const body = deferred();
      const response = { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }),
        clone: () => ({ json: () => body.promise }), json: async () => ({}) };
      globalThis.fetch = async () => response;
      await apiFetch('/fixture/records/record-one', { method });
      controller.replace(session);
      body.resolve({ response: { data: [{ id: 'record-one', updated: 'obsolete-version' }] } });
      await body.promise;
      await Promise.resolve();
      assert.equal(getRecordVersion('record-one', 'records'), undefined);

      const current = deferred();
      globalThis.fetch = async () => ({ ...response, clone: () => ({ json: () => current.promise }) });
      await apiFetch('/fixture/records/record-one', { method });
      current.resolve({ response: { data: [{ id: 'record-one', updated: 'current-version' }] } });
      await current.promise;
      await Promise.resolve();
      assert.equal(getRecordVersion('record-one', 'records'), 'current-version');
    });
  }

  it('does not replay an obsolete write', async () => {
    const { controller, session } = setup();
    const pending = deferred();
    let calls = 0;
    globalThis.fetch = () => { calls += 1; return pending.promise; };
    const request = apiFetch('/fixture/action', { method: 'POST', body: '{}' }).catch((error) => error);
    controller.replace(session);
    pending.resolve(jsonResponse({ success: true }));
    assert.equal((await request).name, 'AbortError');
    assert.equal(calls, 1);
  });
});
