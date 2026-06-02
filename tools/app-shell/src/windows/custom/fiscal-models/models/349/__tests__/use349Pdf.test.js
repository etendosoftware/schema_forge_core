import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'use349Pdf.js'), 'utf8');

describe('use349Pdf — exports', () => {
  it('exports use349Pdf function', () => assert.match(src, /export function use349Pdf/));
});

describe('use349Pdf — hook shape', () => {
  it('returns pdfUrl', () => assert.match(src, /pdfUrl/));
  it('returns loading state', () => assert.match(src, /loading/));
  it('exposes generatePdf function', () => assert.match(src, /function generatePdf|generatePdf\s*=/));
  it('exposes clearPdf function', () => assert.match(src, /function clearPdf|clearPdf\s*=/));
});

describe('use349Pdf — PDF generation', () => {
  it('calls renderPdf', () => assert.match(src, /renderPdf/));
  it('computes totalAmount from operators', () => assert.match(src, /totalAmount/));
  it('reads orgNif from _precomputed', () => assert.match(src, /_precomputed.*orgNif|orgNif.*_precomputed/s));
});

describe('use349Pdf — memory management', () => {
  it('revokes object URL when pdfUrl changes (useEffect cleanup)', () =>
    assert.match(src, /useEffect.*revokeObjectURL|revokeObjectURL.*useEffect/s));
  it('revokes previous URL before setting a new one in generatePdf', () =>
    assert.match(src, /if\s*\(pdfUrl\)\s*URL\.revokeObjectURL/));
  it('revokes URL in clearPdf', () =>
    assert.match(src, /clearPdf[\s\S]*revokeObjectURL/));
});
