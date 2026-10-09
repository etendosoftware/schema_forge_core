// @covers packages/app-shell-core/src/lib/import/importSummary.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { countColumns, countAutoResolvedFks, countResults } from '../importSummary.js';

describe('importSummary', () => {
  it('counts columns in the file, auto-mapped and manually mapped', () => {
    const headers = ['Code', 'Name', 'Extra', 'Other'];
    const auto = { Code: 'searchKey', Name: 'name', Extra: null, Other: null };
    const mapping = { Code: 'searchKey', Name: 'description', Extra: 'uom', Other: null };
    assert.deepEqual(countColumns(headers, auto, mapping), {
      columnsInFile: 4, columnsAutoMapped: 2, columnsManuallyMapped: 2,
    });
  });

  it('copes with missing inputs', () => {
    assert.deepEqual(countColumns(undefined, undefined, undefined), {
      columnsInFile: 0, columnsAutoMapped: 0, columnsManuallyMapped: 0,
    });
  });

  it('counts only auto-resolved foreign-key values', () => {
    const fk = new Map([
      ['uom', new Map([['Kilo', { status: 'auto-resolved' }], ['Foo', { status: 'needs-review' }]])],
      ['category', new Map([['A', { status: 'auto-resolved' }]])],
    ]);
    assert.equal(countAutoResolvedFks(fk), 2);
    assert.equal(countAutoResolvedFks(undefined), 0);
  });

  it('counts row outcomes by status and returns quantities only', () => {
    const results = [
      { status: 'ok', row: { name: 'secret' } }, { status: 'ok' }, { status: 'failed' },
      { status: 'duplicate' }, { status: 'unknown' }, { status: 'ok' },
    ];
    const counts = countResults(results);
    assert.deepEqual(counts, { rowsTotal: 6, rowsCreated: 3, rowsFailed: 1, rowsDuplicate: 1, rowsUnknown: 1 });
    assert.ok(Object.values(counts).every((v) => typeof v === 'number'));
  });
});
