import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { detectDiscardPatterns } from '../src/migrate-to-decisions.js';

// We test the exported function + replicate the pure internal helpers.

function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

function visibilityDefaultsForMigration(visibility) {
  switch (visibility) {
    case 'editable':
    case 'readOnly':
      return { grid: false, form: true, searchable: false };
    default:
      return { grid: false, form: false, searchable: false };
  }
}

function buildColumnMap(rawEntity) {
  const map = {};
  for (const f of (rawEntity?.fields || [])) {
    if (!map[f.columnName]) map[f.columnName] = [];
    map[f.columnName].push(f);
  }
  return map;
}

function findRawFieldByColumn(columnMap, columnName, curatedVisibility) {
  const candidates = columnMap[columnName];
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const exact = candidates.find(f => f.visibility === curatedVisibility);
  if (exact) return exact;
  if (curatedVisibility !== 'system' && curatedVisibility !== 'discarded') {
    const nonSystem = candidates.find(f => f.visibility !== 'system' && f.visibility !== 'discarded');
    if (nonSystem) return nonSystem;
  }
  return candidates[0];
}

function buildDefaultFieldMap(defaultEntity) {
  const map = {};
  for (const f of (defaultEntity?.fields || [])) {
    map[f.name] = f;
  }
  return map;
}

