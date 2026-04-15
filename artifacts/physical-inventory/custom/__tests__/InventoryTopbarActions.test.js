import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'InventoryTopbarActions.jsx'), 'utf8');

describe('InventoryTopbarActions', () => {
  it('exports a default function component', () => {
    assert.match(src, /export default function InventoryTopbarActions/);
  });

  it('accepts data, recordId, token, apiBaseUrl props', () => {
    assert.match(src, /\{\s*data.*recordId.*token.*apiBaseUrl\s*\}/s);
  });

  it('returns null when recordId is missing or new', () => {
    assert.match(src, /recordId.*===.*['"]new['"]/);
    assert.match(src, /return null/);
  });

  it('returns null when inventory is already processed', () => {
    assert.match(src, /isProcessed/);
    assert.match(src, /data\?\.processed/);
  });

  it('renders two IconBtn actions (list and update)', () => {
    assert.match(src, /createInventoryCountList/);
    assert.match(src, /updateListSystemCount/);
  });

  it('uses createPortal for tooltip rendering', () => {
    assert.match(src, /createPortal/);
    assert.match(src, /document\.body/);
  });

  it('imports and renders InventoryCreateListModal', () => {
    assert.match(src, /import InventoryCreateListModal from/);
    assert.match(src, /InventoryCreateListModal/);
  });

  it('POSTs to the updateQuantities action endpoint', () => {
    assert.match(src, /\/action\/updateQuantities/);
    assert.match(src, /method:\s*['"]POST['"]/);
  });

  it('uses useUI for i18n', () => {
    assert.match(src, /useUI/);
    assert.match(src, /from\s+['"]@\/i18n['"]/);
  });
});
