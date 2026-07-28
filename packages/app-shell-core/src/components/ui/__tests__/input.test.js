import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'input.jsx'), 'utf8');

// Pull the multi-line cn(`…`) template literal assigned to className. The base
// className became a template literal in ETP-4321 so the density tokens
// (FIELD_HEIGHT / FIELD_PADDING) can be interpolated from a single source.
function extractInputClass(source) {
  const match = source.match(/className=\{[\s\S]*?cn\(\s*\n?\s*`([^`]+)`/);
  return match ? match[1] : null;
}

describe('Input — semantic form-input tokens (ETP-4554)', () => {
  const inputClass = extractInputClass(src);

  it('source exposes a single canonical class string', () => {
    assert.ok(inputClass, 'could not extract Input base className');
  });

  it('drives height from the shared FIELD_HEIGHT density token (ETP-4321)', () => {
    assert.match(inputClass, /\$\{FIELD_HEIGHT\}/);
    assert.match(src, /import \{[^}]*FIELD_HEIGHT[^}]*\} from "\.\/formDensity\.js"/);
  });

  it('does NOT hardcode a field height — height must come from the token', () => {
    assert.doesNotMatch(inputClass, /(^|\s)h-\d+(\s|$)/);
  });

  it('uses 8px border-radius (rounded-lg)', () => {
    assert.match(inputClass, /(^|\s)rounded-lg(\s|$)/);
  });

  it('uses the semantic control border', () => {
    assert.match(inputClass, /border-border-control/);
  });

  it('drives padding from the shared FIELD_PADDING density token (ETP-4321)', () => {
    assert.match(inputClass, /\$\{FIELD_PADDING\}/);
    assert.match(src, /import \{[^}]*FIELD_PADDING[^}]*\} from "\.\/formDensity\.js"/);
  });

  it('uses a semantic muted surface', () => {
    assert.match(inputClass, /bg-muted/);
  });

  it('uses semantic secondary placeholder text', () => {
    assert.match(inputClass, /placeholder:text-text-secondary/);
  });

  it('does NOT carry a drop shadow — Figma ETP-4000 renders the field flat', () => {
    assert.doesNotMatch(inputClass, /(^|\s)shadow-/, 'no Tailwind shadow utility should be on the base Input');
    assert.doesNotMatch(inputClass, /shadow-\[0px_1px_2px_rgba\(18,18,23,0\.05\)\]/);
  });

  it('does NOT regress to the legacy rounded-md / shadow-sm pairing', () => {
    assert.doesNotMatch(inputClass, /(^|\s)rounded-md(\s|$)/);
    assert.doesNotMatch(inputClass, /(^|\s)shadow-sm(\s|$)/);
  });

  it('resolves FIELD_HEIGHT to 36px (h-9) and FIELD_PADDING to px-2 py-1.5 (ETP-4321)', async () => {
    const { FIELD_HEIGHT, FIELD_PADDING } = await import('../formDensity.js');
    assert.equal(FIELD_HEIGHT, 'h-9');
    assert.equal(FIELD_PADDING, 'px-2 py-1.5');
  });

  it('does NOT use the legacy bg-transparent (ETP-4000 sets the form fill)', () => {
    assert.doesNotMatch(inputClass, /(^|\s)bg-transparent(\s|$)/);
  });

  it('uses a dedicated disabled state and an accessible focus ring', () => {
    assert.match(inputClass, /disabled:text-text-disabled/);
    assert.doesNotMatch(inputClass, /disabled:opacity-/);
    assert.match(inputClass, /focus-visible:ring-focus-ring/);
  });
});
