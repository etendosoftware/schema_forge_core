import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'InvoiceHeaderTable.jsx'), 'utf8');

describe('Sales InvoiceHeaderTable', () => {
  it('uses calendar-date helpers for due date parsing and formatting', () => {
    assert.match(src, /parseCalendarDate/);
    assert.match(src, /formatCalendarDate/);
    assert.match(src, /getCalendarDateRelation/);
  });

  it('formats due dates with the active locale instead of a hardcoded region', () => {
    assert.match(src, /useLocaleSwitch/);
    assert.match(src, /formatCalendarDate\(d, locale\)/);
  });

  it('renders the due date column with red, amber, and green dot states', () => {
    assert.match(src, /key.*_dueDate/);
    assert.match(src, /bg-red-500/);
    assert.match(src, /bg-amber-500/);
    assert.match(src, /bg-emerald-500/);
  });

  it('treats only past due dates as overdue status', () => {
    assert.match(src, /getCalendarDateRelation\(row\.dueDate\) === 'past'/);
  });
});
