import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useBulkActionToast } from '@/hooks/useBulkActionToast';
import GeneratedApp from '@generated/sales-order/generated/web/sales-order/index.jsx';
import HeaderTable from '@generated/sales-order/generated/web/sales-order/HeaderTable';
import OrderReactivateBulkAction from '@generated/sales-order/custom/OrderReactivateBulkAction';
import { ListView } from '@/components/contract-ui';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';
import CreateContactModal from '@/components/contract-ui/CreateContactModal';
import { CreateContactContext } from '@/components/contract-ui/CreateContactContext.js';
import { useCreateContactModal } from '@/components/contract-ui/useCreateContactModal.js';

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
    { label: 'all' },
    { label: 'pendingDeliveryOnly', rowFilter: (row) => (row.deliveryStatus ?? 100) < 100 },
  ];
  const initialQuickFilterIndex = filterParam === 'pendingDelivery' ? 1 : 0;

  return (
    <>
      <ListView
        entity="header"
        Table={HeaderTable}
        entityLabel="Sales Order"
        windowName={windowName}
        breadcrumb="Sales / Sales Order"
        onCloneRow={(rowOrRows) => setCloneTargets(Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows])}
        token={token}
        apiBaseUrl={apiBaseUrl}
        hidePrint
        bulkActions={(ctx) => <OrderReactivateBulkAction {...ctx} />}
        initialColumnFilters={initialColumnFilters}
        quickFilters={QUICK_FILTERS}
        initialQuickFilterIndex={initialQuickFilterIndex}
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
