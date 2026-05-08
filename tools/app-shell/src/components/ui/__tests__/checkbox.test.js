import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, '..', 'checkbox.jsx'), 'utf8');

// ---------------------------------------------------------------------------
// checkbox.jsx — source-reading tests (ETP-3660)
//
// The Checkbox is a custom forwardRef component that renders a <button
// role="checkbox"> with a visually-hidden <input type="checkbox"> inside.
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

describe('Checkbox — button role (ETP-3660)', () => {
  it('renders a button element as the root', () => {
    assert.match(src, /<button/);
  });

  it('button has role="checkbox"', () => {
    assert.match(src, /role="checkbox"/);
  });

  it('button has type="button" to prevent form submission', () => {
    assert.match(src, /type="button"/);
  });

  it('passes disabled prop to the button', () => {
    assert.match(src, /disabled=\{disabled\}/);
  });
});

describe('Checkbox — hidden input element (ETP-3660)', () => {
  it('contains a visually hidden <input type="checkbox">', () => {
    assert.match(src, /type="checkbox"/);
  });

  it('input has tabIndex={-1} to remove it from tab order', () => {
    assert.match(src, /tabIndex=\{-1\}/);
  });

  it('input is visually hidden with sr-only class', () => {
    assert.match(src, /className="sr-only"/);
  });

  it('input is readOnly (no onChange on the input itself)', () => {
    assert.match(src, /readOnly/);
  });

  it('input checked value is coerced to boolean (!!checked)', () => {
    assert.match(src, /checked=\{!!checked\}/);
  });
});

describe('Checkbox — click handler wiring (ETP-3660)', () => {
  it('onClick handler calls both onClick and onChange props', () => {
    assert.match(src, /onClick\?\..*onChange\?\./ );
  });

  it('uses optional chaining for onClick prop call', () => {
    assert.match(src, /onClick\?\.\(/);
  });

  it('uses optional chaining for onChange prop call', () => {
    assert.match(src, /onChange\?\.\(/);
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
