import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useUI } from '@/i18n';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';
import { generateReturnToVendorPdf, getReturnToVendorPdfLabels } from './useReturnToVendorPdf';
import ConfirmWithCreditButtonBase from '../shared/ConfirmWithCreditButtonBase';

function CloneButton({ onClick, label }) {
  return (
    <button type="button" onClick={onClick} data-testid="action-clone"
      style={{ padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', border: '1px solid #D1D5DB', background: 'transparent', color: '#6B7280', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
      </svg>
      {label}
    </button>
  );
}

export default function ConfirmWithCreditButton({ data, recordId, token, apiBaseUrl }) {
  const ui = useUI();
  const [cloneTargets, setCloneTargets] = useState(null);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);

  return (
    <ConfirmWithCreditButtonBase
      data={data} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl}
      entitySegment="returnToVendorShipment"
      invoiceRoute="/purchase-invoice/"
      invoiceType="facturaCompra"
      invoiceCreatedTitleKey="returnToVendor.invoiceCreatedTitle"
      generatePdfFn={generateReturnToVendorPdf}
      getPdfLabelsFn={getReturnToVendorPdfLabels}
      specName="return-to-vendor-shipment"
      entityName="returnToVendorShipment"
      confirmDrLabel={ui('confirmReturn')}
      confirmModalTitle={ui('returnToVendor.confirmModal.title')}
      infoRowPre={ui('returnToVendor.confirmModal.infoRowPre')}
      infoRowBold={ui('returnToVendor.confirmModal.infoRowBold')}
      infoRowPost={ui('returnToVendor.confirmModal.infoRowPost')}
      confirmWithInvoiceLabel={ui('returnToVendor.confirmModal.confirmWithInvoice')}
      extraActions={<CloneButton onClick={() => setCloneTargets([data])} label={ui('quickAction.clone')} />}
      extraPortals={cloneTargets && createPortal(
        <CloneOrderModal
          records={cloneTargets}
          apiBaseUrl={apiBaseUrl}
          headers={headers}
          headerEntity="returnToVendorShipment"
          routePrefix="/return-to-vendor-shipment/"
          onClose={() => setCloneTargets(null)}
        />,
        document.body,
      )}
    />
  );
}
