import { useSyncExternalStore } from 'react';

/**
 * Mock installed-apps store.
 *
 * Persists a list of installed appIds in localStorage and exposes a
 * subscribe/getSnapshot pair so React components can re-render when the
 * set changes. Cross-tab updates are picked up via the native `storage`
 * event; same-tab updates dispatch a custom event (`storage` does NOT
 * fire in the tab that wrote the value).
 *
 * The store is intentionally simple — no server, no queues — because the
 * point is only to make it visually obvious that SDK apps are installable
 * artifacts rather than hardcoded menu entries.
 */

const STORAGE_KEY = 'etendo.installedApps';
const CHANGE_EVENT = 'etendo:installed-apps-changed';

function readFromStorage() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// useSyncExternalStore requires a stable reference for unchanged snapshots.
let cachedSnapshot = readFromStorage();
let cachedSerialized = JSON.stringify(cachedSnapshot);

function refreshSnapshot() {
  const next = readFromStorage();
  const nextSerialized = JSON.stringify(next);
  if (nextSerialized !== cachedSerialized) {
    cachedSnapshot = next;
    cachedSerialized = nextSerialized;
  }
}

function getSnapshot() {
  return cachedSnapshot;
}

function getServerSnapshot() {
  return [];
}

function subscribe(callback) {
  const handler = () => {
    refreshSnapshot();
    callback();
  };
  window.addEventListener('storage', handler);
  window.addEventListener(CHANGE_EVENT, handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(CHANGE_EVENT, handler);
  };
}

function writeList(list) {
  const deduped = Array.from(new Set(list));
  cachedSnapshot = deduped;
  cachedSerialized = JSON.stringify(deduped);
  window.localStorage.setItem(STORAGE_KEY, cachedSerialized);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function installApp(appId) {
  if (!appId) return;
  const current = readFromStorage();
  if (current.includes(appId)) return;
  writeList([...current, appId]);
}

export function uninstallApp(appId) {
  if (!appId) return;
  const current = readFromStorage();
  if (!current.includes(appId)) return;
  writeList(current.filter((id) => id !== appId));
}

export function isInstalled(appId) {
  return readFromStorage().includes(appId);
}

export function useInstalledApps() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