describe('migrate-to-decisions', () => {
  describe('deepEqual', () => {
    it('equal primitives', () => {
      assert.ok(deepEqual(1, 1));
      assert.ok(deepEqual('a', 'a'));
      assert.ok(deepEqual(null, null));
      assert.ok(deepEqual(true, true));
    });

    it('unequal primitives', () => {
      assert.ok(!deepEqual(1, 2));
      assert.ok(!deepEqual('a', 'b'));
      assert.ok(!deepEqual(null, 'a'));
      assert.ok(!deepEqual(1, '1'));
    });

    it('equal objects', () => {
      assert.ok(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 }));
    });

    it('unequal objects', () => {
      assert.ok(!deepEqual({ a: 1 }, { a: 2 }));
      assert.ok(!deepEqual({ a: 1 }, { a: 1, b: 2 }));
    });

    it('nested objects', () => {
      assert.ok(deepEqual({ a: { b: 1 } }, { a: { b: 1 } }));
      assert.ok(!deepEqual({ a: { b: 1 } }, { a: { b: 2 } }));
    });

    it('null vs object', () => {
      assert.ok(!deepEqual(null, {}));
      assert.ok(!deepEqual({}, null));
    });
  });

  describe('visibilityDefaultsForMigration', () => {
    it('editable → form: true', () => {
      const d = visibilityDefaultsForMigration('editable');
      assert.equal(d.form, true);
      assert.equal(d.grid, false);
      assert.equal(d.searchable, false);
    });

    it('readOnly → form: true', () => {
      assert.equal(visibilityDefaultsForMigration('readOnly').form, true);
    });

    it('system → form: false', () => {
      assert.equal(visibilityDefaultsForMigration('system').form, false);
    });

    it('discarded → form: false', () => {
      assert.equal(visibilityDefaultsForMigration('discarded').form, false);
    });
  });

  describe('buildColumnMap', () => {
    it('groups fields by columnName', () => {
      const entity = { fields: [
        { columnName: 'Name', visibility: 'editable' },
        { columnName: 'Name', visibility: 'system' },
        { columnName: 'Amount', visibility: 'editable' },
      ]};
      const map = buildColumnMap(entity);
      assert.equal(map['Name'].length, 2);
      assert.equal(map['Amount'].length, 1);
    });

    it('handles null entity', () => {
      const map = buildColumnMap(null);
      assert.deepEqual(map, {});
    });

    it('handles entity with no fields', () => {
      assert.deepEqual(buildColumnMap({ fields: [] }), {});
    });
  });

  describe('findRawFieldByColumn', () => {
    const map = {
      Name: [
        { columnName: 'Name', visibility: 'editable' },
        { columnName: 'Name', visibility: 'system' },
      ],
      Single: [{ columnName: 'Single', visibility: 'readOnly' }],
    };

    it('returns single candidate directly', () => {
      const f = findRawFieldByColumn(map, 'Single', 'readOnly');
      assert.equal(f.visibility, 'readOnly');
    });

    it('prefers exact visibility match', () => {
      const f = findRawFieldByColumn(map, 'Name', 'system');
      assert.equal(f.visibility, 'system');
    });

    it('prefers non-system when curated is visible', () => {
      const f = findRawFieldByColumn(map, 'Name', 'readOnly');
      assert.equal(f.visibility, 'editable');
    });

    it('returns null for missing column', () => {
      assert.equal(findRawFieldByColumn(map, 'Missing', 'editable'), null);
    });

    it('returns first candidate as last resort', () => {
      const dupes = { X: [{ visibility: 'system' }, { visibility: 'discarded' }] };
      const f = findRawFieldByColumn(dupes, 'X', 'system');
      assert.equal(f.visibility, 'system');
    });
  });

  describe('buildDefaultFieldMap', () => {
    it('maps fields by name', () => {
      const entity = { fields: [{ name: 'qty' }, { name: 'price' }] };
      const map = buildDefaultFieldMap(entity);
      assert.ok(map.qty);
      assert.ok(map.price);
    });

    it('handles null entity', () => {
      assert.deepEqual(buildDefaultFieldMap(null), {});
    });
  });

  describe('detectDiscardPatterns', () => {
    it('detects EM_* pattern', () => {
      const entities = [{
        fields: [
          { visibility: 'discarded', column: 'EM_Custom_Col' },
          { visibility: 'editable', column: 'Name' },
        ],
      }];
      const patterns = detectDiscardPatterns(entities);
      assert.ok(patterns.includes('EM_*'));
    });

    it('detects CopyFrom* pattern', () => {
      const entities = [{
        fields: [{ visibility: 'discarded', column: 'CopyFromPO' }],
      }];
      assert.ok(detectDiscardPatterns(entities).includes('CopyFrom*'));
    });

    it('detects lowercase copyFrom', () => {
      const entities = [{
        fields: [{ visibility: 'discarded', column: 'copyFromOrder' }],
      }];
      assert.ok(detectDiscardPatterns(entities).includes('CopyFrom*'));
    });

    it('ignores non-discarded fields', () => {
      const entities = [{
        fields: [{ visibility: 'editable', column: 'EM_ShouldNotMatch' }],
      }];
      assert.deepEqual(detectDiscardPatterns(entities), []);
    });

    it('returns sorted unique patterns', () => {
      const entities = [{
        fields: [
          { visibility: 'discarded', column: 'EM_A' },
          { visibility: 'discarded', column: 'EM_B' },
          { visibility: 'discarded', column: 'CopyFromX' },
        ],
      }];
      const patterns = detectDiscardPatterns(entities);
      assert.deepEqual(patterns, ['CopyFrom*', 'EM_*']);
    });

    it('returns empty for no discarded fields', () => {
      assert.deepEqual(detectDiscardPatterns([{ fields: [] }]), []);
    });

    it('detects patterns across multiple entities', () => {
      const entities = [
        { fields: [{ visibility: 'discarded', column: 'EM_Ext1' }] },
        { fields: [{ visibility: 'discarded', column: 'CopyFromInvoice' }] },
        { fields: [{ visibility: 'discarded', column: 'EM_Ext2' }] },
      ];
      const patterns = detectDiscardPatterns(entities);
      assert.deepEqual(patterns, ['CopyFrom*', 'EM_*']);
    });

    it('handles mixed patterns and non-pattern discarded fields', () => {
      const entities = [{
        fields: [
          { visibility: 'discarded', column: 'EM_Custom' },
          { visibility: 'discarded', column: 'SomeOtherField' },
          { visibility: 'discarded', column: 'CopyFromPO' },
        ],
      }];
      const patterns = detectDiscardPatterns(entities);
      // SomeOtherField does not match any known pattern
      assert.deepEqual(patterns, ['CopyFrom*', 'EM_*']);
    });

    it('handles entity with undefined fields', () => {
      const entities = [{ fields: undefined }];
      assert.deepEqual(detectDiscardPatterns(entities), []);
    });

    it('handles empty entities array', () => {
      assert.deepEqual(detectDiscardPatterns([]), []);
    });

    it('does not duplicate patterns when multiple EM_ fields exist', () => {
      const entities = [{
        fields: [
          { visibility: 'discarded', column: 'EM_A' },
          { visibility: 'discarded', column: 'EM_B' },
          { visibility: 'discarded', column: 'EM_C' },
        ],
      }];
      const patterns = detectDiscardPatterns(entities);
      assert.deepEqual(patterns, ['EM_*']);
    });

    it('case-insensitive EM_ detection (lowercase em_)', () => {
      const entities = [{
        fields: [{ visibility: 'discarded', column: 'em_lowercase' }],
      }];
      const patterns = detectDiscardPatterns(entities);
      assert.ok(patterns.includes('EM_*'));
    });

    it('handles fields with empty column string', () => {
      const entities = [{
        fields: [{ visibility: 'discarded', column: '' }],
      }];
      const patterns = detectDiscardPatterns(entities);
      assert.deepEqual(patterns, []);
    });
  });

  describe('findRawFieldByColumn edge cases', () => {
    it('returns first candidate when curated is system and no exact match', () => {
      const map = {
        Col: [
          { columnName: 'Col', visibility: 'editable' },
          { columnName: 'Col', visibility: 'readOnly' },
        ],
      };
      // system curated: exact match not found, and system curated does not
      // trigger the non-system fallback, so first candidate wins
      const f = findRawFieldByColumn(map, 'Col', 'discarded');
      assert.equal(f.visibility, 'editable');
    });

    it('returns null for empty candidates array', () => {
      const map = { Col: [] };
      assert.equal(findRawFieldByColumn(map, 'Col', 'editable'), null);
    });
  });
});
