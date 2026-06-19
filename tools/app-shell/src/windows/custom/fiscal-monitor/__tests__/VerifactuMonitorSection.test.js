import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'VerifactuMonitorSection.jsx'), 'utf8');

// Guards: core primitives are imported from FmPrimitives
describe('VerifactuMonitorSection — FmPrimitives imports', () => {
  it('imports StatusPill from FmPrimitives', () => assert.match(src, /StatusPill.*from.*FmPrimitives/));
  it('imports ScrollSentinel from FmPrimitives', () => assert.match(src, /ScrollSentinel.*from.*FmPrimitives/));
  it('does not import fmtDate (no date column in Verifactu)', () => assert.doesNotMatch(src, /fmtDate.*from.*FmPrimitives/));
});

// Guards: table structure — 6 cols (checkbox + 5 data), no date/issuerNIF columns
describe('VerifactuMonitorSection — table structure', () => {
  it('header row has exactly 6 <th> elements', () => {
    const thMatches = src.match(/<th[\s>]/g) || [];
    assert.equal(thMatches.length, 6);
  });

  it('empty-state row uses colSpan={6}', () => {
    assert.match(src, /colSpan=\{6\}/);
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

// Guards: export button and related state/constants are present
describe('VerifactuMonitorSection — CSV export wiring', () => {
  it('imports fetchCsvAndDownload from FmPrimitives', () => {
    assert.match(src, /fetchCsvAndDownload.*from.*FmPrimitives/);
  });

  it('imports buildCsvAndDownload from FmPrimitives', () => {
    assert.match(src, /buildCsvAndDownload.*from.*FmPrimitives/);
  });

  it('declares VF_CORRECT_EXPORT_COLS constant', () => {
    assert.match(src, /const VF_CORRECT_EXPORT_COLS/);
  });

  it('VF_CORRECT_EXPORT_COLS is an array with at least one column definition', () => {
    assert.match(src, /VF_CORRECT_EXPORT_COLS\s*=\s*\[/);
  });

  it('declares exporting state with useState', () => {
    assert.match(src, /const\s+\[exporting,\s*setExporting\]\s*=\s*useState\(false\)/);
  });

  it('export button has onClick={handleExport}', () => {
    assert.match(src, /onClick=\{handleExport\}/);
  });

  it('export button is disabled when loading or exporting', () => {
    assert.match(src, /disabled=\{loading \|\| exporting\}/);
  });

  it('handleExport uses fetchCsvAndDownload for the correct tab', () => {
    assert.match(src, /fetchCsvAndDownload[\s\S]*?VF_CORRECT_EXPORT_COLS/);
  });

  it('handleExport uses buildCsvAndDownload for the problems tab (client-side)', () => {
    assert.match(src, /buildCsvAndDownload\s*\(\s*['"]verifactu_problems['"]/);
  });
});
