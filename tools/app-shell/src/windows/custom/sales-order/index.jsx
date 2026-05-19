import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUI } from '@/i18n';
import { useBulkActionToast } from '@/hooks/useBulkActionToast';
import { useRowDelete } from '@/hooks/useRowDelete';
import { buildPendingDeliveryFilter } from '../shared/pendingDeliveryFilter.js';
import { useSavedPreviewRecord } from '../shared/useSavedPreviewRecord.js';
import OrderPreview from '../shared/OrderPreview.jsx';
import GeneratedApp from '@generated/sales-order/generated/web/sales-order/index.jsx';
import HeaderTable from '@generated/sales-order/generated/web/sales-order/HeaderTable';
import OrderReactivateBulkAction from '@generated/sales-order/custom/OrderReactivateBulkAction';
import BulkOrderMoreMenu from '@generated/sales-order/custom/BulkOrderMoreMenu';
import { ConfirmModal, ConfirmResultModal, ManageDocsLauncher } from '@generated/sales-order/custom/OrderCreateInvoice';
import { ListView } from '@/components/contract-ui';

const LIST_COLUMNS = [
  { key: 'orderDate', column: 'DateOrdered', type: 'date', label: 'Order Date', dot: false },
  { key: 'documentNo', column: 'DocumentNo', type: 'string', label: 'Document No.' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector', label: 'Business Partner' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status', label: 'Document Status' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount', label: 'Total Gross Amount' },
  { key: 'invoiceStatus', column: 'InvoiceStatus', type: 'percent', label: 'Invoice Status' },
  { key: 'deliveryStatus', column: 'DeliveryStatus', type: 'percent', label: 'Shipment Status' },
];

function CustomHeaderTable(props) {
  return <HeaderTable columns={LIST_COLUMNS} {...props} />;
}
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';
import CreateContactModal from '@/components/contract-ui/CreateContactModal';
import { CreateContactContext } from '@/components/contract-ui/CreateContactContext.js';
import { useCreateContactModal } from '@/components/contract-ui/useCreateContactModal.js';
import LinesEmptyState from '@/components/contract-ui/LinesEmptyState.jsx';

// Mirrors artifacts/sales-order/decisions.json → window.labelOverrides.
// The list view here bypasses the generated HeaderPage and renders ListView
// directly, so the generator-emitted labelOverrides do not reach it. Mirror
// here until the wrapper consumes the spec's labelOverrides at runtime.
const LABEL_OVERRIDES = {
  es_ES: {
    C_BPartner_ID: 'Contacto',
    DeliveryStatus: 'Estado de entrega',
    InvoiceStatus: 'Estado de facturación',
  },
  en_US: {
    C_BPartner_ID: 'Contact',
    DeliveryStatus: 'Delivery Status',
    InvoiceStatus: 'Invoicing Status',
  },
};

const draftModeWithModal = {
  enabled: true,
  processField: 'documentAction',
  processValue: 'CO',
  label: 'soConfirmBtn',
  onConfirm: () => window.dispatchEvent(new CustomEvent('sales-order:open-confirm-modal')),
};

export default function SalesOrderWindow({ windowName, recordId, token, apiBaseUrl, ...rest }) {
  useBulkActionToast();
  const ui = useUI();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [cloneTargets, setCloneTargets] = useState(null);
  const [confirmRow, setConfirmRow] = useState(null);
  const [confirmedDocs, setConfirmedDocs] = useState(null);
  const [manageRow, setManageRow] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { requestDelete, deleteDialog } = useRowDelete({
    apiBaseUrl,
    entity: 'header',
    token,
    onSuccess: () => setRefreshKey(k => k + 1),
  });

  const { effectiveRecord, clearSavedRecord } = useSavedPreviewRecord();

  const renderPreview = useCallback(({ row, onClose, onEdit }) => (
    <OrderPreview
      order={row}
      token={token}
      apiBaseUrl={apiBaseUrl}
      windowName={windowName}
      specName="sales-order"
      onClose={onClose}
      onEdit={onEdit}
    />
  ), [token, apiBaseUrl, windowName]);

  const rowQuickActions = useMemo(() => ({
    enabled: true,
    editMode: 'navigate',
    statusField: 'documentStatus',
    actions: {
      edit: { show: true },
      duplicate: { show: true },
      delete: { show: true },
    },
    documentPreview: true,
    onEdit: (row) => navigate(`/${windowName}/${row.id}`),
    onClone: (row) => setCloneTargets([row]),
    onDelete: requestDelete,
    // Row kebab mirrors the detail page: Confirm for drafts (opens the same
    // ConfirmModal once the detail mounts via state.autoOpenConfirm), and
    // Reactivate for completed orders without linked documents — same gate as
    // the detail's menuActions.
    menuActions: ({ row, status }) => {
      // For completed orders, only surface "Gestionar..." when there is still
      // pending shipment or invoice — same criterion used by OrderCreateInvoice's
      // topbar button. We use the row's deliveryStatus / invoiceStatus percent
      // columns to avoid an extra fetch per row.
      const delivery = Number(row?.deliveryStatus ?? 100);
      const invoice  = Number(row?.invoiceStatus  ?? 100);
      const needsShip    = status === 'CO' && delivery < 100;
      const needsInvoice = status === 'CO' && invoice  < 100;
      let manageLabelKey = null;
      if      (needsShip && needsInvoice) manageLabelKey = 'soManageShipmentAndInvoice';
      else if (needsShip)                 manageLabelKey = 'soManageShipment';
      else if (needsInvoice)              manageLabelKey = 'soManageInvoice';
      return [
        {
          key: 'confirm',
          label: ui('soConfirmBtn'),
          visible: status === 'DR',
          onClick: ({ row: r }) => setConfirmRow(r),
        },
        {
          key: 'manage',
          label: manageLabelKey ? ui(manageLabelKey) : '',
          visible: !!manageLabelKey,
          onClick: ({ row: r }) => setManageRow(r),
        },
        {
          key: 'reactivate',
          label: ui('reactivate'),
          labelKey: 'reactivate',
          successKey: 'reactivated',
          documentAction: 'RE',
          visible: status === 'CO' && !row?.hasLinkedDocuments,
        },
      ];
    },
    onMenuActionExecuted: (action) => {
      if (action.documentAction) setRefreshKey(k => k + 1);
    },
  }), [navigate, windowName, requestDelete, ui]);

  const { bpApiBaseUrl, headers, createContactState, setCreateContactState, createContactCtxValue } =
    useCreateContactModal({ apiBaseUrl, token });

  if (recordId) {
    return (
      <CreateContactContext.Provider value={createContactCtxValue}>
        <GeneratedApp
          windowName={windowName}
          recordId={recordId}
          token={token}
          apiBaseUrl={apiBaseUrl}
          draftMode={draftModeWithModal}
          linesEmptyState={LinesEmptyState}
          {...rest}
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

  const { initialColumnFilters, isPendingDelivery, initialAdvancedFilter } =
    buildPendingDeliveryFilter(searchParams, 'deliveryStatus');

  return (
    <>
      <ListView
        entity="header"
        Table={CustomHeaderTable}
        entityLabel="Sales Order"
        windowName={windowName}
        breadcrumb="Sales / Sales Order"
        labelOverrides={LABEL_OVERRIDES}
        onCloneRow={(rowOrRows) => setCloneTargets(Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows])}
        rowQuickActions={rowQuickActions}
        token={token}
        apiBaseUrl={apiBaseUrl}
        hidePrint
        bulkActions={(ctx) => (
          <>
            <BulkOrderMoreMenu {...ctx} />
            <OrderReactivateBulkAction {...ctx} />
          </>
        )}
        initialColumnFilters={initialColumnFilters}
        initialAdvancedFilter={initialAdvancedFilter}
        initialColumns={isPendingDelivery ? LIST_COLUMNS : null}
        dateFilterKey="orderDate"
        refreshTrigger={refreshKey}
        renderPreview={renderPreview}
        externalPreviewRow={effectiveRecord}
        onExternalPreviewClose={clearSavedRecord}
        {...rest}
      />
      {deleteDialog}
      {cloneTargets && createPortal(
        <CloneOrderModal
          records={cloneTargets}
          apiBaseUrl={apiBaseUrl}
          headers={headers}
          routePrefix="/sales-order/"
          onClose={() => setCloneTargets(null)}
          onCloned={() => setRefreshKey(k => k + 1)}
        />,
        document.body,
      )}
      {confirmRow && !confirmedDocs && createPortal(
        <ConfirmModal
          orderId={confirmRow.id}
          data={confirmRow}
          apiBaseUrl={apiBaseUrl}
          headers={headers}
          onClose={() => setConfirmRow(null)}
          onConfirmed={(docs) => setConfirmedDocs(docs)}
        />,
        document.body,
      )}
      {manageRow && (
        <ManageDocsLauncher
          orderId={manageRow.id}
          data={manageRow}
          apiBaseUrl={apiBaseUrl}
          token={token}
          onClose={() => setManageRow(null)}
          onCreated={() => { setManageRow(null); setRefreshKey(k => k + 1); }}
        />
      )}
      {confirmedDocs && createPortal(
        <ConfirmResultModal
          docs={confirmedDocs}
          ui={ui}
          navigate={navigate}
          currency={confirmRow?.['currency$_identifier'] || ''}
          onClose={() => {
            setConfirmedDocs(null);
            setConfirmRow(null);
            setRefreshKey(k => k + 1);
          }}
        />,
        document.body,
      )}
    </>
  );
}
