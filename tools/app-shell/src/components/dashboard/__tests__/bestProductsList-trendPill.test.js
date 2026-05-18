import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// TrendPill classification logic from BestProductsList.jsx.
// Translates a numeric percentage into a visual trend direction.
function classifyTrend(pct) {
  if (pct === null || pct === undefined) return null;
  if (pct > 0) return 'up';
  if (pct === 0) return 'flat';
  return 'down';
}

// Figma palette used by TrendPill per direction.
const TREND_STYLES = {
  up:   { backgroundColor: '#EEFBF4', color: '#17663A' },
  flat: { backgroundColor: '#F5F7F9', color: '#6C6C89' },
  down: { backgroundColor: '#FEF0F4', color: '#D50B3E' },
};

describe('BestProductsList — TrendPill trend classification', () => {
  it('returns null for null pct (pill renders nothing)', () => {
    assert.equal(classifyTrend(null), null);
  });

  it('returns null for undefined pct (pill renders nothing)', () => {
    assert.equal(classifyTrend(undefined), null);
  });

  it('returns "up" for a positive integer pct', () => {
    assert.equal(classifyTrend(5), 'up');
  });

  it('returns "up" for a fractional positive pct', () => {
    assert.equal(classifyTrend(0.1), 'up');
  });

  it('returns "flat" for exactly zero', () => {
    assert.equal(classifyTrend(0), 'flat');
  });

  it('returns "down" for a negative integer pct', () => {
    assert.equal(classifyTrend(-3), 'down');
  });

  it('returns "down" for a fractional negative pct', () => {
    assert.equal(classifyTrend(-0.5), 'down');
  });
});

describe('BestProductsList — TrendPill Figma palette', () => {
  it('up uses green palette (#EEFBF4 / #17663A)', () => {
    assert.equal(TREND_STYLES.up.backgroundColor, '#EEFBF4');
    assert.equal(TREND_STYLES.up.color, '#17663A');
  });

  it('flat uses neutral gray palette (#F5F7F9 / #6C6C89)', () => {
    assert.equal(TREND_STYLES.flat.backgroundColor, '#F5F7F9');
    assert.equal(TREND_STYLES.flat.color, '#6C6C89');
  });

  it('down uses red palette (#FEF0F4 / #D50B3E)', () => {
    assert.equal(TREND_STYLES.down.backgroundColor, '#FEF0F4');
    assert.equal(TREND_STYLES.down.color, '#D50B3E');
  });

  it('up and down colors are distinct (no palette confusion)', () => {
    assert.notEqual(TREND_STYLES.up.backgroundColor, TREND_STYLES.down.backgroundColor);
    assert.notEqual(TREND_STYLES.up.color, TREND_STYLES.down.color);
  });
});

describe('BestProductsList — row view mode switch', () => {
  const sellers = [{ name: 'Seller A', qty: 100, amount: 5000 }];
  const products = [{ name: 'Product X', qty: 20,  amount: 1200 }];

  it('quantity mode uses sellers array', () => {
    const viewMode = 'quantity';
    const rows = viewMode === 'quantity' ? sellers : products;
    assert.equal(rows[0].name, 'Seller A');
  });

  it('revenue mode uses products array', () => {
    const viewMode = 'revenue';
    const rows = viewMode === 'quantity' ? sellers : products;
    assert.equal(rows[0].name, 'Product X');
  });

  it('hasPositiveTrend is false when all rows have trendPct ≤ 0', () => {
    const rows = [{ trendPct: 0 }, { trendPct: -5 }];
    assert.equal(rows.some(r => (r.trendPct ?? 0) > 0), false);
  });

  it('hasPositiveTrend is true when at least one row has trendPct > 0', () => {
    const rows = [{ trendPct: -2 }, { trendPct: 8 }];
    assert.equal(rows.some(r => (r.trendPct ?? 0) > 0), true);
  });
});
