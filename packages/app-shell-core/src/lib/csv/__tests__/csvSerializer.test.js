import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { csvField } from '../csvSerializer.js';

describe('csvField', () => {
  describe('neutralizes spreadsheet formula injection', () => {
    it('prepends an apostrophe to a value starting with =', () => {
      assert.equal(csvField('=1+1'), "'=1+1");
    });

    it('prepends an apostrophe to a value starting with +', () => {
      assert.equal(csvField('+SUM(A1:A2)'), "'+SUM(A1:A2)");
    });

    it('prepends an apostrophe to a value starting with -', () => {
      assert.equal(csvField('-CMD'), "'-CMD");
    });

    it('prepends an apostrophe to a value starting with @', () => {
      assert.equal(csvField('@SUM(A1:A2)'), "'@SUM(A1:A2)");
    });

    it('catches a marker hiding behind a leading tab', () => {
      assert.equal(csvField('\t=1+1'), "'\t=1+1");
    });

    it('catches a marker hiding behind a leading carriage return', () => {
      assert.equal(csvField('\r=1+1'), "'\r=1+1");
    });

    it('catches a marker hiding behind leading spaces', () => {
      assert.equal(csvField('   =1+1'), "'   =1+1");
    });

    it('catches a marker hiding behind a leading line feed (and quotes it, since it now contains a raw newline)', () => {
      assert.equal(csvField('\n=1+1'), '"\'\n=1+1"');
    });

    it('neutralizes AND quotes when the value also needs RFC 4180 quoting', () => {
      assert.equal(csvField('=1+1,extra'), '"\'=1+1,extra"');
    });
  });

  describe('does not double-prefix or break legitimate values', () => {
    it('does not add a second apostrophe to an already-neutralized value', () => {
      assert.equal(csvField("'=1+1"), "'=1+1");
    });

    it('neutralizes a legitimate negative number (documented trade-off, same as the server policy)', () => {
      assert.equal(csvField('-500.00'), "'-500.00");
    });

    it('leaves ordinary text untouched', () => {
      assert.equal(csvField('Normal Value'), 'Normal Value');
    });

    it('leaves zero untouched', () => {
      assert.equal(csvField(0), '0');
    });

    it('returns an empty string for null', () => {
      assert.equal(csvField(null), '');
    });

    it('returns an empty string for undefined', () => {
      assert.equal(csvField(undefined), '');
    });

    it('returns an empty string for an empty string', () => {
      assert.equal(csvField(''), '');
    });

    it('quotes a value containing a comma', () => {
      assert.equal(csvField('texto, con coma'), '"texto, con coma"');
    });

    it('escapes embedded double quotes and quotes the field', () => {
      assert.equal(csvField('con "comillas" internas'), '"con ""comillas"" internas"');
    });

    it('preserves an embedded (non-leading) line feed and quotes the field', () => {
      assert.equal(csvField('line one\nline two'), '"line one\nline two"');
    });

    it('preserves an embedded (non-leading) CRLF and quotes the field', () => {
      assert.equal(csvField('line one\r\nline two'), '"line one\r\nline two"');
    });

    it('preserves Unicode characters', () => {
      assert.equal(csvField('José Ñáñez'), 'José Ñáñez');
    });

    it('leaves a safe header untouched', () => {
      assert.equal(csvField('Commercial Name'), 'Commercial Name');
    });

    it('is deterministic across repeated calls', () => {
      assert.equal(csvField('=1+1'), csvField('=1+1'));
    });
  });
});
