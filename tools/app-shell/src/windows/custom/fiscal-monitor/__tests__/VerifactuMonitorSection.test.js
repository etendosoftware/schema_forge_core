import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'VerifactuMonitorSection.jsx'), 'utf8');

// Guards: fmtDate is imported from FmPrimitives (no longer defined locally)
describe('VerifactuMonitorSection — fmtDate import', () => {
  it('imports fmtDate from FmPrimitives', () => assert.match(src, /fmtDate.*from.*FmPrimitives/));
  it('uses fmtDate on the invoiceDate cell', () => assert.match(src, /fmtDate\(row\.invoiceDate\)/));
});

// Guards: date column was added and colSpan updated from 8 to 9
describe('VerifactuMonitorSection — date column structure', () => {
  it('header row has exactly 9 <th> elements', () => {
    const thMatches = src.match(/<th[\s>]/g) || [];
    assert.equal(thMatches.length, 9);
  });

  it('empty-state row uses colSpan={9} (not 8)', () => {
    assert.match(src, /colSpan=\{9\}/);
  });

  it('date column header uses fiscalMonitor.col.date i18n key', () => {
    assert.match(src, /fiscalMonitor\.col\.date/);
  });

  it('date cell renders fmtDate(row.invoiceDate)', () => {
    assert.match(src, /fmtDate\(row\.invoiceDate\)/);
  });
});

// Guards: onBpClick wiring — StatusPill click opens contact detail for error rows
describe('VerifactuMonitorSection — onBpClick wiring', () => {
  it('declares onBpClick in the function signature', () => {
    assert.match(src, /onBpClick\b/);
  });

  it('imports isErrorStatus from FmPrimitives', () => {
    assert.match(src, /isErrorStatus.*from.*FmPrimitives/);
  });

  it('passes onClick prop to StatusPill', () => {
    assert.match(src, /StatusPill[\s\S]*?onClick=/);
  });

  it('onClick is conditional on isErrorStatus result', () => {
    assert.match(src, /isErrorStatus[\s\S]*?onBpClick/);
  });

  it('onClick callback passes businessPartner to onBpClick', () => {
    assert.match(src, /onBpClick.*businessPartner/);
  });
});
