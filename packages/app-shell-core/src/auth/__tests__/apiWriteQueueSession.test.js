import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createApiFetch, resetApiSessionForTests, resetRecordWriteChainsForTests,
} from '../api.js';
import { createSessionController } from '../sessionController.js';
import { createMemoryAuthStorage } from '../session.js';
import { getRecordVersion, rememberRecordVersion, resetRecordVersionsForTests } from '../../lib/recordVersions.js';
import { deferred, sessionFixture } from './refreshFixtures.js';

/**
 * Where per-record write serialisation (ETP-5255) meets session scoping (ETP-5195).
 *
 * The two features are independent on their own, and each is covered elsewhere
 * (`api.test.js`, `apiOwnership.test.js`). What is only testable once they are combined is the
 * WAIT the queue introduces: a write can now sit between being asked for and going out, so the
 * session it is dispatched under is no longer the session it was requested under.
 *
 * The rule this file fixes is that IDENTITY, not the bearer, decides what survives:
 *
 * - a pure token rotation (`bump: false`) discards NOTHING. A queued write goes out with the
 *   fresh bearer, and a request already in flight completes normally — JWT validation here is
 *   stateless (signature plus the token's own `exp`, no server-side registry of "the current
 *   token" and no revocation list until ETP-5270 adds one), so the bearer a request already
 *   sent stays valid and its response is byte-for-byte what it would have been. Failing it
 *   produced an `AbortError` that `useQuery` swallows silently — a request thrown away for
 *   nothing, and, for a queued write, a save the user made lost without a word.
 * - a real identity change (logout, another user, another client, another base URL) abandons
 *   the request, whether it is queued or already in flight.
 */

const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetRecordWriteChainsForTests();
  resetRecordVersionsForTests();
  resetApiSessionForTests();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  // A suite that leaves a write unresolved would otherwise make the next suite's write to the
  // same key wait on it forever.
  resetRecordWriteChainsForTests();
  resetRecordVersionsForTests();
  resetApiSessionForTests();
});

function setup({ tenant = 'X' } = {}) {
  const session = sessionFixture({ tenant });
  const controller = createSessionController(session, createMemoryAuthStorage(session));
  let logouts = 0;
  const getToken = () => controller.getSnapshot().session.token;
  const onUnauthorized = () => { logouts += 1; };
  const client = createApiFetch('', getToken, onUnauthorized, controller);
  return { session, controller, client, getToken, logouts: () => logouts };
}

/** A harvestable success: JSON content type plus an INDEPENDENT clone, as `jsonClone` demands. */
function recordResponse(record, status = 200) {
  const payload = { response: { data: [record] } };
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => payload,
    clone: () => ({ json: async () => payload }),
  };
}

/** Lets every already-queued continuation run, without depending on a fixed number of ticks. */
const flush = () => new Promise((resolve) => { setTimeout(resolve, 0); });

const bearerOf = (init) => init?.headers?.Authorization;

