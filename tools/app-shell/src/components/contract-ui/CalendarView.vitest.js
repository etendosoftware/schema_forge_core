import { describe, it, expect } from 'vitest';
import { indexEvents } from './CalendarView.jsx';

function key(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

describe('indexEvents', () => {
  it('returns {} for empty input', () => {
    expect(indexEvents([])).toEqual({});
  });

  it('indexes a single-day event (no endDate) under exactly one key', () => {
    const evt = { id: 'a', title: 'A', date: new Date(2026, 4, 20) };
    const map = indexEvents([evt]);
    const keys = Object.keys(map);
    expect(keys).toEqual([key(2026, 5, 20)]);
    expect(map[key(2026, 5, 20)]).toEqual([evt]);
  });

  it('indexes a multi-day event under each spanned day', () => {
    const evt = {
      id: 'b',
      title: 'B',
      date: new Date(2026, 4, 20),
      endDate: new Date(2026, 4, 22),
    };
    const map = indexEvents([evt]);
    const keys = Object.keys(map).sort((a, b) => a.localeCompare(b));
    expect(keys).toEqual([
      key(2026, 5, 20),
      key(2026, 5, 21),
      key(2026, 5, 22),
    ]);
    for (const k of keys) {
      expect(map[k]).toEqual([evt]);
    }
  });

  it('indexes once when endDate equals date', () => {
    const d = new Date(2026, 0, 15);
    const evt = { id: 'c', title: 'C', date: d, endDate: new Date(d) };
    const map = indexEvents([evt]);
    expect(Object.keys(map)).toEqual([key(2026, 1, 15)]);
    expect(map[key(2026, 1, 15)]).toHaveLength(1);
  });

  it('stores both events on the same day in the array for that key', () => {
    const e1 = { id: 'd1', title: 'D1', date: new Date(2026, 6, 10) };
    const e2 = { id: 'd2', title: 'D2', date: new Date(2026, 6, 10) };
    const map = indexEvents([e1, e2]);
    expect(Object.keys(map)).toEqual([key(2026, 7, 10)]);
    expect(map[key(2026, 7, 10)]).toEqual([e1, e2]);
  });
});
