import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STATUS_ORDER, compareStatusCodes } from '../statusBadge.js';

// ETP-4913 — the advanced filter's status value picker must render in a fixed
// business-flow order, matching the "All statuses" pill. The comparator is the
// single source of that order; these cases are the contract it must honour.
//
// The first block is copied VERBATIM from the functional repo's
// tools/app-shell/src/lib/__tests__/statusBadge.orderStability.test.js
// (the ETP-4696 contract). Keeping it identical is what makes any divergence
// between the two STATUS_ORDER copies show up as a test failure here.

// Real AD_Ref_List code sets, used to assert the full resulting order.
// 131 "All_Document Status" (M_InOut / C_Invoice) — 10 active values.
const WAREHOUSE_CODES = ['CL', 'CO', 'DR', 'NA', 'WP', 'RE', 'TEMP', 'IP', '??', 'VO'];
// FF80818130217A350130218D802B0011 "Order_Document Status" (C_Order) + ETGO_CI.
const ORDER_CODES = [
  'AE', 'CO', 'CL', 'ETGO_CI', 'CA', 'CJ', 'DR', 'ME', 'NA', 'NC',
  'WP', 'RE', 'TMP', 'UE', 'IP', '??', 'VO',
];
// Payment statuses (FIN_Payment.Status).
const PAYMENT_CODES = ['RPAE', 'RPAP', 'RPR', 'RPPC', 'PPM', 'PWNC', 'RDNC', 'RPVOID', 'ETGOERR'];

/**
 * Sorts a copy of `codes` with the comparator under test. Every ordering
 * assertion goes through this so no test mutates a shared fixture.
 */
function sorted(codes) {
  return codes.slice().sort(compareStatusCodes);
}

/**
 * The order `codes` is expected to come out in: STATUS_ORDER filtered down to
 * the codes present. Derived rather than hand-written so a STATUS_ORDER change
 * cannot silently disagree with a stale literal in the test.
 */
function expectedOrder(codes) {
  return STATUS_ORDER.filter((c) => codes.includes(c));
}

describe('compareStatusCodes (ETP-4696 contract — stable status dropdown order)', () => {
  it('orders known codes by their fixed STATUS_ORDER position', () => {
    const shuffled = ['VO', 'DR', 'CO', 'IP', 'CL', 'RPAP'];
    assert.deepEqual(sorted(shuffled), expectedOrder(shuffled));
  });

  it('produces the same order no matter the input order (idempotent regardless of arrival order)', () => {
    const a = ['CL', 'DR', 'VO', 'IP', 'CO'];
    const b = ['VO', 'IP', 'CO', 'CL', 'DR'];
    assert.deepEqual(sorted(a), sorted(b));
  });

  it('is case-insensitive', () => {
    const mixed = ['vo', 'DR', 'Co', 'ip'];
    assert.deepEqual(sorted(mixed).map((c) => c.toUpperCase()), ['DR', 'IP', 'CO', 'VO']);
  });

  it('pushes unknown codes after all known ones', () => {
    const codes = ['ZZZ_UNKNOWN', 'DR', 'AAA_UNKNOWN'];
    const result = sorted(codes);
    assert.equal(result[0], 'DR');
    assert.deepEqual(result.slice(1), ['AAA_UNKNOWN', 'ZZZ_UNKNOWN']);
  });

  it('keeps unknown codes stable and alphabetical relative to each other', () => {
    const codes = ['UNKNOWN_B', 'UNKNOWN_A', 'UNKNOWN_C'];
    assert.deepEqual(sorted(codes), ['UNKNOWN_A', 'UNKNOWN_B', 'UNKNOWN_C']);
  });

  it('treats boolean-derived codes (true/false) consistently with Draft/Completed buckets', () => {
    assert.deepEqual(sorted(['true', 'false']), ['false', 'true']);
  });

  it('returns 0 for two identical unknown codes (exact tie, neither in STATUS_ORDER)', () => {
    assert.equal(compareStatusCodes('FOO_UNKNOWN', 'FOO_UNKNOWN'), 0);
  });

  it('returns 0 for the same unknown code differing only in case (normalized tie)', () => {
    assert.equal(compareStatusCodes('foo_unknown', 'FOO_UNKNOWN'), 0);
  });
});

describe('compareStatusCodes — full document flows (ETP-4913)', () => {
  it('orders the warehouse docstatus set by document flow, not alphabetically', () => {
    assert.deepEqual(
      sorted(WAREHOUSE_CODES),
      ['TEMP', 'DR', 'IP', 'WP', 'CO', 'RE', 'CL', 'NA', 'VO', '??'],
    );
  });

  it('orders the order/quotation docstatus set by document flow', () => {
    assert.deepEqual(
      sorted(ORDER_CODES),
      ['TMP', 'DR', 'NC', 'IP', 'UE', 'AE', 'ME', 'WP', 'CO', 'CA', 'ETGO_CI',
        'RE', 'CL', 'NA', 'CJ', 'VO', '??'],
    );
  });

  it('orders the payment status set by payment flow', () => {
    assert.deepEqual(
      sorted(PAYMENT_CODES),
      ['RPAE', 'RPAP', 'RPR', 'RPPC', 'PPM', 'PWNC', 'RDNC', 'RPVOID', 'ETGOERR'],
    );
  });

  it('every code of every real docstatus set is known to the catalog', () => {
    for (const code of [...WAREHOUSE_CODES, ...ORDER_CODES, ...PAYMENT_CODES]) {
      assert.ok(
        STATUS_ORDER.includes(code),
        `${code} is missing from STATUS_ORDER and would fall to the alphabetical tail`,
      );
    }
  });

  it('places the Unknown sentinel last among known codes, but still before an unknown one', () => {
    // The backend orders distinct values by raw code, and '?' (0x3F) sorts
    // before 'A', so without an explicit entry '??' rendered FIRST.
    const result = sorted(['??', 'CO', 'DR', 'ZZZ_UNKNOWN']);
    assert.deepEqual(result, ['DR', 'CO', '??', 'ZZZ_UNKNOWN']);
  });

  it('keeps the two Temporal aliases adjacent and ahead of Draft', () => {
    assert.deepEqual(sorted(['DR', 'TEMP', 'TMP']), ['TMP', 'TEMP', 'DR']);
  });

  it('orders Re-Opened after Completed and before the terminal Closed', () => {
    assert.deepEqual(sorted(['CL', 'RE', 'CO']), ['CO', 'RE', 'CL']);
  });
});

describe('STATUS_ORDER invariants', () => {
  it('has no duplicate entries', () => {
    assert.equal(new Set(STATUS_ORDER).size, STATUS_ORDER.length);
  });

  it('holds every entry in upper case', () => {
    // compareStatusCodes normalizes its inputs to upper case before the
    // indexOf lookup, so a lower-case entry would be permanently unreachable.
    for (const code of STATUS_ORDER) {
      assert.equal(code, code.toUpperCase(), `${code} is not upper case`);
    }
  });
});
