import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useBulkActionToast } from '@/hooks/useBulkActionToast';
import { ListView } from '@/components/contract-ui';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';
import CreateContactModal from '@/components/contract-ui/CreateContactModal';
import { CreateContactContext } from '@/components/contract-ui/CreateContactContext.js';
import { useCreateContactModal } from '@/components/contract-ui/useCreateContactModal.js';
import HeaderTable from '@generated/purchase-order/generated/web/purchase-order/HeaderTable';
import LinesTable from '@generated/purchase-order/generated/web/purchase-order/LinesTable';
import GeneratedApp from '@generated/purchase-order/generated/web/purchase-order/index.jsx';
import PurchaseOrderReactivateBulkAction from '@generated/purchase-order/custom/PurchaseOrderReactivateBulkAction';
import LinesEmptyState from '@/components/contract-ui/LinesEmptyState.jsx';

// Simplified list columns aligned with Sales Order visual style
const LIST_COLUMNS = [
  { key: 'orderDate', column: 'DateOrdered', type: 'date', label: 'Order Date', dot: false },
  { key: 'documentNo', column: 'DocumentNo', type: 'string', label: 'Document No.' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'selector', label: 'Business Partner' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status', label: 'Document Status' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount', label: 'Total Gross Amount' },
  { key: 'deliveryStatusPurchase', column: 'DeliveryStatusPurchase', type: 'percent', label: 'Delivery Status' },
  { key: 'invoiceStatus', column: 'InvoiceStatus', type: 'percent', label: 'Invoice Status' },
];
const draftModeWithModal = {
  enabled: true,
  processField: 'documentAction',
  processValue: 'CO',
  label: 'poConfirmBtn',
  onConfirm: () => window.dispatchEvent(new CustomEvent('purchase-order:open-confirm-modal')),
};

// Mirrors artifacts/purchase-order/generated/web/purchase-order/HeaderPage.jsx
// Kept in sync manually because the generator does not expose labelOverrides yet.
const LABEL_OVERRIDES = {
  es_ES: {
    C_BPartner_ID: 'Contacto',
    DatePromised: 'Fecha de entrega esperada',
    DeliveryStatusPurchase: 'Estado de entrega',
  },
  en_US: {
    C_BPartner_ID: 'Contact',
    DatePromised: 'Expected Delivery Date',
    DeliveryStatusPurchase: 'Delivery Status',
  },
};

// Lines table columns without lineNo
const LINES_COLUMNS = [
  { key: 'product', column: 'M_Product_ID', type: 'string', label: 'Product' },
  { key: 'description', column: 'Description', type: 'string', label: 'Description' },
  { key: 'orderedQuantity', column: 'QtyOrdered', type: 'number', label: 'Ordered Quantity' },
  { key: 'unitPrice', column: 'PriceActual', type: 'amount', label: 'Unit Price' },
  { key: 'discount', column: 'Discount', type: 'number', label: 'Discount %' },
  { key: 'tax', column: 'C_Tax_ID', type: 'string', label: 'Tax' },
  { key: 'lineGrossAmount', column: 'Line_Gross_Amount', type: 'amount', label: 'Line Gross Amount' },
];

function CustomHeaderTable(props) {
  return <HeaderTable columns={LIST_COLUMNS} {...props} />;
}

function CustomLinesTable(props) {
  return <LinesTable columns={LINES_COLUMNS} {...props} />;
}

export default function PurchaseOrderWindow(props) {
  useBulkActionToast();
  const { recordId, windowName, token, apiBaseUrl } = props;
  const [searchParams] = useSearchParams();
  const [cloneTargets, setCloneTargets] = useState(null);

  const { bpApiBaseUrl, headers, createContactState, setCreateContactState, createContactCtxValue } =
    useCreateContactModal({ apiBaseUrl, token });

  if (recordId) {
    return (
      <CreateContactContext.Provider value={createContactCtxValue}>
        <GeneratedApp
          {...props}
          DetailTable={CustomLinesTable}
          draftMode={draftModeWithModal}
          linesEmptyState={LinesEmptyState}
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

  const docStatus = searchParams.get('DocStatus');
  const filterParam = searchParams.get('filter');
  const initialColumnFilters = docStatus ? { documentStatus: docStatus } : undefined;

  const QUICK_FILTERS = [
    {
      label: 'pendingDeliveryOnly',
      filter: `criteria=${encodeURIComponent(JSON.stringify([
        { fieldName: 'deliveryStatusPurchase', operator: 'lessThan', value: 100 },
      ]))}`,
    },
  ];
  const initialQuickFilterIndex = filterParam === 'pendingDelivery' ? 0 : null;

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
        bulkActions={(ctx) => <PurchaseOrderReactivateBulkAction {...ctx} />}
        initialColumnFilters={initialColumnFilters}
        quickFilters={QUICK_FILTERS}
        initialQuickFilterIndex={initialQuickFilterIndex}
        dateFilterKey="orderDate"
        {...props}
      />
      {cloneTargets && createPortal(
        <CloneOrderModal
          records={cloneTargets}
          apiBaseUrl={apiBaseUrl}
          headers={headers}
          routePrefix="/purchase-order/"
          onClose={() => setCloneTargets(null)}
        />,
        document.body,
      )}
    </>
  );
}
