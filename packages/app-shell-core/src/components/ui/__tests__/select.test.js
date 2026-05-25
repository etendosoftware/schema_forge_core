import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'select.jsx'), 'utf8');

// SelectTrigger needs a full Radix Select context to render in JSDOM, which
// makes a className-on-DOM assertion painful. Inspect the source the same
// way date-field.test.js does — the canonical class string is short and
// changing it is a deliberate act we want to surface here.
function extractTriggerBaseClass(source) {
  // Pull the multi-line cn() string for SelectTrigger. Stops at the closing
  // single-quoted string before className is appended.
  const match = source.match(/SelectTrigger\s*=[\s\S]*?cn\(\s*\n\s*"([^"]+)"/);
  return match ? match[1] : null;
}

describe('SelectTrigger — Figma form-input dimensions (ETP-3893)', () => {
  const triggerClass = extractTriggerBaseClass(src);

  it('source exposes a single canonical class string for the trigger', () => {
    assert.ok(triggerClass, 'could not extract SelectTrigger base className');
  });

  it('is 40px tall (h-10) so it lines up with Input and DateField', () => {
    assert.match(triggerClass, /(^|\s)h-10(\s|$)/);
  });

  it('uses 8px border-radius (rounded-lg)', () => {
    assert.match(triggerClass, /(^|\s)rounded-lg(\s|$)/);
  });

  it('uses the Figma border color #D1D4DB', () => {
    assert.match(triggerClass, /border-\[#D1D4DB\]/);
  });

  it('uses 8px padding (p-2)', () => {
    assert.match(triggerClass, /(^|\s)p-2(\s|$)/);
  });

  it('uses the Figma xs shadow', () => {
    assert.match(triggerClass, /shadow-\[0px_1px_2px_rgba\(18,18,23,0\.05\)\]/);
  });

  it('does NOT regress to the legacy h-9 / rounded-md / shadow-sm trio', () => {
    assert.doesNotMatch(triggerClass, /(^|\s)h-9(\s|$)/);
    assert.doesNotMatch(triggerClass, /(^|\s)rounded-md(\s|$)/);
    assert.doesNotMatch(triggerClass, /(^|\s)shadow-sm(\s|$)/);
  });
});
