import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUI } from '@/i18n';
import { useBulkActionToast } from '@/hooks/useBulkActionToast';
import { useRowDelete } from '@/hooks/useRowDelete';
import { ListView } from '@/components/contract-ui';
import BulkDocumentAction, { buildInOutActions } from '@/components/contract-ui/BulkDocumentAction';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';
import CreateContactModal from '@/components/contract-ui/CreateContactModal';
import { CreateContactContext } from '@/components/contract-ui/CreateContactContext.js';
import { useCreateContactModal } from '@/components/contract-ui/useCreateContactModal.js';
import HeaderTable from '@generated/purchase-order/generated/web/purchase-order/HeaderTable';
import GeneratedApp from '@generated/purchase-order/generated/web/purchase-order/index.jsx';
import BulkPurchaseOrderMoreMenu from '@generated/purchase-order/custom/BulkPurchaseOrderMoreMenu';
import { ConfirmModal as PoConfirmModal, PoConfirmResultModal, ManageDocsLauncher as PoManageDocsLauncher } from '@generated/purchase-order/custom/PurchaseOrderActions';
import LinesEmptyState from '@/components/contract-ui/LinesEmptyState.jsx';

// Simplified list columns aligned with Sales Order visual style
const LIST_COLUMNS = [
  { key: 'orderDate', column: 'DateOrdered', type: 'date', label: 'Order Date', dot: false },
  { key: 'documentNo', column: 'DocumentNo', type: 'string', label: 'Document No.' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector', label: 'Business Partner' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status', label: 'Document Status' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount', label: 'Total Gross Amount' },
  { key: 'invoiceStatus', column: 'InvoiceStatus', type: 'percent', label: 'Invoice Status' },
  { key: 'deliveryStatusPurchase', column: 'DeliveryStatusPurchase', type: 'percent', label: 'Delivery Status' },
];
const draftModeWithModal = {
  enabled: true,
  processField: 'documentAction',
  processValue: 'CO',
  label: 'poConfirmBtn',
  disableWhenEmpty: true,
  onConfirm: () => window.dispatchEvent(new CustomEvent('purchase-order:open-confirm-modal')),
};

// Mirrors artifacts/purchase-order/decisions.json → window.labelOverrides.
// The list view here bypasses the generated HeaderPage and renders ListView
// directly, so the generator-emitted labelOverrides do not reach it. Mirror
// here until the wrapper consumes the spec's labelOverrides at runtime.
const LABEL_OVERRIDES = {
  es_ES: {
    C_BPartner_ID: 'Contacto',
    DatePromised: 'Fecha de entrega esperada',
    DeliveryStatusPurchase: 'Estado de entrega',
    InvoiceStatus: 'Estado de facturación',
  },
  en_US: {
    C_BPartner_ID: 'Contact',
    DatePromised: 'Expected Delivery Date',
    DeliveryStatusPurchase: 'Delivery Status',
    InvoiceStatus: 'Invoicing Status',
  },
};

function PurchaseOrderBulkActions(props) {
  return (
    <>
      <BulkPurchaseOrderMoreMenu {...props} />
      <BulkDocumentAction {...props} buildActions={buildInOutActions} labelKey="confirmBulk" />
    </>
  );
}

function CustomHeaderTable(props) {
  return <HeaderTable columns={LIST_COLUMNS} {...props} />;
}

export default function PurchaseOrderWindow(props) {
  useBulkActionToast();
  const ui = useUI();
  const { recordId, windowName, token, apiBaseUrl } = props;
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

  const rowQuickActions = useMemo(() => ({
    enabled: true,
    editMode: 'navigate',
    statusField: 'documentStatus',
    actions: {
      edit: { show: true },
      duplicate: { show: true },
      delete: { show: true },
    },
    onEdit: (row) => navigate(`/${windowName}/${row.id}`),
    onClone: (row) => setCloneTargets([row]),
    onDelete: requestDelete,
    menuActions: ({ row, status }) => {
      // For completed orders, only surface "Gestionar..." when there is still
      // pending receipt or invoice — same criterion used by
      // PurchaseOrderActions's topbar button. We read the row's percent columns
      // to avoid an extra fetch per row.
      const delivery = Number(row?.deliveryStatusPurchase ?? 100);
      const invoice  = Number(row?.invoiceStatus           ?? 100);
      const needsRecv    = status === 'CO' && delivery < 100;
      const needsInvoice = status === 'CO' && invoice  < 100;
      let manageLabelKey = null;
      if      (needsRecv && needsInvoice) manageLabelKey = 'poManageReceiptAndInvoice';
      else if (needsRecv)                 manageLabelKey = 'poManageReceipt';
      else if (needsInvoice)              manageLabelKey = 'poManageInvoice';
      return [
        {
          key: 'confirm',
          label: ui('poConfirmBtn'),
          visible: status === 'DR',
          onClick: ({ row: r }) => setConfirmRow(r),
        },
        {
          key: 'manage',
          label: manageLabelKey ? ui(manageLabelKey) : '',
          visible: !!manageLabelKey,
          onClick: ({ row: r }) => setManageRow(r),
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
          {...props}
          draftMode={draftModeWithModal}
          linesEmptyState={LinesEmptyState}
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

  return (
    <>
      <ListView
        entity="header"
        Table={CustomHeaderTable}
        entityLabel="Purchase Order"
        windowName={windowName}
        breadcrumb="Purchases / Purchase Order"
        labelOverrides={LABEL_OVERRIDES}
        onCloneRow={(rowOrRows) => setCloneTargets(Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows])}
        rowQuickActions={rowQuickActions}
        bulkActions={PurchaseOrderBulkActions}
        dateFilterKey="orderDate"
        refreshTrigger={refreshKey}
        {...props}
      />
      {deleteDialog}
      {cloneTargets && createPortal(
        <CloneOrderModal
          records={cloneTargets}
          apiBaseUrl={apiBaseUrl}
          headers={headers}
          routePrefix="/purchase-order/"
          onClose={() => setCloneTargets(null)}
          onCloned={() => setRefreshKey(k => k + 1)}
        />,
        document.body,
      )}
      {confirmRow && !confirmedDocs && createPortal(
        <PoConfirmModal
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
        <PoManageDocsLauncher
          orderId={manageRow.id}
          data={manageRow}
          apiBaseUrl={apiBaseUrl}
          token={token}
          onClose={() => setManageRow(null)}
          onCreated={() => { setManageRow(null); setRefreshKey(k => k + 1); }}
        />
      )}
      {confirmedDocs && createPortal(
        <PoConfirmResultModal
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
