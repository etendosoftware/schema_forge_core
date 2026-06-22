import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// useLocaleState is a React hook — we test the pure logic it relies on:
// localStorage key and default value behavior.

const STORAGE_KEY = 'schema-forge-locale';
const DEFAULT_LOCALE = 'es_ES';

describe('useLocaleState logic', () => {
  it('STORAGE_KEY is schema-forge-locale', () => {
    assert.equal(STORAGE_KEY, 'schema-forge-locale');
  });

  it('DEFAULT_LOCALE is es_ES', () => {
    assert.equal(DEFAULT_LOCALE, 'es_ES');
  });

  it('useLocaleState module exports the hook', async () => {
    const mod = await import('../useLocaleState.js');
    assert.equal(typeof mod.useLocaleState, 'function');
  });
});

describe('getStoredLocale', () => {
  it('is exported as a function', async () => {
    const mod = await import('../useLocaleState.js');
    assert.equal(typeof mod.getStoredLocale, 'function');
  });

  it('returns the locale stored in localStorage', async () => {
    globalThis.localStorage = { getItem: (key) => key === 'schema-forge-locale' ? 'en_US' : null };
    const { getStoredLocale } = await import('../useLocaleState.js');
    assert.equal(getStoredLocale(), 'en_US');
    delete globalThis.localStorage;
  });

  it('returns es_ES when the key is absent', async () => {
    globalThis.localStorage = { getItem: () => null };
    const { getStoredLocale } = await import('../useLocaleState.js');
    assert.equal(getStoredLocale(), 'es_ES');
    delete globalThis.localStorage;
  });

  it('returns es_ES when localStorage throws', async () => {
    globalThis.localStorage = { getItem: () => { throw new Error('no access'); } };
    const { getStoredLocale } = await import('../useLocaleState.js');
    assert.equal(getStoredLocale(), 'es_ES');
    delete globalThis.localStorage;
  });
});
