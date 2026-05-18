import { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ListView } from '@/components/contract-ui';
import { useUI, useMenuLabel } from '@/i18n';
import BulkDocumentAction from '@/components/contract-ui/BulkDocumentAction';
import { useBulkActionToast } from '@/hooks/useBulkActionToast';
import { useRowDelete } from '@/hooks/useRowDelete';
import HeaderPage from '@generated/sales-invoice/generated/web/sales-invoice/HeaderPage';
import InvoiceHeaderTable from '@generated/sales-invoice/custom/InvoiceHeaderTable.jsx';
import InvoicePreview from '../shared/InvoicePreview.jsx';
import SalesInvoiceTopbar from './SalesInvoiceTopbar.jsx';
import InvoiceBottomPanel from '@generated/sales-invoice/custom/InvoiceBottomPanel.jsx';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';
import SendDocumentModal from '@/components/contract-ui/SendDocumentModal';
import CreateContactModal from '@/components/contract-ui/CreateContactModal';
import { CreateContactContext } from '@/components/contract-ui/CreateContactContext.js';
import { useCreateContactModal } from '@/components/contract-ui/useCreateContactModal.js';
import { useInvoicePdf } from '../shared/useInvoicePdf.js';

/* eslint-disable react/prop-types */

const LIST_COLUMNS = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string', label: 'Document No.' },
  { key: 'invoiceDate', column: 'DateInvoiced', type: 'date', label: 'Invoice Date' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector', label: 'Business Partner' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status', label: 'Document Status' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount', label: 'Total Gross Amount' },
];
// Mirrors artifacts/sales-invoice/decisions.json → window.labelOverrides.
// The list view here bypasses the generated HeaderPage and renders ListView
// directly, so the generator-emitted labelOverrides do not reach it. Mirror
// here until the wrapper consumes the spec's labelOverrides at runtime.
const LABEL_OVERRIDES = {
  es_ES: {
    OutstandingAmt: 'Pendiente de pago',
    em_etgo_delivery_status: 'Estado de entrega',
  },
  en_US: {
    OutstandingAmt: 'Pending Payment',
    em_etgo_delivery_status: 'Delivery Status',
  },
};

// Mirrors InvoiceHeaderTable columns (key + column + type only) so that
// buildAdvancedFilterCriteria can resolve filter modes on the first render,
// before DataTable fires onColumnsReady.
const OVERDUE_INITIAL_COLUMNS = [
  { key: 'invoiceDate', column: 'DateInvoiced', type: 'date' },
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
  { key: 'outstandingAmount', column: 'OutstandingAmt', type: 'amount' },
  { key: 'eTGODueDate', column: 'em_etgo_due_date', type: 'date' },
];

function SalesInvoiceTable(props) {
  return <InvoiceHeaderTable {...props} />;
}

/**
 * Main entry point for the sales-invoice custom window.
 *
 * Routing:
 *   - recordId present  → standard HeaderPage (new / edit mode)
 *   - no recordId       → ListView with lateral preview modal
 *
 * To add grid clone (single + multirecord), see sales-order/index.jsx as reference:
 *   1. import CloneOrderModal from '@/components/contract-ui/CloneOrderModal'
 *   2. add useState(null) for cloneTargets
 *   3. pass onCloneRow to ListView
 *   4. render CloneOrderModal portal with cloneActionName="cloneRecord" and invoice i18n keys
 */
