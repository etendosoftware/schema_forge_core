import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'SendDocumentModal.jsx'), 'utf8');

describe('SendDocumentModal', () => {
  it('exports a default function component', () => {
    assert.match(src, /export default function SendDocumentModal/);
  });

  it('exports a named SendDocumentButton component', () => {
    assert.match(src, /export function SendDocumentButton/);
  });

  it('accepts documentType, documentNo, bpName, bpEmail, documentId, windowName, token, and onClose props', () => {
    assert.match(src, /documentType.*documentNo.*bpName.*bpEmail.*documentId.*windowName.*token.*onClose/);
  });

  it('builds reportId from windowName', () => {
    assert.match(src, /print-\$\{windowName\}/);
  });

  it('renders PDF preview via iframe and report render API', () => {
    assert.match(src, /\/api\/reports\/.*\/render/);
    assert.match(src, /iframe/);
  });

  it('supports PDF download via jsreport API', () => {
    assert.match(src, /\/jsreport\/api\/report/);
    assert.match(src, /chrome-pdf/);
    assert.match(src, /\.download\s*=/);
  });

  it('pre-fills email from bpEmail when it contains @', () => {
    assert.match(src, /bpEmail.*includes\('@'\)/);
  });

  it('pre-fills subject with document type and number', () => {
    assert.match(src, /\$\{documentType\}.*#\$\{documentNo\}/);
  });

  it('disables Send button when email is invalid or sending', () => {
    assert.match(src, /!isValidEmail\(to\)\s*\|\|\s*sending/);
  });

  it('uses toast for send confirmation', () => {
    assert.match(src, /toast\.success/);
  });

  it('handles PDF rendering errors gracefully', () => {
    assert.match(src, /pdfError/);
    assert.match(src, /Preview failed/);
  });

  it('generates download filename from windowName and documentNo', () => {
    assert.match(src, /\$\{windowName\}-\$\{documentNo\}\.pdf/);
  });

  // ── ETP-4003: isValidEmail uses indexOf, not regex ─────────────────────────

  it('isValidEmail does NOT use a regex for email validation', () => {
    // The function must use indexOf-based logic, never a regex literal like /^.*@.*$/
    assert.doesNotMatch(src, /\/\^.*@.*\$\//);
  });

  it('isValidEmail uses indexOf to find the @ character', () => {
    assert.match(src, /indexOf\s*\(\s*'@'\s*\)/);
  });

  // ── ETP-4003: EmailFormPanel is module-level ───────────────────────────────

  it('EmailFormPanel is defined as a function at module level (before the default export)', () => {
    // The function declaration must appear before "export default function SendDocumentModal"
    const emailPanelPos = src.indexOf('function EmailFormPanel');
    const defaultExportPos = src.indexOf('export default function SendDocumentModal');
    assert.ok(emailPanelPos > -1, 'EmailFormPanel function not found');
    assert.ok(defaultExportPos > -1, 'SendDocumentModal default export not found');
    assert.ok(emailPanelPos < defaultExportPos, 'EmailFormPanel must be defined before SendDocumentModal');
  });
});
