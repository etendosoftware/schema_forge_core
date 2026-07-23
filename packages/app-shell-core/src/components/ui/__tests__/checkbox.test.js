import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../checkbox.jsx', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// checkbox.jsx — source-reading tests (ETP-3660)
//
// The Checkbox is a custom forwardRef component that renders a native input
// inside a label, avoiding invalid nested interactive controls.
// We verify the structural contract through static source analysis because
// the component depends on React + a DOM environment not available here.
// ---------------------------------------------------------------------------

describe('Checkbox — module contract (ETP-3660)', () => {
  it('exports Checkbox as a named export', () => {
    assert.match(src, /export\s*\{\s*Checkbox\s*\}/);
  });

  it('uses forwardRef', () => {
    assert.match(src, /forwardRef/);
  });

  it('imports forwardRef from react', () => {
    assert.match(src, /import\s*\{[^}]*forwardRef[^}]*\}\s*from\s*['"]react['"]/);
  });
});

describe('Checkbox — props contract (ETP-3660)', () => {
  it('accepts checked prop', () => {
    assert.match(src, /\{\s*checked/);
  });

  it('accepts indeterminate prop', () => {
    assert.match(src, /indeterminate/);
  });

  it('accepts disabled prop', () => {
    assert.match(src, /disabled/);
  });

  it('accepts onChange prop', () => {
    assert.match(src, /onChange/);
  });

  it('accepts onClick prop', () => {
    assert.match(src, /onClick/);
  });

  it('accepts className prop', () => {
    assert.match(src, /className/);
  });
});

describe('Checkbox — aria-checked behavior (ETP-3660)', () => {
  it('sets aria-checked to "mixed" when indeterminate is true', () => {
    assert.match(src, /aria-checked=\{indeterminate\s*\?\s*['"]mixed['"]/);
  });

  it('sets aria-checked to boolean !!checked when not indeterminate', () => {
    assert.match(src, /aria-checked=\{indeterminate\s*\?\s*['"]mixed['"]\s*:\s*!!checked\}/);
  });
});

describe('Checkbox — native control semantics (ETP-4554)', () => {
  it('renders a label wrapper and a native checkbox input', () => {
    assert.match(src, /<label/);
    assert.match(src, /type="checkbox"/);
  });

  it('does not nest an interactive input in a button', () => {
    assert.doesNotMatch(src, /<button/);
  });

  it('passes disabled prop to the native input', () => {
    assert.match(src, /disabled=\{disabled\}/);
  });
});

describe('Checkbox — hidden input element (ETP-3660)', () => {
  it('contains a visually hidden <input type="checkbox">', () => {
    assert.match(src, /type="checkbox"/);
  });

  it('input is visually hidden with sr-only class', () => {
    assert.match(src, /className="sr-only"/);
  });

  it('keeps the native input accessible and wires its change event', () => {
    assert.match(src, /onChange=\{onChange\}/);
    assert.doesNotMatch(src, /aria-hidden="true"/);
  });

  it('input checked value is coerced to boolean (!!checked)', () => {
    assert.match(src, /checked=\{!!checked\}/);
  });
});

describe('Checkbox — click handler wiring (ETP-3660)', () => {
  it('forwards click and change handlers to the native input', () => {
    assert.match(src, /onClick=\{onClick\}/);
    assert.match(src, /onChange=\{onChange\}/);
  });
});

describe('Checkbox — indeterminate effect (ETP-3660)', () => {
  it('uses useEffect to set inputRef.current.indeterminate', () => {
    assert.match(src, /useEffect/);
  });

  it('sets indeterminate property via inputRef', () => {
    assert.match(src, /inputRef\.current\.indeterminate\s*=\s*!!indeterminate/);
  });

  it('depends on [indeterminate] in the useEffect', () => {
    assert.match(src, /\[indeterminate\]/);
  });

  it('uses useRef for the input element ref', () => {
    assert.match(src, /useRef/);
  });
});

describe('Checkbox — visual states (ETP-3660)', () => {
  it('shows checkmark SVG when checked and not indeterminate', () => {
    assert.match(src, /checked\s*&&\s*!indeterminate/);
  });

  it('shows indeterminate indicator when indeterminate is true', () => {
    // The indeterminate visual (dash) is rendered separately from the checkmark
    const indeterminateRender = src.match(/\{indeterminate\s*&&/g) ?? [];
    assert.ok(indeterminateRender.length >= 1, 'Expected at least one {indeterminate && ...} block');
  });

  it('applies disabled styling via conditional class', () => {
    assert.match(src, /disabled.*cursor-not-allowed/s);
  });

  it('uses cn() utility for class merging', () => {
    assert.match(src, /cn\(/);
    assert.match(src, /import.*cn.*from/);
  });
});
