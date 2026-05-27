import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'FiscalStatusBadge.jsx'), 'utf8');

// ── CONFIG completeness ──────────────────────────────────────────────────────

describe('FiscalStatusBadge — SII status codes', () => {
  const siiCodes = ['CO', 'AE', 'IN', 'PE', 'EE', 'AN', 'BA', 'NR'];

  for (const code of siiCodes) {
    it(`CONFIG includes SII code "${code}"`, () => {
      assert.match(src, new RegExp(`\\b${code}:\\s*\\{`),
        `Expected CONFIG entry for SII code "${code}"`);
    });
  }

  it('BA uses a neutral grey colour (not red — it is not an error state)', () => {
    const baBlock = src.match(/BA:\s*\{([^}]+)\}/)?.[1] ?? '';
    assert.ok(baBlock.includes('#4b5563') || baBlock.includes('#f3f4f6'),
      'BA should use neutral grey (#4b5563 / #f3f4f6), not error red');
    assert.ok(!baBlock.includes('#b91c1c'), 'BA must not use error red (#b91c1c)');
  });

  it('NR uses a neutral grey colour', () => {
    const nrBlock = src.match(/NR:\s*\{([^}]+)\}/)?.[1] ?? '';
    assert.ok(nrBlock.includes('#6b7280') || nrBlock.includes('#f9fafb'),
      'NR should use neutral grey (#6b7280 / #f9fafb)');
    assert.ok(!nrBlock.includes('#b91c1c'), 'NR must not use error red (#b91c1c)');
  });
});

describe('FiscalStatusBadge — TBAI status strings', () => {
  const tbaiStatuses = ['Recibido', 'Rechazado', 'Error', 'Pendiente'];

  for (const status of tbaiStatuses) {
    it(`CONFIG includes TBAI status "${status}"`, () => {
      assert.match(src, new RegExp(`${status}:\\s*\\{`),
        `Expected CONFIG entry for TBAI status "${status}"`);
    });
  }
});

describe('FiscalStatusBadge — Verifactu status strings', () => {
  const vfStatuses = ['accepted', 'partiallyAccepted', 'rejected', 'invalid'];

  for (const status of vfStatuses) {
    it(`CONFIG includes Verifactu status "${status}"`, () => {
      assert.match(src, new RegExp(`${status}:\\s*\\{`),
        `Expected CONFIG entry for Verifactu status "${status}"`);
    });
  }
});

// ── i18n key wiring ──────────────────────────────────────────────────────────

describe('FiscalStatusBadge — i18n key wiring', () => {
  it('CO maps to fiscalMonitor.status.sii.CO', () => {
    assert.match(src, /CO:.*key:\s*'fiscalMonitor\.status\.sii\.CO'/s);
  });

  it('BA maps to fiscalMonitor.status.sii.BA (added in ETP-4125)', () => {
    assert.match(src, /BA:.*key:\s*'fiscalMonitor\.status\.sii\.BA'/s);
  });

  it('NR maps to fiscalMonitor.status.sii.NR (added in ETP-4125)', () => {
    assert.match(src, /NR:.*key:\s*'fiscalMonitor\.status\.sii\.NR'/s);
  });

  it('Recibido maps to fiscalMonitor.tbai.status.Recibido', () => {
    assert.match(src, /Recibido:.*key:\s*'fiscalMonitor\.tbai\.status\.Recibido'/s);
  });

  it('accepted maps to fiscalMonitor.status.vf.accepted', () => {
    assert.match(src, /accepted:.*key:\s*'fiscalMonitor\.status\.vf\.accepted'/s);
  });
});
