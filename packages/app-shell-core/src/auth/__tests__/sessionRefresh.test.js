import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileSessionRefresh } from '../sessionRefresh.js';
import { createSessionController } from '../sessionController.js';
import { createMemoryAuthStorage, normalizeAuthSession } from '../session.js';
import { sessionFixture, metadataResponse } from './refreshFixtures.js';

describe('authoritative session refresh contract (ETP-5195)', () => {
  for (const [from, to] of [['personal', 'admin'], ['admin', 'personal']]) {
    it(`replaces ${from} with coherent ${to} role and organization lists`, () => {
      const current = sessionFixture({ role: from });
      const next = sessionFixture({ role: to, org: 'new-org' });
      const original = structuredClone(current);
      assert.deepEqual(reconcileSessionRefresh(current, metadataResponse(next)), { status: 'ready', session: next });
      assert.deepEqual(current, original);
    });
  }

  it('refreshes authoritative names and eligible organizations even when the role is unchanged', () => {
    const current = sessionFixture();
    const next = sessionFixture({ revision: 1 });
    next.selectedRole.name = 'Renamed personal role';
    next.selectedRole.orgList.push({ id: 'X-additional', name: 'Additional organization' });
    assert.deepEqual(reconcileSessionRefresh(current, metadataResponse(next)), { status: 'ready', session: next });
  });

  const invalid = [
    ['user mismatch', (r) => { r.session.userId = 'other-user'; }],
    ['client mismatch', (r) => { r.session.clientId = 'other-client'; }],
    ['role mismatch', (r) => { r.session.selectedRoleId = 'other-role'; }],
    ['organization mismatch', (r) => { r.session.selectedOrgId = 'other-org'; }],
    ['unsupported version', (r) => { r.session.version = 2; }],
    ['missing version', (r) => { delete r.session.version; }],
    ['empty role list', (r) => { r.session.roleList = []; }],
    ['missing selected role', (r) => { r.session.roleList[0].id = 'other-role'; }],
    ['missing selected organization', (r) => { r.session.roleList[0].orgList = []; }],
    ['duplicate role', (r) => { r.session.roleList.push(r.session.roleList[0]); }],
    ['duplicate organization', (r) => { r.session.roleList[0].orgList.push(r.session.roleList[0].orgList[0]); }],
    ['missing authoritative name', (r) => { delete r.session.roleList[0].name; }],
    ['malformed token with metadata', (r) => { r.token = 'invalid'; }],
  ];
  for (const [name, mutate] of invalid) {
    it(`rejects ${name} without a partial session`, () => {
      const response = metadataResponse(sessionFixture({ role: 'admin' }));
      mutate(response);
      assert.deepEqual(reconcileSessionRefresh(sessionFixture(), response), { status: 'metadata-required' });
    });
  }

  it('rejects a foreign tenant even when its metadata agrees with its JWT', () => {
    assert.deepEqual(reconcileSessionRefresh(sessionFixture(), metadataResponse(sessionFixture({ tenant: 'Y' }))),
      { status: 'metadata-required' });
  });

  it('rejects a foreign user in the same tenant even with matching metadata', () => {
    const response = metadataResponse(sessionFixture());
    const claims = JSON.parse(Buffer.from(response.token.split('.')[1], 'base64url').toString());
    claims.user = 'another-user-X';
    response.token = `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.fixture`;
    response.session.userId = claims.user;
    assert.deepEqual(reconcileSessionRefresh(sessionFixture(), response), { status: 'metadata-required' });
  });

  it('permits unchanged legacy identity as degraded without writing a new tuple', () => {
    assert.deepEqual(reconcileSessionRefresh(sessionFixture(), { token: sessionFixture({ revision: 2 }).token }),
      { status: 'legacy' });
  });

  it('treats an { unchanged: true } response the same as a legacy no-op', () => {
    // [ETP-5195 follow-up] SFRefreshToken now skips minting a JWT entirely when the caller's
    // role has not changed, returning `{ unchanged: true }` with no token/session at all —
    // this must route through the SAME no-op path a legacy (token-only, same-identity) backend
    // response does, not be misclassified as a failure just because there is no token to decode.
    assert.deepEqual(reconcileSessionRefresh(sessionFixture(), { unchanged: true }), { status: 'legacy' });
  });

  for (const change of [{ role: 'admin' }, { org: 'another' }, { tenant: 'Y' }]) {
    it(`blocks token-only identity changes ${JSON.stringify(change)}`, () => {
      assert.deepEqual(reconcileSessionRefresh(sessionFixture(), { token: sessionFixture(change).token }),
        { status: 'metadata-required' });
    });
  }

  it('rejects a persisted client/JWT mismatch even in legacy mode', () => {
    const session = sessionFixture();
    assert.deepEqual(reconcileSessionRefresh({ ...session, clientId: 'tenant-Y' }, { token: session.token }),
      { status: 'metadata-required' });
  });

  for (const response of [null, {}, { token: 'broken' }, { token: 'h.bnVsbA.s' }]) {
    it(`degrades unusable non-metadata responses ${JSON.stringify(response)}`, () => {
      assert.deepEqual(reconcileSessionRefresh(sessionFixture(), response), { status: 'failed' });
    });
  }
});

