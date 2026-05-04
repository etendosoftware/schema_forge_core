import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'OrderDraftChips.jsx'), 'utf8');

describe('OrderDraftChips', () => {
  it('exports a default function component', () => {
    assert.match(src, /export default function OrderDraftChips/);
  });

  it('only renders when the order is in CO status', () => {
    assert.match(src, /documentStatus === 'CO'/);
  });

  it('uses the shared progress-tone helper for badge color', () => {
    assert.match(src, /from '@\/lib\/progressTone'/);
    assert.match(src, /getProgressTone/);
  });

  it('reuses TONE_STYLES from the status-tag tokens (success/warning/neutral)', () => {
    assert.match(src, /from '@\/components\/ui\/status-tag-tokens\.js'/);
    assert.match(src, /TONE_STYLES\[tone\]/);
  });

  it('computes deliveredPct from order-line quantities', () => {
    assert.match(src, /qtyOrdered > 0 \? qtyDelivered \/ qtyOrdered : 0/);
  });

  it('computes invoicedPct from grand totals', () => {
    assert.match(src, /totalOrder > 0 \? totalInvoiced \/ totalOrder : 0/);
  });

  it('renders Delivered and Invoiced progress badges unconditionally when state is loaded', () => {
    assert.match(src, /<ProgressBadge[^>]*soAllDelivered[^>]*pct=\{deliveredPct\}/s);
    assert.match(src, /<ProgressBadge[^>]*soAllInvoiced[^>]*pct=\{invoicedPct\}/s);
  });

  it('keeps the draft-pill chips for clickable navigation to in-progress documents', () => {
    assert.match(src, /<DraftPill/);
    assert.match(src, /goods-shipment\/\$\{shipmentsDraft\[0\]\.id\}/);
    assert.match(src, /sales-invoice\/\$\{invoiceDraft\.id\}/);
  });

  it('drops the legacy CompletionBadge gray-only treatment', () => {
    assert.doesNotMatch(src, /CompletionBadge/);
    assert.doesNotMatch(src, /background:\s*'#F3F4F6'/);
  });

  it('renders the rounded integer percent in the badge instead of a check icon', () => {
    assert.match(src, /Math\.round\(safePct \* 100\)/);
    assert.match(src, /\{percent\}%/);
    assert.doesNotMatch(src, /aria-hidden="true">✓<\/span>/);
  });

  it('clamps the percentage to the 0..1 range before rendering', () => {
    assert.match(src, /Math\.max\(0,\s*Math\.min\(1,\s*pct\)\)/);
  });
});
