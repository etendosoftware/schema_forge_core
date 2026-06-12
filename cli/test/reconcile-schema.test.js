import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { formatDiffSummary } from '../src/reconcile-schema.js';

// We test the pure functions. reconcileSchema itself requires file I/O
// and migration imports, which are tested via integration.

describe('reconcile-schema', () => {
  describe('formatDiffSummary — decisions mode', () => {
    it('returns clean message when no diff', () => {
      const diff = { mode: 'decisions', hasDiff: false, entities: { unclassified: [], orphaned: [] } };
      const result = formatDiffSummary(diff);
      assert.ok(result.includes('No unclassified fields'));
    });

    it('lists unclassified fields', () => {
      const diff = {
        mode: 'decisions',
        hasDiff: true,
        entities: {
          unclassified: [
            {
              entityKey: 'c_order',
              tableName: 'C_Order',
              tabName: 'Header',
              fields: [
                { fieldName: 'newField', columnName: 'NewField' },
                { fieldName: 'anotherField', columnName: 'AnotherField' },
              ],
            },
          ],
          orphaned: [],
        },
      };
      const result = formatDiffSummary(diff);
      assert.ok(result.includes('UNCLASSIFIED'));
      assert.ok(result.includes('Header'));
      assert.ok(result.includes('newField'));
      assert.ok(result.includes('anotherField'));
      assert.ok(result.includes('2 field(s) need decisions'));
    });

    it('lists orphaned decisions', () => {
      const diff = {
        mode: 'decisions',
        hasDiff: true,
        entities: {
          unclassified: [],
          orphaned: [
            { entityKey: 'c_order', fieldName: 'removedField' },
          ],
        },
      };
      const result = formatDiffSummary(diff);
      assert.ok(result.includes('ORPHANED'));
      assert.ok(result.includes('c_order.removedField'));
      assert.ok(result.includes('1 orphaned decision(s)'));
    });

    it('shows both unclassified and orphaned', () => {
      const diff = {
        mode: 'decisions',
        hasDiff: true,
        entities: {
          unclassified: [{
            entityKey: 'e1',
            tableName: 'T1',
            tabName: 'Tab1',
            fields: [{ fieldName: 'f1', columnName: 'F1' }],
          }],
          orphaned: [{ entityKey: 'e2', fieldName: 'f2' }],
        },
      };
      const result = formatDiffSummary(diff);
      assert.ok(result.includes('UNCLASSIFIED'));
      assert.ok(result.includes('ORPHANED'));
    });
  });

  describe('formatDiffSummary — curated mode', () => {
    it('returns clean message when no diff', () => {
      const diff = {
        mode: 'curated',
        hasDiff: false,
        entities: { added: [], removed: [], changed: [] },
      };
      const result = formatDiffSummary(diff);
      assert.ok(result.includes('No structural changes'));
    });

    it('lists added entities', () => {
      const diff = {
        mode: 'curated',
        hasDiff: true,
        entities: {
          added: [{ tabName: 'NewTab', tableName: 'NEW_TABLE', fieldCount: 5, fields: [] }],
          removed: [],
          changed: [],
        },
      };
      const result = formatDiffSummary(diff);
      assert.ok(result.includes('NEW entities'));
      assert.ok(result.includes('NewTab'));
      assert.ok(result.includes('5 fields'));
    });

    it('lists removed entities', () => {
      const diff = {
        mode: 'curated',
        hasDiff: true,
        entities: {
          added: [],
          removed: [{ tabName: 'OldTab', tableName: 'OLD_TABLE', fieldCount: 3 }],
          changed: [],
        },
      };
      const result = formatDiffSummary(diff);
      assert.ok(result.includes('ORPHANED entities'));
      assert.ok(result.includes('OldTab'));
    });

    it('lists changed entities with added and removed fields', () => {
      const diff = {
        mode: 'curated',
        hasDiff: true,
        entities: {
          added: [],
          removed: [],
          changed: [{
            entityKey: 'c_order',
            tableName: 'C_Order',
            tabName: 'Header',
            fields: {
              added: [{ columnName: 'NewCol' }],
              removed: [{ columnName: 'OldCol' }],
              unchanged: 10,
            },
          }],
        },
      };
      const result = formatDiffSummary(diff);
      assert.ok(result.includes('CHANGED'));
      assert.ok(result.includes('1 new field'));
      assert.ok(result.includes('1 orphaned field'));
      assert.ok(result.includes('10 field(s) unchanged'));
    });

    it('computes summary totals across entities', () => {
      const diff = {
        mode: 'curated',
        hasDiff: true,
        entities: {
          added: [{ tabName: 'A', tableName: 'A', fieldCount: 3, fields: [] }],
          removed: [{ tabName: 'B', tableName: 'B', fieldCount: 2 }],
          changed: [{
            entityKey: 'c',
            tableName: 'C',
            tabName: 'C',
            fields: { added: [{ columnName: 'X' }], removed: [], unchanged: 5 },
          }],
        },
      };
      const result = formatDiffSummary(diff);
      // 3 from added entity + 1 from changed = 4 to classify
      assert.ok(result.includes('4 field(s) to classify'));
      // 2 from removed entity = 2 orphaned
      assert.ok(result.includes('2 orphaned field(s)'));
    });
  });
});
