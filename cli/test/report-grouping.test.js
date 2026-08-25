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

  it('builds tbGroups when a dimension is chosen on a foldable report', () => {
    const rows = [
      { account_value: '100', bpartnerName: 'A', opening_balance: 1, activity_debit: 2, activity_credit: 0, closing_balance: 3 },
      { account_value: '100', bpartnerName: 'A', opening_balance: 1, activity_debit: 4, activity_credit: 0, closing_balance: 5 },
    ];
    const out = resolveGrouping(DIMENSION_CONTRACT, { groupBy: 'bp' }, rows);
    assert.ok(Array.isArray(out.tbGroups), 'tbGroups must be built when a dimension is active');
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
