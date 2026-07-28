import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateRecord } from '../validateRecord.js';
import { ERROR_CODES } from '../errorCodes.js';

// Convenience: build a single-field descriptor carrying a validation object.
function field(name, validation, extra = {}) {
  return { name, key: name, column: name, type: 'string', validation, ...extra };
}

// Convenience: assert the first error code for a field.
function codesFor(result, name) {
  return (result.errors[name] || []).map((e) => e.code);
}

describe('validateRecord — required (presence, not truthiness)', () => {
  it('flags a missing required field (undefined)', () => {
    const r = validateRecord({
      fields: [field('doc', { required: true })],
      values: {},
      operation: 'create',
    });
    assert.equal(r.valid, false);
    assert.deepEqual(codesFor(r, 'doc'), [ERROR_CODES.REQUIRED]);
  });

  it('flags a null required field', () => {
    const r = validateRecord({
      fields: [field('doc', { required: true })],
      values: { doc: null },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'doc'), [ERROR_CODES.REQUIRED]);
  });

  it('flags a whitespace-only required string', () => {
    const r = validateRecord({
      fields: [field('doc', { required: true })],
      values: { doc: '   ' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'doc'), [ERROR_CODES.REQUIRED]);
  });

  it('treats 0 as present for a required numeric field', () => {
    const r = validateRecord({
      fields: [field('qty', { required: true }, { type: 'number' })],
      values: { qty: 0 },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('treats false as present for a required boolean field', () => {
    const r = validateRecord({
      fields: [field('flag', { required: true }, { type: 'boolean' })],
      values: { flag: false },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('accepts a non-empty required string', () => {
    const r = validateRecord({
      fields: [field('doc', { required: true })],
      values: { doc: 'ORD-1' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
    assert.deepEqual(r.errors, {});
  });
});

describe('validateRecord — optional empty', () => {
  it('an absent optional value is valid and skips other constraints', () => {
    const r = validateRecord({
      fields: [field('note', { minLength: 5, maxLength: 10, format: 'email' })],
      values: { note: '' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
    assert.deepEqual(r.errors, {});
  });
});

describe('validateRecord — length (Unicode code points)', () => {
  it('flags a string shorter than minLength', () => {
    const r = validateRecord({
      fields: [field('code', { minLength: 3 })],
      values: { code: 'ab' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'code'), [ERROR_CODES.MIN_LENGTH]);
    assert.equal(r.errors.code[0].actual, 2);
    assert.equal(r.errors.code[0].min, 3);
  });

  it('flags a string longer than maxLength', () => {
    const r = validateRecord({
      fields: [field('code', { maxLength: 3 })],
      values: { code: 'abcd' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'code'), [ERROR_CODES.MAX_LENGTH]);
  });

  it('counts astral (emoji) characters as one code point, not two UTF-16 units', () => {
    // '😀' is one code point but String.length === 2. maxLength:1 must PASS.
    const r = validateRecord({
      fields: [field('code', { maxLength: 1 })],
      values: { code: '😀' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('rejects a 2-code-point emoji string against maxLength:1', () => {
    const r = validateRecord({
      fields: [field('code', { maxLength: 1 })],
      values: { code: '😀😀' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'code'), [ERROR_CODES.MAX_LENGTH]);
    assert.equal(r.errors.code[0].actual, 2);
  });
});

describe('validateRecord — range (numeric, zero valid)', () => {
  it('flags a value below minimum', () => {
    const r = validateRecord({
      fields: [field('qty', { minimum: 1 }, { type: 'number' })],
      values: { qty: 0 },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'qty'), [ERROR_CODES.MINIMUM]);
  });

  it('accepts zero when minimum is 0', () => {
    const r = validateRecord({
      fields: [field('qty', { minimum: 0 }, { type: 'number' })],
      values: { qty: 0 },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('flags a value above maximum', () => {
    const r = validateRecord({
      fields: [field('pct', { maximum: 100 }, { type: 'number' })],
      values: { pct: 101 },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'pct'), [ERROR_CODES.MAXIMUM]);
  });

  it('coerces numeric strings', () => {
    const r = validateRecord({
      fields: [field('qty', { minimum: 5 }, { type: 'number' })],
      values: { qty: '3' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'qty'), [ERROR_CODES.MINIMUM]);
  });

  it('rejects a non-numeric value against a numeric bound as INVALID_FORMAT number', () => {
    const r = validateRecord({
      fields: [field('qty', { minimum: 1 }, { type: 'number' })],
      values: { qty: 'abc' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'qty'), [ERROR_CODES.INVALID_FORMAT]);
    assert.equal(r.errors.qty[0].format, 'number');
  });

  it('rejects Infinity against a numeric bound', () => {
    const r = validateRecord({
      fields: [field('qty', { maximum: 10 }, { type: 'number' })],
      values: { qty: Infinity },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'qty'), [ERROR_CODES.INVALID_FORMAT]);
  });
});

describe('validateRecord — email format', () => {
  it('accepts a valid email', () => {
    const r = validateRecord({
      fields: [field('email', { format: 'email' })],
      values: { email: 'a@b.com' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('flags a malformed email', () => {
    const r = validateRecord({
      fields: [field('email', { format: 'email' })],
      values: { email: 'not-an-email' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'email'), [ERROR_CODES.INVALID_FORMAT]);
    assert.equal(r.errors.email[0].format, 'email');
  });
});

describe('validateRecord — allowedSchemes (URL)', () => {
  it('accepts a URL whose scheme is in the allowlist', () => {
    const r = validateRecord({
      fields: [field('site', { allowedSchemes: ['https'] })],
      values: { site: 'https://example.com/x' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('normalizes scheme case and trims surrounding whitespace before comparing', () => {
    const r = validateRecord({
      fields: [field('site', { allowedSchemes: ['https'] })],
      values: { site: '  HTTPS://example.com  ' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('flags a URL whose scheme is NOT in the allowlist', () => {
    const r = validateRecord({
      fields: [field('site', { allowedSchemes: ['https'] })],
      values: { site: 'http://example.com' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'site'), [ERROR_CODES.DISALLOWED_SCHEME]);
    assert.equal(r.errors.site[0].scheme, 'http');
    assert.deepEqual(r.errors.site[0].allowed, ['https']);
  });

  it('passes URLs with embedded credentials (does not error on user:pass@)', () => {
    const r = validateRecord({
      fields: [field('site', { allowedSchemes: ['https'] })],
      values: { site: 'https://user:pass@example.com' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('flags an unparseable URL as INVALID_FORMAT', () => {
    const r = validateRecord({
      fields: [field('site', { allowedSchemes: ['https'] })],
      values: { site: 'not a url' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'site'), [ERROR_CODES.INVALID_FORMAT]);
  });

  it('treats an empty allowedSchemes array as a contract error (fail safe)', () => {
    const r = validateRecord({
      fields: [field('site', { allowedSchemes: [] })],
      values: { site: 'https://example.com' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'site'), [ERROR_CODES.INVALID_CONSTRAINT]);
  });

  it('treats a non-string-array allowedSchemes as a contract error', () => {
    const r = validateRecord({
      fields: [field('site', { allowedSchemes: [1, 2] })],
      values: { site: 'https://example.com' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'site'), [ERROR_CODES.INVALID_CONSTRAINT]);
  });
});

describe('validateRecord — enum', () => {
  it('accepts an allowed enum value', () => {
    const r = validateRecord({
      fields: [field('status', { enum: ['DR', 'CO'] })],
      values: { status: 'CO' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('flags a value not in the enum', () => {
    const r = validateRecord({
      fields: [field('status', { enum: ['DR', 'CO'] })],
      values: { status: 'XX' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'status'), [ERROR_CODES.NOT_IN_ENUM]);
    assert.deepEqual(r.errors.status[0].allowed, ['DR', 'CO']);
  });
});

describe('validateRecord — malformed / unknown constraints', () => {
  it('emits INVALID_CONSTRAINT for a non-numeric minLength', () => {
    const r = validateRecord({
      fields: [field('code', { minLength: 'three' })],
      values: { code: 'ab' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'code'), [ERROR_CODES.INVALID_CONSTRAINT]);
    assert.equal(r.errors.code[0].constraint, 'minLength');
  });

  it('emits INVALID_CONSTRAINT for an unknown format value', () => {
    const r = validateRecord({
      fields: [field('x', { format: 'ssn' })],
      values: { x: 'anything' },
      operation: 'create',
    });
    assert.deepEqual(codesFor(r, 'x'), [ERROR_CODES.INVALID_CONSTRAINT]);
    assert.equal(r.errors.x[0].constraint, 'format');
  });

  it('ignores unknown constraint keys (forward-compatible)', () => {
    const r = validateRecord({
      fields: [field('x', { required: true, someFutureRule: 42 })],
      values: { x: 'ok' },
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });
});

describe('validateRecord — multiple errors', () => {
  it('collects errors from multiple failing fields', () => {
    const r = validateRecord({
      fields: [
        field('a', { required: true }),
        field('b', { minLength: 3 }),
      ],
      values: { b: 'x' },
      operation: 'create',
    });
    assert.equal(r.valid, false);
    assert.deepEqual(codesFor(r, 'a'), [ERROR_CODES.REQUIRED]);
    assert.deepEqual(codesFor(r, 'b'), [ERROR_CODES.MIN_LENGTH]);
  });

  it('collects multiple errors on a single field in key order', () => {
    const r = validateRecord({
      fields: [field('code', { minLength: 5, format: 'email' })],
      values: { code: 'ab' },
      operation: 'create',
    });
    // minLength comes before format in VALIDATION_KEY_ORDER
    assert.deepEqual(codesFor(r, 'code'), [ERROR_CODES.MIN_LENGTH, ERROR_CODES.INVALID_FORMAT]);
  });
});

describe('validateRecord — operation semantics', () => {
  it('partial-update only validates fields present in values', () => {
    const r = validateRecord({
      fields: [field('a', { required: true }), field('b', { required: true })],
      values: { b: 'here' },
      operation: 'partial-update',
    });
    assert.equal(r.valid, true); // 'a' not present in values → not validated
  });

  it('update validates all fields (missing required flagged)', () => {
    const r = validateRecord({
      fields: [field('a', { required: true }), field('b', { required: true })],
      values: { b: 'here' },
      operation: 'update',
    });
    assert.deepEqual(codesFor(r, 'a'), [ERROR_CODES.REQUIRED]);
  });
});

describe('validateRecord — skipped fields', () => {
  it('skips read-only fields', () => {
    const r = validateRecord({
      fields: [field('a', { required: true }, { readOnly: true })],
      values: {},
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('skips hidden fields', () => {
    const r = validateRecord({
      fields: [field('a', { required: true }, { hidden: true })],
      values: {},
      operation: 'create',
    });
    assert.equal(r.valid, true);
  });

  it('skips fields whose visibility is system/discarded/readOnly', () => {
    for (const visibility of ['system', 'discarded', 'readOnly']) {
      const r = validateRecord({
        fields: [field('a', { required: true }, { visibility })],
        values: {},
        operation: 'create',
      });
      assert.equal(r.valid, true, `visibility=${visibility} should be skipped`);
    }
  });
});

describe('validateRecord — unchanged legacy-invalid policy', () => {
  it('by DEFAULT skips an unchanged legacy-invalid value when previousValues is supplied', () => {
    const r = validateRecord({
      fields: [field('email', { format: 'email' })],
      values: { email: 'legacy-bad' },
      operation: 'update',
      options: { previousValues: { email: 'legacy-bad' } },
    });
    assert.equal(r.valid, true);
  });

  it('by DEFAULT still validates a CHANGED value (previousValues differs)', () => {
    const r = validateRecord({
      fields: [field('email', { format: 'email' })],
      values: { email: 'still-bad' },
      operation: 'update',
      options: { previousValues: { email: 'legacy-bad' } },
    });
    assert.deepEqual(codesFor(r, 'email'), [ERROR_CODES.INVALID_FORMAT]);
  });

  it('validates everything by default when NO previousValues are supplied (nothing to compare)', () => {
    const r = validateRecord({
      fields: [field('email', { format: 'email' })],
      values: { email: 'legacy-bad' },
      operation: 'update',
    });
    assert.deepEqual(codesFor(r, 'email'), [ERROR_CODES.INVALID_FORMAT]);
  });

  it('skipUnchangedInvalid:false forces full validation even of an unchanged value', () => {
    const r = validateRecord({
      fields: [field('email', { format: 'email' })],
      values: { email: 'legacy-bad' },
      operation: 'update',
      options: { previousValues: { email: 'legacy-bad' }, skipUnchangedInvalid: false },
    });
    assert.deepEqual(codesFor(r, 'email'), [ERROR_CODES.INVALID_FORMAT]);
  });

  it('explicit skipUnchangedInvalid:true still validates a CHANGED value', () => {
    const r = validateRecord({
      fields: [field('email', { format: 'email' })],
      values: { email: 'still-bad' },
      operation: 'update',
      options: { previousValues: { email: 'legacy-bad' }, skipUnchangedInvalid: true },
    });
    assert.deepEqual(codesFor(r, 'email'), [ERROR_CODES.INVALID_FORMAT]);
  });
});
