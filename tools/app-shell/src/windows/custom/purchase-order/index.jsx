import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ListView } from '@/components/contract-ui';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';
import CreateContactModal from '@/components/contract-ui/CreateContactModal';
import { CreateContactContext } from '@/components/contract-ui/CreateContactContext.js';
import { useCreateContactModal } from '@/components/contract-ui/useCreateContactModal.js';
import HeaderTable from '@generated/purchase-order/generated/web/purchase-order/HeaderTable';
import LinesTable from '@generated/purchase-order/generated/web/purchase-order/LinesTable';
import GeneratedApp from '@generated/purchase-order/generated/web/purchase-order/index.jsx';

// Simplified list columns aligned with Sales Order visual style
const LIST_COLUMNS = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string', label: 'Document No.' },
  { key: 'orderDate', column: 'DateOrdered', type: 'date', label: 'Order Date' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string', label: 'Business Partner' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status', label: 'Document Status' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount', label: 'Total Gross Amount' },
  { key: 'deliveryStatusPurchase', column: 'DeliveryStatusPurchase', type: 'percent', label: 'Delivery Status' },
  { key: 'invoiceStatus', column: 'InvoiceStatus', type: 'percent', label: 'Invoice Status' },
];

// Lines table columns without lineNo
const LINES_COLUMNS = [
  { key: 'product', column: 'M_Product_ID', type: 'string', label: 'Product' },
  { key: 'orderedQuantity', column: 'QtyOrdered', type: 'number', label: 'Ordered Quantity' },
  { key: 'unitPrice', column: 'PriceActual', type: 'number', label: 'Net Unit Price' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'amount', label: 'Line Net Amount' },
  { key: 'tax', column: 'C_Tax_ID', type: 'string', label: 'Tax' },
  { key: 'discount', column: 'Discount', type: 'number', label: 'Discount %' },
];

function CustomHeaderTable(props) {
  return <HeaderTable columns={LIST_COLUMNS} {...props} />;
}

function CustomLinesTable(props) {
  return <LinesTable columns={LINES_COLUMNS} {...props} />;
}

export default function PurchaseOrderWindow(props) {
  const { recordId, windowName, token, apiBaseUrl } = props;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [cloneTarget, setCloneTarget] = useState(null);

  const { bpApiBaseUrl, headers, createContactState, setCreateContactState, createContactCtxValue } =
    useCreateContactModal({ apiBaseUrl, token });

  if (recordId) {
    return (
      <CreateContactContext.Provider value={createContactCtxValue}>
        <GeneratedApp
          {...props}
          DetailTable={CustomLinesTable}
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
    { label: 'all' },
    { label: 'pendingDeliveryOnly', rowFilter: (row) => (row.deliveryStatusPurchase ?? 100) < 100 },
  ];
  const initialQuickFilterIndex = filterParam === 'pendingDelivery' ? 1 : 0;

  return (
    <>
      <ListView
        entity="header"
        Table={CustomHeaderTable}
        entityLabel="Purchase Order"
        windowName={windowName}
        breadcrumb="Purchases / Purchase Order"
        onCloneRow={(row) => setCloneTarget(row)}
        initialColumnFilters={initialColumnFilters}
        quickFilters={QUICK_FILTERS}
        initialQuickFilterIndex={initialQuickFilterIndex}
        {...props}
      />
      {cloneTarget && createPortal(
        <CloneOrderModal
          orderId={cloneTarget.id}
          data={cloneTarget}
          apiBaseUrl={apiBaseUrl}
          headers={headers}
          onClose={() => setCloneTarget(null)}
          onCloned={(newId) => {
            setCloneTarget(null);
            navigate(`/purchase-order/${newId}`);
          }}
        />,
        document.body,
      )}
    </>
  );
}
