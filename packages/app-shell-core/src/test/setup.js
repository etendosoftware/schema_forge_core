import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

// jsdom doesn't implement scroll APIs — stub them so components that
// scroll-to-bottom on new content (chat threads, message lists) don't throw.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}

// Node 22+ ships its own global `localStorage` accessor, gated behind the
// `--localstorage-file` flag. Without that flag it resolves to `undefined`
// (with an ExperimentalWarning), and vitest's bundled jsdom environment does
// not override a global that already exists on `globalThis` — so jsdom's own
// working `localStorage` never gets wired in, and every suite that touches
// `localStorage`/`window.localStorage` throws
// "Cannot read properties of undefined (reading 'clear')" (jsdom's
// `sessionStorage` is unaffected: Node's own version is a real in-memory
// Storage, not gated behind a flag).
// Back `localStorage` with a real Storage from a throwaway jsdom window so
// component/hook code behaves the same as it would in a browser.
if (typeof globalThis.localStorage === 'undefined') {
  const storageDom = new JSDOM('', { url: 'http://localhost' });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    enumerable: true,
    get: () => storageDom.window.localStorage,
  });
}

// ETP-5138 — ported from the functional setup (npm-only parts).
// Grid state is snapshotted into sessionStorage and shared by every test in a file's jsdom
// realm; clear it between tests so one test's filters never seed the next.
beforeEach(() => {
  try {
    globalThis.sessionStorage?.clear();
  } catch {
    /* no sessionStorage in this environment — nothing to reset */
  }
});

// scroll-pane observes size via ResizeObserver, which jsdom does not implement.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() { /* no-op: size never changes under jsdom */ }
    unobserve() { /* no-op: nothing is ever observed */ }
    disconnect() { /* no-op: nothing is ever observed */ }
  };
}

// testing-library's `waitFor` window defaults to 1s, which a loaded fork pool can starve;
// 5s matches the functional setup and stays well below the test timeout.
configure({ asyncUtilTimeout: 5000 });
