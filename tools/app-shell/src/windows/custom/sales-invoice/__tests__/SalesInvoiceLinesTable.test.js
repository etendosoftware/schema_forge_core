import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'SalesInvoiceLinesTable.jsx'), 'utf8');

describe('SalesInvoiceLinesTable', () => {
  it('exports a default function component', () => {
    assert.match(src, /export default SalesInvoiceLinesTable/);
  });

  it('delegates rendering to the shared invoice lines table', () => {
    assert.match(src, /InvoiceLinesTable/);
  });

  it('forwards ref and props to the shared component', () => {
    assert.match(src, /forwardRef/);
    assert.match(src, /ref=\{ref\}/);
    assert.match(src, /\{\.\.\.props\}/);
  });
});
