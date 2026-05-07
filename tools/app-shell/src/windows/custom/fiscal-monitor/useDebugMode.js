// Module-level store so all hook instances share the same state.
const STORAGE_KEY = 'etendo-debug-fiscal';
const SEQUENCE    = 'debugfiscal';

let buffer    = '';
let listeners = new Set();

function getActive() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

function setActive(v) {
  try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch {}
  listeners.forEach(fn => fn(v));
}

if (typeof window !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const ch = e.key.length === 1 ? e.key.toLowerCase() : '';
    if (!ch) return;
    buffer = (buffer + ch).slice(-SEQUENCE.length);
    if (buffer === SEQUENCE) {
      const next = !getActive();
      setActive(next);
      buffer = '';
      console.info(`[Debug] Fiscal debug mode ${next ? 'ON' : 'OFF'}`);
    }
  });
}

import { useState, useEffect } from 'react';

export function useDebugMode() {
  const [active, setLocalActive] = useState(getActive);

  useEffect(() => {
    const handler = (v) => setLocalActive(v);
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  return active;
}
