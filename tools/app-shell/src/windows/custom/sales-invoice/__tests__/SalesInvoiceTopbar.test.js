import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'SalesInvoiceTopbar.jsx'), 'utf8');

describe('SalesInvoiceTopbar', () => {
  it('calls onProcess (not window.location.reload) in the invoice-updated handler', () => {
    assert.match(src, /onProcess\?\.\(\)/, 'expected onProcess?.() call in event handler');
    assert.doesNotMatch(src, /window\.location\.reload\(\)/, 'expected no window.location.reload() in event handler');
  });
});
