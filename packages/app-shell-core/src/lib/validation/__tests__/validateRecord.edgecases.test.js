import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateRecord } from '../validateRecord.js';
import { ERROR_CODES } from '../errorCodes.js';

// ETP-4556 — Additional edge-case coverage for the validation engine.
// Complements validateRecord.test.js; does NOT duplicate cases already
// covered there (see that file for the base contract per constraint).

function field(name, validation, extra = {}) {
  return { name, key: name, column: name, type: 'string', validation, ...extra };
}

function codesFor(result, name) {
  return (result.errors[name] || []).map((e) => e.code);
}

describe('validateRecord — numeric coercion edge cases', () => {
  it('accepts scientific notation as a valid number', () => {
    const r = validateRecord({
      fields: [field('qty', { minimum: 500 }, { type: 'number' })],
      values: { qty: '1e3' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('trims leading/trailing spaces around a numeric string', () => {
    const r = validateRecord({
      fields: [field('qty', { minimum: 10 }, { type: 'number' })],
      values: { qty: ' 42 ' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('rejects a localized number string ("1.234,56") as INVALID_FORMAT', () => {
    const r = validateRecord({
      fields: [field('qty', { minimum: 1 }, { type: 'number' })],
      values: { qty: '1.234,56' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'qty'), [ERROR_CODES.INVALID_FORMAT]);
    assert.equal(r.errors.qty[0].format, 'number');
  });

  it('treats the "0" string the same as the number 0 (present, and satisfies minimum:0)', () => {
    const r = validateRecord({
      fields: [field('qty', { required: true, minimum: 0 }, { type: 'number' })],
      values: { qty: '0' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('treats negative zero as satisfying minimum:0 (-0 is not < 0)', () => {
    const r = validateRecord({
      fields: [field('qty', { minimum: 0 }, { type: 'number' })],
      values: { qty: -0 },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('flags a value just below a minimum:0 boundary', () => {
    const r = validateRecord({
      fields: [field('qty', { minimum: 0 }, { type: 'number' })],
      values: { qty: -0.0001 },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'qty'), [ERROR_CODES.MINIMUM]);
  });

  it('accepts a value exactly equal to the maximum boundary', () => {
    const r = validateRecord({
      fields: [field('pct', { maximum: 100 }, { type: 'number' })],
      values: { pct: 100 },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('handles a value beyond Number.MAX_SAFE_INTEGER without throwing (precision loss accepted)', () => {
    // 9007199254740993 rounds to 9007199254740992 in IEEE-754 double precision;
    // the engine must still compare it as a finite number, not crash or NaN.
    const r = validateRecord({
      fields: [field('big', { minimum: 9007199254740992 }, { type: 'number' })],
      values: { big: 9007199254740993 },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });
});

describe('validateRecord — Unicode length edge cases', () => {
  it('counts a single-codepoint emoji (thumbs up) as length 1, not 2', () => {
    const r = validateRecord({
      fields: [field('note', { maxLength: 1 })],
      values: { note: '\u{1F44D}' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('counts a base letter + combining accent as TWO code points (documented limitation)', () => {
    // 'e' + COMBINING ACUTE ACCENT (U+0301) is one grapheme but two code points.
    const r = validateRecord({
      fields: [field('note', { maxLength: 1 })],
      values: { note: 'é' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'note'), [ERROR_CODES.MAX_LENGTH]);
    assert.equal(r.errors.note[0].actual, 2);
  });

  it('accepts a string exactly at the maxLength boundary', () => {
    const r = validateRecord({
      fields: [field('code', { maxLength: 3 })],
      values: { code: 'abc' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('flags a string exactly one code point over the maxLength boundary', () => {
    const r = validateRecord({
      fields: [field('code', { maxLength: 3 })],
      values: { code: 'abcd' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'code'), [ERROR_CODES.MAX_LENGTH]);
  });

  it('flags an empty string as missing when required (distinct from whitespace-only)', () => {
    const r = validateRecord({
      fields: [field('doc', { required: true })],
      values: { doc: '' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'doc'), [ERROR_CODES.REQUIRED]);
  });
});

describe('validateRecord — URL / allowedSchemes edge cases', () => {
  it('normalizes a mixed-case scheme ("HtTpS") before comparing', () => {
    const r = validateRecord({
      fields: [field('site', { allowedSchemes: ['https'] })],
      values: { site: 'HtTpS://example.com' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('accepts a URL with query string and fragment present', () => {
    const r = validateRecord({
      fields: [field('site', { allowedSchemes: ['https'] })],
      values: { site: 'https://example.com/path?a=b#x' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('accepts an IDN/punycode host', () => {
    const r = validateRecord({
      fields: [field('site', { allowedSchemes: ['https'] })],
      values: { site: 'https://xn--n3h.com' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('flags "https://" (missing host) as an unparseable URL', () => {
    const r = validateRecord({
      fields: [field('site', { allowedSchemes: ['https'] })],
      values: { site: 'https://' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'site'), [ERROR_CODES.INVALID_FORMAT]);
  });

  it('flags a scheme-relative URL ("//x", no base) as unparseable', () => {
    const r = validateRecord({
      fields: [field('site', { allowedSchemes: ['https'] })],
      values: { site: '//x' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'site'), [ERROR_CODES.INVALID_FORMAT]);
  });

  it('parses but disallows a javascript: scheme not present in the allowlist', () => {
    const r = validateRecord({
      fields: [field('site', { allowedSchemes: ['https'] })],
      values: { site: 'javascript:alert(1)' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'site'), [ERROR_CODES.DISALLOWED_SCHEME]);
    assert.equal(r.errors.site[0].scheme, 'javascript');
  });

  it('parses but disallows a data: scheme not present in the allowlist', () => {
    const r = validateRecord({
      fields: [field('site', { allowedSchemes: ['https'] })],
      values: { site: 'data:text/plain,hi' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'site'), [ERROR_CODES.DISALLOWED_SCHEME]);
    assert.equal(r.errors.site[0].scheme, 'data');
  });

  it('parses but disallows a file: scheme not present in the allowlist', () => {
    const r = validateRecord({
      fields: [field('site', { allowedSchemes: ['https'] })],
      values: { site: 'file:///etc/passwd' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'site'), [ERROR_CODES.DISALLOWED_SCHEME]);
    assert.equal(r.errors.site[0].scheme, 'file');
  });

  it('treats a non-array (string) allowedSchemes as a contract error', () => {
    const r = validateRecord({
      fields: [field('site', { allowedSchemes: 'https' })],
      values: { site: 'https://example.com' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'site'), [ERROR_CODES.INVALID_CONSTRAINT]);
    assert.equal(r.errors.site[0].constraint, 'allowedSchemes');
  });
});

describe('validateRecord — format edge cases', () => {
  it('accepts a plus-addressed email', () => {
    const r = validateRecord({
      fields: [field('email', { format: 'email' })],
      values: { email: 'user+tag@example.com' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('rejects a unicode local-part email (ASCII-only pattern)', () => {
    const r = validateRecord({
      fields: [field('email', { format: 'email' })],
      values: { email: 'üser@example.com' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'email'), [ERROR_CODES.INVALID_FORMAT]);
  });

  it('rejects an email with a trailing dot after the TLD', () => {
    const r = validateRecord({
      fields: [field('email', { format: 'email' })],
      values: { email: 'user@example.com.' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'email'), [ERROR_CODES.INVALID_FORMAT]);
  });

  it('accepts a phone number using the full allowed separator charset', () => {
    const r = validateRecord({
      fields: [field('phone', { format: 'phone' })],
      values: { phone: '+1 (555) 123-4567' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('rejects a phone value with only separators and no digit', () => {
    const r = validateRecord({
      fields: [field('phone', { format: 'phone' })],
      values: { phone: '()' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'phone'), [ERROR_CODES.INVALID_FORMAT]);
  });

  it('rejects a phone value containing letters', () => {
    const r = validateRecord({
      fields: [field('phone', { format: 'phone' })],
      values: { phone: 'abc' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'phone'), [ERROR_CODES.INVALID_FORMAT]);
  });

  it('emits INVALID_CONSTRAINT for an unrecognized format name', () => {
    const r = validateRecord({
      fields: [field('x', { format: 'not-a-real-format' })],
      values: { x: 'anything' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'x'), [ERROR_CODES.INVALID_CONSTRAINT]);
    assert.equal(r.errors.x[0].constraint, 'format');
  });
});

describe('validateRecord — enum edge cases', () => {
  it('flags a numeric value not present in a numeric enum', () => {
    const r = validateRecord({
      fields: [field('level', { enum: [1, 2, 3] }, { type: 'number' })],
      values: { level: 4 },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'level'), [ERROR_CODES.NOT_IN_ENUM]);
    assert.deepEqual(r.errors.level[0].allowed, [1, 2, 3]);
  });

  it('accepts a numeric value present in a numeric enum', () => {
    const r = validateRecord({
      fields: [field('level', { enum: [1, 2, 3] }, { type: 'number' })],
      values: { level: 2 },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('treats an empty enum array as a contract error', () => {
    const r = validateRecord({
      fields: [field('status', { enum: [] })],
      values: { status: 'anything' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'status'), [ERROR_CODES.INVALID_CONSTRAINT]);
    assert.equal(r.errors.status[0].constraint, 'enum');
  });
});

describe('validateRecord — multiple errors / evaluation order', () => {
  it('accumulates errors across three failing fields', () => {
    const r = validateRecord({
      fields: [
        field('a', { required: true }),
        field('b', { minLength: 5 }),
        field('c', { enum: ['X'] }),
      ],
      values: { b: 'ab', c: 'Y' },
      operation: 'create',
    });
    assert.equal(r.valid, false);
    assert.deepEqual(codesFor(r, 'a'), [ERROR_CODES.REQUIRED]);
    assert.deepEqual(codesFor(r, 'b'), [ERROR_CODES.MIN_LENGTH]);
    assert.deepEqual(codesFor(r, 'c'), [ERROR_CODES.NOT_IN_ENUM]);
  });

  it('collects maxLength then enum on a single field, in canonical key order', () => {
    const r = validateRecord({
      fields: [field('code', { maxLength: 2, enum: ['XY'] })],
      values: { code: 'ABCDEF' },
      operation: 'create',
    });
    // maxLength comes before enum in VALUE_CONSTRAINT_EVALUATORS.
    assert.deepEqual(codesFor(r, 'code'), [ERROR_CODES.MAX_LENGTH, ERROR_CODES.NOT_IN_ENUM]);
  });
});

describe('validateRecord — structural robustness', () => {
  it('is a no-op for a field with no validation object at all', () => {
    const r = validateRecord({
      fields: [{ name: 'note', key: 'note', type: 'string' }],
      values: { note: 'anything goes' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
    assert.deepEqual(r.errors, {});
  });

  it('does not crash on an explicit null validation object', () => {
    const r = validateRecord({
      fields: [{ name: 'note', key: 'note', type: 'string', validation: null }],
      values: { note: 'anything' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('returns valid for an empty fields array', () => {
    const r = validateRecord({ fields: [], values: { anything: 'here' }, operation: 'create' });
    assert.equal(r.valid, true);
    assert.deepEqual(r.errors, {});
  });

  it('returns valid for empty fields and empty values together', () => {
    const r = validateRecord({ fields: [], values: {}, operation: 'create' });
    assert.equal(r.valid, true);
  });

  it('ignores a value present for a field not declared in `fields`', () => {
    const r = validateRecord({
      fields: [field('a', { required: true })],
      values: { a: 'ok', extraneous: 'ignored-because-undeclared' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
    assert.equal('extraneous' in r.errors, false);
  });
});

describe('validateRecord — operation semantics (further cases)', () => {
  it('partial-update with both required fields omitted is valid (neither present)', () => {
    const r = validateRecord({
      fields: [field('a', { required: true }), field('b', { required: true })],
      values: {},
      operation: 'partial-update',
    });
    assert.equal(r.valid, true);
  });

  it('partial-update flags a required field that IS present but empty', () => {
    const r = validateRecord({
      fields: [field('a', { required: true })],
      values: { a: '' },
      operation: 'partial-update',
    });
    assert.deepEqual(codesFor(r, 'a'), [ERROR_CODES.REQUIRED]);
  });
});
