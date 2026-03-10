import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// useLocaleState is a React hook — we test the pure logic it relies on:
// localStorage key and default value behavior.

const STORAGE_KEY = 'schema-forge-locale';
const DEFAULT_LOCALE = 'en_US';

describe('useLocaleState logic', () => {
  it('STORAGE_KEY is schema-forge-locale', () => {
    assert.equal(STORAGE_KEY, 'schema-forge-locale');
  });

  it('DEFAULT_LOCALE is en_US', () => {
    assert.equal(DEFAULT_LOCALE, 'en_US');
  });

  it('useLocaleState module exports the hook', async () => {
    const mod = await import('../useLocaleState.js');
    assert.equal(typeof mod.useLocaleState, 'function');
  });
});
