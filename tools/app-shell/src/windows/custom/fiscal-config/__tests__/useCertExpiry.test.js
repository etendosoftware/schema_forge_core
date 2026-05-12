import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'useCertExpiry.js'), 'utf8');

// ── daysUntil pure function — copied to avoid importing JSX/alias dependencies ──

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - today) / 86_400_000);
}

function addDays(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

describe('daysUntil — null / falsy inputs', () => {
  it('returns null for null', () => assert.equal(daysUntil(null), null));
  it('returns null for empty string', () => assert.equal(daysUntil(''), null));
  it('returns null for undefined', () => assert.equal(daysUntil(undefined), null));
});

describe('daysUntil — relative future dates', () => {
  it('returns 1 for tomorrow', () => assert.equal(daysUntil(addDays(1)), 1));
  it('returns 30 for 30 days from now', () => assert.equal(daysUntil(addDays(30)), 30));
  it('returns 60 for 60 days from now', () => assert.equal(daysUntil(addDays(60)), 60));
  it('returns 0 for today', () => assert.equal(daysUntil(addDays(0)), 0));
});

describe('daysUntil — past dates', () => {
  it('returns a negative number for yesterday', () => assert.equal(daysUntil(addDays(-1)), -1));
  it('returns -30 for 30 days ago', () => assert.equal(daysUntil(addDays(-30)), -30));
});

// Guards: public API of useCertExpiry.js is intact
describe('useCertExpiry — exports', () => {
  it('exports daysUntil as a named function', () => {
    assert.match(src, /export function daysUntil/);
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

  it('fetches from the /certificate endpoint with orgId', () => {
    assert.match(src, /certificate\?orgId/);
  });

  it('sets daysLeft only when the API response has exists and validTo', () => {
    assert.match(src, /data\?\.exists.*data\?\.validTo|exists[\s\S]*?validTo/);
  });

  it('short-circuits immediately when mockDaysLeft is not null', () => {
    assert.match(src, /if \(mockDaysLeft !== null\)/);
  });

  it('includes Authorization header in the fetch', () => {
    assert.match(src, /Authorization.*Bearer/);
  });
});
