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

  it('returns false for a valid (non-expired) JWT', () => {
    // header: {"alg":"none"}, payload: {"sub":"u","exp":9999999999}
    const validToken = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1IiwiZXhwIjo5OTk5OTk5OTk5fQ.sig';
    assert.equal(isTokenExpired(validToken), false);
  });

  it('returns true for an expired JWT', () => {
    // header: {"alg":"none"}, payload: {"sub":"u","exp":1000000000}
    const expiredToken = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1IiwiZXhwIjoxMDAwMDAwMDAwfQ.sig';
    assert.equal(isTokenExpired(expiredToken), true);
  });

  it('returns true for a malformed token', () => {
    assert.equal(isTokenExpired('not.a.jwt'), true);
    assert.equal(isTokenExpired('some-token'), true);
  });
});
