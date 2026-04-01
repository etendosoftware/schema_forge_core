import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_LABELS = {
  RPAP: 'Awaiting Payment', RPPC: 'Payment Cleared', RPR: 'Payment Received',
  RDNC: 'Deposited not Cleared', RPVOID: 'Voided', PPM: 'Payment Made',
};

function fmt(val, curr) {
  const n = typeof val === 'string' ? parseFloat(val) : (val ?? 0);
  if (curr) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: curr }).format(n);
    } catch { /* fallback if currency code is invalid */ }
  }
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Classify an installment into a status category */
function classifyInstallment(inst) {
  const outstanding = parseFloat(inst.outstandingAmount) || 0;
  const paid = parseFloat(inst.paidAmount) || 0;
  const overdue = parseInt(inst.daysOverdue, 10) || 0;

  if (outstanding <= 0) return 'paid';
  if (overdue > 0 && outstanding > 0) return 'overdue';
  if (paid > 0 && outstanding > 0) return 'partial';
  return 'pending';
}

const BADGE_STYLES = {
  paid:    { bg: '#d1fae5', color: '#065f46', dot: '#10b981', accent: '#10b981' },
  partial: { bg: '#dbeafe', color: '#1e3a5f', dot: '#3b82f6', accent: '#3b82f6' },
  overdue: { bg: '#fee2e2', color: '#991b1b', dot: '#ef4444', accent: '#ef4444' },
  pending: { bg: '#fef3c7', color: '#78350f', dot: '#f59e0b', accent: '#f59e0b' },
};

/**
 * InvoiceTopbarExtra — installment-aware payment status for the detail view topbar.
 *
 * Fetches paymentPlan installments on mount and derives badge status:
 * - All paid -> Green "Paid . total"
 * - Some partial, none overdue -> Blue "Partial . paid of total"
 * - Any overdue -> Red "Overdue . outstanding"
 * - None paid, none overdue -> Amber "Pending . outstanding"
 * - Draft -> nothing
 *
 * The badge is the ONLY entry point. Clicking it opens the payments modal.
 */
