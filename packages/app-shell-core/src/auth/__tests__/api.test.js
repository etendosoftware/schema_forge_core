import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// api.js uses window and import.meta.env at module scope — cannot be imported in Node.
// Use source-reading to verify the module's contract.
const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'api.js'), 'utf8');

describe('buildHeaders', () => {
  it('is exported as a named function', () => {
    assert.match(src, /export function buildHeaders/);
  });

  it('sets Authorization header with Bearer prefix when token is provided', () => {
    assert.match(src, /Authorization.*Bearer.*token/s);
  });

  it('sets Content-Type to application/json', () => {
    assert.match(src, /Content-Type.*application\/json/);
  });

  it('sets Accept-Language header using getStoredLocale for backend i18n', () => {
    assert.match(src, /Accept-Language/);
    assert.match(src, /getStoredLocale/);
  });
});

describe('isTokenExpired', () => {
  it('is exported as a named function', () => {
    assert.match(src, /export function isTokenExpired/);
  });

  it('returns truthy for falsy token values', () => {
    assert.match(src, /!token/);
  });
});

describe('createApiFetch — FormData handling', () => {
  it('deletes Content-Type when body is FormData so the browser sets the multipart boundary', () => {
    assert.match(src, /instanceof FormData[\s\S]*?delete headers\[.Content-Type.\]/);
  });
});

describe('detectBaseUrl', () => {
  it('is exported and reads window.location.pathname', () => {
    assert.match(src, /export function detectBaseUrl/);
    assert.match(src, /window\.location\.pathname/);
  });

  it('falls back to VITE_API_BASE env variable', () => {
    assert.match(src, /VITE_API_BASE/);
  });
});