describe('per-record write serialisation (ETP-5255)', () => {
  it('holds the second write to a record until the first response has been harvested', async () => {
    const { client } = setup();
    rememberRecordVersion({ id: 'record-one', updated: 'version-read' }, 'records');
    const bodies = [];
    const first = deferred();
    const harvest = deferred();
    globalThis.fetch = (url, init) => {
      bodies.push(JSON.parse(init.body));
      return bodies.length === 1
        ? first.promise
        : Promise.resolve(recordResponse({ id: 'record-one', updated: 'version-after-second' }));
    };

    const a = client('/fixture/records/record-one', { method: 'PUT', body: JSON.stringify({ name: 'a' }) });
    const b = client('/fixture/records/record-one', { method: 'PUT', body: JSON.stringify({ name: 'b' }) });
    await flush();
    assert.equal(bodies.length, 1, 'the second write must not be in flight alongside the first');

    // The first response arrives, but its body is still being parsed. Releasing the second write
    // now would arm it from a cache the harvest has not written to yet.
    first.resolve({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
      clone: () => ({ json: () => harvest.promise }),
    });
    await flush();
    assert.equal(bodies.length, 1, 'the second write must wait for the harvest, not just the response');

    harvest.resolve({ response: { data: [{ id: 'record-one', updated: 'version-after-first' }] } });
    await a;
    await b;
    // The point of awaiting the harvest: the second body carries what the first RESPONSE
    // returned, not the token the first REQUEST sent (which the server has already consumed).
    assert.deepEqual(bodies, [
      { name: 'a', updated: 'version-read' },
      { name: 'b', updated: 'version-after-first' },
    ]);
  });

  it('keeps writes to different records fully parallel', async () => {
    const { client } = setup();
    const calls = [];
    const pending = deferred();
    globalThis.fetch = (url) => { calls.push(url); return pending.promise; };

    const a = client('/fixture/records/record-one', { method: 'PUT', body: '{}' });
    const b = client('/fixture/records/record-two', { method: 'PUT', body: '{}' });
    await flush();
    assert.deepEqual(calls, ['/fixture/records/record-one', '/fixture/records/record-two']);

    pending.resolve(recordResponse({ id: 'record-one', updated: 'v' }));
    await Promise.all([a, b]);
  });

  it('does not strand a successor behind a failed predecessor', async () => {
    const { client } = setup();
    const calls = [];
    const first = deferred();
    globalThis.fetch = (url, init) => {
      calls.push(JSON.parse(init.body).name);
      return calls.length === 1
        ? first.promise
        : Promise.resolve(recordResponse({ id: 'record-one', updated: 'v' }));
    };

    const a = client('/fixture/records/record-one', { method: 'PUT', body: JSON.stringify({ name: 'a' }) });
    const b = client('/fixture/records/record-one', { method: 'PUT', body: JSON.stringify({ name: 'b' }) });
    await flush();
    first.reject(new Error('network down'));

    await assert.rejects(a, /network down/);
    const response = await b;
    assert.equal(response.status, 200);
    assert.deepEqual(calls, ['a', 'b']);
  });
});

