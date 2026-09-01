import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

// Exercises the REAL shared module. Everything here used to live inline in the
// functional repo's Vite dev plugin, so the production report-server had none of
// it. Never re-implement the logic in this file — a hand-rolled copy passes
// whether or not the shipped code is right.
import {
  resolveGrouping,
  foldOpeningBalance,
  buildNestedGroups,
  foldAggregateRows,
  groupAggregateRowsByAccount,
  TRIAL_BALANCE_AMOUNT_FIELDS,
} from '../src/report-grouping.js';

const DIMENSION_CONTRACT = {
  groups: [{ field: 'account', label: { en_US: 'Account', es_ES: 'Cuenta' } }],
  columns: [{ field: 'groupbyname', label: { en_US: 'Description', es_ES: 'Descripción' } }],
  parameters: [
    { name: 'groupBy' },
    { name: 'dim', groupByValue: 'bp', groupByField: 'bpartnerName', label: { en_US: 'Partner', es_ES: 'Contacto' } },
  ],
};

describe('resolveGrouping', () => {
  it('keeps the Account band label separate from the dimension label', () => {
    // report-server used to overwrite groupLabel/descriptionLabel with the
    // dimension label, collapsing two bands into one. The template reads
    // meta.groupLabel for the Account band and meta.dimensionLabel for the
    // dimension band above it — they are not interchangeable.
    const out = resolveGrouping(DIMENSION_CONTRACT, { groupBy: 'bp' }, [{ bpartnerName: 'A' }], 'es_ES');
    assert.equal(out.dimensionLabel, 'Contacto');
    assert.equal(out.groupLabel, 'Cuenta');
    assert.equal(out.descriptionLabel, 'Descripción');
  });

  it('exposes the field the report is grouped by', () => {
    const out = resolveGrouping(DIMENSION_CONTRACT, { groupBy: 'bp' }, [{ bpartnerName: 'A' }]);
    assert.equal(out.dimensionField, 'bpartnerName');
  });

  it('leaves dimension fields null when no groupBy is requested', () => {
    const out = resolveGrouping(DIMENSION_CONTRACT, {}, [{ bpartnerName: 'A' }]);
    assert.equal(out.dimensionField, null);
    assert.equal(out.dimensionLabel, null);
  });

  it('ignores a groupBy value that matches no dimension parameter', () => {
    const out = resolveGrouping(DIMENSION_CONTRACT, { groupBy: 'nope' }, [{ bpartnerName: 'A' }]);
    assert.equal(out.dimensionField, null);
  });

  it('sorts by the dimension without synthesising name/value onto rows', () => {
    const rows = [{ bpartnerName: 'Zeta', amount: 10 }, { bpartnerName: 'Alpha', amount: 20 }];
    const out = resolveGrouping({ ...DIMENSION_CONTRACT, parameters: DIMENSION_CONTRACT.parameters.slice(1) },
      { groupBy: 'bp' }, rows);
    assert.equal(out.rows[0].bpartnerName, 'Alpha');
    assert.equal(out.rows[0].amount, 20, 'the row keeps its own data');
    assert.ok(!('name' in out.rows[0]), 'name must not be overwritten with the dimension value');
  });

  it('does not mutate the caller\'s rows array', () => {
    const rows = [{ bpartnerName: 'Zeta' }, { bpartnerName: 'Alpha' }];
    resolveGrouping({ ...DIMENSION_CONTRACT, parameters: DIMENSION_CONTRACT.parameters.slice(1) },
      { groupBy: 'bp' }, rows);
    assert.equal(rows[0].bpartnerName, 'Zeta', 'the input array was reordered in place');
  });

  it('sorts stably, so rows tied on the dimension keep their SQL order', () => {
    const rows = [
      { bpartnerName: 'A', seq: 1 }, { bpartnerName: 'A', seq: 2 }, { bpartnerName: 'A', seq: 3 },
    ];
    const out = resolveGrouping({ ...DIMENSION_CONTRACT, parameters: DIMENSION_CONTRACT.parameters.slice(1) },
      { groupBy: 'bp' }, rows);
    assert.deepEqual(out.rows.map((r) => r.seq), [1, 2, 3]);
  });

  // ETP-5013 — tbGroups is account-outer / dimension-inner. The previous
  // assertion here only checked `Array.isArray(out.tbGroups)`, which stayed
  // green through the full inversion of the nesting: it proved nothing.
  const TB_ROWS = [
    { account_no: '43000000', account_id: 'A1', account_name: 'Clientes', bpartnerName: 'Zeta', opening_balance: 10, activity_debit: 0, activity_credit: 0, closing_balance: 10 },
    { account_no: '43000000', account_id: 'A1', account_name: 'Clientes', bpartnerName: '', opening_balance: 5, activity_debit: 2, activity_credit: 0, closing_balance: 7 },
    { account_no: '43000000', account_id: 'A1', account_name: 'Clientes', bpartnerName: 'Alpha', opening_balance: 1, activity_debit: 0, activity_credit: 3, closing_balance: -2 },
    { account_no: '57000000', account_id: 'A2', account_name: 'Caja euros', bpartnerName: 'Alpha', opening_balance: -16, activity_debit: 0, activity_credit: 0, closing_balance: -16 },
  ];

  it('builds tbGroups as ONE BLOCK PER ACCOUNT, not per dimension value', () => {
    const out = resolveGrouping(DIMENSION_CONTRACT, { groupBy: 'bp' }, TB_ROWS);
    assert.ok(Array.isArray(out.tbGroups), 'tbGroups must be built when a dimension is active');
    // Two accounts -> two blocks, even though the dimension only has 3 distinct
    // values across them. Dimension-outer nesting would give 3 blocks.
    assert.deepEqual(out.tbGroups.map((g) => g.account_no), ['43000000', '57000000']);
    assert.equal(out.tbGroups[0].account_id, 'A1');
    assert.equal(out.tbGroups[0].account_name, 'Clientes');
    assert.ok(!('accounts' in out.tbGroups[0]),
      'the old dimension-outer `accounts` array must not come back');
    assert.ok(!('dimensionValue' in out.tbGroups[0]),
      'a block is an ACCOUNT, so it carries no dimensionValue of its own');
  });

  it('nests each account\'s dimension breakdown inside its block, dimension-sorted', () => {
    const out = resolveGrouping(DIMENSION_CONTRACT, { groupBy: 'bp' }, TB_ROWS);
    // '' (no dimension value) sorts first and is its OWN row — Classic renders
    // it as a blank-name row, it is never merged into another or dropped.
    assert.deepEqual(out.tbGroups[0].dimensionRows.map((r) => r.dimensionValue),
      ['', 'Alpha', 'Zeta']);
    assert.deepEqual(out.tbGroups[1].dimensionRows.map((r) => r.dimensionValue), ['Alpha']);
  });

  it('closes each account block with that account\'s own totals (sum of its dimensionRows)', () => {
    const out = resolveGrouping(DIMENSION_CONTRACT, { groupBy: 'bp' }, TB_ROWS);
    for (const group of out.tbGroups) {
      for (const field of TRIAL_BALANCE_AMOUNT_FIELDS) {
        const expected = group.dimensionRows.reduce((sum, r) => sum + r[field], 0);
        assert.ok(Math.abs(group[field] - expected) < 1e-9,
          `${group.account_no}.${field} must equal the sum of its dimensionRows`);
      }
    }
    assert.equal(out.tbGroups[0].opening_balance, 16);
    assert.equal(out.tbGroups[0].activity_debit, 2);
    assert.equal(out.tbGroups[0].activity_credit, 3);
    assert.equal(out.tbGroups[0].closing_balance, 15);
  });

  it('never builds tbGroups for grouped-listing reports (Libro Mayor has its own path)', () => {
    const contract = { ...DIMENSION_CONTRACT, type: 'grouped-listing' };
    const out = resolveGrouping(contract, { groupBy: 'bp' }, [{ bpartnerName: 'A' }]);
    assert.equal(out.tbGroups, null);
  });

  it('tolerates null rows', () => {
    const out = resolveGrouping(DIMENSION_CONTRACT, { groupBy: 'bp' }, null);
    assert.equal(out.dimensionField, null);
    assert.equal(out.rows, null);
  });
});

