import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import GeneratedApp from '@generated/sales-order/generated/web/sales-order/index.jsx';
import HeaderTable from '@generated/sales-order/generated/web/sales-order/HeaderTable';
import { ListView } from '@/components/contract-ui';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';
import CreateContactModal from '@/components/contract-ui/CreateContactModal';
import { CreateContactContext } from '@/components/contract-ui/CreateContactContext.js';
import { useCreateContactModal } from '@/components/contract-ui/useCreateContactModal.js';

export default function SalesOrderWindow({ windowName, recordId, token, apiBaseUrl, ...rest }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [cloneTarget, setCloneTarget] = useState(null);

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
        onCloneRow={(row) => setCloneTarget(row)}
        token={token}
        apiBaseUrl={apiBaseUrl}
        hidePrint
        initialColumnFilters={initialColumnFilters}
        quickFilters={QUICK_FILTERS}
        initialQuickFilterIndex={initialQuickFilterIndex}
        {...rest}
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
            navigate(`/sales-order/${newId}`);
          }}
        />,
        document.body,
      )}
    </>
  );
}
