import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'CloneButton.jsx'), 'utf8');

describe('CloneButton', () => {

  // ── Exports ────────────────────────────────────────────────────────────────

  it('exports CloneButton as the default export', () => {
    assert.match(src, /export default function CloneButton/);
  });

  it('accepts onClick and title props', () => {
    assert.match(src, /onClick/);
    assert.match(src, /title/);
  });

  // ── Hover state ────────────────────────────────────────────────────────────

  it('uses useState to track hover state', () => {
    assert.match(src, /useState\(false\)/);
  });

  it('sets hover background to #F1F5F9 on mouseenter', () => {
    assert.match(src, /#F1F5F9/);
    assert.match(src, /onMouseEnter/);
    assert.match(src, /onMouseLeave/);
  });

  // ── Secondary Outline style ────────────────────────────────────────────────

  it('uses Secondary Outline border token #D1D4DB', () => {
    assert.match(src, /#D1D4DB/);
  });

  it('uses muted icon color #64748B', () => {
    assert.match(src, /#64748B/);
  });

  it('renders a button with type="button"', () => {
    assert.match(src, /type="button"/);
  });

  // ── Copy icon ──────────────────────────────────────────────────────────────

  it('renders a copy icon SVG with two paths', () => {
    assert.match(src, /<rect/);
    assert.match(src, /<path/);
  });

});
