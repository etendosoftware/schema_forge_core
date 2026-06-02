import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(
  join(__dirname, '../../../../../../../artifacts/assets/generated/web/assets/AssetsTable.jsx'),
  'utf8',
);

describe('AssetsTable — renderDepreciationProgress', () => {
  it('uses only depreciationAmt as denominator (not depreciatedPlan)', () => {
    // depreciationAmt must be the sole denominator so the progress bar is consistent
    // with the DB trigger: depreciatedValue >= amortizationValueAmt.
    // depreciatedPlan was previously used as denominator, causing false 100% when
    // depreciatedValue > depreciatedPlan (e.g. 750/250 = 300% → capped to 100%).
    assert.match(src, /depreciationAmt > 0/);
    assert.doesNotMatch(src, /depreciatedPlan > 0 \? depreciatedPlan/);
  });

  it('does not read depreciatedPlan from the row', () => {
    assert.doesNotMatch(src, /row\.depreciatedPlan/);
  });

  it('renders 100% in green only when depreciatedValue >= depreciationAmt', () => {
    // Color logic: green (#10b981) only at 100%
    assert.match(src, /pct === 100.*#10b981/);
  });
});

describe('AssetsTable — fullyDepreciated column', () => {
  it('has filterable omitted (defaults to true) after enabling the filter', () => {
    // filterable: false was removed — the field now appears in the Advanced Filter.
    assert.doesNotMatch(src, /fullyDepreciated.*filterable: false/);
  });

  it('uses multilingual badgeLabels objects', () => {
    assert.match(src, /es_ES.*Totalmente depreciado/);
    assert.match(src, /en_US.*Fully depreciated/);
  });
});