export default function InvoiceTopbarExtra({ data, recordId, token, apiBaseUrl, api }) {
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [installments, setInstallments] = useState([]);
  const [installmentsLoading, setInstallmentsLoading] = useState(true);

  const base = useMemo(() => (apiBaseUrl || '').replace(/\/[^/]+$/, ''), [apiBaseUrl]);
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const currency = data?.['currency$_identifier'] || '';
  const grandTotal = data?.grandTotalAmount ?? 0;
  const isDraft = data?.documentStatus === 'DR';
  const isCompleted = data?.documentStatus === 'CO';

  // Fetch installments once on mount (for badge calculation)
  const fetchInstallments = useCallback(async () => {
    if (!recordId || !base) { setInstallmentsLoading(false); return; }
    try {
      const res = await fetch(
        `${base}/sales-invoice/paymentPlan?parentId=${recordId}&_startRow=0&_endRow=50`,
        { headers },
      );
      if (res.ok) {
        const json = await res.json();
        setInstallments(json?.response?.data || []);
      }
    } catch { /* silent */ }
    finally { setInstallmentsLoading(false); }
  }, [recordId, base, headers]);

  useEffect(() => { fetchInstallments(); }, [fetchInstallments]);

  if (!data?.documentStatus || isDraft) return null;

  // Derive badge status from installments
  const badgeInfo = useMemo(() => {
    if (installmentsLoading || installments.length === 0) return null;

    const classified = installments.map(inst => ({
      ...inst,
      _status: classifyInstallment(inst),
    }));

    const allPaid = classified.every(i => i._status === 'paid');
    const anyOverdue = classified.some(i => i._status === 'overdue');
    const hasSomePaid = classified.some(i => i._status === 'paid') || classified.some(i => i._status === 'partial');

    const sumPaid = classified.reduce((s, i) => s + (parseFloat(i.paidAmount) || 0), 0);
    const sumOutstanding = classified.reduce((s, i) => s + (parseFloat(i.outstandingAmount) || 0), 0);
    const sumTotal = classified.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

    if (allPaid) {
      return { type: 'paid', label: `Paid · ${fmt(sumTotal, currency)}`, style: BADGE_STYLES.paid };
    }
    if (anyOverdue) {
      return {
        type: 'overdue',
        label: `Overdue · ${fmt(sumOutstanding, currency)}`,
        style: BADGE_STYLES.overdue,
      };
    }
    if (hasSomePaid) {
      return {
        type: 'partial',
        label: `Partial · ${fmt(sumPaid, currency)} of ${fmt(sumTotal, currency)}`,
        style: BADGE_STYLES.partial,
      };
    }
    return { type: 'pending', label: `Pending · ${fmt(sumOutstanding, currency)}`, style: BADGE_STYLES.pending };
  }, [installments, installmentsLoading, currency]);

  // Summary amounts from installments
  const totalPaid = useMemo(() =>
    installments.reduce((sum, i) => sum + (parseFloat(i.paidAmount) || 0), 0),
    [installments],
  );
  const totalOutstanding = useMemo(() =>
    installments.reduce((sum, i) => sum + (parseFloat(i.outstandingAmount) || 0), 0),
    [installments],
  );

  // While loading, show a subtle placeholder
  if (installmentsLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground" style={{ padding: '4px 12px' }}>
        Loading...
      </span>
    );
  }

  // No installments found — fallback badge from header-level data
  if (!badgeInfo) {
    const outstanding = data?.outstandingAmount ?? grandTotal;
    const paid = grandTotal - outstanding;
    const isPaid = paid > 0 && outstanding <= 0;
    const isPending = outstanding > 0 && paid <= 0;
    const isPartial = paid > 0 && outstanding > 0;

    let fallbackStyle = null;
    let fallbackLabel = null;
    if (isPaid) {
      fallbackStyle = BADGE_STYLES.paid;
      fallbackLabel = `Paid · ${fmt(grandTotal, currency)}`;
    } else if (isPartial) {
      fallbackStyle = BADGE_STYLES.partial;
      fallbackLabel = `Partial · ${fmt(paid, currency)} of ${fmt(grandTotal, currency)}`;
    } else if (isPending && isCompleted) {
      fallbackStyle = BADGE_STYLES.pending;
      fallbackLabel = `Pending · ${fmt(outstanding, currency)}`;
    }

    if (!fallbackStyle) return null;

    return (
      <button
        type="button"
        onClick={() => setShowPaymentsModal(true)}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium hover:opacity-80 cursor-pointer h-9"
        style={{
          padding: '0 12px',
          borderRadius: '8px',
          backgroundColor: fallbackStyle.bg,
          color: fallbackStyle.color,
        }}
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: fallbackStyle.dot }} />
        {fallbackLabel}
        <span style={{ opacity: 0.6, marginLeft: 4 }}>View &rarr;</span>
      </button>
    );
  }

  return (
    <>
      {/* Badge pill — sole entry point to payments modal */}
      <button
        type="button"
        onClick={() => setShowPaymentsModal(true)}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium hover:opacity-80 cursor-pointer h-9"
        style={{
          padding: '0 12px',
          borderRadius: '8px',
          backgroundColor: badgeInfo.style.bg,
          color: badgeInfo.style.color,
        }}
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: badgeInfo.style.dot }} />
        {badgeInfo.label}
        <span style={{ opacity: 0.6, marginLeft: 4 }}>View &rarr;</span>
      </button>

      {/* View payments modal — installment breakdown */}
      {showPaymentsModal && (
        <ViewPaymentsModal
          recordId={recordId}
          invoiceData={data}
          installments={installments}
          grandTotal={grandTotal}
          totalPaid={totalPaid}
          outstanding={totalOutstanding}
          currency={currency}
          base={base}
          headers={headers}
          isCompleted={isCompleted}
          onClose={() => setShowPaymentsModal(false)}
          onPaymentAdded={() => {
            fetchInstallments();
          }}
        />
      )}
    </>
  );
}

// ─── VIEW PAYMENTS MODAL (redesigned installment breakdown) ────────────────────

