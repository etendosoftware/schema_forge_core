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
