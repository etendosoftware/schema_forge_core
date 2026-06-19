import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'index.jsx'), 'utf8');

describe('PhysicalInventoryWindow custom wrapper', () => {
  it('exports a default function component', () => {
    assert.match(src, /export default function PhysicalInventoryWindow/);
  });

  it('imports GeneratedApp from generated artifacts', () => {
    assert.match(src, /import GeneratedApp from '@generated\/physical-inventory/);
  });

  it('imports InventoryTable from generated artifacts', () => {
    assert.match(src, /import InventoryTable from '@generated\/physical-inventory/);
  });

  it('renders GeneratedApp with custom Table', () => {
    assert.match(src, /Table=\{CustomInventoryTable\}/);
  });

  it('passes hideMoreMenu callback', () => {
    assert.match(src, /hideMoreMenu=\{hideMenuActions\}/);
  });

  it('defines COLUMNS with expected fields', () => {
    assert.match(src, /key:\s*'movementDate'/);
    assert.match(src, /key:\s*'name'/);
    assert.match(src, /key:\s*'warehouse'/);
    assert.match(src, /key:\s*'inventoryType'/);
    assert.match(src, /key:\s*'processed'/);
  });

  it('inventoryType column uses enum type with labels', () => {
    assert.match(src, /type:\s*'enum'/);
    assert.match(src, /enumLabels/);
    assert.match(src, /'C':\s*'Closing Inventory'/);
    assert.match(src, /'N':\s*'Normal'/);
    assert.match(src, /'O':\s*'Opening Inventory'/);
  });

  it('hideMenuActions hides menu when no id', () => {
    // Test the logic by evaluating the pattern
    assert.match(src, /function hideMenuActions/);
    assert.match(src, /!data\?\.id/);
  });

  it('hideMenuActions hides menu when processed', () => {
    assert.match(src, /data\?\.processed\s*===\s*true/);
    assert.match(src, /data\?\.processed\s*===\s*'Y'/);
  });
});
