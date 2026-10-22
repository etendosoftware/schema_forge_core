// @covers packages/app-shell-core/src/components/ui/custom-icons.jsx
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../custom-icons.jsx', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// custom-icons.jsx — source-reading tests (ETP-3660)
//
// The file exports four SVG icon components. Since they return JSX and cannot
// be rendered without a DOM + React transform, we verify the module contract
// through static source analysis.
// ---------------------------------------------------------------------------

describe('custom-icons — exports (ETP-3660)', () => {
  it('exports RefreshIcon as a named export', () => {
    assert.match(src, /export function RefreshIcon/);
  });

  it('exports SortIcon as a named export', () => {
    assert.match(src, /export function SortIcon/);
  });

  it('exports UploadIcon as a named export', () => {
    assert.match(src, /export function UploadIcon/);
  });

  it('exports SearchIcon as a named export', () => {
    assert.match(src, /export function SearchIcon/);
  });

  it('exports TrashIcon as a named export', () => {
    assert.match(src, /export function TrashIcon/);
  });

  it('exports PricingIcon as a named export', () => {
    assert.match(src, /export function PricingIcon/);
  });

  it('has exactly fourteen exported functions (no accidental extras)', () => {
    const exportedFunctions = src.match(/export function \w+/g) ?? [];
    assert.equal(exportedFunctions.length, 14);
  });
});

describe('custom-icons — className prop (ETP-3660)', () => {
  it('RefreshIcon destructures className from props', () => {
    assert.match(src, /function RefreshIcon\s*\(\s*\{[^}]*className[^}]*\}/);
  });

  it('SortIcon destructures className from props', () => {
    assert.match(src, /function SortIcon\s*\(\s*\{[^}]*className[^}]*\}/);
  });

  it('UploadIcon destructures className from props', () => {
    assert.match(src, /function UploadIcon\s*\(\s*\{[^}]*className[^}]*\}/);
  });

  it('SearchIcon destructures className from props', () => {
    assert.match(src, /function SearchIcon\s*\(\s*\{[^}]*className[^}]*\}/);
  });

  it('RefreshIcon passes className to the svg element', () => {
    assert.match(src, /RefreshIcon[\s\S]*?className=\{className\}/);
  });

  it('SortIcon passes className to the svg element', () => {
    assert.match(src, /SortIcon[\s\S]*?className=\{className\}/);
  });

  it('UploadIcon passes className to the svg element', () => {
    assert.match(src, /UploadIcon[\s\S]*?className=\{className\}/);
  });

  it('SearchIcon passes className to the svg element', () => {
    assert.match(src, /SearchIcon[\s\S]*?className=\{className\}/);
  });
});

describe('custom-icons — SVG structure (ETP-3660)', () => {
  it('RefreshIcon renders an <svg> element', () => {
    assert.match(src, /RefreshIcon[\s\S]*?<svg/);
  });

  it('SortIcon renders an <svg> element', () => {
    assert.match(src, /SortIcon[\s\S]*?<svg/);
  });

  it('UploadIcon renders an <svg> element', () => {
    assert.match(src, /UploadIcon[\s\S]*?<svg/);
  });

  it('SearchIcon renders an <svg> element', () => {
    assert.match(src, /SearchIcon[\s\S]*?<svg/);
  });

  it('all four icons use fill="none" on the svg element', () => {
    const fillNoneMatches = src.match(/fill="none"/g) ?? [];
    assert.ok(fillNoneMatches.length >= 4, 'Expected at least 4 fill="none" occurrences (one per icon svg)');
  });

  it('stroke-based icons use currentColor for strokes', () => {
    assert.match(src, /UploadIcon[\s\S]*?stroke="currentColor"/);
    assert.match(src, /RefreshIcon[\s\S]*?stroke="currentColor"/);
  });

  it('fill-based icons use currentColor for path fill', () => {
    const currentColorMatches = src.match(/fill="currentColor"/g) ?? [];
    assert.ok(currentColorMatches.length >= 3, 'Expected at least 3 fill="currentColor" path occurrences');
  });
});

