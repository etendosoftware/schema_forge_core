import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'CloneOrderModal.jsx'), 'utf8');

describe('CloneOrderModal', () => {
  it('exports a default function component', () => {
    assert.match(src, /export default function CloneOrderModal/);
  });

  it('accepts records, recordId, data, apiBaseUrl, headers, onClose, routePrefix, and onCloned props', () => {
    assert.match(src, /records/);
    assert.match(src, /recordId/);
    assert.match(src, /apiBaseUrl/);
    assert.match(src, /headers/);
    assert.match(src, /onClose/);
    assert.match(src, /onCloned/);
    assert.match(src, /routePrefix/);
  });

  it('builds items from records prop or falls back to recordId+data', () => {
    assert.match(src, /recordsProp/);
    assert.match(src, /items/);
  });

  it('calls the configured clone action endpoint via POST for each item', () => {
    assert.match(src, /action\/\$\{cloneActionName\}/);
    assert.match(src, /method:\s*'POST'/);
  });

  it('fetches cloned record details when routePrefix is set', () => {
    assert.match(src, /routePrefix/);
    assert.match(src, /Promise\.all/);
    assert.match(src, /setCloned/);
  });

  it('calls onClose after a successful clone without routePrefix', () => {
    assert.match(src, /onClose\(\)/);
  });

  it('shows an error message when the clone fails', () => {
    assert.match(src, /setError/);
    assert.match(src, /errorKey/);
  });

  it('has a loading state that disables the confirm button', () => {
    assert.match(src, /phase/);
    assert.match(src, /disabled.*cloning/s);
  });

  it('renders a modal overlay with click-outside-to-close', () => {
    assert.match(src, /overlay/);
    assert.match(src, /onClick.*onClose/);
  });

  it('shows business partner name from items', () => {
    assert.match(src, /businessPartner\$_identifier/);
  });

  it('shows document number and status badge from items', () => {
    assert.match(src, /documentNo/);
    assert.match(src, /documentStatus/);
    assert.match(src, /DocStatusTag/);
  });

  it('uses i18n via useUI', () => {
    assert.match(src, /useUI/);
    assert.match(src, /ui\(/);
  });

  it('uses cloneConfirmTitleOne and cloneConfirmTitleMany i18n keys', () => {
    assert.match(src, /cloneConfirmTitleOne/);
    assert.match(src, /cloneConfirmTitleMany/);
  });

  it('navigates to cloned record via routePrefix in done state', () => {
    assert.match(src, /handleRowClick/);
    assert.match(src, /navigate\(`\$\{routePrefix\}\$\{id\}`\)/);
  });
});
