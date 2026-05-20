import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'index.jsx'), 'utf8');

describe('GoodsShipmentWindow — DocStatus URL filter (ETP-4004)', () => {
  it('reads DocStatus from URL via useSearchParams', () => {
    assert.match(src, /useSearchParams/,
      'must import and use useSearchParams to read the DocStatus query param');
    assert.match(src, /searchParams\.get\('DocStatus'\)/,
      "must read 'DocStatus' param from the URL");
  });

  it('passes initialColumnFilters in parsed descriptor format { mode, value }', () => {
    assert.match(src, /mode:\s*'enumLabel'/,
      "initialColumnFilters must use mode: 'enumLabel' (parsed descriptor, not raw string)");
    assert.match(src, /value:\s*\[docStatus\]/,
      'initialColumnFilters must wrap docStatus in an array: value: [docStatus]');
  });

  it('does NOT pass initialColumnFilters as a raw string (old broken format)', () => {
    assert.doesNotMatch(src, /documentStatus:\s*docStatus\s*}/,
      "must not pass { documentStatus: docStatus } — raw string causes buildBackendFilter to emit undefined");
    assert.doesNotMatch(src, /documentStatus:\s*'DR'/,
      "must not hardcode 'DR' as a raw string value");
  });

  it('conditionally passes initialColumnFilters only when docStatus exists', () => {
    assert.match(src, /docStatus\s*\?/,
      'initialColumnFilters must be conditional on docStatus being truthy');
    assert.match(src, /:\s*undefined/,
      'must pass undefined when docStatus is falsy, not an always-on filter');
  });

  it('imports useSearchParams from react-router-dom', () => {
    assert.match(src, /import.*useSearchParams.*from\s*['"]react-router-dom['"]/,
      'must import useSearchParams from react-router-dom');
  });

  it('exports a default function component named GoodsShipmentWindow', () => {
    assert.match(src, /export default function GoodsShipmentWindow/,
      'must export GoodsShipmentWindow as the default export');
  });
});

describe('GoodsShipmentWindow — COLUMNS definition (ETP-4031)', () => {
  it('defines the invoiceStatus column with type percent', () => {
    assert.match(src, /key:\s*['"]invoiceStatus['"]/,
      'COLUMNS must include an invoiceStatus entry');
    assert.match(src, /invoiceStatus[^}]*type:\s*['"]percent['"]/s,
      "invoiceStatus column must have type: 'percent'");
  });

  it('sets noHoverHide: true on the invoiceStatus column so the progress bar stays visible on row hover', () => {
    assert.match(src, /invoiceStatus[^}]*noHoverHide:\s*true/s,
      'invoiceStatus column must have noHoverHide: true to prevent the bar from disappearing on hover');
  });

  it('defines movementDate column', () => {
    assert.match(src, /key:\s*['"]movementDate['"]/);
  });

  it('defines documentNo column', () => {
    assert.match(src, /key:\s*['"]documentNo['"]/);
  });

  it('defines businessPartner column', () => {
    assert.match(src, /key:\s*['"]businessPartner['"]/);
  });

  it('defines documentStatus column', () => {
    assert.match(src, /key:\s*['"]documentStatus['"]/);
  });

  it('defines warehouse column', () => {
    assert.match(src, /key:\s*['"]warehouse['"]/);
  });

  it('passes the COLUMNS array to GoodsShipmentTable via the columns prop', () => {
    assert.match(src, /GoodsShipmentTable\s+columns=\{COLUMNS\}/s,
      'CustomGoodsShipmentTable must spread COLUMNS into GoodsShipmentTable as columns prop');
  });
});
