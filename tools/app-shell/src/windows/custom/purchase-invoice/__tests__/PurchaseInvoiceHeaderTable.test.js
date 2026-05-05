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
    assert.match(src, /getLatestInstallmentDueDate/);
  });

  it('includes invoiceDate column with dot suppressed', () => {
    assert.match(src, /key.*invoiceDate/);
    assert.match(src, /dot.*false/);
  });

  it('includes orderReference column for supplier reference', () => {
    assert.match(src, /key.*orderReference/);
    assert.match(src, /POReference/);
  });

  it('includes a custom _dueDate column driven by paid/overdue/soon/ok state', () => {
    assert.match(src, /key.*_dueDate/);
    assert.match(src, /getDueDateState/);
    assert.match(src, /getDueDateDotStyle/);
  });

  it('feeds outstandingAmount into the due-date state to flip overdue→paid', () => {
    assert.match(src, /getDueDateState\(\s*d\s*,\s*row\.outstandingAmount/);
  });

  it('shows a dash when no due date is available', () => {
    assert.match(src, /text-muted-foreground/);
  });

  it('uses the dueDate generic label key', () => {
    assert.match(src, /t\('dueDate'\)/);
  });

  it('formats due dates with the active locale instead of a hardcoded region', () => {
    assert.match(src, /useLocaleSwitch/);
    assert.match(src, /formatCalendarDate\(d, locale\)/);
  });

  it('passes Authorization header when fetching payment plans', () => {
    assert.match(src, /Authorization.*Bearer/);
  });
});
