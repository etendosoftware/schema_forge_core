import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';
import InvoiceTopbarExtra from '@generated/sales-invoice/custom/InvoiceTopbarExtra';
import { useUI } from '@/i18n';

/* eslint-disable react/prop-types */

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

export default function SalesInvoiceTopbar({ data, recordId, token, apiBaseUrl, api, onProcess }) {
  const navigate = useNavigate();
  const ui = useUI();
  const [showClone, setShowClone] = useState(false);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  if (!data || !recordId) return null;

  return (
    <>
      <button type="button" onClick={() => setShowClone(true)} style={btnCloneStyle}>
        <CopyIcon />{ui('cloneOrderBtn')}
      </button>
      <InvoiceTopbarExtra
        data={data}
        recordId={recordId}
        token={token}
        apiBaseUrl={apiBaseUrl}
        api={api}
        onProcess={onProcess}
      />
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
            navigate(`/sales-invoice/${newId}`);
          }}
        />,
        document.body,
      )}
    </>
  );
}
