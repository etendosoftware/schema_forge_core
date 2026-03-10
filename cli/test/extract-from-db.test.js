import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { QUERIES, rowsToCsv } from '../src/extract-from-db.js';

// ---------- QUERIES constant ----------

describe('QUERIES', () => {
  it('exports an object with expected query names', () => {
    const expectedKeys = [
      'fields',
      'callouts',
      'validation-rules',
      'display-logic',
      'document-processes',
      'auxiliary-inputs',
    ];
    for (const key of expectedKeys) {
      assert.ok(
        Object.hasOwn(QUERIES, key),
        `QUERIES should contain key "${key}"`
      );
    }
  });

  it('all query values are non-empty strings', () => {
    for (const [name, sql] of Object.entries(QUERIES)) {
      assert.equal(typeof sql, 'string', `${name} should be a string`);
      assert.ok(sql.trim().length > 0, `${name} should not be empty`);
    }
  });

  it('fields query references core AD tables', () => {
    const sql = QUERIES.fields;
    assert.ok(sql.includes('AD_Field'), 'should reference AD_Field');
    assert.ok(sql.includes('AD_Tab'), 'should reference AD_Tab');
    assert.ok(sql.includes('AD_Window'), 'should reference AD_Window');
    assert.ok(sql.includes('AD_Column'), 'should reference AD_Column');
    assert.ok(sql.includes('AD_Table'), 'should reference AD_Table');
    assert.ok(sql.includes('AD_Reference'), 'should reference AD_Reference');
  });

  it('all queries use parameterized $1 placeholder', () => {
    for (const [name, sql] of Object.entries(QUERIES)) {
      assert.ok(
        sql.includes('$1'),
        `${name} query should use $1 parameter placeholder`
      );
    }
  });

  it('fields query filters on IsActive', () => {
    assert.ok(
      QUERIES.fields.includes("IsActive = 'Y'"),
      'fields query should filter active records'
    );
  });

  it('document-processes query covers all three mechanisms', () => {
    const sql = QUERIES['document-processes'];
    assert.ok(sql.includes("'tab_process'"), 'should include tab_process');
    assert.ok(sql.includes("'classic_process'"), 'should include classic_process');
    assert.ok(sql.includes("'obuiapp_process'"), 'should include obuiapp_process');
    assert.ok(sql.includes('UNION ALL'), 'should use UNION ALL');
  });
});

// ---------- rowsToCsv ----------

describe('rowsToCsv', () => {
  it('returns empty string for empty array', () => {
    assert.equal(rowsToCsv([]), '');
  });

  it('generates header row from object keys', () => {
    const rows = [{ name: 'Alice', age: 30 }];
    const csv = rowsToCsv(rows);
    const lines = csv.split('\n');
    assert.equal(lines[0], 'name,age');
  });

  it('generates data rows correctly', () => {
    const rows = [
      { col1: 'a', col2: 'b' },
      { col1: 'c', col2: 'd' },
    ];
    const csv = rowsToCsv(rows);
    const lines = csv.trim().split('\n');
    assert.equal(lines.length, 3); // header + 2 data rows
    assert.equal(lines[1], 'a,b');
    assert.equal(lines[2], 'c,d');
  });

  it('handles null values as empty strings', () => {
    const rows = [{ a: null, b: 'ok' }];
    const csv = rowsToCsv(rows);
    const lines = csv.trim().split('\n');
    assert.equal(lines[1], ',ok');
  });

  it('handles undefined values as empty strings', () => {
    const rows = [{ a: undefined, b: 'ok' }];
    const csv = rowsToCsv(rows);
    const lines = csv.trim().split('\n');
    assert.equal(lines[1], ',ok');
  });

  it('quotes values containing commas', () => {
    const rows = [{ text: 'hello, world' }];
    const csv = rowsToCsv(rows);
    const lines = csv.trim().split('\n');
    assert.equal(lines[1], '"hello, world"');
  });

  it('quotes values containing double quotes and escapes them', () => {
    const rows = [{ text: 'say "hi"' }];
    const csv = rowsToCsv(rows);
    const lines = csv.trim().split('\n');
    assert.equal(lines[1], '"say ""hi"""');
  });

  it('quotes values containing newlines', () => {
    const rows = [{ text: 'line1\nline2' }];
    const csv = rowsToCsv(rows);
    // The output should contain the quoted value
    assert.ok(csv.includes('"line1\nline2"'));
  });

  it('converts numeric values to strings', () => {
    const rows = [{ num: 42, bool: true }];
    const csv = rowsToCsv(rows);
    const lines = csv.trim().split('\n');
    assert.equal(lines[1], '42,true');
  });

  it('ends with a trailing newline', () => {
    const rows = [{ a: '1' }];
    const csv = rowsToCsv(rows);
    assert.ok(csv.endsWith('\n'), 'CSV should end with newline');
  });
});
