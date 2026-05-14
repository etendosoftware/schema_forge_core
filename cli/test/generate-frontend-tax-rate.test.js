/**
 * Regression test for renderTaxRate — source-reading (Node test runner).
 *
 * Reads cli/src/generate-frontend.js as a string and asserts that the
 * renderTaxRate template contains all three correct branches introduced in the
 * ETP-3894 fix. Also verifies the old single-branch pattern is gone.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'src', 'generate-frontend.js'), 'utf8');

// Extract the renderTaxRate function body from the source so that assertions
// are scoped to that function and do not accidentally match other helpers.
const taxRateMatch = src.match(/function renderTaxRate\(row\)[\s\S]*?^`\s*: '';/m);
assert.ok(taxRateMatch, 'Could not locate renderTaxRate helper in generate-frontend.js');
const fnSrc = taxRateMatch[0];

describe('generate-frontend.js — renderTaxRate template', () => {
  describe('null guard', () => {
    it("returns '' when val is null", () => {
      assert.match(fnSrc, /if \(val == null\) return '';/);
    });
  });

  describe('positive branch (val > 0)', () => {
    it('uses variant="green"', () => {
      assert.match(fnSrc, /if \(val > 0\).*variant="green"/s);
    });

    it('renders the + prefix: `+${val} %`', () => {
      // The file contains a JS template literal nested inside another template
      // literal, so backticks are escaped. The raw bytes are: label={\`+\${val} %\`}
      // Use includes() to match the literal character sequence without regex escape issues.
      assert.ok(
        fnSrc.includes('label={\\`+\\${val} %\\`}'),
        'green branch should emit label={\\`+\\${val} %\\`}'
      );
    });
  });

  describe('zero branch (val === 0)', () => {
    it('uses variant="neutral"', () => {
      assert.match(fnSrc, /if \(val === 0\).*variant="neutral"/s);
    });

    it('renders fixed label "0 %" (no + prefix)', () => {
      assert.match(fnSrc, /if \(val === 0\).*"0 %"/s);
    });

    it('does NOT render "+0 %" on the zero branch', () => {
      // The zero label must be the literal "0 %" without a leading +
      assert.doesNotMatch(fnSrc, /if \(val === 0\).*\+0 %/s);
    });
  });

  describe('negative branch (fallback)', () => {
    it('uses variant="red"', () => {
      // The red branch is the final return — after the val===0 guard
      assert.match(fnSrc, /return <Tag variant="red"/);
    });

    it('renders `${val} %` without a + prefix on the negative branch', () => {
      // The red tag label is: label={\`\${val} %\`}  (no leading +)
      assert.ok(
        fnSrc.includes('label={\\`\\${val} %\\`}'),
        'red branch should emit label={\\`\\${val} %\\`} (no + prefix)'
      );
      // Confirm the red line itself does not contain a + before \${val}
      // Extract just the red-tag line for a targeted check.
      const redLine = fnSrc.split('\n').find(l => l.includes('variant="red"'));
      assert.ok(redLine, 'red variant line must exist');
      assert.equal(
        redLine.includes('+\\${val}') || redLine.includes('+${val}'),
        false,
        'red branch label must not have a + prefix'
      );
    });
  });

  describe('old buggy pattern is gone', () => {
    it('does not have a single green-only branch without val > 0 guard', () => {
      // The old buggy code had only one rendering path: always green with `+${val} %`.
      // It lacked the val > 0 / val === 0 conditional structure.
      // Verify that the conditional guard `val > 0` is present (fix is applied).
      assert.match(fnSrc, /val > 0/);
      assert.match(fnSrc, /val === 0/);
    });

    it('does not unconditionally emit variant="green" for all non-null values', () => {
      // If the fix were not applied, variant="green" would appear outside any conditional.
      // With the fix, variant="green" only appears inside `if (val > 0)`.
      // We verify that variant="neutral" and variant="red" are also present — proof of
      // the three-branch structure.
      assert.match(fnSrc, /variant="neutral"/);
      assert.match(fnSrc, /variant="red"/);
    });
  });
});
