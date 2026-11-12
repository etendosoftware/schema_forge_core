import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STALE_SESSION_ERROR_FALLBACK,
  STALE_SESSION_ERROR_KEY,
  staleSessionError,
} from '../staleSessionError.js';
import {
  registerErrorTranslator,
  resetErrorTranslatorForTests,
} from '../errorTranslator.js';

/**
 * ETP-5763 — the error a request of a superseded session rejects with used to carry the
 * hardcoded English sentence `'The request belongs to a superseded session.'`, and it reached
 * the screen verbatim: ~150 UI sites render `err.message` as-is, so the English sentence
 * showed up in the middle of a Spanish interface (reported from production on 2026-10-15).
 *
 * The message is now resolved through the host app's translator, the same mechanism ETP-5424
 * built for the network error. The error's IDENTITY (a `DOMException` named `AbortError`) is
 * unchanged on purpose: about ten call sites branch on `err.name === 'AbortError'` to swallow a
 * cancellation, and this error is one of the cancellations they swallow.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

const SPANISH = 'Tu sesión se abrió en otra pestaña o ventana. Recarga la página para continuar.';

afterEach(() => {
  // A translator registered by one case must never decide the message of the next.
  resetErrorTranslatorForTests();
});

describe('staleSessionError constants', () => {
  it('exposes the i18n key and the English fallback', () => {
    assert.equal(STALE_SESSION_ERROR_KEY, 'staleSession');
    assert.equal(
      STALE_SESSION_ERROR_FALLBACK,
      'Your session was opened in another tab or window. Reload the page to continue.',
    );
  });

  it('the fallback is explanatory — it tells the user what to do', () => {
    assert.match(STALE_SESSION_ERROR_FALLBACK, /reload/i);
  });
});

describe('staleSessionError identity', () => {
  it('is a DOMException named AbortError — the contract the swallow-sites rely on', () => {
    const err = staleSessionError();
    assert.ok(err instanceof DOMException);
    assert.ok(err instanceof Error);
    assert.equal(err.name, 'AbortError');
  });

  it('carries the locale-independent messageKey, so a consumer never matches the text', () => {
    assert.equal(staleSessionError().messageKey, STALE_SESSION_ERROR_KEY);
  });

  it('the messageKey survives on the error the caller receives', () => {
    registerErrorTranslator(() => SPANISH);
    const err = staleSessionError();
    assert.equal(err.messageKey, STALE_SESSION_ERROR_KEY);
    assert.equal(err.message, SPANISH);
  });
});

describe('staleSessionError message resolution', () => {
  it('uses the English fallback when no translator is registered', () => {
    assert.equal(staleSessionError().message, STALE_SESSION_ERROR_FALLBACK);
  });

  it('uses the registered translator, asking it for the staleSession key', () => {
    const asked = [];
    registerErrorTranslator((key, params) => {
      asked.push({ key, params });
      return key === STALE_SESSION_ERROR_KEY ? SPANISH : key;
    });
    const err = staleSessionError();
    assert.equal(err.message, SPANISH);
    assert.ok(asked.some((call) => call.key === STALE_SESSION_ERROR_KEY));
  });

  it('never carries the old hardcoded English prose when a translator is registered', () => {
    registerErrorTranslator(() => SPANISH);
    assert.doesNotMatch(staleSessionError().message, /superseded session/i);
  });

  it('falls back when the translator returns the key unchanged (the "missing" signal)', () => {
    registerErrorTranslator((key) => key);
    assert.equal(staleSessionError().message, STALE_SESSION_ERROR_FALLBACK);
  });

  it('falls back when the translator returns an empty string', () => {
    registerErrorTranslator(() => '');
    assert.equal(staleSessionError().message, STALE_SESSION_ERROR_FALLBACK);
  });

  it('falls back when the translator returns nothing', () => {
    registerErrorTranslator(() => undefined);
    assert.equal(staleSessionError().message, STALE_SESSION_ERROR_FALLBACK);
  });

  it('falls back — and does not throw — when the translator itself throws', () => {
    registerErrorTranslator(() => { throw new Error('i18n not ready'); });
    let err;
    assert.doesNotThrow(() => { err = staleSessionError(); });
    assert.equal(err.message, STALE_SESSION_ERROR_FALLBACK);
  });

  it('resetErrorTranslatorForTests drops the registered translator', () => {
    registerErrorTranslator(() => SPANISH);
    assert.equal(staleSessionError().message, SPANISH);
    resetErrorTranslatorForTests();
    assert.equal(staleSessionError().message, STALE_SESSION_ERROR_FALLBACK);
  });

  it('a later registration replaces the earlier one (locale switch)', () => {
    registerErrorTranslator(() => 'primero');
    registerErrorTranslator(() => 'segundo');
    assert.equal(staleSessionError().message, 'segundo');
  });

  it('the returned unregister drops its own translator, back to the fallback', () => {
    const unregister = registerErrorTranslator(() => SPANISH);
    assert.equal(typeof unregister, 'function');
    assert.equal(staleSessionError().message, SPANISH);
    unregister();
    assert.equal(staleSessionError().message, STALE_SESSION_ERROR_FALLBACK);
  });

  it('a stale unregister does nothing once a newer translator was registered', () => {
    const unregisterOld = registerErrorTranslator(() => 'primero');
    registerErrorTranslator(() => 'segundo');
    unregisterOld();
    assert.equal(staleSessionError().message, 'segundo');
  });
});

describe('the shared translator registry (ETP-5763)', () => {
  it('the network error and the stale-session error share ONE registry', async () => {
    const { NetworkError } = await import('../networkError.js');
    const asked = [];
    registerErrorTranslator((key) => {
      asked.push(key);
      if (key === STALE_SESSION_ERROR_KEY) return SPANISH;
      if (key === 'networkErrorRetry') return 'traducido';
      return key;
    });
    // One registry: the translator registered here is the one BOTH errors ask. Two registries
    // would leave whichever error registered second permanently English, silently.
    assert.equal(staleSessionError().message, SPANISH);
    assert.equal(new NetworkError({ reason: 'offline' }).message, 'traducido');
    assert.ok(asked.includes(STALE_SESSION_ERROR_KEY));
    assert.ok(asked.includes('networkErrorRetry'));
  });

  it('networkError.js still re-exports the registry, so no import site breaks', () => {
    const source = readFileSync(join(__dirname, '..', 'networkError.js'), 'utf8');
    assert.match(source, /from '\.\/errorTranslator\.js'/);
    assert.match(source, /registerErrorTranslator/);
    assert.match(source, /resetErrorTranslatorForTests/);
  });
});

describe('auth barrel', () => {
  // index.js re-exports .jsx modules, which plain `node --test` cannot load, so the
  // re-export is checked on the source.
  const indexSrc = readFileSync(join(__dirname, '..', 'index.js'), 'utf8');
  const block = indexSrc.match(/export\s*\{([^}]*)\}\s*from\s*'\.\/staleSessionError\.js'/);

  it('re-exports the staleSessionError module', () => {
    assert.ok(block, 'expected an `export { ... } from \'./staleSessionError.js\'` in auth/index.js');
  });

  for (const name of ['STALE_SESSION_ERROR_FALLBACK', 'STALE_SESSION_ERROR_KEY', 'staleSessionError']) {
    it(`re-exports ${name}`, () => {
      assert.ok(block, 'staleSessionError.js re-export missing from auth/index.js');
      assert.match(block[1], new RegExp(`\\b${name}\\b`));
    });
  }
});
