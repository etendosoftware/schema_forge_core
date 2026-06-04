import { useMemo, useState, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { LinesBottomSection, LinesEmptyState } from '@/components/contract-ui';
import ImportFromPurchaseOrderModal from './ImportFromPurchaseOrderModal.jsx';
import ImportFromPurchaseInvoiceModal from './ImportFromPurchaseInvoiceModal.jsx';
import RelatedDocuments from './RelatedDocuments.jsx';
import { useUI } from '@/i18n';

/**
 * Goods Receipt bottom section. Delegates to the shared LinesBottomSection
 * for the Docs/Notes layout (no totals — shipment-style document) and exposes
 * "Importar desde pedido de compra" as a dropdown menu item under the
 * "+ Añadir línea" button instead of as a separate link beneath it.
 */
export default function GoodsReceiptBottomPanel(props) {
  return (
    <LinesBottomSection
      {...props}
      relatedDocuments={RelatedDocuments}
      showTotals={false}
    />
  );
}
GoodsReceiptBottomPanel.showLineTotals = false;

function UploadArrowIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function InvoiceDocIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function useImportModals({ recordId, bpId, base, headers, onRefresh }) {
  const [showImportOrderModal, setShowImportOrderModal] = useState(false);
  const [showImportInvoiceModal, setShowImportInvoiceModal] = useState(false);

  const importModals = (
    <>
      {showImportOrderModal && createPortal(
        <ImportFromPurchaseOrderModal
          receiptId={recordId}
          bpId={bpId}
          base={base}
          headers={headers}
          onClose={() => setShowImportOrderModal(false)}
          onSuccess={() => { setShowImportOrderModal(false); onRefresh?.(); }}
        />,
        document.body,
      )}
      {showImportInvoiceModal && createPortal(
        <ImportFromPurchaseInvoiceModal
          receiptId={recordId}
          bpId={bpId}
          base={base}
          headers={headers}
          onClose={() => setShowImportInvoiceModal(false)}
          onSuccess={() => { setShowImportInvoiceModal(false); onRefresh?.(); }}
        />,
        document.body,
      )}
    </>
  );

  return { importModals, setShowImportOrderModal, setShowImportInvoiceModal };
}

function ReceiptLinesEmptyState({ data, onAddLine, recordId, token, apiBaseUrl, onRefresh }) {
  const ui = useUI();
  const bpId = data?.businessPartner;
  const base = useMemo(() => (apiBaseUrl || '').replace(/\/[^/]+$/, ''), [apiBaseUrl]);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);
  const { importModals, setShowImportOrderModal, setShowImportInvoiceModal } = useImportModals({ recordId, bpId, base, headers, onRefresh });

  const secondaryActions = bpId ? (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
      <button
        type="button"
        data-testid="action-import-purchase-order-empty-state"
        onClick={() => setShowImportOrderModal(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '0.5px solid #888', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', background: 'transparent', cursor: 'pointer' }}
      >
        <UploadArrowIcon size={13} />
        {ui('importFromPurchaseOrder')}
      </button>
      <button
        type="button"
        data-testid="action-import-purchase-invoice-empty-state"
        onClick={() => setShowImportInvoiceModal(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '0.5px solid #888', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', background: 'transparent', cursor: 'pointer' }}
      >
        <InvoiceDocIcon size={13} />
        {ui('importFromPurchaseInvoice')}
      </button>
    </div>
  ) : null;

  return (
    <>
      <LinesEmptyState
        data={data}
        onAddLine={onAddLine}
        description={ui('addLinesManuallyOrImportFromPurchaseOrderOrInvoice')}
        secondaryAction={secondaryActions}
      />
      {importModals}
    </>
  );
}

// forwardRef so DetailView can imperatively trigger the import modal from a
// dropdown menu item under the "+ Añadir línea" button — see lineMenuActions
// below. `hideTrigger` suppresses the visible inline link (we use the menu
// item instead) but the modal portal stays mounted.
const ReceiptLineActions = forwardRef(function ReceiptLineActions(
  { data, recordId, token, apiBaseUrl, onRefresh, hideTrigger = false },
  ref,
) {
  const ui = useUI();
  const isDraft = data?.documentStatus === 'DR';
  const bpId = data?.businessPartner;
  const base = useMemo(() => (apiBaseUrl || '').replace(/\/[^/]+$/, ''), [apiBaseUrl]);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);
  const { importModals, setShowImportOrderModal, setShowImportInvoiceModal } = useImportModals({ recordId, bpId, base, headers, onRefresh });

  useImperativeHandle(ref, () => ({
    openImportModal: () => setShowImportOrderModal(true),
    openImportInvoiceModal: () => setShowImportInvoiceModal(true),
  }), []);

  if (!isDraft || !bpId) return null;

  return (
    <>
      {!hideTrigger && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => setShowImportOrderModal(true)}
            style={{ all: 'unset', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-secondary, #6b7280)', cursor: 'pointer' }}
          >
            <UploadArrowIcon size={12} />
            {ui('importFromPurchaseOrder')}
          </button>
          <button
            type="button"
            onClick={() => setShowImportInvoiceModal(true)}
            style={{ all: 'unset', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-secondary, #6b7280)', cursor: 'pointer' }}
          >
            <InvoiceDocIcon size={12} />
            {ui('importFromPurchaseInvoice')}
          </button>
        </div>
      )}
      {importModals}
    </>
  );
});

GoodsReceiptBottomPanel.linesEmptyState = ReceiptLinesEmptyState;
GoodsReceiptBottomPanel.detailExtraActions = ReceiptLineActions;

/**
 * Builds the menu items for the "+ Añadir línea" chevron dropdown. Plain
 * function (NOT a hook) so DetailView's hook order stays consistent. The
 * `importRef` points at ReceiptLineActions mounted with `hideTrigger`, which
 * exposes `openImportModal` via useImperativeHandle.
 */
GoodsReceiptBottomPanel.lineMenuActions = function lineMenuActions({ data, importRef }) {
  const isDraft = data?.documentStatus === 'DR';
  const bpId = data?.businessPartner;
  if (!isDraft || !bpId) return [];
  return [
    {
      key: 'import-purchase-order',
      label: 'importFromPurchaseOrder',
      onClick: () => importRef.current?.openImportModal?.(),
    },
    {
      key: 'import-purchase-invoice',
      label: 'importFromPurchaseInvoice',
      onClick: () => importRef.current?.openImportInvoiceModal?.(),
    },
  ];
};
