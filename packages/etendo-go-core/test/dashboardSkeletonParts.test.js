import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const componentsDir = join(__dirname, '..', 'src', 'onboarding', 'components');
const parts = readFileSync(join(componentsDir, 'dashboardSkeletonParts.jsx'), 'utf8');

// dashboardSkeletonParts.jsx (ETP-4662) — shared skeleton primitives extracted
// out of SetupPreviewMockup so AuthPreviewMockup (login/register right panel)
// can reuse the exact same visual pieces instead of a static localized image.
// These tests pin down the pieces both consumers depend on.
describe('dashboardSkeletonParts (ETP-4662)', () => {
  it('exports the skeleton color tokens', () => {
    assert.match(parts, /export const SKELETON_BG = 'bg-\[#E8EAEF\]'/);
    assert.match(parts, /export const ICON_COLOR = 'text-\[#828FA3\]'/);
  });

  it('exports MENU_GROUPS with the exact phosphor icons the real sidebar uses', () => {
    assert.match(parts, /export const MENU_GROUPS = \[/);
    assert.match(parts, /from '@phosphor-icons\/react'/);
    for (const icon of ['House', 'Star', 'IdentificationCard', 'TrendUp', 'Receipt', 'Package', 'Bank', 'Plug', 'Gear', 'Flask']) {
      assert.match(parts, new RegExp(`\\b${icon}\\b`), `expected phosphor icon ${icon}`);
    }
  });

  it('exports the table skeleton row/column constants', () => {
    assert.match(parts, /export const TABLE_ROW_1 = \[35, 29, 73, 90, 90\]/);
    assert.match(parts, /export const TABLE_ROW_2 = \[84, 54, 108, 130, 130\]/);
    assert.match(parts, /export const EMPTY_ROW_COUNT = 10/);
    assert.match(parts, /export const CELL_WIDTHS = \[112, 96, 132, 200, 200\]/);
  });

  it('exports a Bar skeleton pill sized by its width prop', () => {
    assert.match(parts, /export function Bar\(\{ width \}\)/);
    assert.match(parts, /style=\{\{ width: `\$\{width\}px` \}\}/);
    assert.match(parts, new RegExp(`inline-block h-3 rounded-full \\$\\{SKELETON_BG\\}`));
  });

  it('exports RailMenuItem composing an icon, a Bar label and an optional chevron', () => {
    assert.match(parts, /export function RailMenuItem\(\{ icon: Icon, width, hasChevron \}\)/);
    assert.match(parts, /<Icon size=\{20\} weight="regular" \/>/);
    assert.match(parts, /<Bar width=\{width\} \/>/);
    assert.match(parts, /\{hasChevron && <ChevronDown/);
  });

  it('exports Checkbox with a distinct checked visual (dark fill + check mark)', () => {
    assert.match(parts, /export function Checkbox\(\{ checked \}\)/);
    assert.match(parts, /border-\[#121217\] bg-\[#121217\]/);
    assert.match(parts, /border-\[#D1D4DB\] bg-white/);
    // Check mark svg only renders when checked.
    assert.match(parts, /\{checked && \(/);
    assert.match(parts, /<svg width="8" height="6"/);
  });

  it('exports TableRow rendering a Checkbox plus one Bar cell per width, using CELL_WIDTHS', () => {
    assert.match(parts, /export function TableRow\(\{ widths, tall, checked \}\)/);
    assert.match(parts, /<Checkbox checked=\{checked\} \/>/);
    assert.match(parts, /widths\.map\(\(barWidth, i\) =>/);
    assert.match(parts, /width: `\$\{CELL_WIDTHS\[i\]\}px`/);
    // Row height toggles between the default and the "tall" (selected) variant.
    assert.match(parts, /\$\{tall \? 'h-\[52px\]' : 'h-10'\}/);
  });
});
