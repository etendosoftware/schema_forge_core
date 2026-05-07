import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'InvoiceHeaderTable.jsx'), 'utf8');

describe('Sales InvoiceHeaderTable', () => {
  it('uses calendar-date helpers for due date parsing and formatting', () => {
    assert.match(src, /formatCalendarDate/);
    assert.match(src, /getCalendarDateRelation/);
  });

  it('formats due dates with the active locale instead of a hardcoded region', () => {
    assert.match(src, /useLocaleSwitch/);
    assert.match(src, /formatCalendarDate\(d, locale\)/);
  });

  it('renders the due date column driven by paid/overdue/soon/ok state', () => {
    assert.match(src, /key.*eTGODueDate/);
    assert.match(src, /getDueDateState/);
    assert.match(src, /getDueDateDotStyle/);
  });

  it('feeds outstandingAmount into the due-date state', () => {
    assert.match(src, /getDueDateState\(d, row\.outstandingAmount\)/);
  });

  it('uses getCalendarDateRelation to determine overdue status', () => {
    assert.match(src, /getCalendarDateRelation\(row\.eTGODueDate\) === 'past'/);
  });
});