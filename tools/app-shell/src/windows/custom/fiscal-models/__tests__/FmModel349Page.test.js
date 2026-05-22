import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'models', '349', 'FmModel349Page.jsx'), 'utf8');

describe('FmModel349Page — exports', () => {
  it('has default export', () => assert.match(src, /export default/));
});

describe('FmModel349Page — composition', () => {
  it('renders StatusPillMenu', () => assert.match(src, /StatusPillMenu/));
  it('has back navigation (onBack)', () => assert.match(src, /onBack/));
  it('renders operator table', () => assert.match(src, /operator|operador/i));
});

describe('FmModel349Page — no removed features', () => {
  it('does not reference AuditReasonModal', () => assert.doesNotMatch(src, /AuditReasonModal/));
  it('does not reference manualAdj', () => assert.doesNotMatch(src, /manualAdj/));
});

describe('FmModel349Page — keys (no Triangulares, pairs grouped)', () => {
  // KEY_IDS is defined as a plain string array: const KEY_IDS = ['E', 'S', 'A', 'I']
  const keyIds = src.match(/const KEY_IDS\s*=\s*\[([^\]]+)\]/)?.[1] ?? '';

  it('does not include Triangulares key', () => assert.doesNotMatch(src, /Triangulares/));
  it('has Entregas key (E)', () => assert.match(keyIds, /'E'/));
  it('has Servicios prestados key (S)', () => assert.match(keyIds, /'S'/));
  it('has Adquisiciones key (A)', () => assert.match(keyIds, /'A'/));
  it('has Servicios recibidos key (I)', () => assert.match(keyIds, /'I'/));
  it('Entregas (E) appears before Servicios prestados (S) in KEYS', () => {
    const eIdx = keyIds.indexOf("'E'");
    const sIdx = keyIds.indexOf("'S'");
    assert.ok(eIdx !== -1 && sIdx !== -1 && eIdx < sIdx, 'E must come before S');
  });
  it('Servicios prestados (S) appears before Adquisiciones (A) in KEYS', () => {
    const sIdx = keyIds.indexOf("'S'");
    const aIdx = keyIds.indexOf("'A'");
    assert.ok(sIdx !== -1 && aIdx !== -1 && sIdx < aIdx, 'S must come before A');
  });
  it('Adquisiciones (A) appears before Servicios recibidos (I) in KEYS', () => {
    const aIdx = keyIds.indexOf("'A'");
    const iIdx = keyIds.indexOf("'I'");
    assert.ok(aIdx !== -1 && iIdx !== -1 && aIdx < iIdx, 'A must come before I');
  });
});
