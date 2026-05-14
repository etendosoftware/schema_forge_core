import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'OcrLinesReviewModal.jsx'), 'utf8');

describe('OcrLinesReviewModal generic rendering', () => {
  it('renders table columns from config instead of a hardcoded tax selector column', () => {
    assert.match(src, /columns\.map\(/);
    assert.match(src, /KindRenderer/);
    assert.doesNotMatch(src, /function TaxInlineSelector/);
  });

  it('keeps column width and label driven by config', () => {
    assert.match(src, /column\.width/);
    assert.match(src, /ui\(column\.label\)/);
  });

  it('returns rows keyed by extractFrom so the purchase descriptor still receives description\/quantity\/unit_price\/tax_label\/tax_id', () => {
    assert.match(src, /column\.extractFrom/);
    assert.match(src, /tax_id/);
    assert.match(src, /rows\.map/);
  });
});
