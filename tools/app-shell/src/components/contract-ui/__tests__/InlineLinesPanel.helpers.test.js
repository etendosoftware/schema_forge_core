import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(
  new URL('../InlineLinesPanel.jsx', import.meta.url),
  'utf8',
);

// ETP-4005 — InlineLinesPanel introduced two internal helpers to lower the
// cognitive complexity of commitField and EditCell, plus a min-value
// validation path. These helpers are not exported, so behavior is checked
// against the source text.

describe('InlineLinesPanel helpers (ETP-4005)', () => {
  describe('editInputClassName', () => {
    it('is declared as an internal helper', () => {
      assert.match(src, /function editInputClassName\(isNumeric, isInvalid\)/);
    });

    it('returns the red-border class when the cell is invalid', () => {
      assert.match(src, /isInvalid\s*\?\s*'border-red-500 focus-visible:ring-red-500'/);
    });

    it('returns the default border class when the cell is valid', () => {
      assert.match(src, /:\s*'border-input'/);
    });

    it('adds right-aligned tabular-nums for numeric cells', () => {
      assert.match(src, /isNumeric\s*\?\s*' text-right tabular-nums'/);
    });
  });

  describe('isValueBelowMin', () => {
    it('is declared as an internal helper', () => {
      assert.match(src, /function isValueBelowMin\(col, value\)/);
    });

    it('short-circuits when col.min is undefined or value is empty', () => {
      assert.match(src, /col\.min === undefined \|\| value === '' \|\| value == null/);
    });

    it('parses the value with parseFloat before comparing', () => {
      assert.match(src, /parseFloat\(value\)/);
    });

    it('compares the parsed number against col.min', () => {
      assert.match(src, /num < col\.min/);
    });
  });

  describe('commit-time min-value enforcement', () => {
    it('fires the fieldMinValueError toast when a value violates the min rule', () => {
      assert.match(src, /toast\.error\(ui\('fieldMinValueError'\)\)/);
    });

    it('flags the cell via setInvalidCell with the offending rowId and colKey', () => {
      assert.match(src, /setInvalidCell\(\{\s*rowId: row\.id, colKey: col\.key\s*\}\)/);
    });

    it('keeps edit mode open by setting hasValidationErrorRef.current = true', () => {
      assert.match(src, /hasValidationErrorRef\.current = true/);
    });

    it('uses editInputClassName for the edit-cell className', () => {
      assert.match(src, /className=\{editInputClassName\(isNumeric, isInvalid\)\}/);
    });
  });
});
