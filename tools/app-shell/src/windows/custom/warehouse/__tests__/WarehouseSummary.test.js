import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'WarehouseSummary.jsx'), 'utf8');

describe('WarehouseSummary — Y-axis formatting', () => {
  it('imports niceScale and formatDashboardAxisTick from the shared lib', () => {
    assert.match(src, /import.*niceScale.*formatDashboardAxisTick.*from.*@\/lib\/dashboardNumberFormat/);
  });

  it('does not define a local fmtY function', () => {
    assert.doesNotMatch(src, /function fmtY/);
  });

  it('does not call fmtY anywhere', () => {
    assert.doesNotMatch(src, /fmtY\(/);
  });

  it('uses niceScale to compute line chart ticks', () => {
    assert.match(src, /niceScale\(maxVal\)/);
  });

  it('uses niceScale to compute bar chart ticks', () => {
    assert.match(src, /niceScale\(barMaxVal\)/);
  });

  it('uses formatDashboardAxisTick for line chart Y-axis labels', () => {
    assert.match(src, /formatDashboardAxisTick\(val\)/);
  });
});

describe('WarehouseSummary — i18n', () => {
  it('uses i18n key for line chart aria-label', () => {
    assert.match(src, /aria-label=\{ui\('warehouseStockTrend'\)\}/);
  });

  it('uses i18n key for bar chart aria-label', () => {
    assert.match(src, /aria-label=\{ui\('warehouseStockBarAria'\)\}/);
  });

  it('uses i18n keys for toolbar button titles', () => {
    assert.match(src, /title=\{ui\('warehouseLineChart'\)\}/);
    assert.match(src, /title=\{ui\('warehouseBarChart'\)\}/);
    assert.match(src, /title=\{ui\('warehouseExpandChart'\)\}/);
  });

  it('does not hardcode Line chart, Bar chart or Expand chart strings', () => {
    assert.doesNotMatch(src, /"Line chart"/);
    assert.doesNotMatch(src, /"Bar chart"/);
    assert.doesNotMatch(src, /"Expand chart"/);
    assert.doesNotMatch(src, /"Stock trend"/);
    assert.doesNotMatch(src, /"Stock bar chart"/);
  });
});

describe('WarehouseSummary — line chart dots', () => {
  it('circles are transparent by default (no permanent dots)', () => {
    assert.match(src, /fill.*transparent/);
  });

  it('circles show stroke only when hovered', () => {
    assert.match(src, /stroke.*hovered.*i === i.*#10b981.*none/s);
  });
});

describe('WarehouseSummary — bar chart tooltip', () => {
  it('passes ui prop to SvgTooltip in the bar chart branch', () => {
    const barSection = src.slice(src.indexOf("ui('warehouseStockBarAria')"));
    assert.match(barSection, /SvgTooltip[^/]*ui=\{ui\}/);
  });
});