describe('a queued write and the session it is dispatched under (ETP-5255 x ETP-5195)', () => {
  // The agreed rule, end to end and named: a pure rotation is not a session change, so it
  // discards nothing. The in-flight write keeps its response (its bearer is still valid) and the
  // queued one is re-armed with the fresh bearer (abandoning it would silently lose a save the
  // user made). What DOES abandon a request is a real identity change — see the logout test
  // below for the queued half and the in-flight suite further down for the other.
  it('a pure token rotation discards nothing: the in-flight write completes and the queued one goes out with the new bearer', async () => {
    const { client, controller, session, logouts } = setup();
    const rotated = sessionFixture({ revision: 1 });
    assert.notEqual(rotated.token, session.token, 'the fixture must actually rotate the bearer');

    const bearers = [];
    const first = deferred();
    globalThis.fetch = (url, init) => {
      bearers.push(bearerOf(init));
      return bearers.length === 1
        ? first.promise
        : Promise.resolve(recordResponse({ id: 'record-one', updated: 'v' }));
    };

    const a = client('/fixture/records/record-one', { method: 'PUT', body: '{}' });
    const b = client('/fixture/records/record-one', { method: 'PUT', body: '{}' });
    await flush();

    // A silent rotation: same user, same client, same role — only the bearer moved.
    controller.replace(rotated, { bump: false });
    first.resolve(recordResponse({ id: 'record-one', updated: 'v' }));

    // In flight when the bearer moved: the token it already sent is still valid, so the response
    // is still ours and throwing it away would buy nothing.
    assert.equal((await a).status, 200);
    // Queued when the bearer moved: it goes out, and it goes out under the token that is live NOW.
    const response = await b;
    assert.equal(response.status, 200);
    assert.deepEqual(bearers, [`Bearer ${session.token}`, `Bearer ${rotated.token}`]);
    // A rotation is not an expired session. Logging the user out here would be the defect.
    assert.equal(logouts(), 0);
  });

  // The other half of the rule. `resolveSession` alone cannot tell this case from the rotation
  // above: after a logout both of its token readings agree (both `null`) and a snapshot captured
  // at dispatch time is trivially current, so the write would reach the server with no
  // `Authorization` header at all. What separates them is the identity captured when the request
  // was ASKED for, re-checked after the queue wait.
  it('abandons a queued write when the session is logged out before it dispatches', async () => {
    const { client, controller, logouts } = setup();
    const bearers = [];
    const first = deferred();
    globalThis.fetch = (url, init) => {
      bearers.push(bearerOf(init));
      return bearers.length === 1
        ? first.promise
        : Promise.resolve(recordResponse({ id: 'record-one', updated: 'v' }));
    };

    const a = client('/fixture/records/record-one', { method: 'PUT', body: '{}' }).catch((error) => error);
    const b = client('/fixture/records/record-one', { method: 'PUT', body: '{}' }).catch((error) => error);
    await flush();

    controller.logout();
    first.resolve(recordResponse({ id: 'record-one', updated: 'v' }));

    assert.equal((await a).name, 'AbortError');
    assert.equal((await b).name, 'AbortError');
    assert.equal(bearers.length, 1, 'the queued write must never reach the transport after a logout');
    // In particular it must never go out unauthenticated, which is what an anonymous write to a
    // NEO record would be.
    assert.ok(!bearers.includes(undefined));
    assert.equal(logouts(), 0);
  });

  // Regression guard for the session prefix in the `recordWriteChains` key: (entity, id) carries
  // no tenant, and the map is module state that outlives a login, so without the prefix two
  // clients holding the same record id share one queue.
  it('prefixes the write queue key with the session, so one tenant\'s pending chain cannot gate another tenant\'s write to the same record', async () => {
    const mine = setup({ tenant: 'X' });
    const theirs = setup({ tenant: 'Y' });
    const calls = [];
    const stuck = deferred();
    globalThis.fetch = (url, init) => {
      calls.push(bearerOf(init));
      return calls.length === 1 ? stuck.promise : Promise.resolve(recordResponse({ id: 'record-one', updated: 'v' }));
    };

    // Never resolved: the first session leaves a pending chain on (records, record-one).
    const abandoned = mine.client('/fixture/records/record-one', { method: 'PUT', body: '{}' })
      .catch((error) => error);
    await flush();
    assert.equal(calls.length, 1);

    // Same entity, same id, different user: the queue key is prefixed by session identity.
    await theirs.client('/fixture/records/record-one', { method: 'PUT', body: '{}' });
    assert.deepEqual(calls, [`Bearer ${mine.session.token}`, `Bearer ${theirs.session.token}`]);

    stuck.resolve(recordResponse({ id: 'record-one', updated: 'v' }));
    await abandoned;
  });
});

describe('a request already in flight and the session under it', () => {
  // Two identity changes that reach the verdict by DIFFERENT routes inside `matches()`: a logout
  // bumps `generation`, so it is rejected by the generation guard before any field is compared;
  // a `bump: false` handover to another user leaves `generation` alone, so only the field
  // comparison (userId / clientId / storageIdentity) can catch it. Now that the bearer is no
  // longer the trigger, these are the two paths that have to keep working.
  for (const [change, apply] of [
    ['a logout', (controller) => controller.logout()],
    ['a different user taking over', (controller) => controller.replace(sessionFixture({ tenant: 'Y' }), { bump: false })],
  ]) {
    it(`abandons an in-flight request after ${change}`, async () => {
      const { client, controller } = setup();
      const pending = deferred();
      globalThis.fetch = () => pending.promise;

      const request = client('/fixture/records/record-one').catch((error) => error);
      await flush();
      apply(controller);
      pending.resolve(recordResponse({ id: 'record-one', updated: 'not-ours' }));

      assert.equal((await request).name, 'AbortError');
      // And nothing it carried leaks into the session that replaced it.
      assert.equal(getRecordVersion('record-one', 'records'), undefined);
    });
  }

  it('abandons an in-flight WRITE after a logout', async () => {
    const { client, controller } = setup();
    const pending = deferred();
    globalThis.fetch = () => pending.promise;

    const request = client('/fixture/records/record-one', { method: 'PUT', body: '{}' })
      .catch((error) => error);
    await flush();
    controller.logout();
    pending.resolve(recordResponse({ id: 'record-one', updated: 'not-ours' }));

    assert.equal((await request).name, 'AbortError');
    assert.equal(getRecordVersion('record-one', 'records'), undefined);
  });
});