export default function SalesInvoiceWindow(props) {
  useBulkActionToast();
  const { recordId, token, apiBaseUrl, windowName } = props;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const ui = useUI();
  const tMenu = useMenuLabel();
  const [savedRecord, setSavedRecord] = useState(null);
  const [cloneTargets, setCloneTargets] = useState(null);
  const [emailRow, setEmailRow] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { bpApiBaseUrl, headers, createContactState, setCreateContactState, createContactCtxValue } =
    useCreateContactModal({ apiBaseUrl, token });
  const { pdfUrl: emailPdfUrl, loading: emailPdfLoading } = useInvoicePdf(emailRow?.id ?? null, apiBaseUrl, token);
  const breadcrumb = 'Sales / Sales Invoice';

  const { requestDelete, deleteDialog } = useRowDelete({
    apiBaseUrl,
    entity: 'header',
    token,
    onSuccess: () => setRefreshKey(k => k + 1),
  });

  const rowQuickActions = useMemo(() => ({
    enabled: true,
    editMode: 'navigate',
    documentPreview: true,
    actions: {
      edit: { show: true },
      duplicate: { show: true },
      email: { show: true },
      delete: { show: true },
    },
    onEdit: (row) => navigate(`/${windowName}/${row.id}`),
    onClone: (row) => setCloneTargets([row]),
    onEmail: (row) => setEmailRow(row),
    onDelete: requestDelete,
  }), [navigate, windowName, requestDelete]);

  // Pick up the saved record from navigation state when arriving at the list view
  const effectiveRecord = savedRecord ?? location.state?.savedRecord ?? null;

  const clearSavedRecord = useCallback(() => {
    setSavedRecord(null);
    // Clear navigation state so the modal doesn't reappear on browser back/forward
    if (location.state?.savedRecord) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const draftModeOverride = { enabled: true, processField: 'documentAction', processValue: 'CO', label: 'Confirm', disableWhenEmpty: true };

  if (recordId) {
    return (
      <CreateContactContext.Provider value={createContactCtxValue}>
        <HeaderPage
          {...props}
          draftMode={draftModeOverride}
          bottomSection={InvoiceBottomPanel}
          topbarRight={SalesInvoiceTopbar}
          notesField="description"
          onAfterSave={true}
          refetchAfterSave={true}
          breadcrumb={breadcrumb}
        />
        {createContactState && createPortal(
          <CreateContactModal
            bpApiBaseUrl={bpApiBaseUrl}
            headers={headers}
            initialQuery={createContactState.query}
            documentType="sale"
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

  const isOverdue = filterParam === 'overdue';
  const isCollectionsDueToday = filterParam === 'collectionsDueToday';
  const isInvoiceFilter = isOverdue || isCollectionsDueToday;

  const todayISO = new Date().toISOString().slice(0, 10);

  const initialAdvancedFilter = isInvoiceFilter
    ? {
        rowOperator: 'and',
        conditions: [
          { field: 'documentStatus', operator: 'equals', value: 'CO' },
          { field: 'outstandingAmount', operator: 'greaterThan', value: 0 },
          ...(isCollectionsDueToday
            ? [{ field: 'eTGODueDate', operator: 'equals', value: todayISO }]
            : []),
        ],
      }
    : null;

  const initialColumnFilters = docStatus ? { documentStatus: docStatus } : undefined;

  return (
    <>
      <ListView
        {...props}
        entity="header"
        Table={SalesInvoiceTable}
        entityLabel="Sales Invoice"
        breadcrumb={breadcrumb}
        labelOverrides={LABEL_OVERRIDES}
        initialColumnFilters={initialColumnFilters}
        initialAdvancedFilter={initialAdvancedFilter}
        initialColumns={isInvoiceFilter ? OVERDUE_INITIAL_COLUMNS : null}
        dateFilterKey="invoiceDate"
        onCloneRow={(rowOrRows) => setCloneTargets(Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows])}
        rowQuickActions={rowQuickActions}
        bulkActions={(ctx) => <BulkDocumentAction {...ctx} />}
        refreshTrigger={refreshKey}
        renderPreview={({ row, onClose, onEdit }) => (
          <InvoicePreview
            invoice={row}
            specName="sales-invoice"
            token={token}
            apiBaseUrl={apiBaseUrl}
            windowName={windowName}
            onClose={onClose}
            onEdit={onEdit}
            onInvoiceUpdated={() => setRefreshKey(k => k + 1)}
          />
        )}
        externalPreviewRow={effectiveRecord}
        onExternalPreviewClose={clearSavedRecord}
      />
      {deleteDialog}
      {emailRow && createPortal(
        <SendDocumentModal
          documentType={tMenu('Sales Invoice')}
          documentNo={emailRow.documentNo}
          bpName={emailRow['businessPartner$_identifier']}
          bPartnerId={emailRow.businessPartner}
          apiBaseUrl={apiBaseUrl}
          documentId={emailRow.id}
          windowName={windowName}
          token={token}
          pdfBlobUrl={emailPdfUrl}
          pdfBlobLoading={emailPdfLoading}
          onClose={() => setEmailRow(null)}
        />,
        document.body,
      )}
      {cloneTargets && createPortal(
        <CloneOrderModal
          records={cloneTargets}
          apiBaseUrl={apiBaseUrl}
          headers={headers}
          routePrefix="/sales-invoice/"
          errorKey="cloneInvoiceError"
          processingKey="invoiceProcessing"
          onClose={() => setCloneTargets(null)}
          onCloned={() => setRefreshKey(k => k + 1)}
        />,
        document.body,
      )}
    </>
  );
}
