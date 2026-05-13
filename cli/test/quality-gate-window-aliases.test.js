import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WINDOW_ALIASES,
  resolveCanonicalWindow,
  getAliasDirs,
} from '../src/quality-gate/window-aliases.js';

describe('quality-gate window-aliases', () => {
  it('declares the legacy businessPartner → contacts alias', () => {
    const contacts = WINDOW_ALIASES.find((a) => a.canonical === 'contacts');
    assert.ok(contacts, 'expected an entry for contacts');
    assert.deepEqual(contacts.aliasDirs, ['businessPartner']);
  });

  describe('resolveCanonicalWindow', () => {
    it('maps an alias dir to its canonical window when that window is available', () => {
      assert.equal(
        resolveCanonicalWindow('businessPartner', ['contacts', 'purchase-order']),
        'contacts',
      );
    });

    it('returns null when the canonical window is not in the available set', () => {
      assert.equal(
        resolveCanonicalWindow('businessPartner', ['purchase-order']),
        null,
      );
    });

    it('returns null for unknown dirs', () => {
      assert.equal(resolveCanonicalWindow('contacts', ['contacts']), null);
      assert.equal(resolveCanonicalWindow('something-else', ['contacts']), null);
    });
  });

  describe('getAliasDirs', () => {
    it('returns alias dirs for a canonical window', () => {
      assert.deepEqual(getAliasDirs('contacts'), ['businessPartner']);
    });

    it('returns an empty array for windows without aliases', () => {
      assert.deepEqual(getAliasDirs('purchase-order'), []);
    });

    it('returns a fresh copy so callers cannot mutate the registry', () => {
      const a = getAliasDirs('contacts');
      a.push('mutated');
      assert.deepEqual(getAliasDirs('contacts'), ['businessPartner']);
    });
  });
});
