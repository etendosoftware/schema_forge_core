import { describe, it, expect } from 'vitest';
import { computeBalance } from '../balanceTotals.js';

const cfg = { debitField: 'amtSourceDr', creditField: 'amtSourceCr' };

describe('computeBalance', () => {
  it('returns zeros and not balanced for empty lines', () => {
    expect(computeBalance([], null, null, cfg)).toEqual({
      totalDebit: 0, totalCredit: 0, difference: 0, isBalanced: false,
    });
  });

  it('balances when debit equals credit and total > 0', () => {
    const lines = [
      { amtSourceDr: '100', amtSourceCr: '0' },
      { amtSourceDr: '0', amtSourceCr: '100' },
    ];
    expect(computeBalance(lines, null, null, cfg)).toEqual({
      totalDebit: 100, totalCredit: 100, difference: 0, isBalanced: true,
    });
  });

  it('is not balanced when totals differ', () => {
    const lines = [
      { amtSourceDr: '100', amtSourceCr: '0' },
      { amtSourceDr: '0', amtSourceCr: '60' },
    ];
    const r = computeBalance(lines, null, null, cfg);
    expect(r.difference).toBe(40);
    expect(r.isBalanced).toBe(false);
  });

  it('is NOT balanced when both totals are zero', () => {
    const lines = [{ amtSourceDr: '0', amtSourceCr: '0' }];
    expect(computeBalance(lines, null, null, cfg).isBalanced).toBe(false);
  });

  it('includes the pending (in-progress add) line', () => {
    const lines = [{ amtSourceDr: '100', amtSourceCr: '0' }];
    const pending = { amtSourceDr: '0', amtSourceCr: '100' };
    expect(computeBalance(lines, pending, null, cfg).isBalanced).toBe(true);
  });

  it('applies the editing-line snapshot over the saved line', () => {
    const lines = [
      { id: 'a', amtSourceDr: '100', amtSourceCr: '0' },
      { id: 'b', amtSourceDr: '0', amtSourceCr: '40' },
    ];
    const editing = { id: 'b', amtSourceCr: '100' };
    expect(computeBalance(lines, null, editing, cfg).isBalanced).toBe(true);
  });

  it('rounds to 2 decimals to avoid float drift', () => {
    const lines = [
      { amtSourceDr: '0.1', amtSourceCr: '0' },
      { amtSourceDr: '0.2', amtSourceCr: '0' },
      { amtSourceDr: '0', amtSourceCr: '0.3' },
    ];
    expect(computeBalance(lines, null, null, cfg).isBalanced).toBe(true);
  });

  it('returns not-balanced when config is missing', () => {
    expect(computeBalance([{ amtSourceDr: '1' }], null, null, null).isBalanced).toBe(false);
  });
});
