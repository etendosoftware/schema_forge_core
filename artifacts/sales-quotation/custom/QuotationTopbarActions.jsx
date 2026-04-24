import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import SendDocumentModal, { SendDocumentButton } from '@/components/contract-ui/SendDocumentModal';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';
import QuotationConfirmModal from './QuotationConfirmModal';
import SendToEvaluationModal from './SendToEvaluationModal';
import { useUI } from '@/i18n';

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

export default function QuotationTopbarActions({ data, recordId, token, apiBaseUrl }) {
  const navigate = useNavigate();
  const ui = useUI();
  const [showSend, setShowSend] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSendToEval, setShowSendToEval] = useState(false);
  const [showClone, setShowClone] = useState(false);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const status = data?.documentStatus;
  const isDraft = status === 'DR';
  const isUnderEvaluation = status === 'UE';

  if (!status) return null;

  return (
    <>
      {isDraft && (
        <button
          type="button"
          onClick={() => setShowSendToEval(true)}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors"
          style={{
            padding: '4px 14px', borderRadius: 6, border: 'none',
            background: '#185FA5', color: '#fff', fontWeight: 500, cursor: 'pointer',
          }}
        >
          {ui('soConfirmBtn')}
        </button>
      )}

      {isUnderEvaluation && (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors"
          style={{
            padding: '4px 14px', borderRadius: 6, border: 'none',
            background: '#185FA5', color: '#fff', fontWeight: 500, cursor: 'pointer',
          }}
        >
          {ui('soConfirmBtn')}
        </button>
      )}

      <button type="button" onClick={() => setShowClone(true)} style={btnCloneStyle}>
        <CopyIcon />{ui('cloneOrderBtn')}
      </button>

      <SendDocumentButton onClick={() => setShowSend(true)} />

      {showClone && createPortal(
        <CloneOrderModal
          recordId={recordId}
          data={data}
          apiBaseUrl={apiBaseUrl}
          headers={headers}
          cloneActionName="cloneRecord"
          headerEntity="quotation"
          onClose={() => setShowClone(false)}
          onCloned={(newId) => {
            setShowClone(false);
            navigate(`/sales-quotation/${newId}`);
          }}
        />,
        document.body,
      )}

      {showSendToEval && createPortal(
        <SendToEvaluationModal
          quotationId={recordId}
          data={data}
          token={token}
          apiBaseUrl={apiBaseUrl}
          onClose={() => setShowSendToEval(false)}
        />,
        document.body,
      )}

      {showConfirm && createPortal(
        <QuotationConfirmModal
          quotationId={recordId}
          data={data}
          token={token}
          apiBaseUrl={apiBaseUrl}
          onClose={() => setShowConfirm(false)}
        />,
        document.body,
      )}

      {showSend && createPortal(
        <SendDocumentModal
          documentType="Quotation"
          documentNo={data?.documentNo}
          bpName={data?.['businessPartner$_identifier']}
          bpEmail={data?.['userContact$_identifier']}
          documentId={recordId}
          windowName="sales-quotation"
          token={token}
          onClose={() => setShowSend(false)}
        />,
        document.body,
      )}
    </>
  );
}
