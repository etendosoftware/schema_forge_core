import { describe, it, expect } from 'vitest';
import { daysUntil } from '../certExpiryUtils.js';

function isoDateOffset(days) {
  const now = new Date();
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
  return target.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Null / falsy inputs
// ---------------------------------------------------------------------------

describe('daysUntil — falsy inputs', () => {
  it('returns null for null', () => {
    expect(daysUntil(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(daysUntil(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(daysUntil('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Relative dates (today, past, future)
// ---------------------------------------------------------------------------

describe('daysUntil — today', () => {
  it('returns 0 for today', () => {
    expect(daysUntil(isoDateOffset(0))).toBe(0);
  });
});

describe('daysUntil — future dates', () => {
  it('returns 1 for tomorrow', () => {
    expect(daysUntil(isoDateOffset(1))).toBe(1);
  });

  it('returns 30 for 30 days from now', () => {
    expect(daysUntil(isoDateOffset(30))).toBe(30);
  });

  it('returns 365 for one year from now', () => {
    expect(daysUntil(isoDateOffset(365))).toBe(365);
  });
});

describe('daysUntil — past dates', () => {
  it('returns -1 for yesterday', () => {
    expect(daysUntil(isoDateOffset(-1))).toBe(-1);
  });

  it('returns -30 for 30 days ago', () => {
    expect(daysUntil(isoDateOffset(-30))).toBe(-30);
  });
});

// ---------------------------------------------------------------------------
// Out-of-range component values
// ---------------------------------------------------------------------------

describe('daysUntil — out-of-range components', () => {
  it('returns null for month 0', () => {
    expect(daysUntil('2026-00-01')).toBeNull();
  });

  it('returns null for month 13', () => {
    expect(daysUntil('2026-13-01')).toBeNull();
  });

  it('returns null for day 0', () => {
    expect(daysUntil('2026-01-00')).toBeNull();
  });

  it('returns null for day 32', () => {
    expect(daysUntil('2026-01-32')).toBeNull();
  });

  it('returns null for impossible Feb 31', () => {
    expect(daysUntil('2026-02-31')).toBeNull();
  });

  it('returns null for impossible Apr 31', () => {
    expect(daysUntil('2026-04-31')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Malformed string inputs
// ---------------------------------------------------------------------------

describe('daysUntil — malformed strings', () => {
  it('returns null for non-date string', () => {
    expect(daysUntil('not-a-date')).toBeNull();
  });

  it('returns null for slash-delimited dd/mm/yyyy', () => {
    expect(daysUntil('13/05/2026')).toBeNull();
  });
});
