import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'SifDataTabs.jsx'), 'utf8');

describe('SifDataTabs', () => {

  // ── Exports ────────────────────────────────────────────────────────────────

  it('exports a default function component', () => {
    assert.match(src, /export default function SifDataTabs/);
  });

  it('accepts data, recordId, token, and apiBaseUrl props', () => {
    assert.match(src, /\{\s*data.*recordId.*token.*apiBaseUrl\s*\}/);
  });

  // ── Fiscal config ──────────────────────────────────────────────────────────

  it('imports useFiscalConfig from the fiscal-config module', () => {
    assert.match(src, /import.*useFiscalConfig.*from.*fiscal-config/);
  });

  it('reads orgId from selectedOrg via useAuth', () => {
    assert.match(src, /useAuth/);
    assert.match(src, /selectedOrg/);
  });

  it('returns null when no fiscal targets apply to the current invoice spec', () => {
    assert.match(src, /return null/);
  });

  // ── Tab visibility ─────────────────────────────────────────────────────────

  it('derives visible fiscal targets from a shared helper', () => {
    assert.match(src, /getInvoiceFiscalTargets/);
  });

  it('derives showSii and showTbai from profile', () => {
    assert.match(src, /showSii/);
    assert.match(src, /showTbai/);
    assert.match(src, /showVerifactu/);
  });

  // ── Tab state ──────────────────────────────────────────────────────────────

  it('tracks activeTab state defaulting to sii', () => {
    assert.match(src, /useState\(['"]sii['"]\)/);
  });

  it('renders tab buttons for each visible tab', () => {
    assert.match(src, /onClick.*setActiveTab/);
  });

  // ── SII fields ─────────────────────────────────────────────────────────────

  it('renders an input for etsgDateOperation (date)', () => {
    assert.match(src, /etsgDateOperation/);
  });

  it('renders a select for aeatsiiClaveTipo with R, F1, F2, F4 options', () => {
    assert.match(src, /aeatsiiClaveTipo/);
    assert.match(src, /value.*['"']F1['"']/);
  });

  it('renders a checkbox for aeatsiiIsauthorization', () => {
    assert.match(src, /aeatsiiIsauthorization/);
    assert.match(src, /type=['"]checkbox['"]/);
  });

  it('switches to purchase-specific SII fields for purchase invoices', () => {
    assert.match(src, /aeatsiiClaveTipoFc/);
    assert.match(src, /aeatsiiPurDescription\$_identifier/);
    assert.match(src, /PURCHASE_CLAVE_TIPO_FC_OPTIONS/);
  });

  it('shows aeatsiiEjercicio and aeatsiiPeriodo as read-only', () => {
    assert.match(src, /aeatsiiEjercicio/);
    assert.match(src, /aeatsiiPeriodo/);
  });

  // ── Auto-save ──────────────────────────────────────────────────────────────

  it('defines a patchField function for auto-save', () => {
    assert.match(src, /function patchField|patchField.*=.*async/);
  });

  it('calls PATCH on the current spec header endpoint', () => {
    assert.match(src, /PATCH/);
    assert.match(src, /specName/);
    assert.match(src, /header/);
  });

  it('shows a toast error on PATCH failure', () => {
    assert.match(src, /toast\.error/);
  });

  // ── TBAI fields ────────────────────────────────────────────────────────────

  it('renders tbaiSequence, tbaiInvoicenum, and tbaiInvoiceseq as read-only', () => {
    assert.match(src, /tbaiSequence/);
    assert.match(src, /tbaiInvoicenum/);
    assert.match(src, /tbaiInvoiceseq/);
  });

  it('renders a Verifactu status tab with read-only fields', () => {
    assert.match(src, /Verifactu/);
    assert.match(src, /etvfacInvoiceStatus/);
    assert.match(src, /etvfacDateIssue/);
    assert.match(src, /cdigoCSV/);
    assert.match(src, /etvfacHash/);
    assert.match(src, /etvfacQRURL/);
    assert.match(src, /etvfacIssueDescription/);
  });

});