describe('foldOpeningBalance', () => {
  // Field names mirror openingQuery's real output: the account code is `value`
  // and the amounts are opening{dr,cr,total} — not the amtacct* names the folded
  // RESULT uses. Getting that backwards is easy and silently yields all zeros.
  const openingRows = [
    { value: '100', dim: 'A', openingdr: 10, openingcr: 4, openingtotal: 6 },
    { value: '100', dim: 'B', openingdr: 5, openingcr: 1, openingtotal: 4 },
    { value: '200', dim: 'A', openingdr: 7, openingcr: 0, openingtotal: 7 },
  ];

  it('scopes to one account under one dimension value', () => {
    const out = foldOpeningBalance(openingRows, '100', 'dim', 'A');
    assert.equal(Number(out.amtacctdr), 10);
    assert.equal(Number(out.amtacctcr), 4);
  });

  it('sums every breakdown row for the account when there is no dimension', () => {
    const out = foldOpeningBalance(openingRows, '100', null, null);
    assert.equal(Number(out.amtacctdr), 15);
    assert.equal(Number(out.amtacctcr), 5);
  });

  it('returns zeros, not undefined, for an account with no opening rows', () => {
    const out = foldOpeningBalance(openingRows, '999', null, null);
    assert.equal(Number(out.amtacctdr), 0);
    assert.equal(Number(out.total), 0);
  });

  it('returns zeros when there are no opening rows at all', () => {
    assert.equal(Number(foldOpeningBalance(null, '100', null, null).total), 0);
  });
});

