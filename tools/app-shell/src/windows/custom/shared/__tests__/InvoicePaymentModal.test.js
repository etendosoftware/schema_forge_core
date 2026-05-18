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

  it('accepts invoiceId, invoiceData, specName, apiBaseUrl, onClose, and onPaymentAdded props without token', () => {
    assert.match(src, /invoiceId/);
    assert.match(src, /invoiceData/);
    assert.match(src, /specName/);
    assert.match(src, /onPaymentAdded/);
    assert.doesNotMatch(src, /export default function InvoicePaymentModal\(\{[^}]*\btoken\b/s);
  });

  it('uses the centralized authenticated fetch hook instead of building Authorization locally', () => {
    assert.match(src, /useApiFetch/);
    assert.doesNotMatch(src, /Authorization:\s*`Bearer \$\{token\}`/);
    assert.doesNotMatch(src, /headers=\{headers\}/);
  });

  it('does not pass raw headers into PaymentRegisterForm', () => {
    assert.doesNotMatch(src, /export function PaymentRegisterForm\(\{[^}]*\bheaders\b/s);
    assert.doesNotMatch(src, /<PaymentRegisterForm[\s\S]*headers=\{headers\}/);
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

  it('calls onPaymentAdded after a successful payment registration', () => {
    assert.match(src, /onPaymentAdded\?\.\(\)/);
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

  // ── i18n paymentAmountInvalid (ETP-4005) ──────────────────────────────────

  it('uses ui(paymentAmountInvalid) for the invalid amount error message', () => {
    assert.match(src, /ui\('paymentAmountInvalid'\)/);
  });

  it('does not contain the hardcoded English string "Enter a valid amount"', () => {
    assert.doesNotMatch(src, /Enter a valid amount/);
  });

  // ── ETP-4005: payment validation branches ─────────────────────────────────

  describe('ETP-4005 — PaymentRegisterForm submit validation', () => {
    it('declares an invalidField state initialized to null', () => {
      assert.match(src, /\[invalidField, setInvalidField\] = useState\(null\)/);
    });

    it('marks the date field invalid and shows paymentDateRequired when date is empty', () => {
      // The first guard in handleSubmit: if (!date) ...
      assert.match(src, /if \(!date\) \{[^}]*setInvalidField\('date'\)[^}]*setError\(ui\('paymentDateRequired'\)\)[^}]*return;\s*\}/);
    });

    it('marks the amount field invalid and shows paymentAmountInvalid when amount is missing or non-positive', () => {
      assert.match(src, /if \(!amount \|\| amount <= 0\) \{[^}]*setInvalidField\('amount'\)[^}]*setError\(ui\('paymentAmountInvalid'\)\)[^}]*return;\s*\}/);
    });

    it('returns silently when amount exceeds outstanding (UI shows amountExceedsOutstanding warning already)', () => {
      // After the amount validity check: `if (amountExceeded) return;` with no
      // setError — the warning is already rendered separately.
      assert.match(src, /if \(amountExceeded\)\s*return;/);
    });

    it('marks the account field invalid and shows paymentAccountRequired when accountId is empty', () => {
      assert.match(src, /if \(!accountId\) \{[^}]*setInvalidField\('account'\)[^}]*setError\(ui\('paymentAccountRequired'\)\)[^}]*return;\s*\}/);
    });

    it('clears invalidField and error when all checks pass before posting the payment', () => {
      // After the four guards, the form resets the visual error state before
      // entering the network call.
      assert.match(src, /setInvalidField\(null\);\s*\n\s*setError\(null\);\s*\n\s*setSaving\(true\);/);
    });

    it('applies border-red-500 to the DateField wrapper when invalidField === "date"', () => {
      assert.match(src, /className=\{invalidField === 'date' \? 'border-red-500 focus-within:ring-red-500' : ''\}/);
    });

    it('clears the date-invalid marker as soon as the user picks a new date', () => {
      assert.match(src, /onChange=\{\(v\) => \{ setDate\(v\); if \(invalidField === 'date'\) setInvalidField\(null\); \}\}/);
    });

    it('shows the red asterisk after the paymentDate label (required indicator)', () => {
      assert.match(src, /ui\('paymentDate'\)\}\s*<span style=\{\{ color: '#dc2626' \}\}>\*<\/span>/);
    });

    it('disables the Confirm button when saving, amount exceeds outstanding, or date is empty', () => {
      assert.match(src, /disabled=\{saving \|\| amountExceeded \|\| !date\}/);
    });

    it('falls back to ui(paymentRequestFailed) when the response is not ok and the body has no error.message', () => {
      assert.match(src, /ui\('paymentRequestFailed'\)/);
    });

    it('does not contain hardcoded English fallbacks for the new ETP-4005 keys', () => {
      assert.doesNotMatch(src, /['"`]Payment date is required['"`]/);
      assert.doesNotMatch(src, /['"`]Select an account['"`]/);
      assert.doesNotMatch(src, /['"`]The payment could not be processed['"`]/);
    });
  });
});
