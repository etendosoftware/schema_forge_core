import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'date-picker-chrome.jsx'), 'utf8');

// This file covers the shared month/year-picker chrome (ETP-4771) extracted
// verbatim out of date-field.jsx into its own module so it can also be reused
// by the functional repo's quick-filter date-range picker. Composition with
// DateField itself is covered by date-field.test.js.

describe('date-picker-chrome — exports and dependencies', () => {
  it('exports HeaderRow, NavButton, PillButton, PickerTabs and PickerGrid as named functions', () => {
    assert.match(src, /export function HeaderRow\(/);
    assert.match(src, /export function NavButton\(/);
    assert.match(src, /export function PillButton\(/);
    assert.match(src, /export function PickerTabs\(/);
    assert.match(src, /export function PickerGrid\(/);
  });

  it('imports the chevron icons from lucide-react (Calendar icon stays in date-field.jsx)', () => {
    assert.match(src, /ChevronDown[\s\S]*?ChevronLeft[\s\S]*?ChevronRight[\s\S]*?from\s+['"]lucide-react['"]/);
    assert.doesNotMatch(src, /Calendar as CalendarIcon/);
  });

  it('imports cn from lib/utils.js', () => {
    assert.match(src, /import\s*\{\s*cn\s*\}\s*from\s+['"]\.\.\/\.\.\/lib\/utils\.js['"]/);
  });
});

describe('HeaderRow — label + chevron + nav arrows', () => {
  it('accepts label, onLabelClick, onPrev, onNext and showLabelChevron props', () => {
    assert.match(src, /function HeaderRow\(\{\s*label,\s*onLabelClick,\s*onPrev,\s*onNext,\s*showLabelChevron\s*\}\)/);
  });

  it('renders the label and conditionally a ChevronDown next to it', () => {
    assert.match(src, /<span>\{label\}<\/span>/);
    assert.match(src, /\{showLabelChevron\s*&&\s*\(\s*<ChevronDown/);
  });

  it('wires onLabelClick to the label button and capitalizes the (already locale-formatted) label', () => {
    assert.match(src, /<button[\s\S]*?onClick=\{onLabelClick\}[\s\S]*?capitalize/);
  });

  it('delegates prev/next arrows to NavButton with ChevronLeft/ChevronRight children', () => {
    assert.match(src, /<NavButton onClick=\{onPrev\}[\s\S]*?<ChevronLeft/);
    assert.match(src, /<NavButton onClick=\{onNext\}[\s\S]*?<ChevronRight/);
  });
});

describe('NavButton — circular pill nav arrow (24x24, border, shadow-xs)', () => {
  it('declares a NavButton subcomponent accepting onClick, ariaLabel and children', () => {
    assert.match(src, /function NavButton\(\{\s*onClick,\s*ariaLabel,\s*children\s*\}\)/);
  });

  it('renders the prev/next arrow as a circular pill button (24x24, border, shadow-xs)', () => {
    assert.match(src, /h-6 w-6[\s\S]*?bg-white[\s\S]*?border border-\[#D1D4DB\][\s\S]*?rounded-full[\s\S]*?shadow-\[0px_1px_2px_rgba\(18,18,23,0\.05\)\]/);
  });

  it('wires onClick and aria-label from props', () => {
    assert.match(src, /onClick=\{onClick\}/);
    assert.match(src, /aria-label=\{ariaLabel\}/);
  });
});

describe('PillButton — filled and outlined variants', () => {
  it('declares a PillButton subcomponent supporting filled and outlined variants', () => {
    assert.match(src, /function PillButton\(\{\s*children,\s*onClick,\s*variant\s*=\s*'outlined',\s*disabled\s*\}\)/);
    assert.match(src, /variant === 'filled'/);
  });

  it('filled PillButton (Hoy/Ok) hovers to Etendo yellow #FFD500 (active-button hover convention)', () => {
    assert.match(src, /variant === 'filled'[\s\S]*?hover:bg-\[#FFD500\][\s\S]*?hover:text-\[#121217\]/);
  });

  it('renders pill-shaped buttons (rounded-full, h-8, border for outlined, black for filled)', () => {
    assert.match(src, /rounded-full/);
    assert.match(src, /h-8 px-3/);
    assert.match(src, /bg-\[#121217\] text-white/);
    assert.match(src, /bg-white border border-\[#D1D4DB\] text-\[#121217\]/);
  });

  it('disables the button and dims it via disabled:opacity-40', () => {
    assert.match(src, /disabled=\{disabled\}/);
    assert.match(src, /disabled:opacity-40 disabled:cursor-not-allowed/);
  });
});

describe('PickerTabs — Mes / Año tab control', () => {
  it('declares a PickerTabs subcomponent accepting active, onChange, monthLabel and yearLabel', () => {
    assert.match(src, /function PickerTabs\(\{\s*active,\s*onChange,\s*monthLabel,\s*yearLabel\s*\}\)/);
  });

  it('renders two tabs wired to onChange with month/year', () => {
    assert.match(src, /onClick=\{\(\)\s*=>\s*onChange\('month'\)\}/);
    assert.match(src, /onClick=\{\(\)\s*=>\s*onChange\('year'\)\}/);
    assert.match(src, /\{monthLabel\}/);
    assert.match(src, /\{yearLabel\}/);
  });

  it('gives the active tab a white/shadow card style, the idle tab a hover style', () => {
    assert.match(src, /tabActive\s*=\s*\n?\s*['"]bg-white text-\[#121217\] shadow-/);
    assert.match(src, /tabIdle\s*=\s*['"]text-\[#121217\] hover:bg-\[rgba\(18,18,23,0\.05\)\]['"]/);
  });
});

describe('PickerGrid — month/year selectable grid', () => {
  it('declares a PickerGrid subcomponent accepting items, selectedValue and onSelect', () => {
    assert.match(src, /function PickerGrid\(\{\s*items,\s*selectedValue,\s*onSelect\s*\}\)/);
  });

  it('renders a 3-column grid and calls onSelect(item.value) per cell', () => {
    assert.match(src, /grid grid-cols-3 gap-2/);
    assert.match(src, /onClick=\{\(\)\s*=>\s*onSelect\(item\.value\)\}/);
  });

  it('selected month/year cell uses the Figma filled-black style', () => {
    assert.match(src, /isSelected[\s\S]*?bg-\[#121217\]\s*text-white/);
  });

  it('selected picker cell (Feb/2025) hovers to Etendo yellow #FFD500 (active-button hover convention)', () => {
    assert.match(src, /isSelected[\s\S]*?bg-\[#121217\] text-white hover:bg-\[#FFD500\] hover:text-\[#121217\]/);
  });

  it('non-selected cells get the subtle gray hover, not yellow', () => {
    assert.match(src, /:\s*['"]text-\[#121217\] hover:bg-\[rgba\(18,18,23,0\.05\)\]['"]/);
  });
});
