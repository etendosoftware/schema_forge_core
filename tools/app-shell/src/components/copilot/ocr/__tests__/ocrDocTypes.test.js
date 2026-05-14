import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'ocrDocTypes.js'), 'utf8');

describe('ocrDocTypes config contract', () => {
  it('defines purchase-invoice review config in the doc type entry', () => {
    assert.match(src, /id:\s*'purchase-invoice'/);
    assert.match(src, /headerFields:\s*\[/);
    assert.match(src, /lineColumns:\s*\[/);
  });

  it('models vendor and tax as entity configs, not bespoke modal code', () => {
    assert.match(src, /key:\s*'vendor'[\s\S]*kind:\s*'entity'/);
    assert.match(src, /key:\s*'tax'[\s\S]*kind:\s*'entity'/);
    assert.match(src, /preResolve:\s*'findBp'/);
    assert.match(src, /preResolve:\s*'findTax'/);
  });

  it('keeps documentNo, invoiceDate, dueDate as explicit header fields', () => {
    assert.match(src, /key:\s*'documentNo'[\s\S]*kind:\s*'text'/);
    assert.match(src, /key:\s*'invoiceDate'[\s\S]*kind:\s*'date'/);
    assert.match(src, /key:\s*'dueDate'[\s\S]*kind:\s*'date'/);
  });
});