describe('buildNestedGroups', () => {
  const rows = [
    { value: '100', name: 'Cash', wh: 'Main', total: 10 },
    { value: '100', name: 'Cash', wh: 'Main', total: 5 },
    { value: '200', name: 'Bank', wh: 'Other', total: 7 },
  ];

  it('folds everything into one implicit group when no dimension is given', () => {
    const groups = buildNestedGroups(rows, undefined, null);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].dimensionValue, null);
  });

  it('produces one group per distinct dimension value', () => {
    const groups = buildNestedGroups(rows, 'wh', null);
    assert.deepEqual(groups.map((g) => g.dimensionValue), ['Main', 'Other']);
  });
});

// ── foldAggregateRows / groupAggregateRowsByAccount (ETP-5013) ──────────────
//
// Both are exported and independently testable, but until now were only
// exercised indirectly through resolveGrouping. The ordering contract between
// them is load-bearing: groupAggregateRowsByAccount only opens a new block when
// account_no CHANGES, so it is correct ONLY if foldAggregateRows sorted by
// account first. Testing them together, and the sort key directly, is what
// pins that coupling down.

function tbRow(overrides) {
  return {
    account_no: '00000000', account_id: 'acct-x', account_name: 'Account X',
    opening_balance: 0, activity_debit: 0, activity_credit: 0, closing_balance: 0,
    ...overrides,
  };
}

describe('foldAggregateRows — sort order (ETP-5013)', () => {
  it('sorts by account_no FIRST and dimensionValue SECOND when a dimension is active', () => {
    // Deliberately interleaved so a dimension-first sort (the pre-ETP-5013
    // order) would produce a visibly different sequence.
    const rows = [
      tbRow({ account_no: '57000000', dim: 'Alpha', opening_balance: 1 }),
      tbRow({ account_no: '43000000', dim: 'Zeta', opening_balance: 2 }),
      tbRow({ account_no: '57000000', dim: 'Zeta', opening_balance: 3 }),
      tbRow({ account_no: '43000000', dim: 'Alpha', opening_balance: 4 }),
    ];
    const folded = foldAggregateRows(rows, 'dim');
    assert.deepEqual(folded.map((r) => [r.account_no, r.dimensionValue]), [
      ['43000000', 'Alpha'],
      ['43000000', 'Zeta'],
      ['57000000', 'Alpha'],
      ['57000000', 'Zeta'],
    ]);
    // The dimension-first order this replaced would have been:
    //   43/Alpha, 57/Alpha, 43/Zeta, 57/Zeta
    assert.notDeepEqual(folded.map((r) => r.dimensionValue), ['Alpha', 'Alpha', 'Zeta', 'Zeta']);
  });

  it('groups every row of one account contiguously (what the account blocks rely on)', () => {
    const rows = [
      tbRow({ account_no: '57000000', dim: 'B', opening_balance: 1 }),
      tbRow({ account_no: '43000000', dim: 'B', opening_balance: 1 }),
      tbRow({ account_no: '57000000', dim: 'A', opening_balance: 1 }),
      tbRow({ account_no: '43000000', dim: 'A', opening_balance: 1 }),
    ];
    const seen = [];
    for (const r of foldAggregateRows(rows, 'dim')) {
      if (seen[seen.length - 1] !== r.account_no) seen.push(r.account_no);
    }
    assert.deepEqual(seen, ['43000000', '57000000'], 'each account must appear as ONE contiguous run');
  });

  it('keeps the blank dimension value ("") as its own row, sorted first within the account', () => {
    const rows = [
      tbRow({ account_no: '35000000', dim: 'Juan Perez', opening_balance: -141413.14, activity_credit: 640.52, closing_balance: -142053.66 }),
      tbRow({ account_no: '35000000', dim: '', opening_balance: 159193.58, closing_balance: 159193.58 }),
    ];
    const folded = foldAggregateRows(rows, 'dim');
    assert.deepEqual(folded.map((r) => r.dimensionValue), ['', 'Juan Perez']);
    assert.equal(folded[0].opening_balance, 159193.58);
  });

  it('sorts by account_no alone when no dimension is active', () => {
    const rows = [
      tbRow({ account_no: '61000000', opening_balance: -1 }),
      tbRow({ account_no: '43000000', opening_balance: -1 }),
      tbRow({ account_no: '57000000', opening_balance: -1 }),
    ];
    assert.deepEqual(foldAggregateRows(rows, null).map((r) => r.account_no),
      ['43000000', '57000000', '61000000']);
  });
});

