import { useState, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ListView } from '@/components/contract-ui';
import { useUI } from '@/i18n';
import HeaderTable from '@generated/sales-invoice/generated/web/sales-invoice/HeaderTable';
import HeaderPage from '@generated/sales-invoice/generated/web/sales-invoice/HeaderPage';
import InvoicePreviewModal from '../purchase-invoice/InvoicePreviewModal.jsx';
import InvoiceTopbarExtra from '@generated/sales-invoice/custom/InvoiceTopbarExtra.jsx';
import InvoiceBottomPanel from '@generated/sales-invoice/custom/InvoiceBottomPanel.jsx';
import RelatedDocuments from '@generated/sales-invoice/custom/RelatedDocuments.jsx';

/* eslint-disable react/prop-types */

const LIST_COLUMNS = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string', label: 'Document No.' },
  { key: 'invoiceDate', column: 'DateInvoiced', type: 'date', label: 'Invoice Date' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string', label: 'Business Partner' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status', label: 'Document Status' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount', label: 'Total Gross Amount' },
];

let previewRowSetterRef = null;

/**
 * SalesInvoiceTable — generated table wrapper that opens the preview modal.
 */
function SalesInvoiceTable(props) {
  return (
    <HeaderTable
      columns={LIST_COLUMNS}
      {...props}
      onNavigate={(row) => previewRowSetterRef?.(row)}
    />
  );
}

/**
 * Main entry point for the sales-invoice custom window.
 *
 * Routing:
 *   - recordId present  → standard HeaderPage (new / edit mode)
 *   - no recordId       → ListView with lateral preview modal
 */
export default function SalesInvoiceWindow(props) {
  const { recordId, token, apiBaseUrl, windowName } = props;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const ui = useUI();
  const [savedRecord, setSavedRecord] = useState(null);
  const [previewRow, setPreviewRow] = useState(null);
  const breadcrumb = 'Sales / Sales Invoice';
  previewRowSetterRef = setPreviewRow;

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
      <HeaderPage
        {...props}
        bottomSection={InvoiceBottomPanel}
        topbarRight={InvoiceTopbarExtra}
        notesField="description"
        customTabs={[{ key: 'related', label: ui('relatedDocuments'), Component: RelatedDocuments }]}
        onAfterSave={true}
        addLineGuard={(d) => !!d?.businessPartner}
        breadcrumb={breadcrumb}
      />
    );
  }

  const filterParam = searchParams.get('filter');
  const docStatus = searchParams.get('DocStatus');
  const initialColumnFilters = docStatus ? { documentStatus: docStatus } : undefined;

  const INVOICE_QUICK_FILTERS = [
    { label: 'all' },
    { label: 'overdueOnly', rowFilter: (row) => Number(row.outstandingAmount ?? 0) > 0 },
  ];
  const initialQuickFilterIndex = filterParam === 'overdue' ? 1 : 0;

  return (
    <>
      <ListView
        {...props}
        entity="header"
        Table={SalesInvoiceTable}
        entityLabel="Sales Invoice"
        breadcrumb={breadcrumb}
        initialColumnFilters={initialColumnFilters}
        quickFilters={INVOICE_QUICK_FILTERS}
        initialQuickFilterIndex={initialQuickFilterIndex}
      />
      {(previewRow || effectiveRecord) && (
        <InvoicePreviewModal
          specName="sales-invoice"
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
