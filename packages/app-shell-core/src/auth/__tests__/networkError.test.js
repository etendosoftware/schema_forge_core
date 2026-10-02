import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_API_TIMEOUT_MS,
  NETWORK_ERROR_FALLBACK,
  NETWORK_ERROR_KEY,
  NetworkError,
  isNetworkError,
  registerErrorTranslator,
  resetErrorTranslatorForTests,
} from '../networkError.js';

/**
 * ETP-5424 — the browser's `TypeError('Failed to fetch')` used to reach ~150 UI sites
 * verbatim through `err.message`. The error apiFetch throws for a transport failure now
 * carries a message that is ALREADY user-facing and localized, so every one of those
 * sites shows the right text without being touched.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

afterEach(() => {
  // A translator registered by one case must never decide the message of the next.
  resetErrorTranslatorForTests();
});

describe('networkError constants', () => {
  it('exposes the English fallback, the i18n key and the default timeout', () => {
    assert.equal(NETWORK_ERROR_FALLBACK, 'Could not complete the action. Try again.');
    assert.equal(NETWORK_ERROR_KEY, 'networkErrorRetry');
    assert.equal(DEFAULT_API_TIMEOUT_MS, 60000);
  });
});

describe('NetworkError', () => {
  it('is an Error with a stable name, code and messageKey', () => {
    const err = new NetworkError({ reason: 'offline' });
    assert.ok(err instanceof Error);
    assert.ok(err instanceof NetworkError);
    assert.equal(err.name, 'NetworkError');
    assert.equal(err.code, 'NETWORK');
    assert.equal(err.messageKey, 'networkErrorRetry');
  });

  it('keeps the reason it was built with', () => {
    assert.equal(new NetworkError({ reason: 'offline' }).reason, 'offline');
    assert.equal(new NetworkError({ reason: 'timeout' }).reason, 'timeout');
  });

  it('keeps the original error on `cause`, so nothing diagnostic is lost', () => {
    const cause = new TypeError('Failed to fetch');
    const err = new NetworkError({ reason: 'offline', cause });
    assert.equal(err.cause, cause);
  });

  it('never carries the browser prose as its message', () => {
    const err = new NetworkError({ reason: 'offline', cause: new TypeError('Failed to fetch') });
    assert.doesNotMatch(err.message, /Failed to fetch/);
  });
});

describe('NetworkError message resolution', () => {
  it('uses the English fallback when no translator is registered', () => {
    assert.equal(new NetworkError({ reason: 'offline' }).message, NETWORK_ERROR_FALLBACK);
  });

  it('uses the registered translator, asking it for networkErrorRetry', () => {
    const asked = [];
    registerErrorTranslator((key, params) => {
      asked.push({ key, params });
      return key === 'networkErrorRetry' ? 'No se pudo completar la acción. Inténtalo de nuevo.' : key;
    });
    const err = new NetworkError({ reason: 'offline' });
    assert.equal(err.message, 'No se pudo completar la acción. Inténtalo de nuevo.');
    assert.ok(asked.some((call) => call.key === 'networkErrorRetry'));
  });

  it('localizes a timeout exactly like an offline failure', () => {
    registerErrorTranslator(() => 'No se pudo completar la acción. Inténtalo de nuevo.');
    assert.equal(
      new NetworkError({ reason: 'timeout' }).message,
      'No se pudo completar la acción. Inténtalo de nuevo.',
    );
  });

  it('falls back when the translator returns the key unchanged (the "missing" signal)', () => {
    registerErrorTranslator((key) => key);
    assert.equal(new NetworkError({ reason: 'offline' }).message, NETWORK_ERROR_FALLBACK);
  });

  it('falls back when the translator returns an empty string', () => {
    registerErrorTranslator(() => '');
    assert.equal(new NetworkError({ reason: 'offline' }).message, NETWORK_ERROR_FALLBACK);
  });

  it('falls back when the translator returns nothing', () => {
    registerErrorTranslator(() => undefined);
    assert.equal(new NetworkError({ reason: 'offline' }).message, NETWORK_ERROR_FALLBACK);
  });

  it('falls back — and does not throw — when the translator itself throws', () => {
    registerErrorTranslator(() => { throw new Error('i18n not ready'); });
    let err;
    assert.doesNotThrow(() => { err = new NetworkError({ reason: 'offline' }); });
    assert.equal(err.message, NETWORK_ERROR_FALLBACK);
  });

  it('resetErrorTranslatorForTests drops the registered translator', () => {
    registerErrorTranslator(() => 'traducido');
    assert.equal(new NetworkError({ reason: 'offline' }).message, 'traducido');
    resetErrorTranslatorForTests();
    assert.equal(new NetworkError({ reason: 'offline' }).message, NETWORK_ERROR_FALLBACK);
  });

  it('a later registration replaces the earlier one (locale switch)', () => {
    registerErrorTranslator(() => 'primero');
    registerErrorTranslator(() => 'segundo');
    assert.equal(new NetworkError({ reason: 'offline' }).message, 'segundo');
  });

  it('the returned unregister drops its own translator, back to the fallback (review N4)', () => {
    const unregister = registerErrorTranslator(() => 'traducido');
    assert.equal(typeof unregister, 'function');
    assert.equal(new NetworkError({ reason: 'offline' }).message, 'traducido');
    unregister();
    assert.equal(new NetworkError({ reason: 'offline' }).message, NETWORK_ERROR_FALLBACK);
  });

  it('a stale unregister does nothing once a newer translator was registered (review N4)', () => {
    const unregisterOld = registerErrorTranslator(() => 'primero');
    registerErrorTranslator(() => 'segundo');
    unregisterOld();
    assert.equal(new NetworkError({ reason: 'offline' }).message, 'segundo');
  });

  it('calling unregister twice is harmless and does not drop a newer translator (review N4)', () => {
    const unregister = registerErrorTranslator(() => 'primero');
    unregister();
    registerErrorTranslator(() => 'segundo');
    unregister();
    assert.equal(new NetworkError({ reason: 'offline' }).message, 'segundo');
  });
});

describe('isNetworkError', () => {
  it('is true for a NetworkError instance', () => {
    assert.equal(isNetworkError(new NetworkError({ reason: 'offline' })), true);
    assert.equal(isNetworkError(new NetworkError({ reason: 'timeout' })), true);
  });

  it('is true for any object carrying code NETWORK (cross-realm / duplicated bundle)', () => {
    assert.equal(isNetworkError({ code: 'NETWORK' }), true);
    const foreign = new Error('x');
    foreign.code = 'NETWORK';
    assert.equal(isNetworkError(foreign), true);
  });

  it('is false for an AbortError — a cancellation is not a network failure', () => {
    assert.equal(isNetworkError(new DOMException('aborted', 'AbortError')), false);
  });

  it('is false for a plain Error and for a raw TypeError', () => {
    assert.equal(isNetworkError(new Error('Failed to fetch')), false);
    assert.equal(isNetworkError(new TypeError('Failed to fetch')), false);
  });

  it('is false for another code', () => {
    assert.equal(isNetworkError({ code: 'OTHER' }), false);
  });

  it('is false for null and undefined', () => {
    assert.equal(isNetworkError(null), false);
    assert.equal(isNetworkError(undefined), false);
  });
});

describe('auth barrel', () => {
  // index.js re-exports .jsx modules, which plain `node --test` cannot load, so the
  // re-export is checked on the source.
  const indexSrc = readFileSync(join(__dirname, '..', 'index.js'), 'utf8');
  const block = indexSrc.match(/export\s*\{([^}]*)\}\s*from\s*'\.\/networkError\.js'/);

  it('re-exports the networkError module', () => {
    assert.ok(block, 'expected an `export { ... } from \'./networkError.js\'` in auth/index.js');
  });

  for (const name of [
    'NetworkError', 'isNetworkError', 'registerErrorTranslator', 'resetErrorTranslatorForTests',
    'NETWORK_ERROR_FALLBACK', 'NETWORK_ERROR_KEY', 'DEFAULT_API_TIMEOUT_MS',
  ]) {
    it(`re-exports ${name}`, () => {
      assert.ok(block, 'networkError.js re-export missing from auth/index.js');
      assert.match(block[1], new RegExp(`\\b${name}\\b`));
    });
  }
});
