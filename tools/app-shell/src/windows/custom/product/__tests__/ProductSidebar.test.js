import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'ProductSidebar.jsx'), 'utf8');

describe('ProductSidebar — Y-axis formatting', () => {
  it('imports formatDashboardAxisTick from the shared lib', () => {
    assert.match(src, /import.*formatDashboardAxisTick.*from.*@\/lib\/dashboardNumberFormat/);
  });

  it('does not define a local formatCompact function', () => {
    assert.doesNotMatch(src, /function formatCompact/);
  });

  it('uses formatDashboardAxisTick for the Y-axis labels', () => {
    assert.match(src, /formatDashboardAxisTick\(maxVal\)/);
    assert.match(src, /formatDashboardAxisTick\(Math\.round\(/);
  });

  it('does not call formatCompact anywhere', () => {
    assert.doesNotMatch(src, /formatCompact\(/);
  });
});
