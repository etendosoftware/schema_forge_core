import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';
import InvoicePaymentModal from '../shared/InvoicePaymentModal.jsx';
import { useUI } from '@/i18n';
import { formatCurrency } from '@/lib/formatCurrency';

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

const btnCloneStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '5px 12px',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  border: '1px solid #D1D5DB',
  background: 'transparent',
  color: '#374151',
  cursor: 'pointer',
};

export default function PurchaseInvoiceTopbar({ data, recordId, token, apiBaseUrl, onRefresh }) {
  const navigate = useNavigate();
  const ui = useUI();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showClone, setShowClone] = useState(false);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  if (!data) return null;

  const docStatus = data.documentStatus;
  const currency = data['currency$_identifier'] || '';
  const grandTotal = data.grandTotalAmount ?? 0;
  const outstanding = data.outstandingAmount ?? grandTotal;
  const totalPaid = grandTotal - outstanding;
  const isFullyPaid = data.paymentComplete === true || data.paymentComplete === 'Y' || outstanding <= 0;
  const isCompleted = docStatus === 'CO';

  const handleBadgeClick = () => {
    if (isCompleted) setShowPaymentModal(true);
  };

  const handleModalClose = () => {
    setShowPaymentModal(false);
    onRefresh?.();
  };

  return (
    <>
      {recordId && (
        <>
          <button type="button" onClick={() => setShowClone(true)} style={btnCloneStyle}>
            <CopyIcon />{ui('cloneOrderBtn')}
          </button>
          {showClone && createPortal(
            <CloneOrderModal
              recordId={recordId}
              data={data}
              apiBaseUrl={apiBaseUrl}
              headers={headers}
              cloneActionName="cloneRecord"
              titleKey="cloneInvoiceConfirmTitle"
              bodyKey="cloneInvoiceConfirmBody"
              actionLabelKey="cloneInvoiceAction"
              errorKey="cloneInvoiceError"
              processingKey="invoiceProcessing"
              onClose={() => setShowClone(false)}
              onCloned={(newId) => {
                setShowClone(false);
                navigate(`/purchase-invoice/${newId}`);
              }}
            />,
            document.body,
          )}
        </>
      )}
      {/* Payment Status pill — only show for completed invoices */}
      {isCompleted && (
        isFullyPaid ? (
          <span
            className="inline-flex items-center gap-1.5 text-[13px] font-medium"
            style={{ padding: '4px 12px', borderRadius: '6px', backgroundColor: '#d1fae5', color: '#065f46', cursor: 'pointer' }}
            onClick={handleBadgeClick}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#10b981' }} />
            {ui('statusPaid')}
            <span style={{ opacity: 0.4 }}>&middot;</span>
            <span className="font-semibold tabular-nums">{formatCurrency(currency || 'USD', totalPaid)}</span>
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 text-[13px] font-medium"
            style={{ padding: '4px 12px', borderRadius: '6px', backgroundColor: '#fef3c7', color: '#78350f', cursor: 'pointer' }}
            onClick={handleBadgeClick}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#f59e0b' }} />
            {ui('statusPending')}
            <span style={{ opacity: 0.4 }}>&middot;</span>
            <span className="font-semibold tabular-nums">{formatCurrency(currency || 'USD', outstanding)}</span>
          </span>
        )
      )}

      {showPaymentModal && (
        <InvoicePaymentModal
          invoiceId={data.id}
          invoiceData={data}
          specName="purchase-invoice"
          token={token}
          apiBaseUrl={apiBaseUrl}
          onClose={handleModalClose}
        />
      )}
    </>
  );
}
