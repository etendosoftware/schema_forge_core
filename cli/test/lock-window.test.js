import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { lockWindow, unlockWindow, getLockStatus, validateLock } from '../src/lock-window.js';

describe('lockWindow', () => {
  let locks;

  beforeEach(() => {
    locks = {};
  });

  it('locks an unlocked window', () => {
    const result = lockWindow(locks, 'Sales Order', {
      owner: 'sebastian',
      branch: 'feat/sales-order',
      reason: 'Extracting fields',
    });
    assert.equal(result.success, true);
    assert.ok(result.locks['Sales Order']);
    assert.equal(result.locks['Sales Order'].owner, 'sebastian');
    assert.equal(result.locks['Sales Order'].branch, 'feat/sales-order');
    assert.equal(result.locks['Sales Order'].reason, 'Extracting fields');
    assert.ok(result.locks['Sales Order'].since);
  });

  it('rejects locking already-locked window by different owner', () => {
    locks['Sales Order'] = {
      owner: 'alex',
      branch: 'feat/other',
      since: '2026-03-12',
      reason: 'Working on it',
    };
    const result = lockWindow(locks, 'Sales Order', {
      owner: 'sebastian',
      branch: 'feat/sales-order',
      reason: 'Need it',
    });
    assert.equal(result.success, false);
    assert.ok(result.error);
    assert.match(result.error, /alex/);
  });

  it('allows same owner to re-lock (update reason)', () => {
    locks['Sales Order'] = {
      owner: 'sebastian',
      branch: 'feat/sales-order',
      since: '2026-03-12',
      reason: 'Old reason',
    };
    const result = lockWindow(locks, 'Sales Order', {
      owner: 'sebastian',
      branch: 'feat/sales-order-v2',
      reason: 'New reason',
    });
    assert.equal(result.success, true);
    assert.equal(result.locks['Sales Order'].reason, 'New reason');
    assert.equal(result.locks['Sales Order'].branch, 'feat/sales-order-v2');
  });
});

describe('unlockWindow', () => {
  let locks;

  beforeEach(() => {
    locks = {};
  });

  it('unlocks a window owned by requesting owner', () => {
    locks['Sales Order'] = {
      owner: 'sebastian',
      branch: 'feat/sales-order',
      since: '2026-03-12',
      reason: 'Working',
    };
    const result = unlockWindow(locks, 'Sales Order', 'sebastian');
    assert.equal(result.success, true);
    assert.equal(result.locks['Sales Order'], undefined);
  });

  it('rejects unlock by different owner', () => {
    locks['Sales Order'] = {
      owner: 'alex',
      branch: 'feat/other',
      since: '2026-03-12',
      reason: 'Working',
    };
    const result = unlockWindow(locks, 'Sales Order', 'sebastian');
    assert.equal(result.success, false);
    assert.ok(result.error);
    assert.match(result.error, /alex/);
  });

  it('succeeds silently for already-unlocked window', () => {
    const result = unlockWindow(locks, 'Sales Order', 'sebastian');
    assert.equal(result.success, true);
  });
});

describe('getLockStatus', () => {
  it('returns all locks sorted by window name', () => {
    const locks = {
      'Purchase Order': { owner: 'alex', branch: 'feat/po', since: '2026-03-12', reason: 'PO work' },
      'Business Partner': { owner: 'sebastian', branch: 'feat/bp', since: '2026-03-11', reason: 'BP work' },
      'Sales Order': { owner: 'catalyst', branch: 'feat/so', since: '2026-03-10', reason: 'SO work' },
    };
    const status = getLockStatus(locks);
    assert.equal(status.length, 3);
    assert.equal(status[0].window, 'Business Partner');
    assert.equal(status[1].window, 'Purchase Order');
    assert.equal(status[2].window, 'Sales Order');
    assert.equal(status[0].owner, 'sebastian');
  });

  it('returns empty array when no locks', () => {
    const status = getLockStatus({});
    assert.deepEqual(status, []);
  });
});

describe('validateLock', () => {
  it('returns valid when owner has the lock', () => {
    const locks = {
      'Sales Order': { owner: 'sebastian', branch: 'feat/so', since: '2026-03-12', reason: 'Work' },
    };
    const result = validateLock(locks, 'Sales Order', 'sebastian');
    assert.equal(result.valid, true);
    assert.equal(result.error, undefined);
  });

  it('returns invalid when different owner has lock', () => {
    const locks = {
      'Sales Order': { owner: 'alex', branch: 'feat/so', since: '2026-03-12', reason: 'Work' },
    };
    const result = validateLock(locks, 'Sales Order', 'sebastian');
    assert.equal(result.valid, false);
    assert.ok(result.error);
    assert.match(result.error, /alex/);
  });

  it('returns invalid when window is not locked', () => {
    const result = validateLock({}, 'Sales Order', 'sebastian');
    assert.equal(result.valid, false);
    assert.ok(result.error);
  });
});
