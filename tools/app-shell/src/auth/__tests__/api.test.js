import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildHeaders, isTokenExpired } from '../api.js';

describe('buildHeaders', () => {
  it('includes Authorization header when token provided', () => {
    const headers = buildHeaders('my-jwt-token');
    assert.equal(headers['Authorization'], 'Bearer my-jwt-token');
    assert.equal(headers['Content-Type'], 'application/json');
  });

  it('omits Authorization when no token', () => {
    const headers = buildHeaders(null);
    assert.ok(!headers['Authorization']);
    assert.equal(headers['Content-Type'], 'application/json');
  });

  it('omits Authorization for empty string', () => {
    const headers = buildHeaders('');
    assert.ok(!headers['Authorization']);
  });
});

describe('isTokenExpired', () => {
  it('returns true for null token', () => {
    assert.equal(isTokenExpired(null), true);
  });

  it('returns true for empty string', () => {
    assert.equal(isTokenExpired(''), true);
  });

  it('returns false for non-empty token', () => {
    assert.equal(isTokenExpired('some-token'), false);
  });
});
