import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDatePattern,
  formatDateInput,
  parseDateInput,
  formatMonthYearLabel,
} from '../dateMask.js';

describe('dateMask — getDatePattern', () => {
  it('detects day-first order with "/" separator for es-ES', () => {
    const pattern = getDatePattern('es-ES');
    assert.deepEqual(pattern.order, ['day', 'month', 'year']);
    assert.equal(pattern.sep, '/');
  });

  it('detects day-first order for en-GB', () => {
    const pattern = getDatePattern('en-GB');
    assert.deepEqual(pattern.order, ['day', 'month', 'year']);
  });

  it('detects month-first order for en-US', () => {
    const pattern = getDatePattern('en-US');
    assert.equal(pattern.order[0], 'month');
  });
});

describe('dateMask — formatDateInput (typing forward)', () => {
  const esPattern = { order: ['day', 'month', 'year'], sep: '/' };

  it('does not insert a separator before the first segment is complete', () => {
    assert.equal(formatDateInput('1', esPattern), '1');
    assert.equal(formatDateInput('16', esPattern), '16');
  });

  it('auto-inserts a separator once a segment is full', () => {
    assert.equal(formatDateInput('160', esPattern), '16/0');
  });

  it('builds the full masked date from a flat digit stream (e.g. pasted input)', () => {
    assert.equal(formatDateInput('16072026', esPattern), '16/07/2026');
  });

  it('caps at 8 digits total, ignoring anything typed past the year', () => {
    assert.equal(formatDateInput('160720269999', esPattern), '16/07/2026');
  });
});

describe('dateMask — formatDateInput (ETP-4544 bug 2: mid-segment delete must not corrupt the date)', () => {
  const esPattern = { order: ['day', 'month', 'year'], sep: '/' };

  // Contract chosen for "keep cursor position / don't redistribute into an
  // invalid value" (documented in dateMask.js): when the raw value already
  // has one segment per pattern position (all separators intact), each
  // segment is clamped independently — digits are never pulled from a later
  // segment into an earlier one. This is what happens on the wire when the
  // user deletes a single character from an already-formatted date.
  it('preserves the edit when a digit is deleted from the middle (month) segment', () => {
    // Original value "16/07/2026", user deletes the "0" in "07" -> browser's
    // raw onChange value is "16/7/2026" (the exact repro from the ticket).
    const result = formatDateInput('16/7/2026', esPattern);
    assert.notEqual(result, '16/72/026'); // the corrupted output from the bug
    assert.equal(result, '16/7/2026');
  });

  it('preserves the edit when a digit is deleted from the first (day) segment', () => {
    // "16/07/2026" -> delete the "1" in "16" -> raw "6/07/2026"
    assert.equal(formatDateInput('6/07/2026', esPattern), '6/07/2026');
  });

  it('preserves the edit when a digit is deleted from the last (year) segment', () => {
    // "16/07/2026" -> delete the "0" in "2026" -> raw "16/07/226"
    assert.equal(formatDateInput('16/07/226', esPattern), '16/07/226');
  });
});

describe('dateMask — parseDateInput', () => {
  const esPattern = { order: ['day', 'month', 'year'], sep: '/' };
  const usPattern = { order: ['month', 'day', 'year'], sep: '/' };

  it('parses a valid day-first date to ISO', () => {
    assert.deepEqual(parseDateInput('16/07/2026', esPattern), { ok: true, iso: '2026-07-16' });
  });

  it('parses a valid month-first date to ISO', () => {
    assert.deepEqual(parseDateInput('07/16/2026', usPattern), { ok: true, iso: '2026-07-16' });
  });

  it('accepts empty input as ok with an empty iso', () => {
    assert.deepEqual(parseDateInput('', esPattern), { ok: true, iso: '' });
    assert.deepEqual(parseDateInput('   ', esPattern), { ok: true, iso: '' });
  });

  it('rejects malformed input', () => {
    assert.deepEqual(parseDateInput('16/07', esPattern), { ok: false });
    assert.deepEqual(parseDateInput('not-a-date', esPattern), { ok: false });
  });

  it('rejects an out-of-range month', () => {
    assert.deepEqual(parseDateInput('16/13/2026', esPattern), { ok: false });
  });

  it('rejects a non-existent day for the given month (e.g. Feb 31st)', () => {
    assert.deepEqual(parseDateInput('31/02/2026', esPattern), { ok: false });
  });
});

describe('dateMask — formatMonthYearLabel (ETP-4544 bug 1: no "de" preposition)', () => {
  it('formats es-ES month + year without the "de" preposition', () => {
    assert.equal(formatMonthYearLabel(new Date(2026, 6, 16), 'es-ES'), 'Julio 2026');
  });

  it('formats en-US month + year (no preposition to begin with)', () => {
    assert.equal(formatMonthYearLabel(new Date(2026, 6, 16), 'en-US'), 'July 2026');
  });
});
