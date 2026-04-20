import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'InventoryCreateListModal.jsx'), 'utf8');

describe('InventoryCreateListModal', () => {
  it('exports a default function component', () => {
    assert.match(src, /export default function InventoryCreateListModal/);
  });

  it('accepts inventoryId, warehouseId, apiBaseUrl, token, onClose, onSuccess props', () => {
    assert.match(src, /\{\s*inventoryId.*warehouseId.*apiBaseUrl.*token.*onClose.*onSuccess\s*\}/s);
  });

  it('uses createPortal to render into document.body', () => {
    assert.match(src, /createPortal/);
    assert.match(src, /document\.body/);
  });

  it('POSTs to the generateList action endpoint', () => {
    assert.match(src, /\/action\/generateList/);
    assert.match(src, /method:\s*['"]POST['"]/);
  });

  it('includes QTY_OPTIONS with the four quantity range values', () => {
    assert.match(src, /QTY_OPTIONS/);
    assert.match(src, /value:\s*['"]N['"]/);
    assert.match(src, /value:\s*['"]=['"]/);
    assert.match(src, /value:\s*['"]<['"]/);
    assert.match(src, /value:\s*['"]>['"]/);
  });

  it('fetches product categories on mount', () => {
    assert.match(src, /M_Product_Category_ID/);
    assert.match(src, /useEffect/);
  });

  it('defaults productValue to percent wildcard', () => {
    assert.match(src, /useState\(['"]%['"]\)/);
  });

  it('calls onSuccess after successful generation', () => {
    assert.match(src, /onSuccess\(\)/);
  });

  it('disables the generate button while submitting', () => {
    assert.match(src, /disabled=\{submitting\}/);
  });

  it('uses useUI for i18n', () => {
    assert.match(src, /useUI/);
    assert.match(src, /from\s+['"]@\/i18n['"]/);
  });
});
