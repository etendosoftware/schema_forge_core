import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getDueDateDotColor,
  getLatestInstallmentDueDate,
} from '../invoiceDueDate.js';

describe('invoiceDueDate helpers', () => {
  describe('getLatestInstallmentDueDate', () => {
    it('returns the latest due date across installments', () => {
      const dueDate = getLatestInstallmentDueDate([
        { dueDate: '2026-04-27' },
        { dueDate: '2026-04-29' },
        { dueDate: '2026-04-28' },
      ]);

      assert.equal(dueDate?.getFullYear(), 2026);
      assert.equal(dueDate?.getMonth(), 3);
      assert.equal(dueDate?.getDate(), 29);
    });

    it('keeps UTC midnight payloads on the original calendar day', () => {
      const dueDate = getLatestInstallmentDueDate([
        { dueDate: '2026-04-27T00:00:00Z' },
        { dueDate: '2026-04-28T00:00:00Z' },
      ]);

      assert.equal(dueDate?.getFullYear(), 2026);
      assert.equal(dueDate?.getMonth(), 3);
      assert.equal(dueDate?.getDate(), 28);
    });

    it('ignores invalid or missing due dates', () => {
      const dueDate = getLatestInstallmentDueDate([
        { dueDate: 'not-a-date' },
        {},
        { dueDate: '2026-04-30' },
      ]);

      assert.equal(dueDate?.getFullYear(), 2026);
      assert.equal(dueDate?.getMonth(), 3);
      assert.equal(dueDate?.getDate(), 30);
    });

    it('returns null when no installment has a valid due date', () => {
      assert.equal(getLatestInstallmentDueDate([{ dueDate: 'bad-date' }, {}]), null);
    });
  });

  describe('getDueDateDotColor', () => {
    const reference = new Date(2026, 3, 27, 15, 30, 0, 0);

    it('returns red for past due dates', () => {
      assert.equal(getDueDateDotColor('2026-04-26', reference), 'bg-red-500');
    });

    it('returns amber for same-day due dates', () => {
      assert.equal(getDueDateDotColor('2026-04-27', reference), 'bg-amber-500');
    });

    it('returns green for future due dates', () => {
      assert.equal(getDueDateDotColor('2026-04-28', reference), 'bg-emerald-500');
    });
  });
});
