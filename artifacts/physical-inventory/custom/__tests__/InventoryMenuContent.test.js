import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'InventoryMenuContent.jsx'), 'utf8');

describe('InventoryMenuContent', () => {
  it('exports a default function component', () => {
    assert.match(src, /export default function InventoryMenuContent/);
  });

  it('accepts data, recordId, token, apiBaseUrl, onClose props', () => {
    assert.match(src, /\{\s*data.*recordId.*token.*apiBaseUrl.*onClose\s*\}/s);
  });

  it('renders a create-list button and an update-quantities button', () => {
    assert.match(src, /createInventoryCountList/);
    assert.match(src, /updateListSystemCount/);
  });

  it('POSTs to the updateQuantities action endpoint', () => {
    assert.match(src, /\/action\/updateQuantities/);
    assert.match(src, /method:\s*['"]POST['"]/);
  });

  it('imports and renders InventoryCreateListModal', () => {
    assert.match(src, /import InventoryCreateListModal from/);
    assert.match(src, /InventoryCreateListModal/);
  });

  it('shows modal when create-list button is clicked', () => {
    assert.match(src, /setShowModal\(true\)/);
  });

  it('passes warehouse id from data prop to the modal', () => {
    assert.match(src, /data\?\.warehouse/);
  });

  it('uses useUI for i18n', () => {
    assert.match(src, /useUI/);
    assert.match(src, /from\s+['"]@\/i18n['"]/);
  });

  it('returns null when recordId is new', () => {
    assert.match(src, /recordId\s*===\s*['"]new['"]/);
  });

  it('returns null when data.processed is true', () => {
    assert.match(src, /data\?\.processed\s*===\s*true/);
  });
});
