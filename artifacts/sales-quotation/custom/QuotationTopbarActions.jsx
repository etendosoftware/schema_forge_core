import { useState } from 'react';
import { createPortal } from 'react-dom';
import SendDocumentModal, { SendDocumentButton } from '@/components/contract-ui/SendDocumentModal';

export default function QuotationTopbarActions({ data, recordId, token, apiBaseUrl }) {
  const [showSend, setShowSend] = useState(false);

  if (!data?.documentStatus) return null;

  return (
    <>
      <SendDocumentButton onClick={() => setShowSend(true)} />
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
