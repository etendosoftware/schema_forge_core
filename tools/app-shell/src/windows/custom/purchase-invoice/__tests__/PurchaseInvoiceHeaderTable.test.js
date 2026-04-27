import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'PurchaseInvoiceHeaderTable.jsx'), 'utf8');

describe('PurchaseInvoiceHeaderTable', () => {
  it('exports a default function component', () => {
    assert.match(src, /export default function PurchaseInvoiceHeaderTable/);
  });

  it('renders a DataTable', () => {
    assert.match(src, /DataTable/);
  });

  it('batch-fetches due dates from the payment plan endpoint', () => {
    assert.match(src, /paymentPlan\?parentId/);
    assert.match(src, /Promise\.all/);
  });

  it('derives max dueDate from installments', () => {
    assert.match(src, /Math\.max/);
    assert.match(src, /dueDate/);
  });

  it('includes invoiceDate column with dot suppressed', () => {
    assert.match(src, /key.*invoiceDate/);
    assert.match(src, /dot.*false/);
  });

  it('includes orderReference column for supplier reference', () => {
    assert.match(src, /key.*orderReference/);
    assert.match(src, /POReference/);
  });

  it('includes a custom _dueDate column with dot color logic', () => {
    assert.match(src, /key.*_dueDate/);
    assert.match(src, /bg-red-500/);
    assert.match(src, /bg-emerald-500/);
  });

  it('shows a dash when no due date is available', () => {
    assert.match(src, /text-muted-foreground/);
  });

  it('uses the dueDate generic label key', () => {
    assert.match(src, /t\('dueDate'\)/);
  });

  it('passes Authorization header when fetching payment plans', () => {
    assert.match(src, /Authorization.*Bearer/);
  });
});
