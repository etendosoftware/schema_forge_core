import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'PurchaseInvoiceTopbar.jsx'), 'utf8');

describe('PurchaseInvoiceTopbar', () => {
  it('opens InvoicePaymentModal without passing a token prop', () => {
    const modalBlock = src.match(/<InvoicePaymentModal[\s\S]*?\/>/);
    assert.ok(modalBlock, 'expected InvoicePaymentModal to be rendered');
    assert.doesNotMatch(modalBlock[0], /token=\{token\}/);
  });
});
