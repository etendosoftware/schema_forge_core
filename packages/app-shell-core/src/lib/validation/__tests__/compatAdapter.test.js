import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inferFormatConstraints, applyCompatFormats } from '../compatAdapter.js';
import { validateRecord } from '../validateRecord.js';
import { ERROR_CODES } from '../errorCodes.js';

describe('compatAdapter — inferFormatConstraints (name-based, TEMPORARY)', () => {
  it('infers email format from an email field name', () => {
    assert.deepEqual(inferFormatConstraints({ key: 'contactEmail', type: 'string' }), {
      format: 'email',
    });
  });

  it('excludes SMTP credential fields that merely contain "email"', () => {
    assert.equal(inferFormatConstraints({ key: 'emailUser', type: 'string' }), null);
    assert.equal(inferFormatConstraints({ key: 'EmailUserPW', type: 'string' }), null);
  });

  it('infers url format + https allowlist from a website field name', () => {
    assert.deepEqual(inferFormatConstraints({ key: 'website', type: 'string' }), {
      format: 'url',
      allowedSchemes: ['https'],
    });
  });

  it('does not treat "webhook" as a website field', () => {
    assert.deepEqual(inferFormatConstraints({ key: 'webhookUrl', type: 'string' }), {
      format: 'url',
      allowedSchemes: ['https'],
    });
    // "webhookUrl" DOES contain "url" so it is a website field; but a bare
    // "webhook" token must NOT match.
    assert.equal(inferFormatConstraints({ key: 'webhook', type: 'string' }), null);
  });

  it('infers phone format from a phone field name', () => {
    assert.deepEqual(inferFormatConstraints({ key: 'alternativePhone', type: 'string' }), {
      format: 'phone',
    });
  });

  it('returns null for a non-text-like field even if the name matches', () => {
    assert.equal(inferFormatConstraints({ key: 'sendEmail', type: 'boolean' }), null);
  });

  it('returns null for a field with no matching name', () => {
    assert.equal(inferFormatConstraints({ key: 'documentNo', type: 'string' }), null);
  });
});

describe('compatAdapter — applyCompatFormats', () => {
  it('merges inferred constraints without overriding explicit validation', () => {
    const fields = [
      { name: 'website', key: 'website', type: 'string', validation: { required: true } },
    ];
    const out = applyCompatFormats(fields);
    assert.deepEqual(out[0].validation, {
      format: 'url',
      allowedSchemes: ['https'],
      required: true,
    });
  });

  it('lets an explicit format win over the inferred one', () => {
    const fields = [
      { name: 'email', key: 'email', type: 'string', validation: { format: 'url' } },
    ];
    const out = applyCompatFormats(fields);
    assert.equal(out[0].validation.format, 'url');
  });

  it('does not mutate the input fields', () => {
    const fields = [{ name: 'email', key: 'email', type: 'string' }];
    applyCompatFormats(fields);
    assert.equal(fields[0].validation, undefined);
  });

  it('end-to-end: adapted email field validates through validateRecord', () => {
    const fields = applyCompatFormats([{ name: 'email', key: 'email', type: 'string' }]);
    const r = validateRecord({ fields, values: { email: 'bad' }, operation: 'create' });
    assert.deepEqual((r.errors.email || []).map((e) => e.code), [ERROR_CODES.INVALID_FORMAT]);
  });
});