describe('groupAggregateRowsByAccount (ETP-5013)', () => {
  // Real GO-client data for account 35000000, verified digit-for-digit against
  // a real Classic Trial Balance PDF export.
  const REAL_35000000 = [
    { account_no: '35000000', account_id: 'ACC-35', account_name: 'Productos terminados', dimensionValue: '', opening_balance: 159193.58, activity_debit: 0, activity_credit: 0, closing_balance: 159193.58 },
    { account_no: '35000000', account_id: 'ACC-35', account_name: 'Productos terminados', dimensionValue: 'Blanquiceleste S.A.', opening_balance: -5127.83, activity_debit: 0, activity_credit: 0, closing_balance: -5127.83 },
    { account_no: '35000000', account_id: 'ACC-35', account_name: 'Productos terminados', dimensionValue: 'Juan Perez', opening_balance: -141413.14, activity_debit: 0, activity_credit: 640.52, closing_balance: -142053.66 },
    { account_no: '35000000', account_id: 'ACC-35', account_name: 'Productos terminados', dimensionValue: 'Laura Morat', opening_balance: -3275.78, activity_debit: 0, activity_credit: 0, closing_balance: -3275.78 },
    { account_no: '35000000', account_id: 'ACC-35', account_name: 'Productos terminados', dimensionValue: 'Proveedor Mayorista', opening_balance: 7469.00, activity_debit: 0, activity_credit: 0, closing_balance: 7469.00 },
  ];

  it('emits one block per account carrying its identity fields', () => {
    const [group, ...rest] = groupAggregateRowsByAccount(REAL_35000000);
    assert.equal(rest.length, 0, 'five rows of ONE account must collapse into ONE block');
    assert.equal(group.account_no, '35000000');
    assert.equal(group.account_id, 'ACC-35');
    assert.equal(group.account_name, 'Productos terminados');
  });

  it('nests the dimension breakdown inside, preserving order and the blank-name bucket', () => {
    const [group] = groupAggregateRowsByAccount(REAL_35000000);
    assert.equal(group.dimensionRows.length, 5);
    assert.deepEqual(group.dimensionRows.map((r) => r.dimensionValue),
      ['', 'Blanquiceleste S.A.', 'Juan Perez', 'Laura Morat', 'Proveedor Mayorista']);
    assert.equal(group.dimensionRows[0].dimensionValue, '',
      'the no-dimension bucket is a real row, not merged away and not dropped');
  });

  it('matches the real Classic PDF totals for account 35000000, digit for digit', () => {
    const [group] = groupAggregateRowsByAccount(REAL_35000000);
    assert.ok(Math.abs(group.opening_balance - 16845.83) < 1e-9, `opening_balance was ${group.opening_balance}`);
    assert.equal(group.activity_debit, 0);
    assert.ok(Math.abs(group.activity_credit - 640.52) < 1e-9);
    assert.ok(Math.abs(group.closing_balance - 16205.31) < 1e-9, `closing_balance was ${group.closing_balance}`);
  });

  it('an account\'s totals equal the sum of its dimensionRows, for all four amount fields', () => {
    // The core correctness invariant: the block's closing row is the account's
    // OWN balance. The shape this replaced summed unrelated accounts under one
    // contact, which always netted to ~0 and meant nothing.
    for (const group of groupAggregateRowsByAccount(REAL_35000000)) {
      for (const field of TRIAL_BALANCE_AMOUNT_FIELDS) {
        const expected = group.dimensionRows.reduce((sum, r) => sum + r[field], 0);
        assert.ok(Math.abs(group[field] - expected) < 1e-9, `${field} mismatch`);
      }
    }
  });

  it('gives each account its own block, in the order the folded rows arrive', () => {
    const rows = foldAggregateRows([
      tbRow({ account_no: '57000000', dim: 'B', opening_balance: 2 }),
      tbRow({ account_no: '43000000', dim: 'A', opening_balance: 1 }),
      tbRow({ account_no: '43000000', dim: 'B', opening_balance: 3 }),
    ], 'dim');
    const groups = groupAggregateRowsByAccount(rows);
    assert.deepEqual(groups.map((g) => g.account_no), ['43000000', '57000000']);
    assert.deepEqual(groups.map((g) => g.dimensionRows.length), [2, 1]);
    assert.equal(groups[0].opening_balance, 4);
    assert.equal(groups[1].opening_balance, 2);
  });

  it('returns an empty array for no rows', () => {
    assert.deepEqual(groupAggregateRowsByAccount([]), []);
  });

  it('normalizes a null/undefined dimensionValue to "" rather than leaking it into the template', () => {
    const groups = groupAggregateRowsByAccount([
      { account_no: '1', account_id: 'i', account_name: 'n', dimensionValue: null, opening_balance: 1, activity_debit: 0, activity_credit: 0, closing_balance: 1 },
    ]);
    assert.equal(groups[0].dimensionRows[0].dimensionValue, '');
  });
});
