import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeRows } from '../dedupeRows.js';

describe('dedupeRows', () => {
  it('keeps rows whose key is unique', () => {
    const rows = [{ email: 'a@x.com' }, { email: 'b@x.com' }];
    const { uniqueRows, duplicates } = dedupeRows(rows, ['email']);
    assert.equal(uniqueRows.length, 2);
    assert.equal(duplicates.length, 0);
  });

  it('collapses rows sharing the same key, keeping the first occurrence', () => {
    const rows = [{ email: 'a@x.com', name: 'First' }, { email: 'a@x.com', name: 'Second' }];
    const { uniqueRows, duplicates } = dedupeRows(rows, ['email']);
    assert.equal(uniqueRows.length, 1);
    assert.equal(uniqueRows[0].name, 'First');
    assert.equal(duplicates.length, 1);
    assert.equal(duplicates[0].row.name, 'Second');
    assert.equal(duplicates[0].duplicateOfIndex, 0);
  });

  it('matches the key case-insensitively and trims whitespace', () => {
    const rows = [{ email: 'A@X.com' }, { email: ' a@x.com ' }];
    const { uniqueRows, duplicates } = dedupeRows(rows, ['email']);
    assert.equal(uniqueRows.length, 1);
    assert.equal(duplicates.length, 1);
  });

  it('builds a composite key from multiple targets', () => {
    const rows = [
      { name: 'Lucia', company: 'Acme' },
      { name: 'Lucia', company: 'Other' },
    ];
    const { uniqueRows } = dedupeRows(rows, ['name', 'company']);
    assert.equal(uniqueRows.length, 2);
  });

  it('never treats rows with a blank key as duplicates of each other', () => {
    const rows = [{ email: '' }, { email: '' }, { email: '  ' }];
    const { uniqueRows, duplicates } = dedupeRows(rows, ['email']);
    assert.equal(uniqueRows.length, 3);
    assert.equal(duplicates.length, 0);
  });

  it('reports duplicateOfIndex pointing at the position in uniqueRows', () => {
    const rows = [
      { email: 'a@x.com' },
      { email: 'b@x.com' },
      { email: 'a@x.com' },
      { email: 'b@x.com' },
    ];
    const { uniqueRows, duplicates } = dedupeRows(rows, ['email']);
    assert.equal(uniqueRows.length, 2);
    assert.equal(duplicates[0].duplicateOfIndex, 0); // duplicate of a@x.com, at uniqueRows[0]
    assert.equal(duplicates[1].duplicateOfIndex, 1); // duplicate of b@x.com, at uniqueRows[1]
  });
});
