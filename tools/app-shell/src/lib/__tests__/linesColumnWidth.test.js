import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { columnFlex, columnMinWidthPx } from '../linesColumnWidth.js';

// Helper — extract the flex-basis px from a CSS flex shorthand like "0 0 160px"
function basis(flex) {
  const m = flex.match(/(\d+)px$/);
  return m ? parseInt(m[1], 10) : null;
}

describe('linesColumnWidth', () => {
  describe('columnFlex', () => {
    it('returns a CSS flex string', () => {
      const f = columnFlex({ type: 'string' }, 1);
      assert.match(f, /^\d+ \d+ \d+px$/);
    });

    it('amount columns → 0 0 160px (fixed width)', () => {
      assert.equal(columnFlex({ type: 'amount' }, 0), '0 0 160px');
      assert.equal(columnFlex({ type: 'amount' }, 1), '0 0 160px');
    });

    it('price columns → 0 0 140px', () => {
      assert.equal(columnFlex({ type: 'price' }, 1), '0 0 140px');
    });

    it('quantity/integer columns → 0 0 90px', () => {
      assert.equal(columnFlex({ type: 'quantity' }, 1), '0 0 90px');
      assert.equal(columnFlex({ type: 'integer' }, 1), '0 0 90px');
    });

    it('decimal/percent columns → 0 0 100px', () => {
      assert.equal(columnFlex({ type: 'decimal' }, 1), '0 0 100px');
      assert.equal(columnFlex({ type: 'percent' }, 1), '0 0 100px');
    });

    it('first column (idx=0) gets 1 1 180px regardless of type', () => {
      assert.equal(columnFlex({ type: 'string' }, 0), '1 1 180px');
      assert.equal(columnFlex({ type: 'selector' }, 0), '1 1 180px');
    });

    it('string/text at non-zero idx → 2 1 180px (double grow)', () => {
      assert.equal(columnFlex({ type: 'string' }, 1), '2 1 180px');
      assert.equal(columnFlex({ type: 'text' }, 2), '2 1 180px');
    });

    it('selector/search/foreignKey columns → 1 1 160px', () => {
      assert.equal(columnFlex({ type: 'selector' }, 1), '1 1 160px');
      assert.equal(columnFlex({ type: 'search' }, 1), '1 1 160px');
      assert.equal(columnFlex({ type: 'foreignKey' }, 1), '1 1 160px');
    });

    it('enum/select columns → 1 1 220px (wider for option labels)', () => {
      assert.equal(columnFlex({ type: 'enum' }, 1), '1 1 220px');
      assert.equal(columnFlex({ type: 'select' }, 1), '1 1 220px');
    });

    it('date columns → 1 1 130px', () => {
      assert.equal(columnFlex({ type: 'date' }, 1), '1 1 130px');
    });

    it('unknown types → 0 0 120px (safe fallback)', () => {
      assert.equal(columnFlex({ type: 'custom' }, 1), '0 0 120px');
      assert.equal(columnFlex({}, 1), '0 0 120px');
    });
  });

  describe('columnMinWidthPx', () => {
    it('returns an integer (number, not string)', () => {
      const v = columnMinWidthPx({ type: 'amount' }, 0);
      assert.equal(typeof v, 'number');
      assert.equal(Math.floor(v), v);
    });

    it('matches the flex-basis of columnFlex for every type', () => {
      const CASES = [
        [{ type: 'amount' }, 1, 160],
        [{ type: 'price' }, 1, 140],
        [{ type: 'quantity' }, 1, 90],
        [{ type: 'integer' }, 1, 90],
        [{ type: 'decimal' }, 1, 100],
        [{ type: 'percent' }, 1, 100],
        [{ type: 'selector' }, 1, 160],
        [{ type: 'search' }, 1, 160],
        [{ type: 'foreignKey' }, 1, 160],
        [{ type: 'enum' }, 1, 220],
        [{ type: 'select' }, 1, 220],
        [{ type: 'date' }, 1, 130],
        [{ type: 'string' }, 0, 180],  // first col
        [{ type: 'string' }, 1, 180],
        [{ type: 'text' }, 1, 180],
        [{ type: 'custom' }, 1, 120],
      ];
      for (const [col, idx, expected] of CASES) {
        const px = columnMinWidthPx(col, idx);
        assert.equal(px, expected, `type=${col.type} idx=${idx}: expected ${expected}, got ${px}`);
        const flexBasis = basis(columnFlex(col, idx));
        assert.equal(px, flexBasis, `px and flex-basis must match for type=${col.type} idx=${idx}`);
      }
    });
  });
});
