import { describe, it, before, beforeEach, after } from 'node:test';
import { strict as assert } from 'node:assert';

// Minimal DOM shim — `node:test` runs without jsdom and the hook only
// touches window, localStorage and CustomEvent.
function setupDom() {
  const listeners = new Map();
  const store = new Map();

  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };

  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };

  globalThis.window = {
    localStorage: globalThis.localStorage,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    dispatchEvent(event) {
      for (const fn of listeners.get(event.type) || []) fn(event);
    },
    _reset() {
      listeners.clear();
      store.clear();
    },
  };
}

before(setupDom);
beforeEach(() => {
  window._reset();
});
after(() => {
  delete globalThis.window;
  delete globalThis.localStorage;
  delete globalThis.CustomEvent;
});

function keyEvent(key, { target = {} } = {}) {
  return { key, target };
}

describe('App Store unlock easter-egg', () => {
  it('starts locked', async () => {
    const mod = await import('../useAppStoreUnlock.js?case=start');
    assert.equal(mod.isAppStoreUnlocked(), false);
  });

  it('typing "playstoreon" unlocks and fires onUnlock once', async () => {
    const mod = await import('../useAppStoreUnlock.js?case=unlock');
    let unlockCalls = 0;
    const dispose = mod.attachKeySequenceWatcher({ onUnlock: () => unlockCalls++ });

    for (const ch of 'playstoreon') {
      window.dispatchEvent({ type: 'keydown', ...keyEvent(ch) });
    }

    assert.equal(mod.isAppStoreUnlocked(), true);
    assert.equal(unlockCalls, 1);

    // Typing it again when already unlocked should NOT refire.
    for (const ch of 'playstoreon') {
      window.dispatchEvent({ type: 'keydown', ...keyEvent(ch) });
    }
    assert.equal(unlockCalls, 1, 'onUnlock should not fire while already unlocked');

    dispose();
  });

  it('typing "playstoreoff" locks again', async () => {
    const mod = await import('../useAppStoreUnlock.js?case=lock');
    mod.unlockAppStore();
    assert.equal(mod.isAppStoreUnlocked(), true);

    let lockCalls = 0;
    const dispose = mod.attachKeySequenceWatcher({ onLock: () => lockCalls++ });

    for (const ch of 'playstoreoff') {
      window.dispatchEvent({ type: 'keydown', ...keyEvent(ch) });
    }

    assert.equal(mod.isAppStoreUnlocked(), false);
    assert.equal(lockCalls, 1);
    dispose();
  });

  it('ignores keys typed inside input / textarea / contenteditable', async () => {
    const mod = await import('../useAppStoreUnlock.js?case=editable');
    const dispose = mod.attachKeySequenceWatcher({});

    for (const ch of 'playstoreon') {
      window.dispatchEvent({
        type: 'keydown',
        ...keyEvent(ch, { target: { tagName: 'INPUT' } }),
      });
    }
    assert.equal(mod.isAppStoreUnlocked(), false,
      'typing in an INPUT should not unlock');

    for (const ch of 'playstoreon') {
      window.dispatchEvent({
        type: 'keydown',
        ...keyEvent(ch, { target: { isContentEditable: true } }),
      });
    }
    assert.equal(mod.isAppStoreUnlocked(), false,
      'typing in a contenteditable element should not unlock');

    dispose();
  });

  it('ignores non-character keys (shift, meta, arrows, etc.)', async () => {
    const mod = await import('../useAppStoreUnlock.js?case=non-char');
    const dispose = mod.attachKeySequenceWatcher({});

    // interleave "playstoreon" with harmless modifiers and navigation keys.
    const noise = ['Shift', 'ArrowLeft', 'Meta'];
    for (const ch of 'playstoreon') {
      window.dispatchEvent({ type: 'keydown', ...keyEvent(noise[0]) });
      window.dispatchEvent({ type: 'keydown', ...keyEvent(ch) });
      window.dispatchEvent({ type: 'keydown', ...keyEvent(noise[1]) });
    }

    assert.equal(mod.isAppStoreUnlocked(), true);
    dispose();
  });
});
