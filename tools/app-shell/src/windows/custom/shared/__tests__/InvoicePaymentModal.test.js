import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'InvoicePaymentModal.jsx'), 'utf8');

describe('InvoicePaymentModal', () => {

  // ── Exports ────────────────────────────────────────────────────────────────

  it('exports InvoicePaymentModal as the default export', () => {
    assert.match(src, /export default function InvoicePaymentModal/);
  });

  it('exports PaymentRegisterForm as a named export', () => {
    assert.match(src, /export function PaymentRegisterForm/);
  });

  it('accepts invoiceId, invoiceData, specName, token, apiBaseUrl, and onClose props', () => {
    assert.match(src, /invoiceId/);
    assert.match(src, /invoiceData/);
    assert.match(src, /specName/);
  });

  // ── Installment label ──────────────────────────────────────────────────────

  it('uses the installment i18n key for the card header label', () => {
    assert.match(src, /ui\('installment'\)/);
  });

  it('appends a 1-based index to the installment label', () => {
    assert.match(src, /ui\('installment'\)\s*\}\s*\{\s*idx\s*\+\s*1/);
  });

  // ── Percentage removed ─────────────────────────────────────────────────────

  it('does not compute or render a percentage of total per installment', () => {
    assert.doesNotMatch(src, /Math\.round\(instAmount\s*\/\s*\(/);
    assert.doesNotMatch(src, /\{.*instAmount.*\/.*localTotal.*\*\s*100.*\}%/);
  });

  // ── Summary header ─────────────────────────────────────────────────────────

  it('shows invoice number and Payments title in the modal header', () => {
    assert.match(src, /ui\('invoiceNumber'\)/);
    assert.match(src, /ui\('payments'\)/);
  });

  it('displays total paid and outstanding amounts in the summary row', () => {
    assert.match(src, /ui\('paidAmount'\)/);
    assert.match(src, /ui\('outstandingLabel'\)/);
    assert.match(src, /localPaid/);
    assert.match(src, /localOutstanding/);
  });

  // ── Status classification ──────────────────────────────────────────────────

  it('classifies installments as paid when outstandingAmount is 0', () => {
    assert.match(src, /instOutstanding\s*<=\s*0\s*\?\s*'paid'/);
  });

  it('classifies installments as partial when paid > 0 and outstanding > 0', () => {
    assert.match(src, /instPaid\s*>\s*0\s*\?\s*'partial'\s*:\s*'pending'/);
  });

  it('renders the statusPartiallyExecuted badge label for partial installments', () => {
    assert.match(src, /ui\('statusPartiallyExecuted'\)/);
  });

  it('defines BADGE_STYLES for paid, partial, overdue, and pending states', () => {
    assert.match(src, /BADGE_STYLES/);
    assert.match(src, /paid:/);
    assert.match(src, /partial:/);
    assert.match(src, /overdue:/);
    assert.match(src, /pending:/);
  });

  // ── Data fetching ──────────────────────────────────────────────────────────

  it('fetches installments from the specName paymentPlan endpoint with parentId', () => {
    assert.match(src, /\$\{specName\}\/paymentPlan\?parentId=\$\{invoiceId\}/);
  });

  it('fetches payment history via the invoicePayments action', () => {
    assert.match(src, /action\/invoicePayments/);
  });

  it('fetches installments and payments in parallel on mount', () => {
    assert.match(src, /fetchInstallments/);
    assert.match(src, /fetchPayments/);
  });

  it('re-fetches installments and payments after a payment is registered', () => {
    assert.match(src, /handlePaymentSuccess/);
  });

  // ── Sorting ────────────────────────────────────────────────────────────────

  it('sorts installments by due date ascending', () => {
    assert.match(src, /\.sort\(/);
    assert.match(src, /a\.dueDate/);
    assert.match(src, /b\.dueDate/);
  });

  // ── Payment direction routing ──────────────────────────────────────────────

  it('routes to payment-out for purchase-invoice and payment-in otherwise', () => {
    assert.match(src, /purchase-invoice.*payment-out|payment-out.*purchase-invoice/s);
    assert.match(src, /payment-in/);
  });

  it('uses a paymentPrefix helper to resolve the direction', () => {
    assert.match(src, /function paymentPrefix/);
    assert.match(src, /paymentPrefix\(specName\)/);
  });

  // ── Register form ──────────────────────────────────────────────────────────

  it('shows the register payment button only for completed invoices with outstanding balance', () => {
    assert.match(src, /instOutstanding\s*>\s*0/);
    assert.match(src, /isCompleted/);
  });

  it('posts a new payment to the registerPayment action endpoint', () => {
    assert.match(src, /action\/registerPayment/);
    assert.match(src, /method:\s*'POST'/);
  });

  it('validates that the payment amount does not exceed the outstanding balance', () => {
    assert.match(src, /amountExceeded/);
  });

  it('fetches available financial accounts via the invoiceAccounts action', () => {
    assert.match(src, /action\/invoiceAccounts/);
  });

  it('sends the selected account id as fin_financial_account_id in the payment body', () => {
    assert.match(src, /fin_financial_account_id/);
  });

  // ── Cancellation ──────────────────────────────────────────────────────────

  it('closes the modal on backdrop click', () => {
    assert.match(src, /onClick={onClose}/);
    assert.match(src, /e\.stopPropagation/);
  });
});
