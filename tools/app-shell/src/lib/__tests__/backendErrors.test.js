import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { translateBackendError } from '../backendErrors.js';

/**
 * Unit tests for translateBackendError.
 *
 * Contract:
 *  - Known Etendo backend messages are mapped to i18n keys and translated via t().
 *  - Unknown messages are returned as-is (original string preserved).
 *  - If t(key) === key (translation missing), original message is returned as a guard.
 *  - null / undefined input is returned unchanged.
 *  - Leading/trailing whitespace in the message is stripped before lookup.
 *  - If t is not a function, original message is returned.
 */

describe('translateBackendError', () => {
  // ── known messages ──────────────────────────────────────────────────────────

  describe('known IBAN / account messages', () => {
    const KNOWN = [
      {
        raw: 'Country needed in an IBAN account.',
        key: 'backendError.countryIban',
      },
      {
        raw: 'Using IBAN for generating the Displayed Account requires to introduce the IBAN',
        key: 'backendError.ibanRequired',
      },
      {
        raw: 'Using the Generic Account No. for generating the Displayed Account requires to introduce a Generic Account Number',
        key: 'backendError.genericAccountRequired',
      },
      {
        raw: 'IBAN code entered is not correct. Please review the IBAN code and the country defined for the bank',
        key: 'backendError.ibanInvalid',
      },
    ];

    for (const { raw, key } of KNOWN) {
      it(`maps "${raw.slice(0, 40)}..." to key ${key}`, () => {
        const t = (k) => (k === key ? `translated:${key}` : k);
        const result = translateBackendError(raw, t);
        assert.equal(result, `translated:${key}`);
      });
    }
  });

  // ── translation missing guard ────────────────────────────────────────────────

  it('returns original message when t returns the key itself (key not found in locale)', () => {
    const raw = 'Country needed in an IBAN account.';
    // t() echoes back the key — translation is missing
    const t = (k) => k;
    const result = translateBackendError(raw, t);
    assert.equal(result, raw);
  });

  it('returns translated string when t returns non-key value for a known message', () => {
    const raw = 'Country needed in an IBAN account.';
    const t = (k) => (k === 'backendError.countryIban' ? 'Se necesita un país para cuentas IBAN.' : k);
    const result = translateBackendError(raw, t);
    assert.equal(result, 'Se necesita un país para cuentas IBAN.');
  });

  // ── unknown messages ─────────────────────────────────────────────────────────

  it('returns original message unchanged for an unknown backend error', () => {
    const raw = 'Some other unrecognised backend error';
    const t = (k) => `translated:${k}`;
    const result = translateBackendError(raw, t);
    assert.equal(result, raw);
  });

  it('returns original message unchanged when message is an empty-ish string not in map', () => {
    const raw = 'Not a known error at all.';
    const t = () => 'something';
    const result = translateBackendError(raw, t);
    // Not in map → returned as-is
    assert.equal(result, raw);
  });

  // ── whitespace trimming ───────────────────────────────────────────────────────

  it('trims leading and trailing whitespace before looking up the key', () => {
    const raw = '  Country needed in an IBAN account.  ';
    const t = (k) => (k === 'backendError.countryIban' ? 'Traducido' : k);
    const result = translateBackendError(raw, t);
    assert.equal(result, 'Traducido');
  });

  it('returns the trimmed message unchanged when trimmed form is not in map', () => {
    const raw = '   Unknown error   ';
    const t = (k) => `translated:${k}`;
    const result = translateBackendError(raw, t);
    // key not found — returns original (with spaces, since we return msg not msg.trim())
    assert.equal(result, raw);
  });

  // ── null / undefined / non-function t ────────────────────────────────────────

  it('returns null when msg is null', () => {
    const t = (k) => k;
    const result = translateBackendError(null, t);
    assert.equal(result, null);
  });

  it('returns undefined when msg is undefined', () => {
    const t = (k) => k;
    const result = translateBackendError(undefined, t);
    assert.equal(result, undefined);
  });

  it('returns empty string when msg is an empty string', () => {
    const t = (k) => k;
    const result = translateBackendError('', t);
    assert.equal(result, '');
  });

  it('returns original message when t is not a function', () => {
    const raw = 'Country needed in an IBAN account.';
    const result = translateBackendError(raw, null);
    assert.equal(result, raw);
  });

  it('returns original message when t is undefined', () => {
    const raw = 'Country needed in an IBAN account.';
    const result = translateBackendError(raw, undefined);
    assert.equal(result, raw);
  });

  it('returns original message when t is an object (not a function)', () => {
    const raw = 'Country needed in an IBAN account.';
    const result = translateBackendError(raw, {});
    assert.equal(result, raw);
  });
});
