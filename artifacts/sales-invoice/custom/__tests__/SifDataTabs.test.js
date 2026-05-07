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

  it('returns null when profile is not sii/tbai/sii+tbai', () => {
    assert.match(src, /return null/);
  });

  // ── Tab visibility ─────────────────────────────────────────────────────────

  it('defines SII_PROFILES with sii, sii-navarra, and sii+tbai', () => {
    assert.match(src, /SII_PROFILES/);
    assert.match(src, /sii-navarra/);
    assert.match(src, /sii\+tbai/);
  });

  it('defines TBAI_PROFILES with tbai and sii+tbai', () => {
    assert.match(src, /TBAI_PROFILES/);
    assert.match(src, /tbai/);
  });

  it('derives showSii and showTbai from profile', () => {
    assert.match(src, /showSii/);
    assert.match(src, /showTbai/);
  });

  // ── Tab state ──────────────────────────────────────────────────────────────

  it('tracks activeTab state defaulting to sii', () => {
    assert.match(src, /useState\(['"]sii['"]\)/);
  });

  it('renders tab buttons for each visible tab', () => {
    assert.match(src, /onClick.*setActiveTab/);
  });

  // ── SII fields ─────────────────────────────────────────────────────────────

  it('renders an input for aeatsiiFechaOperacion (date)', () => {
    assert.match(src, /aeatsiiFechaOperacion/);
  });

  it('renders a select for aeatsiiClaveTipo with R, F1, F2, F4 options', () => {
    assert.match(src, /aeatsiiClaveTipo/);
    assert.match(src, /value.*['"']F1['"']/);
  });

  it('renders a checkbox for aeatsiiIsauthorization', () => {
    assert.match(src, /aeatsiiIsauthorization/);
    assert.match(src, /type=['"]checkbox['"]/);
  });

  it('shows aeatsiiEjercicio and aeatsiiPeriodo as read-only', () => {
    assert.match(src, /aeatsiiEjercicio/);
    assert.match(src, /aeatsiiPeriodo/);
  });

  // ── Auto-save ──────────────────────────────────────────────────────────────

  it('defines a patchField function for auto-save', () => {
    assert.match(src, /function patchField|patchField.*=.*async/);
  });

  it('calls PATCH on the sales-invoice header endpoint', () => {
    assert.match(src, /PATCH/);
    assert.match(src, /sales-invoice\/header/);
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

});
