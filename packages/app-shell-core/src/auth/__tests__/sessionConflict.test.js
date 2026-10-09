import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  ACCOUNT_MISMATCH_MESSAGE,
  SESSION_CHANNEL_NAME,
  announceSessionAccount,
  clearSessionConflict,
  compareLiveSessionAccount,
  getSessionConflict,
  listenSessionAccount,
  observeSessionConflictResponse,
  reportSessionConflict,
  resetSessionConflictForTests,
  subscribeSessionConflict,
} from '../sessionConflict.js';

/**
 * @covers packages/app-shell-core/src/auth/sessionConflict.js
 *
 * ETP-5675 — the session cookie belongs to the browser profile, so a tab still showing account B
 * after another tab signed in as C used to read C's tenant under B's name. This module is how a
 * tab learns it: a broadcast from the tab that signed in, a re-check on return, and the backend's
 * 403 "Session belongs to another account". Plain `node --test`: the module imports nothing.
 */
describe('sessionConflict', () => {
  beforeEach(() => {
    resetSessionConflictForTests();
  });

  describe('store', () => {
    it('records the first report and ignores the burst that follows it', () => {
      let notified = 0;
      subscribeSessionConflict(() => { notified += 1; });

      reportSessionConflict({ reason: 'request' });
      reportSessionConflict({ reason: 'broadcast', accountId: 'acc-C' });

      assert.deepEqual(getSessionConflict(), { reason: 'request', accountId: null });
      assert.equal(notified, 1);
    });

    it('clears and notifies once', () => {
      let notified = 0;
      reportSessionConflict({ reason: 'broadcast', accountId: 'acc-C' });
      subscribeSessionConflict(() => { notified += 1; });

      clearSessionConflict();
      clearSessionConflict();

      assert.equal(getSessionConflict(), null);
      assert.equal(notified, 1);
    });
  });

  describe('observeSessionConflictResponse', () => {
    const refusal = (message, status = 403) => new Response(
      JSON.stringify({ error: { message, status } }), { status },
    );

    it('records the backend account-mismatch refusal', async () => {
      assert.equal(await observeSessionConflictResponse(refusal(ACCOUNT_MISMATCH_MESSAGE)), true);
      assert.equal(getSessionConflict()?.reason, 'request');
    });

    it('ignores a stale-CSRF 403, which the ETP-5550 recovery owns', async () => {
      assert.equal(await observeSessionConflictResponse(refusal('CSRF validation failed')), false);
      assert.equal(getSessionConflict(), null);
    });

    it('ignores anything that is not a 403', async () => {
      assert.equal(await observeSessionConflictResponse(refusal(ACCOUNT_MISMATCH_MESSAGE, 401)), false);
      assert.equal(getSessionConflict(), null);
    });

    it('drops a refusal that belonged to a session this tab already left', async () => {
      await observeSessionConflictResponse(refusal(ACCOUNT_MISMATCH_MESSAGE), () => false);
      assert.equal(getSessionConflict(), null);
    });

    it('leaves the caller an unread body', async () => {
      const response = refusal(ACCOUNT_MISMATCH_MESSAGE);
      await observeSessionConflictResponse(response);
      assert.equal(response.bodyUsed, false);
    });
  });

  describe('compareLiveSessionAccount', () => {
    it('same account', async () => {
      const outcome = await compareLiveSessionAccount('acc-B', async () => ({ account: { id: 'acc-B' } }));
      assert.deepEqual(outcome, { status: 'same', accountId: 'acc-B' });
    });

    it('another account', async () => {
      const outcome = await compareLiveSessionAccount('acc-B', async () => ({ account: { id: 'acc-C' } }));
      assert.deepEqual(outcome, { status: 'other', accountId: 'acc-C' });
    });

    it('no session left', async () => {
      assert.deepEqual(await compareLiveSessionAccount('acc-B', async () => null), { status: 'none' });
    });

    it('an unreadable session is never a conflict (a deploy must not sign anyone out)', async () => {
      const outcome = await compareLiveSessionAccount('acc-B', async () => { throw new Error('503'); });
      assert.deepEqual(outcome, { status: 'unknown' });
    });

    it('a session without an account id cannot be compared', async () => {
      assert.deepEqual(await compareLiveSessionAccount('acc-B', async () => ({ csrfToken: 'c' })),
        { status: 'unknown' });
    });
  });

  describe('broadcast', () => {
    const original = globalThis.BroadcastChannel;
    let channels;

    beforeEach(() => {
      channels = [];
      globalThis.BroadcastChannel = class {
        constructor(name) { this.name = name; this.closed = false; channels.push(this); }

        postMessage(data) {
          channels.filter((c) => c !== this && !c.closed && c.name === this.name)
            .forEach((c) => c.onmessage?.({ data }));
        }

        close() { this.closed = true; }
      };
    });

    afterEach(() => {
      globalThis.BroadcastChannel = original;
    });

    it('delivers the announced account to the listeners of the other tabs', () => {
      const heard = [];
      const stop = listenSessionAccount((accountId) => heard.push(accountId));

      announceSessionAccount('acc-C');
      announceSessionAccount(null);
      stop();
      announceSessionAccount('acc-D');

      assert.deepEqual(heard, ['acc-C', null]);
      assert.ok(channels.every((c) => c.name === SESSION_CHANNEL_NAME));
    });

    it('ignores messages that are not announcements', () => {
      const heard = [];
      listenSessionAccount((accountId) => heard.push(accountId));
      const foreign = new globalThis.BroadcastChannel(SESSION_CHANNEL_NAME);

      foreign.postMessage({ type: 'something-else', accountId: 'acc-X' });

      assert.deepEqual(heard, []);
    });

    it('is a no-op without BroadcastChannel', () => {
      globalThis.BroadcastChannel = undefined;

      assert.doesNotThrow(() => announceSessionAccount('acc-C'));
      assert.equal(typeof listenSessionAccount(() => {}), 'function');
    });
  });
});
