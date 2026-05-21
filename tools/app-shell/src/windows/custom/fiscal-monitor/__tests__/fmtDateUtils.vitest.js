import { describe, it, expect } from 'vitest';
import { fmtDate } from '../fmtDateUtils.js';

describe('fmtDate — falsy inputs', () => {
  it('returns em-dash for null', () => {
    expect(fmtDate(null)).toBe('—');
  });

  it('returns em-dash for undefined', () => {
    expect(fmtDate(undefined)).toBe('—');
  });

  it('returns em-dash for empty string', () => {
    expect(fmtDate('')).toBe('—');
  });

  it('returns em-dash for 0', () => {
    expect(fmtDate(0)).toBe('—');
  });
});

describe('fmtDate — ISO yyyy-mm-dd to dd/mm/yyyy', () => {
  it('converts 2026-05-13 to 13/05/2026', () => {
    expect(fmtDate('2026-05-13')).toBe('13/05/2026');
  });

  it('converts 2025-01-01 to 01/01/2025', () => {
    expect(fmtDate('2025-01-01')).toBe('01/01/2025');
  });

  it('converts 2024-12-31 to 31/12/2024', () => {
    expect(fmtDate('2024-12-31')).toBe('31/12/2024');
  });
});

describe('fmtDate — dd/mm/yyyy passthrough', () => {
  it('leaves 13/05/2026 unchanged', () => {
    expect(fmtDate('13/05/2026')).toBe('13/05/2026');
  });

  it('leaves 01/01/2025 unchanged', () => {
    expect(fmtDate('01/01/2025')).toBe('01/01/2025');
  });
});

describe('fmtDate — invalid inputs returned as-is', () => {
  it('returns raw value when fewer than 3 parts', () => {
    expect(fmtDate('2026-05')).toBe('2026-05');
  });

  it('returns raw value when more than 3 parts', () => {
    expect(fmtDate('a-b-c-d')).toBe('a-b-c-d');
  });

  it('returns raw value for no separators', () => {
    expect(fmtDate('20260513')).toBe('20260513');
  });
});
