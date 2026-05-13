import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fmtDate } from '../fmtDateUtils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'fmtDateUtils.js'), 'utf8');

describe('fmtDateUtils — exports', () => {
  it('exports fmtDate as a named function', () => assert.match(src, /export function fmtDate/));
});

describe('fmtDate — null / falsy inputs', () => {
  it('returns em-dash for null', () => assert.equal(fmtDate(null), '—'));
  it('returns em-dash for empty string', () => assert.equal(fmtDate(''), '—'));
  it('returns em-dash for undefined', () => assert.equal(fmtDate(undefined), '—'));
});

describe('fmtDate — ISO YYYY-MM-DD → DD/MM/YYYY', () => {
  it('converts 2026-05-13 to 13/05/2026', () => assert.equal(fmtDate('2026-05-13'), '13/05/2026'));
  it('converts 2026-01-01 to 01/01/2026', () => assert.equal(fmtDate('2026-01-01'), '01/01/2026'));
  it('converts 2025-12-31 to 31/12/2025', () => assert.equal(fmtDate('2025-12-31'), '31/12/2025'));
});

describe('fmtDate — already DD/MM/YYYY (pass-through)', () => {
  it('leaves 13/05/2026 unchanged', () => assert.equal(fmtDate('13/05/2026'), '13/05/2026'));
  it('leaves 01/01/2026 unchanged', () => assert.equal(fmtDate('01/01/2026'), '01/01/2026'));
});

describe('fmtDate — invalid / non-date input', () => {
  it('returns raw value for a bare string with no separators', () => assert.equal(fmtDate('nodate'), 'nodate'));
  it('returns raw value when split produces only 2 parts', () => assert.equal(fmtDate('2026-05'), '2026-05'));
  it('returns raw value when split produces 4+ parts', () => assert.equal(fmtDate('a-b-c-d'), 'a-b-c-d'));
});
