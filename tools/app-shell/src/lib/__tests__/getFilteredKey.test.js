import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getFilteredKey } from '../gridQuery.js';

describe('getFilteredKey', () => {
  describe('backendFilterKey precedence', () => {
    it('returns backendFilterKey when set as a non-empty string (ignores mode/op)', () => {
      const col = { key: 'businessPartner', backendFilterKey: 'bpartner_id' };
      assert.equal(getFilteredKey(col, 'identifier', 'iContains'), 'bpartner_id');
      assert.equal(getFilteredKey(col, 'value', 'equals'), 'bpartner_id');
    });

    it('returns empty string when backendFilterKey is "" (locks in != null semantics)', () => {
      const col = { key: 'businessPartner', backendFilterKey: '' };
      assert.equal(getFilteredKey(col, 'identifier', 'iContains'), '');
      assert.equal(getFilteredKey(col, 'value', 'equals'), '');
    });

    it('falls through when backendFilterKey is null', () => {
      const col = { key: 'businessPartner', backendFilterKey: null };
      assert.equal(getFilteredKey(col, 'value', 'equals'), 'businessPartner');
    });

    it('falls through when backendFilterKey is undefined (omitted)', () => {
      const col = { key: 'businessPartner' };
      assert.equal(getFilteredKey(col, 'value', 'equals'), 'businessPartner');
    });
  });

  describe('identifier mode + textual op', () => {
    it('appends $_identifier for iContains', () => {
      const col = { key: 'businessPartner' };
      assert.equal(getFilteredKey(col, 'identifier', 'iContains'), 'businessPartner$_identifier');
    });

    it('appends $_identifier for iNotContains', () => {
      const col = { key: 'businessPartner' };
      assert.equal(getFilteredKey(col, 'identifier', 'iNotContains'), 'businessPartner$_identifier');
    });

    it('appends $_identifier for iEquals', () => {
      const col = { key: 'businessPartner' };
      assert.equal(getFilteredKey(col, 'identifier', 'iEquals'), 'businessPartner$_identifier');
    });

    it('appends $_identifier for iNotEqual', () => {
      const col = { key: 'businessPartner' };
      assert.equal(getFilteredKey(col, 'identifier', 'iNotEqual'), 'businessPartner$_identifier');
    });
  });

  describe('identifier mode + non-textual op', () => {
    it('returns col.key for equals', () => {
      const col = { key: 'businessPartner' };
      assert.equal(getFilteredKey(col, 'identifier', 'equals'), 'businessPartner');
    });

    it('returns col.key for greaterThan', () => {
      const col = { key: 'amount' };
      assert.equal(getFilteredKey(col, 'identifier', 'greaterThan'), 'amount');
    });
  });

  describe('non-identifier mode', () => {
    it('returns col.key when mode is "value" regardless of op', () => {
      const col = { key: 'businessPartner' };
      assert.equal(getFilteredKey(col, 'value', 'iContains'), 'businessPartner');
      assert.equal(getFilteredKey(col, 'value', 'equals'), 'businessPartner');
    });

    it('returns col.key when mode is undefined', () => {
      const col = { key: 'businessPartner' };
      assert.equal(getFilteredKey(col, undefined, 'iContains'), 'businessPartner');
    });
  });
});
