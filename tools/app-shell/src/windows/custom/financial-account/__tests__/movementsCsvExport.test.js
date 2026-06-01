import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildMovementsCsv } from '../movementsCsvExport.js';

// ---------------------------------------------------------------------------
// buildMovementsCsv — public surface
//
// The helpers `csvField`, `formatDateDDMMYYYY`, `splitAmount`, `buildPaymentLabel`
// and `resolveStatusLabel` are NOT exported individually, so we cover their
// behaviour through the only exported entry-point: `buildMovementsCsv`. The
// header is fixed and rows are emitted in input order, so we can assert on
// specific column positions deterministically.
// ---------------------------------------------------------------------------

const HEADER_LINE = [
  '"Transaction Type"',
  '"Payment"',
  '"Transaction Date"',
  '"Business Partner"',
  '"Payment No."',
  '"G/L Item"',
  '"Description"',
  '"Deposit Amount"',
  '"Withdrawal Amount"',
  '"Currency"',
  '"Status"',
  '"Foreign  Amount"', // legacy double space
  '"Foreign Currency"',
  '"Processed"',
].join(',');

function rowCells(csv, idx) {
  // Split, then skip the header (index 0). Returns the CSV fields of `idx`.
  const lines = csv.split('\n');
  return lines[idx + 1].split(',');
}

