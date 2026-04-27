import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useBulkActionToast } from '@/hooks/useBulkActionToast';
import GeneratedApp from '@generated/sales-order/generated/web/sales-order/index.jsx';
import HeaderTable from '@generated/sales-order/generated/web/sales-order/HeaderTable';
import OrderReactivateBulkAction from '@generated/sales-order/custom/OrderReactivateBulkAction';
import BulkOrderMoreMenu from '@generated/sales-order/custom/BulkOrderMoreMenu';
import { ListView } from '@/components/contract-ui';

const LIST_COLUMNS = [
  { key: 'orderDate', column: 'DateOrdered', type: 'date', label: 'Order Date', dot: false },
  { key: 'documentNo', column: 'DocumentNo', type: 'string', label: 'Document No.' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector', label: 'Business Partner' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status', label: 'Document Status' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount', label: 'Total Gross Amount' },
  { key: 'deliveryStatus', column: 'DeliveryStatus', type: 'percent', label: 'Shipment Status' },
  { key: 'invoiceStatus', column: 'InvoiceStatus', type: 'percent', label: 'Invoice Status' },
];

function CustomHeaderTable(props) {
  return <HeaderTable columns={LIST_COLUMNS} {...props} />;
}
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';
import CreateContactModal from '@/components/contract-ui/CreateContactModal';
import { CreateContactContext } from '@/components/contract-ui/CreateContactContext.js';
import { useCreateContactModal } from '@/components/contract-ui/useCreateContactModal.js';
import LinesEmptyState from '@/components/contract-ui/LinesEmptyState.jsx';

// Mirrors artifacts/sales-order/generated/web/sales-order/HeaderPage.jsx.
// Kept in sync manually because the generator does not expose labelOverrides yet,
// and the list view bulkActions prop is hand-rolled here (drift with decisions.json).
const LABEL_OVERRIDES = {
  es_ES: {
    C_BPartner_ID: 'Contacto',
    DeliveryStatus: 'Estado de entrega',
  },
  en_US: {
    C_BPartner_ID: 'Contact',
    DeliveryStatus: 'Delivery Status',
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
  const [searchParams] = useSearchParams();
  const [cloneTargets, setCloneTargets] = useState(null);

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
          addLineGuard={(d) => !!d?.businessPartner}
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

  const docStatus = searchParams.get('DocStatus');
  const filterParam = searchParams.get('filter');
  const initialColumnFilters = docStatus ? { documentStatus: docStatus } : undefined;

  const QUICK_FILTERS = [
    {
      label: 'pendingDeliveryOnly',
      filter: `criteria=${encodeURIComponent(JSON.stringify([
        { fieldName: 'deliveryStatus', operator: 'lessThan', value: 100 },
      ]))}`,
    },
  ];
  const initialQuickFilterIndex = filterParam === 'pendingDelivery' ? 0 : null;

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
        quickFilters={QUICK_FILTERS}
        initialQuickFilterIndex={initialQuickFilterIndex}
        dateFilterKey="orderDate"
        {...rest}
      />
      {cloneTargets && createPortal(
        <CloneOrderModal
          records={cloneTargets}
          apiBaseUrl={apiBaseUrl}
          headers={headers}
          routePrefix="/sales-order/"
          onClose={() => setCloneTargets(null)}
        />,
        document.body,
      )}
    </>
  );
}
