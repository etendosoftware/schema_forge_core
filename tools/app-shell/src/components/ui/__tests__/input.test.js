import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'input.jsx'), 'utf8');

// Pull the multi-line cn("…") string assigned to className. Mirrors the
// extraction in select.test.js so the same regex contract documents both.
function extractInputClass(source) {
  const match = source.match(/className=\{[\s\S]*?cn\(\s*\n?\s*"([^"]+)"/);
  return match ? match[1] : null;
}

describe('Input — Figma form-input dimensions (ETP-3893)', () => {
  const inputClass = extractInputClass(src);

  it('source exposes a single canonical class string', () => {
    assert.ok(inputClass, 'could not extract Input base className');
  });

  it('is 40px tall (h-10) — same as DateField wrapper and SelectTrigger', () => {
    assert.match(inputClass, /(^|\s)h-10(\s|$)/);
  });

  it('uses 8px border-radius (rounded-lg)', () => {
    assert.match(inputClass, /(^|\s)rounded-lg(\s|$)/);
  });

  it('uses the Figma border color #D1D4DB', () => {
    assert.match(inputClass, /border-\[#D1D4DB\]/);
  });

  it('uses 8px padding (p-2)', () => {
    assert.match(inputClass, /(^|\s)p-2(\s|$)/);
  });

  it('uses the Figma xs shadow', () => {
    assert.match(inputClass, /shadow-\[0px_1px_2px_rgba\(18,18,23,0\.05\)\]/);
  });

  it('does NOT regress to the legacy h-9 / rounded-md / shadow-sm trio', () => {
    assert.doesNotMatch(inputClass, /(^|\s)h-9(\s|$)/);
    assert.doesNotMatch(inputClass, /(^|\s)rounded-md(\s|$)/);
    assert.doesNotMatch(inputClass, /(^|\s)shadow-sm(\s|$)/);
  });
});