describe('buildMovementsCsv', () => {
  describe('header', () => {
    it('emits the fixed 14-column header in the exact order', () => {
      const csv = buildMovementsCsv([]);
      assert.equal(csv, HEADER_LINE);
    });

    it('preserves the legacy double-space in "Foreign  Amount"', () => {
      const csv = buildMovementsCsv([]);
      assert.match(csv, /"Foreign {2}Amount"/);
    });
  });

  describe('csvField escaping (via row output)', () => {
    it('emits "" for null / undefined / empty contact, glItem, description, docNo, currency', () => {
      const csv = buildMovementsCsv([
        { id: 'm1', amount: 0, date: null, trxType: '', paymentStatus: '' },
      ]);
      const cells = rowCells(csv, 0);
      // contact, docNo, glItem, description, currency, status => all empty -> ""
      assert.equal(cells[3], '""');  // Business Partner
      assert.equal(cells[4], '""');  // Payment No.
      assert.equal(cells[5], '""');  // G/L Item
      assert.equal(cells[6], '""');  // Description
      assert.equal(cells[9], '""');  // Currency
      assert.equal(cells[10], '""'); // Status
    });

    it('emits raw numbers for numeric Deposit / Withdrawal Amount', () => {
      const csv = buildMovementsCsv([
        {
          id: 'm1', amount: 100, trxType: 'BPD',
          date: '2026-05-06T12:00:00.000Z',
        },
      ]);
      const cells = rowCells(csv, 0);
      // Deposit (col 7) = 100, Withdrawal (col 8) = 0 -- raw numbers, no quotes
      assert.equal(cells[7], '100');
      assert.equal(cells[8], '0');
    });

    it('serialises booleans as "true" / "false" (Processed column)', () => {
      const csv = buildMovementsCsv([
        { id: 'm1', amount: 100, paymentStatus: 'RPR' },
        { id: 'm2', amount: 100, paymentStatus: 'RPAP' },
      ]);
      // Processed = paymentStatus !== 'RPAP' && !== 'RPAE'
      assert.equal(rowCells(csv, 0).at(-1), '"true"');
      assert.equal(rowCells(csv, 1).at(-1), '"false"');
    });

    it('doubles embedded quotes in string fields (RFC 4180)', () => {
      const csv = buildMovementsCsv([
        { id: 'm1', amount: 0, description: 'has "quoted" text' },
      ]);
      const cells = rowCells(csv, 0);
      // The description column is at index 6
      assert.equal(cells[6], '"has ""quoted"" text"');
    });
  });

  describe('formatDateDDMMYYYY (via Transaction Date column)', () => {
    it('formats a valid ISO date as DD-MM-YYYY', () => {
      const csv = buildMovementsCsv([
        { id: 'm1', amount: 0, date: '2026-05-06T12:00:00.000Z' },
      ]);
      const cells = rowCells(csv, 0);
      // The Date column is at index 2
      assert.equal(cells[2], '"06-05-2026"');
    });

    it('returns "" (empty string) for null date', () => {
      const csv = buildMovementsCsv([{ id: 'm1', amount: 0, date: null }]);
      assert.equal(rowCells(csv, 0)[2], '""');
    });

    it('returns "" for invalid date string', () => {
      const csv = buildMovementsCsv([{ id: 'm1', amount: 0, date: 'not-a-date' }]);
      assert.equal(rowCells(csv, 0)[2], '""');
    });
  });

  describe('splitAmount (via Deposit / Withdrawal columns)', () => {
    it('routes positive amount into the Deposit column', () => {
      const csv = buildMovementsCsv([{ id: 'm1', amount: 250 }]);
      const cells = rowCells(csv, 0);
      assert.equal(cells[7], '250'); // Deposit
      assert.equal(cells[8], '0');   // Withdrawal
    });

    it('routes negative amount into the Withdrawal column as a positive number', () => {
      const csv = buildMovementsCsv([{ id: 'm1', amount: -42.5 }]);
      const cells = rowCells(csv, 0);
      assert.equal(cells[7], '0');
      assert.equal(cells[8], '42.5');
    });

    it('routes zero as a deposit (0, 0)', () => {
      const csv = buildMovementsCsv([{ id: 'm1', amount: 0 }]);
      const cells = rowCells(csv, 0);
      assert.equal(cells[7], '0');
      assert.equal(cells[8], '0');
    });

    it('coerces non-numeric amount to 0', () => {
      const csv = buildMovementsCsv([{ id: 'm1', amount: 'NaN-ish' }]);
      const cells = rowCells(csv, 0);
      assert.equal(cells[7], '0');
      assert.equal(cells[8], '0');
    });
  });

  describe('buildPaymentLabel (via Payment column)', () => {
    it('joins docNo - date - bp - abs(amount) with " - " separators (full row)', () => {
      const csv = buildMovementsCsv([
        {
          id: 'm1', amount: -100, documentNo: 'DOC-001',
          contact: 'ACME', date: '2026-05-06T12:00:00.000Z',
        },
      ]);
      const cells = rowCells(csv, 0);
      // Payment column is at index 1; abs(amount)=100, date DD-MM-YYYY
      assert.equal(cells[1], '"DOC-001 - 06-05-2026 - ACME - 100"');
    });

    it('drops empty segments instead of leaving dangling separators', () => {
      const csv = buildMovementsCsv([
        {
          id: 'm1', amount: 0, documentNo: '', contact: '', date: null,
        },
      ]);
      // Only the amount (0) remains; filter() removes empty strings, the
      // number 0 survives the filter (only `=== ''` is excluded).
      assert.equal(rowCells(csv, 0)[1], '"0"');
    });

    it('omits the date segment when date is null', () => {
      const csv = buildMovementsCsv([
        {
          id: 'm1', amount: 50, documentNo: 'X', contact: 'Y', date: null,
        },
      ]);
      // formatDateDDMMYYYY returns '', filter strips it.
      assert.equal(rowCells(csv, 0)[1], '"X - Y - 50"');
    });
  });

  describe('Transaction Type mapping (TRX_TYPE_LABEL via column 0)', () => {
    it('maps BPD to "BP Deposit"', () => {
      const csv = buildMovementsCsv([{ id: 'm1', amount: 0, trxType: 'BPD' }]);
      assert.equal(rowCells(csv, 0)[0], '"BP Deposit"');
    });

    it('maps BPW to "BP Withdrawal"', () => {
      const csv = buildMovementsCsv([{ id: 'm1', amount: 0, trxType: 'BPW' }]);
      assert.equal(rowCells(csv, 0)[0], '"BP Withdrawal"');
    });

    it('falls back to the raw trxType when unmapped', () => {
      const csv = buildMovementsCsv([{ id: 'm1', amount: 0, trxType: 'BF' }]);
      assert.equal(rowCells(csv, 0)[0], '"BF"');
    });

    it('falls back to "" when trxType is missing', () => {
      const csv = buildMovementsCsv([{ id: 'm1', amount: 0 }]);
      assert.equal(rowCells(csv, 0)[0], '""');
    });
  });

  describe('STATUS_TO_CLASSIC_LABEL (via Status column)', () => {
    const STATUS_PAIRS = [
      ['RPAP',   'Awaiting Payment'],
      ['RPAE',   'Awaiting Execution'],
      ['RPVOID', 'Voided'],
      ['RPR',    'Payment Received'],
      ['PPM',    'Payment Made'],
      ['PWNC',   'Withdrawn not Cleared'],
      ['RDNC',   'Deposited not Cleared'],
      ['RPPC',   'Payment Cleared'],
    ];

    for (const [code, label] of STATUS_PAIRS) {
      it(`maps ${code} → "${label}"`, () => {
        const csv = buildMovementsCsv([{ id: 'm1', amount: 0, paymentStatus: code }]);
        assert.equal(rowCells(csv, 0)[10], `"${label}"`);
      });
    }

    it('falls back to the raw code when paymentStatus is unknown', () => {
      const csv = buildMovementsCsv([{ id: 'm1', amount: 0, paymentStatus: 'UNKNOWN' }]);
      assert.equal(rowCells(csv, 0)[10], '"UNKNOWN"');
    });

    it('emits "" when paymentStatus is missing', () => {
      const csv = buildMovementsCsv([{ id: 'm1', amount: 0 }]);
      assert.equal(rowCells(csv, 0)[10], '""');
    });
  });

  describe('Processed flag derivation', () => {
    it('is false for "awaiting" payment statuses (RPAP, RPAE)', () => {
      const csv = buildMovementsCsv([
        { id: 'm1', amount: 0, paymentStatus: 'RPAP' },
        { id: 'm2', amount: 0, paymentStatus: 'RPAE' },
      ]);
      assert.equal(rowCells(csv, 0).at(-1), '"false"');
      assert.equal(rowCells(csv, 1).at(-1), '"false"');
    });

    it('is true for any other status (incl. empty/null)', () => {
      const csv = buildMovementsCsv([
        { id: 'm1', amount: 0, paymentStatus: 'RPR' },
        { id: 'm2', amount: 0, paymentStatus: 'RPPC' },
        { id: 'm3', amount: 0, paymentStatus: null },
      ]);
      assert.equal(rowCells(csv, 0).at(-1), '"true"');
      assert.equal(rowCells(csv, 1).at(-1), '"true"');
      assert.equal(rowCells(csv, 2).at(-1), '"true"');
    });
  });

  describe('row order and structure', () => {
    it('emits one row per movement in the input order', () => {
      const csv = buildMovementsCsv([
        { id: 'a', amount: 1, documentNo: 'DOC-A' },
        { id: 'b', amount: 2, documentNo: 'DOC-B' },
        { id: 'c', amount: 3, documentNo: 'DOC-C' },
      ]);
      const lines = csv.split('\n');
      assert.equal(lines.length, 4); // header + 3 rows
      assert.equal(rowCells(csv, 0)[4], '"DOC-A"');
      assert.equal(rowCells(csv, 1)[4], '"DOC-B"');
      assert.equal(rowCells(csv, 2)[4], '"DOC-C"');
    });

    it('returns just the header (no rows) for an empty input', () => {
      const csv = buildMovementsCsv([]);
      assert.equal(csv.split('\n').length, 1);
      assert.equal(csv, HEADER_LINE);
    });

    it('emits 14 cells per data row (one per HEADER column)', () => {
      const csv = buildMovementsCsv([
        {
          id: 'm1', amount: 100, trxType: 'BPD', date: '2026-05-06T12:00:00.000Z',
          contact: 'ACME', documentNo: 'DOC-001', glItem: 'GL-1', description: 'desc',
          currencyIso: 'EUR', paymentStatus: 'RPR',
        },
      ]);
      assert.equal(rowCells(csv, 0).length, 14);
    });
  });
});
