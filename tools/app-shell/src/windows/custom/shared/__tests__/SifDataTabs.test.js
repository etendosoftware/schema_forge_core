import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'SifDataTabs.jsx'), 'utf8');
const hookSrc = readFileSync(join(__dirname, '..', 'useSifFieldPatcher.js'), 'utf8');

describe('SifDataTabs', () => {
  it('exports a default function component', () => {
    assert.match(src, /export default function SifDataTabs/);
  });

  it('accepts data, recordId, token, and apiBaseUrl props', () => {
    assert.match(src, /\{\s*data.*recordId.*token.*apiBaseUrl\s*\}/);
  });

  it('delegates form state and PATCH logic to the shared useSifFieldPatcher hook', () => {
    assert.match(src, /useSifFieldPatcher/);
    assert.match(src, /from\s+['"]@\/windows\/custom\/shared\/useSifFieldPatcher\.js['"]/);
  });

  it('returns null when no fiscal targets apply to the current invoice spec', () => {
    assert.match(src, /return null/);
  });

  it('tracks activeTab state defaulting to sii', () => {
    assert.match(src, /useState\(['"]sii['"]\)/);
  });

  it('uses i18n keys for fiscal status labels and field labels', () => {
    assert.match(src, /sifDataTabs\.status\.sii\.correct/);
    assert.match(src, /sifDataTabs\.status\.tbai\.sent/);
    assert.match(src, /sifDataTabs\.field\.operationDate/);
    assert.match(src, /sifDataTabs\.field\.issueDetail/);
  });
});

describe('useSifFieldPatcher (shared hook backing SifDataTabs and SifTab)', () => {
  it('imports useFiscalConfig from the fiscal-config module', () => {
    assert.match(hookSrc, /import.*useFiscalConfig.*from.*fiscal-config/);
  });

  it('reads orgId from selectedOrg via useAuth', () => {
    assert.match(hookSrc, /useAuth/);
    assert.match(hookSrc, /selectedOrg/);
  });

  it('derives visible fiscal targets from a shared helper', () => {
    assert.match(hookSrc, /getInvoiceFiscalTargets/);
  });

  it('switches to purchase-specific SII fields for purchase invoices', () => {
    assert.match(hookSrc, /aeatsiiClaveTipoFc/);
    assert.match(hookSrc, /aeatsiiPurDescription\$_identifier/);
    assert.match(hookSrc, /PURCHASE_CLAVE_TIPO_FC_OPTIONS/);
  });

  it('calls PATCH on the current spec header endpoint', () => {
    assert.match(hookSrc, /method: 'PATCH'/);
    assert.match(hookSrc, /specName/);
    assert.match(hookSrc, /header/);
  });

  it('shows a toast error on PATCH failure', () => {
    assert.match(hookSrc, /toast\.error/);
  });
});