// The positive counterpart of the guards: they exist to reject work belonging to a session that
// is gone, and a pure rotation does not make a session gone. A late body read and a late harvest
// under the same identity are valid and must go through — otherwise relaxing the in-flight rule
// would have moved the silent failure one layer down instead of removing it.
describe('work that lands after a pure token rotation', () => {
  it('lets a body read resolved after the rotation through', async () => {
    const { client, controller } = setup();
    const body = deferred();
    globalThis.fetch = async () => ({ ok: true, status: 200, json: () => body.promise });

    const response = await client('/resource');
    const reading = response.json();
    controller.replace(sessionFixture({ revision: 1 }), { bump: false });
    body.resolve({ value: 'still ours' });

    assert.deepEqual(await reading, { value: 'still ours' });
    // And a read started entirely after the rotation is fine too.
    globalThis.fetch = async () => new Response(JSON.stringify({ value: 'also ours' }));
    assert.deepEqual(await (await client('/resource')).json(), { value: 'also ours' });
  });

  it('remembers a version harvested after the rotation', async () => {
    const { client, controller } = setup();
    const body = deferred();
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
      clone: () => ({ json: () => body.promise }),
    });

    const pending = client('/fixture/records/record-one', { method: 'PUT', body: '{}' });
    await flush();
    controller.replace(sessionFixture({ revision: 1 }), { bump: false });
    body.resolve({ response: { data: [{ id: 'record-one', updated: 'harvested-after-rotation' }] } });
    await pending;

    assert.equal(getRecordVersion('record-one', 'records'), 'harvested-after-rotation');
  });
});

describe('a single exit for every response (ETP-5255 merge: `finish`)', () => {
  // The action branch returns from its own `return` statement, so before `finish` existed the
  // 401 block was duplicated — and a guard applied on one branch and forgotten on the other is
  // exactly what this parametrisation is for.
  for (const [branch, path] of [
    ['action', '/fixture/header/record-one/action/documentAction'],
    ['normal', '/fixture/header/record-one'],
  ]) {
    it(`logs out on a 401 the live bearer earned, on the ${branch} branch`, async () => {
      const { client, session, logouts } = setup();
      globalThis.fetch = async () => recordResponse({}, 401);
      await assert.rejects(
        client(path, { method: 'POST', body: '{}', token: session.token }),
        /Unauthorized/,
      );
      assert.equal(logouts(), 1);
    });

    it(`ignores a 401 earned by a bearer that is no longer live, on the ${branch} branch`, async () => {
      const { client, logouts } = setup();
      globalThis.fetch = async () => recordResponse({}, 401);
      await assert.rejects(
        client(path, { method: 'POST', body: '{}', token: sessionFixture({ tenant: 'Y' }).token }),
        /Unauthorized/,
      );
      // A 401 for a token that has been rotated away says nothing about the session that
      // replaced it, so it must not end that session.
      assert.equal(logouts(), 0);
    });
  }
});

