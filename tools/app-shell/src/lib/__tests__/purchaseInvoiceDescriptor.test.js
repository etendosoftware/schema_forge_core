import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The descriptor itself imports from `@/lib/simSearch` which only resolves
// under Vite. We therefore exercise it via:
//   1. Source-level assertions (regex matches against the file text), and
//   2. Logic-level tests against inlined copies of the pure helpers
//      (mirrors the pattern in useBulkActionToast.test.js).

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(
  join(__dirname, '..', '..', 'components', 'copilot', 'ocr', 'ingest', 'purchaseInvoiceDescriptor.js'),
  'utf8',
);

// Inlined copies of the pure helpers we want to test directly.
function nonBlank(value) {
  return value != null && String(value).trim() !== '';
}

function toIsoDate(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!m) return trimmed;
  const day = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${month}-${day}`;
}

describe('purchaseInvoiceDescriptor source', () => {
  it('exports buildPurchaseInvoiceBatch', () => {
    assert.match(src, /export\s+async\s+function\s+buildPurchaseInvoiceBatch/);
  });

  it('routes the document number to orderReference (not documentNo)', () => {
    assert.match(src, /headerBody\.orderReference/);
    assert.doesNotMatch(src, /headerBody\.documentNo/);
  });

  it('returns { cancelled: true } when the BP popup is dismissed', () => {
    assert.match(src, /return\s*\{\s*cancelled:\s*true\s*\}/);
  });

  it('uses the standalone product list (not the line selector) for the picker', () => {
    assert.match(src, /\$\{productSpecUrl\}\/product/);
  });

  it('looks up an existing BP location for partnerAddress', () => {
    assert.match(src, /findBpLocation\s*\(/);
    assert.match(src, /headerBody\.partnerAddress/);
  });

  it('marks lines with $ref:inv as parent', () => {
    assert.match(src, /parentRef:\s*['"]inv['"]/);
  });
});

describe('nonBlank', () => {
  it('returns false for null/undefined', () => {
    assert.equal(nonBlank(null), false);
    assert.equal(nonBlank(undefined), false);
  });

  it('returns false for empty or whitespace strings', () => {
    assert.equal(nonBlank(''), false);
    assert.equal(nonBlank('   '), false);
  });

  it('returns true for non-empty values', () => {
    assert.equal(nonBlank('a'), true);
    assert.equal(nonBlank(0), true);
    assert.equal(nonBlank(false), true);
    assert.equal(nonBlank('  x '), true);
  });
});

describe('toIsoDate', () => {
  it('returns null for empty input', () => {
    assert.equal(toIsoDate(null), null);
    assert.equal(toIsoDate(undefined), null);
    assert.equal(toIsoDate(''), null);
  });

  it('passes through ISO dates unchanged', () => {
    assert.equal(toIsoDate('2026-05-06'), '2026-05-06');
  });

  it('parses dd/mm/yyyy', () => {
    assert.equal(toIsoDate('06/05/2026'), '2026-05-06');
    assert.equal(toIsoDate('1/5/2026'), '2026-05-01');
  });

  it('parses dd-mm-yyyy', () => {
    assert.equal(toIsoDate('06-05-2026'), '2026-05-06');
  });

  it('expands 2-digit years into the 2000s', () => {
    assert.equal(toIsoDate('06/05/26'), '2026-05-06');
  });

  it('returns the trimmed original when format is unrecognized', () => {
    assert.equal(toIsoDate('  not a date '), 'not a date');
  });
});