describe('synchronous session ownership', () => {
  function setup(onSessionChange) {
    const session = sessionFixture();
    const storage = createMemoryAuthStorage(session);
    return { session, storage, controller: createSessionController(session, storage, onSessionChange, '/server') };
  }

  it('invalidates same-token replacement before storage and host callbacks can reenter', () => {
    const { controller, storage, session } = setup(() => assert.equal(controller.isCurrent(snapshot), false));
    const snapshot = controller.capture();
    const write = storage.write;
    storage.write = (next) => {
      assert.equal(controller.isCurrent(snapshot), false);
      write(next);
    };
    controller.replace(session);
    assert.equal(controller.isCurrent(snapshot), false);
    assert.equal(controller.isCurrent(controller.capture()), true);
  });

  it('merges consecutive patches from synchronous state and clears omitted replacement fields', () => {
    const { controller } = setup();
    controller.patch({ username: 'renamed' });
    controller.patch({ clientId: 'replacement-client' });
    assert.equal(controller.getSnapshot().session.username, 'renamed');
    assert.equal(controller.getSnapshot().session.clientId, 'replacement-client');
    controller.replace({ token: 'replacement' });
    assert.deepEqual(controller.getSnapshot().session, normalizeAuthSession({ token: 'replacement' }));
  });

  it('invalidates logout synchronously, including storage clear reentry', () => {
    const { controller, storage } = setup();
    const snapshot = controller.capture();
    const clear = storage.clear;
    storage.clear = () => {
      assert.equal(controller.isCurrent(snapshot), false);
      assert.equal(controller.getSnapshot().session.token, null);
      clear();
    };
    controller.logout();
    assert.equal(controller.isCurrent(snapshot), false);
  });

  it('binds ownership to controller, storage tuple, server, and lifecycle generation', () => {
    const { controller, storage } = setup();
    const snapshot = controller.capture();
    assert.equal(setup().controller.isCurrent(snapshot), false);
    storage.write(sessionFixture({ tenant: 'Y' }));
    assert.equal(controller.isCurrent(snapshot), false);
    const changedStorage = controller.capture();
    controller.configure({ storage, apiBaseUrl: '/other-server' });
    assert.equal(controller.isCurrent(changedStorage), false);
    const beforeDispose = controller.capture();
    controller.dispose();
    controller.activate();
    assert.equal(controller.isCurrent(beforeDispose), false);
    assert.equal(controller.isCurrent(controller.capture()), true);
  });

  // [ETP-5189] `menuAccess` is a third flat-map slot alongside `windowAccess`/`capabilities` —
  // `replace()` must carry it through the same `access?.<key> ?? {}` contract as the other two,
  // not silently drop it or leave a stale value behind.
  it('replace() populates menuAccess from access.menuAccess', () => {
    const { controller, session } = setup();
    controller.replace(session, {
      access: { windowAccess: { W1: 'full' }, capabilities: { c: true }, menuAccess: { M1: true } },
    });
    assert.deepEqual(controller.getSnapshot().menuAccess, { M1: true });
  });

  it('replace() defaults menuAccess to {} when access has no menuAccess key', () => {
    const { controller, session } = setup();
    controller.replace(session, { access: { windowAccess: { W1: 'full' }, capabilities: { c: true } } });
    assert.deepEqual(controller.getSnapshot().menuAccess, {});
  });

  it('replace() defaults windowAccess/capabilities/menuAccess to {} when access is undefined', () => {
    const { controller, session } = setup();
    // Seed a non-empty menuAccess first, so the next replace() with no `access` at all
    // proves it actively resets rather than merely leaving a previous value untouched.
    controller.replace(session, { access: { windowAccess: { W1: 'full' }, menuAccess: { M1: true } } });
    assert.deepEqual(controller.getSnapshot().menuAccess, { M1: true });
    controller.replace(session);
    assert.deepEqual(controller.getSnapshot().windowAccess, {});
    assert.deepEqual(controller.getSnapshot().capabilities, {});
    assert.deepEqual(controller.getSnapshot().menuAccess, {});
  });
});
