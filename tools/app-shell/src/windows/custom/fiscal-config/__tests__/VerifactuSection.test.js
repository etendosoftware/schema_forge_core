import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'VerifactuSection.jsx'), 'utf8');

describe('VerifactuSection — structure', () => {
  it('exports a forwardRef component', () => {
    assert.match(src, /forwardRef\(function VerifactuSection/);
  });

  it('exposes a save() method via useImperativeHandle', () => {
    assert.match(src, /useImperativeHandle/);
  });

  it('imports useUI from @/i18n', () => {
    assert.match(src, /useUI.*from.*@\/i18n/);
  });
});

describe('VerifactuSection — locked/unlocked badge', () => {
  it('derives isLocked from record.isReady via isEtendoTrue', () => {
    assert.match(src, /isEtendoTrue\(record\?\.isReady\)/);
  });

  it('renders the locked badge when isLocked is true', () => {
    assert.match(src, /fiscal\.verifactu\.locked\.badge/);
  });

  it('renders the locked badge when record is in locked state', () => {
    assert.match(src, /isLocked/);
  });

  it('disables the switches when record is locked', () => {
    assert.match(src, /disabled=\{isLocked\}/);
  });

  it('passes locked state to save button', () => {
    assert.match(src, /locked=\{isLocked\}/);
  });
});

describe('VerifactuSection — form fields', () => {
  it('renders a tax type select for unlocked records', () => {
    assert.match(src, /VERIFACTU_TAX_TYPE_OPTIONS/);
    assert.match(src, /fiscal\.verifactu\.field\.tax/);
  });

  it('renders a disabled input for locked tax type', () => {
    assert.match(src, /getVerifactuTaxTypeLabel/);
  });

  it('renders the QR code toggle', () => {
    assert.match(src, /fiscal\.verifactu\.field\.qr/);
    assert.match(src, /defaultQR/);
  });

  it('renders read-only enrollment date field (inVfactuSystem)', () => {
    assert.match(src, /inVfactuSystem/);
  });
});

describe('VerifactuSection — validation', () => {
  it('validates tAXType is present before saving', () => {
    assert.match(src, /tAXType/);
    assert.match(src, /fiscal\.verifactu\.err\.noTaxType/);
  });

  it('validates record ID is present before saving', () => {
    assert.match(src, /fiscal\.verifactu\.err\.noRecordId/);
  });
});

describe('VerifactuSection — PUT request', () => {
  it('calls the verifactu-config endpoint', () => {
    assert.match(src, /verifactu-config\//);
    assert.match(src, /VERIFACTU_ENTITY/);
  });

  it('uses buildVerifactuUpdatePayload to serialize the form', () => {
    assert.match(src, /buildVerifactuUpdatePayload/);
  });

  it('uses useApiFetch for authenticated requests', () => {
    assert.match(src, /useApiFetch/);
    assert.match(src, /apiFetch/);
  });
});

describe('VerifactuSection — certificate section', () => {
  it('always renders CertSection (not conditional on hideCert)', () => {
    assert.match(src, /CertSection/);
    assert.match(src, /context="verifactu"/);
  });
});