describe('custom-icons — RefreshIcon dimensions (ETP-3660)', () => {
  it('RefreshIcon svg is 17x17', () => {
    assert.match(src, /function RefreshIcon[\s\S]*?width="17"[\s\S]*?height="17"/);
  });
});

describe('custom-icons — SortIcon dimensions (ETP-3660)', () => {
  it('SortIcon svg is 18x18', () => {
    assert.match(src, /function SortIcon[\s\S]*?width="18"[\s\S]*?height="18"/);
  });
});

describe('custom-icons — SearchIcon dimensions (ETP-3660)', () => {
  it('SearchIcon svg is 17x17', () => {
    assert.match(src, /function SearchIcon[\s\S]*?width="17"[\s\S]*?height="17"/);
  });
});

// ---------------------------------------------------------------------------
// Iconic set (24-unit grid). Source-reading like the rest of this file: it runs
// under `node --test`, which cannot import JSX. Each icon keeps the design's
// 24x24 frame (so the Tailwind size IS the Figma size), colours through
// `currentColor`, and forwards className plus any extra prop to the <svg>.
// ---------------------------------------------------------------------------

describe('custom-icons — Iconic 24px icons', () => {
  for (const name of ['IconicTrashIcon', 'IconicArrowUpIcon', 'IconicArrowDownIcon']) {
    const body = src.match(new RegExp(`export function ${name}\\b[\\s\\S]*?</svg>`))?.[0] ?? '';
    const svgTag = body.match(/<svg\b[^>]*>/)?.[0] ?? '';

    it(`${name} is exported and takes className plus the remaining props`, () => {
      assert.match(body, new RegExp(`export function ${name}\\s*\\(\\s*\\{\\s*className\\s*,\\s*\\.\\.\\.props\\s*\\}\\s*\\)`));
    });

    it(`${name} renders a 24x24 svg that forwards className and the extra props`, () => {
      assert.match(svgTag, /viewBox="0 0 24 24"/);
      assert.match(svgTag, /className=\{className\}/);
      assert.match(svgTag, /\{\.\.\.props\}/);
    });

    it(`${name} fills its path with currentColor`, () => {
      assert.match(body, /<path\b[^>]*fill="currentColor"/);
    });
  }
});

describe('custom-icons — Figma row-action icons on the 20px frame (ETP-5600 Sticky Acciones)', () => {
  for (const [name, translate] of [
    ['IconicEditIcon', /translate\(3\.125 3\.678\)/],
    ['IconicCopyIcon', /translate\(3\.125 3\.125\)/],
    ['IconicMailIcon', /translate\(1\.667 3\.333\)/],
    ['IconicDotsVerticalIcon', /translate\(9 5\.667\)/],
  ]) {
    const body = src.match(new RegExp(`export function ${name}\\b[\\s\\S]*?</svg>`))?.[0] ?? '';
    const svgTag = body.match(/<svg\b[^>]*>/)?.[0] ?? '';

    it(`${name} is exported and takes className plus the remaining props`, () => {
      assert.match(body, new RegExp(`export function ${name}\\s*\\(\\s*\\{\\s*className\\s*,\\s*\\.\\.\\.props\\s*\\}\\s*\\)`));
    });

    it(`${name} renders a 20x20 decorative svg that forwards className and the extra props`, () => {
      assert.match(svgTag, /viewBox="0 0 20 20"/);
      assert.match(svgTag, /aria-hidden="true"/);
      assert.match(svgTag, /className=\{className\}/);
      assert.match(svgTag, /\{\.\.\.props\}/);
    });

    it(`${name} offsets its glyph to the Figma position and fills it with currentColor`, () => {
      assert.match(body, translate);
      assert.match(body, /<path\b[^>]*fill="currentColor"/);
    });
  }
});
