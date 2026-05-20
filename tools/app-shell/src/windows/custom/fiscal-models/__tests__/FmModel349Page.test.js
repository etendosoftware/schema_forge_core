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
  it('does not include Triangulares key', () => assert.doesNotMatch(src, /Triangulares/));
  it('has Entregas key (E)', () => assert.match(src, /id:'E'/));
  it('has Servicios prestados key (S)', () => assert.match(src, /id:'S'/));
  it('has Adquisiciones key (A)', () => assert.match(src, /id:'A'/));
  it('has Servicios recibidos key (I)', () => assert.match(src, /id:'I'/));
  it('Entregas (E) appears before Servicios prestados (S) in KEYS', () => {
    const eIdx = src.indexOf("id:'E'");
    const sIdx = src.indexOf("id:'S'");
    assert.ok(eIdx !== -1 && sIdx !== -1 && eIdx < sIdx, 'E must come before S');
  });
  it('Servicios prestados (S) appears before Adquisiciones (A) in KEYS', () => {
    const sIdx = src.indexOf("id:'S'");
    const aIdx = src.indexOf("id:'A'");
    assert.ok(sIdx !== -1 && aIdx !== -1 && sIdx < aIdx, 'S must come before A');
  });
  it('Adquisiciones (A) appears before Servicios recibidos (I) in KEYS', () => {
    const aIdx = src.indexOf("id:'A'");
    const iIdx = src.indexOf("id:'I'");
    assert.ok(aIdx !== -1 && iIdx !== -1 && aIdx < iIdx, 'A must come before I');
  });
});
