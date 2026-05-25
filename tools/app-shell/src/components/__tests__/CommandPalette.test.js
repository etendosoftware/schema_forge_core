import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'CommandPalette.jsx'), 'utf8');

describe('CommandPalette', () => {
  it('imports useMenuLabel from app shell core', () => {
    assert.match(src, /useMenuLabel/);
    assert.match(src, /from '@schema-forge\/app-shell-core'/);
  });

  it('destructures useMenuLabel together with useUI in the same core import', () => {
    assert.match(src, /import\s*\{[^}]*useMenuLabel[^}]*\}\s*from\s*'@schema-forge\/app-shell-core'/);
  });

  it('filters groups with !g.hidden', () => {
    assert.match(src, /\.filter\s*\(\s*g\s*=>\s*!g\.hidden\s*\)/);
  });

  it('filters items within groups with !i.hidden', () => {
    assert.match(src, /\.filter\s*\(\s*i\s*=>\s*!i\.hidden\s*\)/);
  });

  it('uses tMenu(group.group) for group headings', () => {
    assert.match(src, /tMenu\s*\(\s*group\.group\s*\)/);
    assert.match(src, /heading\s*=\s*\{?\s*tMenu\s*\(\s*group\.group\s*\)/);
  });

  it('uses tMenu(item.label) to produce translatedLabel for items', () => {
    assert.match(src, /const\s+translatedLabel\s*=\s*tMenu\s*\(\s*item\.label\s*\)/);
  });

  it('uses translatedLabel in the value prop of CommandItem', () => {
    assert.match(src, /value\s*=\s*\{`\$\{translatedLabel\}/);
  });

  it('value prop of CommandItem includes item.label and item.name for search fallback', () => {
    assert.match(src, /`\$\{translatedLabel\}\s*\$\{item\.label\}\s*\$\{item\.name\}`/);
  });

  it('renders translated label inside CommandItem span', () => {
    assert.match(src, /<span>\s*\{translatedLabel\}\s*<\/span>/);
  });

  it('does not hardcode English group names as literal strings outside JSX', () => {
    // Ensure 'Sales', 'Purchases', etc. are not literal strings used outside i18n calls
    assert.doesNotMatch(src, /heading\s*=\s*['"]Sales['"]/);
    assert.doesNotMatch(src, /heading\s*=\s*['"]Purchases['"]/);
    assert.doesNotMatch(src, /heading\s*=\s*['"]Finance['"]/);
  });

  it('calls useMenuLabel hook and assigns it to tMenu', () => {
    assert.match(src, /const\s+tMenu\s*=\s*useMenuLabel\s*\(\s*\)/);
  });

  it('skips groups where all items are hidden (returns null)', () => {
    assert.match(src, /visibleItems\.length\s*===\s*0\s*\)\s*return\s*null/);
  });
});
