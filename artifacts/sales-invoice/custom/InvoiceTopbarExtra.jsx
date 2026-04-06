import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SendDocumentModal, { SendDocumentButton } from '@/components/contract-ui/SendDocumentModal';

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
  const [showSendModal, setShowSendModal] = useState(false);
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

  // Auto-open Send modal after Confirm & Send
  // Flag set by HeaderPage event listener, checked here on mount
  useEffect(() => {
    if (isCompleted && recordId) {
      const key = `invoice:sendAfterConfirm:${recordId}`;
      if (sessionStorage.getItem(key)) {
        sessionStorage.removeItem(key);
        setShowSendModal(true);
      }
    }
  }, [isCompleted, recordId]);

  // Derive badge status from installments (must be before any early return)
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

  if (!data?.documentStatus) return null;

  // Draft — only show Send button
  if (isDraft) {
    return (
      <>
        <SendDocumentButton onClick={() => setShowSendModal(true)} />
        {showSendModal && (
          <SendDocumentModal
            documentType="Invoice"
            documentNo={data?.documentNo}
            bpName={data?.['businessPartner$_identifier']}
            bpEmail={data?.['userContact$_identifier']}
            documentId={data?.id}
            windowName="sales-invoice"
            token={token}
            onClose={() => setShowSendModal(false)}
          />
        )}
      </>
    );
  }

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

      <SendDocumentButton onClick={() => setShowSendModal(true)} />

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

      {/* Send Invoice modal */}
      {showSendModal && (
        <SendDocumentModal
          documentType="Invoice"
          documentNo={data?.documentNo}
          bpName={data?.['businessPartner$_identifier']}
          bpEmail={data?.['userContact$_identifier']}
          documentId={data?.id}
          windowName="sales-invoice"
          token={token}
          onClose={() => setShowSendModal(false)}
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
                      invoiceData={invoiceData}
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

function InlineRegisterForm({ invoiceId, invoiceData, installment, currency, base, headers, onCancel, onSuccess }) {
  const installmentOutstanding = parseFloat(installment.outstandingAmount) || 0;
  const [amount, setAmount] = useState(installmentOutstanding);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resolvedOrgId, setResolvedOrgId] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // Find an existing payment for this invoice to get the correct account
        const pmId = invoiceData?.paymentMethod;
        const bpId = invoiceData?.businessPartner;
        let mapped = [];

        // Strategy 1: Find the account from existing payments for this BP + payment method
        if (pmId && bpId) {
          try {
            const payRes = await fetch(`${base}/payment-in/finPayment?businessPartner=${bpId}&_startRow=0&_endRow=5`, { headers });
            if (payRes.ok) {
              const payments = (await payRes.json())?.response?.data || [];
              const matching = payments.find(p => p.paymentMethod === pmId && p.account);
              if (matching) {
                mapped = [{ id: matching.account, name: matching['account$_identifier'] || 'Account' }];
                if (matching.organization) setResolvedOrgId(matching.organization);
              }
            }
          } catch { /* silent */ }
        }

        // Strategy 2: Fallback to selector
        if (mapped.length === 0) {
          const res = await fetch(`${base}/payment-in/finPayment/selectors/Fin_Financial_Account_ID?_startRow=0&_endRow=50`, { headers });
          if (res.ok) {
            const json = await res.json();
            const items = json.items || json?.response?.data || [];
            mapped = items.map(a => ({ id: a.id, name: a.label || a._identifier || a.name }));
          }
        }

        setAccounts(mapped);
        if (mapped.length > 0) setAccountId(mapped[0].id);
      } catch { /* silent */ }
      finally { setLoadingAccounts(false); }
    })();
  }, [base, headers, invoiceData?.paymentMethod, invoiceData?.businessPartner]);

  const amountExceeded = amount > installmentOutstanding;

  const handleSubmit = async () => {
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (amountExceeded) return;
    if (!accountId) { toast.error('Select an account'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${base}/sales-invoice/header/${invoiceId}/action/EM_APRM_Addpayment`, {
        method: 'POST', headers,
        body: JSON.stringify({
          fin_payment_id: 'null',
          trxtype: 'BPW',
          ad_org_id: invoiceData.organization || resolvedOrgId || '',
          payment_documentno: '<>',
          c_currency_id: invoiceData.currency,
          received_from: invoiceData.businessPartner,
          fin_paymentmethod_id: invoiceData.paymentMethod,
          actual_payment: String(amount),
          converted_amount: String(amount),
          expected_payment: String(installmentOutstanding),
          payment_date: date,
          fin_financial_account_id: accountId,
          conversion_rate: '1',
          transaction_type: 'I',
          document_action: '345',
          issotrx: true,
          reference_no: '',
          difference: '',
        }),
      });
      const resJson = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(resJson?.response?.message || resJson?.message || `Failed (${res.status})`);
      }
      if (resJson?.response?.error || resJson?.response?.status === -1) {
        throw new Error(resJson?.response?.error?.message || resJson?.response?.message?.text || 'Payment failed');
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

// SendInvoiceModal moved to shared SendDocumentModal component
// Kept here as dead code marker — safe to delete
function _REMOVED_SendInvoiceModal({ invoiceData, token, onClose }) {
  const docNo = invoiceData?.documentNo || '';
  const bpName = invoiceData?.['businessPartner$_identifier'] || '';
  const bpEmail = invoiceData?.['userContact$_identifier'] || '';
  const invoiceId = invoiceData?.id;

  const hasEmail = bpEmail && bpEmail.includes('@');
  const [to, setTo] = useState(hasEmail ? bpEmail : '');
  const [subject, setSubject] = useState(`Invoice #${docNo} — ${bpName}`);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const iframeRef = useCallback(node => { if (node) renderPreview(node); }, []);

  const reportId = 'print-sales-invoice';

  const renderPreview = async (iframe) => {
    if (!invoiceId || !token) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ format: 'html', params: { documentId: invoiceId } }),
      });
      if (!res.ok) throw new Error(`Preview failed (${res.status})`);
      const html = await res.text();
      iframe.src = 'about:blank';
      iframe.onload = () => {
        try { const doc = iframe.contentDocument; doc.open(); doc.write(html); doc.close(); } catch {}
        iframe.onload = null;
      };
    } catch (err) {
      setPdfError(err.message);
    }
    setPdfLoading(false);
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ format: 'html', params: { documentId: invoiceId } }),
      });
      if (!res.ok) throw new Error('Failed to render');
      const html = await res.text();
      const pdfRes = await fetch('/jsreport/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: { content: html, engine: 'none', recipe: 'chrome-pdf', chrome: { format: 'A4', marginTop: '10mm', marginBottom: '10mm', marginLeft: '10mm', marginRight: '10mm' } }, data: {} }),
      });
      if (!pdfRes.ok) throw new Error('PDF generation failed');
      const blob = await pdfRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${docNo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message);
    }
    setDownloading(false);
  };

  const handleSend = () => {
    setSending(true);
    setTimeout(() => {
      toast.success('Invoice sent ✓');
      setSending(false);
      onClose();
    }, 800);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 800, height: 560, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 12, backgroundColor: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '0.5px solid #E5E7EB' }}>

        {/* Header */}
        <div style={{ padding: '12px 16px', background: '#F5F5F5', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Send Invoice #{docNo}</span>
          </div>
          <button type="button" onClick={onClose} style={{ fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>&times;</button>
        </div>

        {/* Body — two columns */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left column — PDF preview (60%) */}
          <div style={{ width: '60%', display: 'flex', flexDirection: 'column', borderRight: '0.5px solid #E5E7EB' }}>
            <div style={{ flex: 1, position: 'relative', background: '#EFEFEF' }}>
              {pdfLoading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>Loading preview...</div>
              )}
              {pdfError && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', padding: 24, textAlign: 'center', gap: 8 }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#6B7280' }}>PDF preview</span>
                  <span style={{ fontSize: 13, color: '#9ca3af', maxWidth: 200 }}>The invoice PDF will appear here once document templates are configured</span>
                </div>
              )}
              <iframe ref={iframeRef} style={{ width: '100%', height: '100%', border: 'none', opacity: pdfLoading ? 0 : 1 }} title="Invoice preview" />
            </div>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 16px', borderTop: '0.5px solid #E5E7EB', background: '#fff', border: 'none', borderTop: '0.5px solid #E5E7EB', fontSize: 13, color: '#374151', cursor: downloading ? 'wait' : 'pointer', flexShrink: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {downloading ? 'Downloading...' : 'Download PDF'}
            </button>
          </div>

          {/* Right column — Email fields (40%) */}
          <div style={{ width: '40%', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', display: 'block', marginBottom: 4 }}>To</label>
              <input
                type="email"
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="email@company.com"
                style={{ width: '100%', fontSize: 13, padding: '8px 10px', border: `0.5px solid ${!to && !hasEmail ? '#ef4444' : '#d1d5db'}`, borderRadius: 6, outline: 'none', color: '#111827', boxSizing: 'border-box' }}
              />
              {!to && !hasEmail && (
                <span style={{ fontSize: 11, color: '#ef4444', marginTop: 3, display: 'block' }}>No email found for this contact</span>
              )}
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', display: 'block', marginBottom: 4 }}>Subject</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                style={{ width: '100%', fontSize: 13, padding: '8px 10px', border: '0.5px solid #d1d5db', borderRadius: 6, outline: 'none', color: '#111827', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', display: 'block', marginBottom: 4 }}>Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Add a personal message..."
                style={{ width: '100%', flex: 1, minHeight: 80, fontSize: 13, padding: '8px 10px', border: '0.5px solid #d1d5db', borderRadius: 6, outline: 'none', color: '#111827', resize: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F5F5F5', borderTop: '1px solid #E5E5E5', padding: '10px 16px', flexShrink: 0 }}>
          <button type="button" onClick={onClose} style={{ fontSize: 13, padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB', background: 'transparent', color: '#6B7280', cursor: 'pointer' }}>Cancel</button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!to.trim() || sending}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, padding: '6px 16px', borderRadius: 6, border: 'none', background: '#18181b', color: '#fff', cursor: (!to.trim() || sending) ? 'not-allowed' : 'pointer', opacity: (!to.trim() || sending) ? 0.4 : 1 }}
          >
            {sending ? 'Sending...' : (
              <>
                Send
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
