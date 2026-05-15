import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'useCertExpiry.js'), 'utf8');

// Guards: public API of useCertExpiry.js is intact
describe('useCertExpiry — exports', () => {
  it('re-exports daysUntil from certExpiryUtils', () => {
    assert.match(src, /export.*daysUntil/);
  });

  it('exports useCertExpiry as a named function', () => {
    assert.match(src, /export function useCertExpiry/);
  });
});

describe('useCertExpiry — hook structure', () => {
  it('accepts mockDaysLeft option to bypass the API call', () => {
    assert.match(src, /mockDaysLeft/);
  });

  it('returns daysLeft from the hook', () => {
    assert.match(src, /return.*daysLeft/);
  });

  it('fetches from the /certificate endpoint without orgId query param', () => {
    assert.match(src, /apiFetch\(['"]\/certificate['"]/);
    assert.doesNotMatch(src, /certificate\?orgId/);
  });

  it('uses useApiFetch to obtain the authenticated fetch function', () => {
    assert.match(src, /useApiFetch/);
    assert.match(src, /apiFetch/);
  });

  it('sets daysLeft only when the API response has exists and validTo', () => {
    assert.match(src, /data\?\.exists.*data\?\.validTo|exists[\s\S]*?validTo/);
  });

  it('short-circuits immediately when mockDaysLeft is not null', () => {
    assert.match(src, /if \(mockDaysLeft !== null\)/);
  });

  it('resets daysLeft to null when response has no valid cert (else branch)', () => {
    assert.match(src, /\} else \{[\s\S]{0,40}setDaysLeft\(null\)/);
  });

  it('uses AbortController to cancel in-flight fetch on cleanup', () => {
    assert.match(src, /new AbortController\(\)/);
    assert.match(src, /controller\.abort\(\)/);
    assert.match(src, /controller\.signal\.aborted/);
  });
});
