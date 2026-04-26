import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ListView } from '@/components/contract-ui';
import { useUI } from '@/i18n';
import BulkDocumentAction from '@/components/contract-ui/BulkDocumentAction';
import { useBulkActionToast } from '@/hooks/useBulkActionToast';
import HeaderTable from '@generated/purchase-invoice/generated/web/purchase-invoice/HeaderTable';
import HeaderPage from '@generated/purchase-invoice/generated/web/purchase-invoice/HeaderPage';
import InvoiceLineTableCustom from './InvoiceLineTableCustom.jsx';
import InvoicePreviewModal from '../shared/InvoicePreviewModal.jsx';
import PurchaseInvoiceTopbar from './PurchaseInvoiceTopbar.jsx';
import PurchaseInvoiceBottomPanel from './PurchaseInvoiceBottomPanel.jsx';
import RelatedDocuments from './RelatedDocuments.jsx';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';
import CreateContactModal from '@/components/contract-ui/CreateContactModal';
import { CreateContactContext } from '@/components/contract-ui/CreateContactContext.js';
import { useCreateContactModal } from '@/components/contract-ui/useCreateContactModal.js';

/* eslint-disable react/prop-types */

const LIST_COLUMNS = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string', label: 'Document No.' },
  { key: 'invoiceDate', column: 'DateInvoiced', type: 'date', label: 'Invoice Date' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector', label: 'Business Partner' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status', label: 'Document Status' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount', label: 'Total Gross Amount' },
];
// Mirrors artifacts/purchase-invoice/generated/web/purchase-invoice/HeaderPage.jsx
// Kept in sync manually because the generator does not expose it yet.
const LABEL_OVERRIDES = {
  es_ES: { POReference: 'Referencia de proveedor' },
  en_US: { POReference: 'Supplier reference' },
};

let previewRowSetterRef = null;

/**
 * PurchaseInvoiceTable — generated table wrapper that opens the preview modal.
 * Columns are driven by decisions.json via the generated HeaderTable.
 */
function PurchaseInvoiceTable(props) {
  return (
    <HeaderTable
      {...props}
      onNavigate={(row) => previewRowSetterRef?.(row)}
    />
  );
}

/**
 * Main entry point for the purchase-invoice custom window.
 *
 * Routing:
 *   - recordId present  → standard InvoicePage (new / edit mode)
 *   - no recordId       → custom list view with preview modal
 */
export default function PurchaseInvoiceWindow(props) {
  useBulkActionToast();
  const { recordId, token, apiBaseUrl, windowName } = props;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const ui = useUI();
  const [savedRecord, setSavedRecord] = useState(null);
  const [previewRow, setPreviewRow] = useState(null);
  const [cloneTargets, setCloneTargets] = useState(null);
  const { bpApiBaseUrl, headers, createContactState, setCreateContactState, createContactCtxValue } =
    useCreateContactModal({ apiBaseUrl, token });
  const breadcrumb = 'Purchases / Purchase Invoice';
  previewRowSetterRef = setPreviewRow;

  const summary = [
    { key: 'summedLineAmount', column: 'TotalLines', type: 'amount', label: ui('totalNetAmount') },
    { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount', label: ui('totalGrossAmount') },
    { key: 'totalPaid', column: 'Totalpaid', type: 'amount', label: ui('paidAmount') },
    { key: 'outstandingAmount', column: 'OutstandingAmt', type: 'amount', label: ui('outstandingAmount') },
  ];

  const customTabs = [{ key: 'related', label: ui('relatedDocuments'), Component: RelatedDocuments }];

  // Pick up the saved record from navigation state when arriving at the list view
  const effectiveRecord = savedRecord ?? location.state?.savedRecord ?? null;

  const clearSavedRecord = useCallback(() => {
    setSavedRecord(null);
    // Clear navigation state so the modal doesn't reappear on browser back/forward
    if (location.state?.savedRecord) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  if (recordId) {
    return (
      <CreateContactContext.Provider value={createContactCtxValue}>
        <HeaderPage
          {...props}
          DetailTable={InvoiceLineTableCustom}
          secondaryTabs={[]}
          summary={summary}
          extraBadges={[]}
          topbarRight={PurchaseInvoiceTopbar}
          bottomSection={PurchaseInvoiceBottomPanel}
          notesField="description"
          customTabs={customTabs}
          breadcrumb={breadcrumb}
          onAfterSave={true}
          addLineGuard={(d) => !!d?.businessPartner}
        />
        {createContactState && createPortal(
          <CreateContactModal
            bpApiBaseUrl={bpApiBaseUrl}
            headers={headers}
            initialQuery={createContactState.query}
            documentType="purchase"
            onClose={() => setCreateContactState(null)}
            onCreated={(newBP) => {
              createContactState.onSelect({ id: newBP.id, name: newBP.name });
              setCreateContactState(null);
            }}
          />,
          document.body,
        )}
      </CreateContactContext.Provider>
    );
  }

  const filterParam = searchParams.get('filter');
  const docStatus = searchParams.get('DocStatus');
  const initialColumnFilters = docStatus ? { documentStatus: docStatus } : undefined;

  const INVOICE_QUICK_FILTERS = [
    {
      label: 'overdueOnly',
      filter: `criteria=${encodeURIComponent(JSON.stringify([
        { fieldName: 'outstandingAmount', operator: 'greaterThan', value: 0 },
      ]))}`,
    },
  ];
  const initialQuickFilterIndex = filterParam === 'overdue' ? 0 : null;

  return (
    <>
      <ListView
        {...props}
        entity="header"
        Table={PurchaseInvoiceTable}
        entityLabel="Purchase Invoice"
        breadcrumb={breadcrumb}
        labelOverrides={LABEL_OVERRIDES}
        initialColumnFilters={initialColumnFilters}
        quickFilters={INVOICE_QUICK_FILTERS}
        initialQuickFilterIndex={initialQuickFilterIndex}
        dateFilterKey="invoiceDate"
        onCloneRow={(rowOrRows) => setCloneTargets(Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows])}
        bulkActions={(ctx) => <BulkDocumentAction {...ctx} />}
      />
      {cloneTargets && createPortal(
        <CloneOrderModal
          records={cloneTargets}
          apiBaseUrl={apiBaseUrl}
          headers={headers}
          routePrefix="/purchase-invoice/"
          errorKey="cloneInvoiceError"
          processingKey="invoiceProcessing"
          onClose={() => setCloneTargets(null)}
        />,
        document.body,
      )}
      {(previewRow || effectiveRecord) && (
        <InvoicePreviewModal
          invoice={previewRow || effectiveRecord}
          token={token}
          apiBaseUrl={apiBaseUrl}
          windowName={windowName}
          onClose={() => {
            setPreviewRow(null);
            clearSavedRecord();
          }}
          onEdit={(id) => {
            setPreviewRow(null);
            clearSavedRecord();
            navigate(`/${windowName}/${id}`);
          }}
        />
      )}
    </>
  );
}
