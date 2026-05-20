import { describe, it, expect, vi } from 'vitest';

// indexEvents is a pure function but CalendarView.jsx pulls in heavy UI deps.
// Stub them so we can import the module without rendering anything.
vi.mock('@/i18n', () => ({
  useLabel: () => (key) => key,
  useMenuLabel: () => (key) => key,
  useUI: () => (key) => key,
  useLocale: () => ({ genericLabels: {}, statuses: {} }),
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
}));

import { indexEvents } from '../CalendarView.jsx';

// Use explicit local-time Date constructors so the YYYY-MM-DD keys produced by
// toDateKey() are independent of the runner's timezone.
const localDate = (y, m1based, d) => new Date(y, m1based - 1, d);
const localKey = (y, m1based, d) => {
  const mm = String(m1based).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
};

describe('indexEvents (CalendarView)', () => {
  // Regression: the `for (const cursor = ...; cursor <= end; ...)` refactor
  // must keep the same iteration semantics as the previous `while` loop.
  it('indexes a single-day event under exactly one date key', () => {
    const evt = { id: 'a', title: 'one-day', date: localDate(2026, 5, 19) };
    const map = indexEvents([evt]);
    expect(Object.keys(map)).toEqual([localKey(2026, 5, 19)]);
    expect(map[localKey(2026, 5, 19)]).toEqual([evt]);
  });

  it('treats an event without endDate the same as a single-day event', () => {
    const evt = { id: 'b', title: 'no-end', date: localDate(2026, 5, 19), endDate: undefined };
    const map = indexEvents([evt]);
    expect(Object.keys(map)).toEqual([localKey(2026, 5, 19)]);
  });

  it('indexes a 3-day event under 3 consecutive date keys', () => {
    const evt = {
      id: 'c',
      title: 'three-days',
      date: localDate(2026, 5, 19),
      endDate: localDate(2026, 5, 21),
    };
    const map = indexEvents([evt]);
    const keys = Object.keys(map).sort();
    expect(keys).toEqual([localKey(2026, 5, 19), localKey(2026, 5, 20), localKey(2026, 5, 21)]);
    for (const key of keys) {
      expect(map[key]).toEqual([evt]);
    }
  });

  it('indexes events that span a month boundary across every day', () => {
    // Jan 30 -> Feb 2 (4 days inclusive)
    const evt = {
      id: 'd',
      title: 'cross-month',
      date: localDate(2026, 1, 30),
      endDate: localDate(2026, 2, 2),
    };
    const map = indexEvents([evt]);
    const keys = Object.keys(map).sort();
    expect(keys).toEqual([
      localKey(2026, 1, 30),
      localKey(2026, 1, 31),
      localKey(2026, 2, 1),
      localKey(2026, 2, 2),
    ]);
  });

  it('accumulates multiple events on the same day', () => {
    const a = { id: 'a', title: 'A', date: localDate(2026, 5, 19) };
    const b = { id: 'b', title: 'B', date: localDate(2026, 5, 19) };
    const map = indexEvents([a, b]);
    expect(map[localKey(2026, 5, 19)]).toEqual([a, b]);
  });

  it('returns an empty object for no events', () => {
    expect(indexEvents([])).toEqual({});
  });
});