describe('harvesting under a session that moved', () => {
  // PUT goes through the AWAITED harvest on the serialised path, GET through the floated one.
  for (const method of ['PUT', 'GET']) {
    it(`does not remember a ${method} version harvested after the session was replaced`, async () => {
      const { client, controller } = setup();
      const body = deferred();
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
        clone: () => ({ json: () => body.promise }),
      });

      const pending = client('/fixture/records/record-one', method === 'PUT'
        ? { method, body: '{}' }
        : {}).catch((error) => error);
      await flush();

      controller.replace(sessionFixture({ tenant: 'Y' }));
      body.resolve({ response: { data: [{ id: 'record-one', updated: 'obsolete-version' }] } });
      await body.promise;
      await flush();
      await pending;

      assert.equal(getRecordVersion('record-one', 'records'), undefined);
    });
  }

  it('remembers the version when the session is still the one that asked', async () => {
    const { client } = setup();
    globalThis.fetch = async () => recordResponse({ id: 'record-one', updated: 'current-version' });
    await client('/fixture/records/record-one', { method: 'PUT', body: '{}' });
    assert.equal(getRecordVersion('record-one', 'records'), 'current-version');
  });
});

describe('sessionController.isSameIdentity', () => {
  const controllerWithoutStorage = (session, apiBaseUrl = '/api') => createSessionController(
    session, undefined, undefined, apiBaseUrl,
  );

  it('stays true across a silent token rotation', () => {
    const session = sessionFixture();
    const controller = controllerWithoutStorage(session);
    const snapshot = controller.capture();
    controller.replace(sessionFixture({ revision: 1 }), { bump: false });
    assert.equal(controller.isSameIdentity(snapshot), true);
    // The distinction this predicate exists to draw: `isCurrent` still rejects the same
    // snapshot, because a request already in flight carries the superseded bearer.
    assert.equal(controller.isCurrent(snapshot), false);
  });

  // The configuration the real app runs in, and the one the identity comparison has to get
  // right: `capture().storage` is a fingerprint of the WHOLE persisted session, token included,
  // so an identity check that excluded `token` but compared `storage` would be indistinguishable
  // from `isCurrent` and the exclusion would buy nothing. `storageIdentity` is the same
  // fingerprint minus the bearer.
  it('stays true across a silent token rotation when a storage is configured', () => {
    const session = sessionFixture();
    const controller = createSessionController(session, createMemoryAuthStorage(session));
    const snapshot = controller.capture();
    controller.replace(sessionFixture({ revision: 1 }), { bump: false });
    assert.equal(controller.isSameIdentity(snapshot), true);
    assert.equal(controller.isCurrent(snapshot), false, 'the two predicates must not collapse into one');
  });

  it('still sees a persisted identity change through the storage fingerprint', () => {
    const session = sessionFixture();
    const storage = createMemoryAuthStorage(session);
    const controller = createSessionController(session, storage);
    const snapshot = controller.capture();
    // Written straight to storage, so no `replace` bumps the generation: only the fingerprint
    // can catch it. Dropping the token from it must not blind it to everything else.
    storage.write({ ...session, username: 'somebody-else' });
    assert.equal(controller.isSameIdentity(snapshot), false);
  });

  it('is false after a logout', () => {
    const controller = controllerWithoutStorage(sessionFixture());
    const snapshot = controller.capture();
    controller.logout();
    assert.equal(controller.isSameIdentity(snapshot), false);
  });

  it('is false after a different user takes over', () => {
    const controller = controllerWithoutStorage(sessionFixture({ tenant: 'X' }));
    const snapshot = controller.capture();
    controller.replace(sessionFixture({ tenant: 'Y' }), { bump: false });
    assert.equal(controller.isSameIdentity(snapshot), false);
  });

  it('is false after the session client changes under the same bearer', () => {
    const session = sessionFixture();
    const controller = controllerWithoutStorage(session);
    const snapshot = controller.capture();
    controller.replace({ ...session, clientId: 'another-client' }, { bump: false });
    assert.equal(controller.isSameIdentity(snapshot), false);
  });

  it('is false after the API base URL changes', () => {
    const controller = controllerWithoutStorage(sessionFixture(), '/api');
    const snapshot = controller.capture();
    controller.configure({ storage: undefined, onSessionChange: undefined, apiBaseUrl: '/other-api' });
    assert.equal(controller.isSameIdentity(snapshot), false);
  });
});