function ViewPaymentsModal({ recordId, invoiceData, installments, grandTotal, totalPaid, outstanding, currency, base, headers, isCompleted, onClose, onPaymentAdded }) {
  const [expandedInstallmentId, setExpandedInstallmentId] = useState(null);

  // Sort installments by due date
  const sorted = useMemo(() =>
    [...installments].sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate) : new Date(0);
      const db = b.dueDate ? new Date(b.dueDate) : new Date(0);
      return da - db;
    }),
    [installments],
  );

  const getInstallmentKey = (inst, idx) => inst.finPaymentScheduleID || inst.id || idx;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg max-h-[80vh] flex flex-col overflow-hidden"
        style={{ width: 400, border: '0.5px solid hsl(var(--border))' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: '14px 16px', borderBottom: '1px solid #E5E7EB', background: '#fff' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Payments</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            style={{ fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 4, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        {/* Summary */}
        <div style={{ background: '#F8F9FA' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div style={{ padding: '12px 14px', borderRight: '0.5px solid #E5E7EB' }}>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Invoice Total</div>
              <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 500, marginTop: 4 }}>{fmt(grandTotal, currency)}</div>
            </div>
            <div style={{ padding: '12px 14px', borderRight: '0.5px solid #E5E7EB' }}>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Paid</div>
              <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 500, marginTop: 4, color: '#10b981' }}>{fmt(totalPaid, currency)}</div>
            </div>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Outstanding</div>
              <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 500, marginTop: 4, color: outstanding > 0 ? '#f59e0b' : '#10b981' }}>{fmt(outstanding, currency)}</div>
            </div>
          </div>
        </div>

        {/* Installment list */}
        <div className="flex-1 overflow-y-auto" style={{ padding: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.length === 0 && (
              <p style={{ fontSize: 12, color: '#9ca3af', padding: '8px 0' }}>No installments found.</p>
            )}
            {sorted.map((inst, idx) => {
              const key = getInstallmentKey(inst, idx);
              const status = classifyInstallment(inst);
              const style = BADGE_STYLES[status];
              const instAmount = parseFloat(inst.amount) || 0;
              const isExpanded = expandedInstallmentId === key;

              return (
                <div
                  key={key}
                  style={{
                    borderLeft: `3px solid ${style.accent}`,
                    borderTop: '0.5px solid #E5E7EB',
                    borderRight: '0.5px solid #E5E7EB',
                    borderBottom: '0.5px solid #E5E7EB',
                    borderRadius: '0 6px 6px 0',
                    padding: '10px 12px',
                    background: '#fff',
                  }}
                >
                  {/* Line 1: amount + badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="tabular-nums" style={{ fontSize: 15, fontWeight: 600 }}>
                      {fmt(instAmount, currency)}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        padding: '2px 10px',
                        borderRadius: 9999,
                        backgroundColor: style.bg,
                        color: style.color,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: style.dot, flexShrink: 0 }} />
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </div>

                  {/* Line 2: due date + paid date */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: '#6B7280' }}>
                      Due {fmtDate(inst.dueDate)}
                    </span>
                    {status === 'paid' && inst.lastPaymentDate && (
                      <span style={{ fontSize: 12, color: '#6B7280' }}>
                        {fmtDate(inst.lastPaymentDate)}
                      </span>
                    )}
                  </div>

                  {/* Line 3 (Pending/Overdue only): Register or Cancel toggle */}
                  {(status === 'pending' || status === 'overdue') && isCompleted && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => setExpandedInstallmentId(isExpanded ? null : key)}
                        className="hover:underline"
                        style={{ fontSize: 12, fontWeight: 500, color: isExpanded ? '#6B7280' : '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {isExpanded ? 'Cancel' : 'Register \u2192'}
                      </button>
                    </div>
                  )}

                  {/* Inline register form */}
                  {isExpanded && (
                    <InlineRegisterForm
                      invoiceId={recordId}
                      installment={inst}
                      currency={currency}
                      base={base}
                      headers={headers}
                      onCancel={() => setExpandedInstallmentId(null)}
                      onSuccess={() => {
                        setExpandedInstallmentId(null);
                        toast.success('Payment registered');
                        if (onPaymentAdded) onPaymentAdded();
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end" style={{ background: '#F8F9FA', borderTop: '1px solid #E5E7EB', padding: '10px 16px' }}>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            style={{ fontSize: 13, padding: '4px 14px', borderRadius: 6, border: '0.5px solid #E5E7EB', background: 'transparent' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── INLINE REGISTER FORM (expands inside installment row) ───────────────────

function InlineRegisterForm({ invoiceId, installment, currency, base, headers, onCancel, onSuccess }) {
  const installmentOutstanding = parseFloat(installment.outstandingAmount) || 0;
  const [amount, setAmount] = useState(installmentOutstanding);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${base}/payment-in/finPayment/selectors/Fin_Financial_Account_ID?_startRow=0&_endRow=50`, { headers });
        if (res.ok) {
          const json = await res.json();
          const items = json.items || json?.response?.data || [];
          const mapped = items.map(a => ({ id: a.id, name: a.label || a._identifier || a.name }));
          setAccounts(mapped);
          if (mapped.length > 0) setAccountId(mapped[0].id);
        }
      } catch { /* silent */ }
      finally { setLoadingAccounts(false); }
    })();
  }, [base, headers]);

  const amountExceeded = amount > installmentOutstanding;

  const handleSubmit = async () => {
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (amountExceeded) return;
    if (!accountId) { toast.error('Select an account'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${base}/sales-invoice/header/${invoiceId}/action/aPRMAddpayment`, {
        method: 'POST', headers,
        body: JSON.stringify({ fieldValues: {
          amount: String(amount),
          paymentDate: date,
          fin_financial_account_id: accountId,
        } }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.response?.message || err?.message || `Failed (${res.status})`);
      }
      onSuccess();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ marginTop: 8, borderTop: '1px dashed #E5E7EB', paddingTop: 10, background: '#FAFBFC', borderRadius: '0 0 4px 0', padding: '10px 0 0 0' }}>
      {/* 2-column: Date + Amount */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="text-sm tabular-nums"
            style={{ width: '100%', border: '0.5px solid #E5E7EB', borderRadius: 4, padding: '6px 10px', outline: 'none' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Amount ({currency})</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            className="text-sm tabular-nums"
            style={{ width: '100%', border: '0.5px solid #E5E7EB', borderRadius: 4, padding: '6px 10px', outline: 'none' }}
          />
        </div>
      </div>

      {/* Outstanding hint */}
      <p className="flex items-center gap-1" style={{ fontSize: 11, color: '#92400e', marginTop: 6, marginBottom: 0 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
        Outstanding: {fmt(installmentOutstanding, currency)}
      </p>
      {amountExceeded && (
        <p className="flex items-center gap-1" style={{ fontSize: 11, color: '#dc2626', marginTop: 4, marginBottom: 0 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} />
          Amount cannot exceed the installment ({fmt(installmentOutstanding, currency)})
        </p>
      )}

      {/* Account selector — full width */}
      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Account</label>
        {loadingAccounts ? (
          <div className="text-sm text-muted-foreground" style={{ padding: '6px 10px' }}>Loading...</div>
        ) : (
          <Select value={accountId} onValueChange={setAccountId} disabled={accounts.length <= 1} required>
            <SelectTrigger className="focus:ring-2 focus:ring-primary" style={{ height: 32, fontSize: 13 }}>
              <SelectValue placeholder="Select account..." />
            </SelectTrigger>
            <SelectContent>
              {accounts.map(acc => (
                <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            fontSize: 12, fontWeight: 500, padding: '5px 12px', borderRadius: 6,
            border: '1px solid #E5E7EB', background: 'transparent', color: '#6B7280', cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || amountExceeded}
          style={{
            fontSize: 12, fontWeight: 500, padding: '5px 12px', borderRadius: 6,
            border: 'none', background: '#18181b', color: '#fff', cursor: (saving || amountExceeded) ? 'not-allowed' : 'pointer',
            opacity: (saving || amountExceeded) ? 0.4 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}
