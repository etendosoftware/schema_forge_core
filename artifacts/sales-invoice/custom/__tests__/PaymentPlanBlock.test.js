import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'PaymentPlanBlock.jsx'), 'utf8');

describe('PaymentPlanBlock', () => {

  // ── Exports ────────────────────────────────────────────────────────────────

  it('exports a default function component', () => {
    assert.match(src, /export default function PaymentPlanBlock/);
  });

  it('accepts recordId, data, token, and apiBaseUrl props', () => {
    assert.match(src, /\{\s*recordId.*data.*token.*apiBaseUrl\s*\}/);
  });

  // ── Guard — only shows for 2+ installments ─────────────────────────────────

  it('returns null when fewer than 2 installments are loaded', () => {
    assert.match(src, /installments\.length\s*<\s*2/);
  });

  it('guards rendering on the loaded flag as well', () => {
    assert.match(src, /!loaded\s*\|\|\s*installments\.length/);
  });

  // ── Data fetching ──────────────────────────────────────────────────────────

  it('fetches installments from the paymentPlan endpoint with parentId', () => {
    assert.match(src, /paymentPlan\?parentId=\$\{recordId\}/);
  });

  it('uses a cancellation flag to avoid setState after unmount', () => {
    assert.match(src, /let cancelled = false/);
    assert.match(src, /cancelled = true/);
  });

  // ── Installment label ──────────────────────────────────────────────────────

  it('uses the installment i18n key for the label', () => {
    assert.match(src, /ui\('installment'\)/);
  });

  it('appends a 1-based index to the installment label', () => {
    assert.match(src, /ui\('installment'\)\s*\}\s*\{\s*idx\s*\+\s*1/);
  });

  // ── Percentage removed ─────────────────────────────────────────────────────

  it('does not compute or render a percentage of total', () => {
    assert.doesNotMatch(src, /Math\.round/);
    assert.doesNotMatch(src, /const pct\s*=/);
    assert.doesNotMatch(src, /\{pct\}%/);
  });

  // ── Status classification ──────────────────────────────────────────────────

  it('classifies an installment as paid when outstandingAmount is 0', () => {
    assert.match(src, /outstanding\s*<=\s*0\s*\?\s*'paid'/);
  });

  it('classifies an installment as partial when paid > 0 and outstanding > 0', () => {
    assert.match(src, /paid\s*>\s*0\s*\?\s*'partial'\s*:\s*'pending'/);
  });

  it('defines badge colours for paid, partial, and pending states', () => {
    assert.match(src, /paid/);
    assert.match(src, /partial/);
    assert.match(src, /pending/);
  });

  // ── Sorting ────────────────────────────────────────────────────────────────

  it('sorts installments by due date ascending', () => {
    assert.match(src, /\.sort\(/);
    assert.match(src, /dueDate/);
  });

  // ── Section label ──────────────────────────────────────────────────────────

  it('displays the paymentPlan section title via i18n', () => {
    assert.match(src, /ui\('paymentPlan'\)/);
  });

  // ── Due date ──────────────────────────────────────────────────────────────

  it('renders the due date for each installment', () => {
    assert.match(src, /ui\('dueShort'\)/);
    assert.match(src, /fmtDate\(inst\.dueDate\)/);
  });
});
