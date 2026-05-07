import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useBulkActionToast } from '@/hooks/useBulkActionToast';
import { buildPendingDeliveryFilter } from '../shared/pendingDeliveryFilter.js';
import { useCurrency } from '@/hooks/useCurrency';
import { ListView } from '@/components/contract-ui';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';
import CreateContactModal from '@/components/contract-ui/CreateContactModal';
import { CreateContactContext } from '@/components/contract-ui/CreateContactContext.js';
import { useCreateContactModal } from '@/components/contract-ui/useCreateContactModal.js';
import HeaderTable from '@generated/purchase-order/generated/web/purchase-order/HeaderTable';
import LinesTable from '@generated/purchase-order/generated/web/purchase-order/LinesTable';
import GeneratedApp from '@generated/purchase-order/generated/web/purchase-order/index.jsx';
import PurchaseOrderReactivateBulkAction from '@generated/purchase-order/custom/PurchaseOrderReactivateBulkAction';
import BulkPurchaseOrderMoreMenu from '@generated/purchase-order/custom/BulkPurchaseOrderMoreMenu';
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

// Mirrors artifacts/purchase-order/generated/web/purchase-order/HeaderPage.jsx.
// Kept in sync manually because the generator does not expose labelOverrides yet,
// and the list view bulkActions prop is hand-rolled here (drift with decisions.json).
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
  { key: 'listPrice', column: 'PriceList', type: 'amount', label: 'Net List Price' },
  { key: 'discount', column: 'Discount', type: 'number', label: 'Discount %' },
  { key: 'tax', column: 'C_Tax_ID', type: 'string', label: 'Tax' },
  { key: 'lineGrossAmount', column: 'Line_Gross_Amount', type: 'amount', label: 'Line Gross Amount' },
];

function CustomHeaderTable(props) {
  return <HeaderTable columns={LIST_COLUMNS} {...props} />;
}

function CustomLinesTable({ data, ...props }) {
  const currencyCode = useCurrency();
  const enrichedData = data?.map(row => ({
    ...row,
    'currency$_identifier': row['currency$_identifier'] ?? currencyCode,
  }));
  return <LinesTable columns={LINES_COLUMNS} data={enrichedData} {...props} />;
}

export default function PurchaseOrderWindow(props) {
  useBulkActionToast();
  const { recordId, windowName, token, apiBaseUrl } = props;
  const [searchParams] = useSearchParams();
  const [cloneTargets, setCloneTargets] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  const { initialColumnFilters, isPendingDelivery, initialAdvancedFilter } =
    buildPendingDeliveryFilter(searchParams, 'deliveryStatusPurchase');

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
        bulkActions={(ctx) => (
          <>
            <BulkPurchaseOrderMoreMenu {...ctx} />
            <PurchaseOrderReactivateBulkAction {...ctx} />
          </>
        )}
        initialColumnFilters={initialColumnFilters}
        initialAdvancedFilter={initialAdvancedFilter}
        initialColumns={isPendingDelivery ? LIST_COLUMNS : null}
        dateFilterKey="orderDate"
        refreshTrigger={refreshKey}
        {...props}
      />
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
    </>
  );
}
