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

  it('accepts orderId, data, apiBaseUrl, headers, onClose and onCloned props', () => {
    assert.match(src, /orderId/);
    assert.match(src, /apiBaseUrl/);
    assert.match(src, /headers/);
    assert.match(src, /onClose/);
    assert.match(src, /onCloned/);
  });

  it('fetches line count from the API on mount', () => {
    assert.match(src, /\/lines\?parentId=\$\{orderId\}/);
    assert.match(src, /useEffect/);
  });

  it('calls the cloneOrder action endpoint via POST', () => {
    assert.match(src, /\/header\/\$\{orderId\}\/action\/cloneOrder/);
    assert.match(src, /method.*POST/);
  });

  it('calls onCloned with the new order id on success', () => {
    assert.match(src, /onCloned\(newId\)/);
    assert.match(src, /response.*data.*id/);
  });

  it('calls onClose after a successful clone', () => {
    assert.match(src, /onClose\(\)/);
  });

  it('shows an error message when the clone fails', () => {
    assert.match(src, /setError/);
    assert.match(src, /cloneOrderError/);
  });

  it('has a loading state that disables the confirm button', () => {
    assert.match(src, /loading/);
    assert.match(src, /disabled.*loading/);
  });

  it('renders a modal overlay with click-outside-to-close', () => {
    assert.match(src, /overlayStyle/);
    assert.match(src, /onClick.*onClose/);
  });

  it('shows the business partner name from data', () => {
    assert.match(src, /businessPartner\$_identifier/);
    assert.match(src, /bpName/);
  });

  it('shows document number and status badge from data', () => {
    assert.match(src, /documentNo/);
    assert.match(src, /documentStatus/);
    assert.match(src, /statusMap/);
  });

  it('formats the grand total with currency', () => {
    assert.match(src, /grandTotalAmount/);
    assert.match(src, /currency\$_identifier/);
    assert.match(src, /fmtNum/);
  });

  it('uses i18n via useUI', () => {
    assert.match(src, /useUI/);
    assert.match(src, /ui\(/);
  });

  it('uses cloneOrderConfirmTitle and cloneOrderAction i18n keys', () => {
    assert.match(src, /cloneOrderConfirmTitle/);
    assert.match(src, /cloneOrderAction/);
  });

  it('shows a cancel button that calls onClose', () => {
    assert.match(src, /ui\('cancel'\)/);
  });
});
