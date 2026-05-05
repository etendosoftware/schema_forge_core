import { useSyncExternalStore } from 'react';

/**
 * "Play Store" easter-egg lock.
 *
 * The App Store menu entry is hidden by default. Typing the magic word
 * `playstoreon` anywhere in the shell (outside of editable fields)
 * reveals it; typing `playstoreoff` hides it again. The unlock state is
 * persisted in localStorage so a reload keeps the Marketplace visible.
 *
 * Exports:
 *   useAppStoreUnlock()   — reactive boolean for the unlocked state
 *   unlockAppStore()      — force-unlock (called by the key-sequence watcher)
 *   lockAppStore()        — force-lock (called by the same watcher or the UI)
 *   isAppStoreUnlocked()  — non-reactive snapshot (for module-level reads)
 *   attachKeySequenceWatcher({ onUnlock, onLock }) — install the global
 *       keydown listener. Returns a dispose function. Intended to be mounted
 *       once, from a component that lives under the Router so callbacks can
 *       navigate / toast.
 */

const STORAGE_KEY = 'etendo.appStoreUnlocked';
const CHANGE_EVENT = 'etendo:app-store-unlocked-changed';

const UNLOCK_PHRASE = 'playstoreon';
const LOCK_PHRASE = 'playstoreoff';
const BUFFER_MAX = Math.max(UNLOCK_PHRASE.length, LOCK_PHRASE.length) + 4;
const RESET_MS = 3000;

function readFromStorage() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

let cached = readFromStorage();

function write(next) {
  if (cached === next) return;
  cached = next;
  if (next) {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function refresh() {
  const next = readFromStorage();
  if (next !== cached) cached = next;
}

function subscribe(callback) {
  const handler = () => {
    refresh();
    callback();
  };
  window.addEventListener('storage', handler);
  window.addEventListener(CHANGE_EVENT, handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(CHANGE_EVENT, handler);
  };
}

function getSnapshot() {
  return cached;
}

function getServerSnapshot() {
  return false;
}

export function unlockAppStore() {
  write(true);
}

export function lockAppStore() {
  write(false);
}

export function isAppStoreUnlocked() {
  return cached;
}

export function useAppStoreUnlock() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Attach a global keydown listener that watches for the magic phrases.
 * Returns a dispose function. Call once at the top of the tree.
 */
export function attachKeySequenceWatcher({ onUnlock, onLock } = {}) {
  let buffer = '';
  let lastKey = 0;

  const onKeyDown = (e) => {
    // Only react to single-character printable keys.
    if (!e.key || e.key.length !== 1) return;

    // Skip when typing in editable fields — do not fight form inputs.
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      return;
    }

    const now = Date.now();
    if (now - lastKey > RESET_MS) buffer = '';
    lastKey = now;

    buffer = (buffer + e.key.toLowerCase()).slice(-BUFFER_MAX);

    // Check LOCK first (its suffix would otherwise partially match UNLOCK
    // intermediate states, and a short-circuit keeps the logic obvious).
    if (buffer.endsWith(LOCK_PHRASE)) {
      buffer = '';
      if (isAppStoreUnlocked()) {
        lockAppStore();
        onLock?.();
      }
      return;
    }

    if (buffer.endsWith(UNLOCK_PHRASE)) {
      buffer = '';
      if (!isAppStoreUnlocked()) {
        unlockAppStore();
        onUnlock?.();
      }
    }
  };

  window.addEventListener('keydown', onKeyDown);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
  };
}
