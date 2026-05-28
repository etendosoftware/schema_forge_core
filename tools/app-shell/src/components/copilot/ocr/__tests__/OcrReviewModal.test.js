import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'OcrReviewModal.jsx'), 'utf8');

describe('OcrReviewModal generic rendering', () => {
  it('renders rows from fields config instead of hardcoded vendor/date inputs', () => {
    assert.match(src, /fields\.map\(/);
    assert.doesNotMatch(src, /function VendorSearch/);
  });

  it('delegates editing to KindRenderer', () => {
    assert.match(src, /KindRenderer/);
    assert.match(src, /kind=\{field\.kind\}/);
  });

  it('builds reviewedHeader by field key so descriptors keep the same contract', () => {
    assert.match(src, /result\[field\.key\]/);
    assert.match(src, /vendor/);
    assert.match(src, /documentNo/);
    assert.match(src, /invoiceDate/);
    assert.match(src, /dueDate/);
  });
});
