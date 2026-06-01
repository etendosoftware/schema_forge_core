import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'SalesInvoiceTopbar.jsx'), 'utf8');

describe('SalesInvoiceTopbar', () => {
  it('delegates invoice-updated handling to useInvoiceUpdatedListener (not window.location.reload)', () => {
    assert.match(src, /useInvoiceUpdatedListener/, 'expected useInvoiceUpdatedListener to be used');
    assert.doesNotMatch(src, /window\.location\.reload\(\)/, 'expected no window.location.reload() in topbar');
  });
});
