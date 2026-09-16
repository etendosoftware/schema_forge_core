import '@testing-library/jest-dom/vitest';
import { JSDOM } from 'jsdom';

// jsdom doesn't implement scroll APIs — stub them so components that scroll
// into view on focus/validation don't throw.
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
// Mirrors the identical fix in packages/app-shell-core/src/test/setup.js.
if (typeof globalThis.localStorage === 'undefined') {
  const storageDom = new JSDOM('', { url: 'http://localhost' });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    enumerable: true,
    get: () => storageDom.window.localStorage,
  });
}
