import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import GeneratedApp from '@generated/sales-order/generated/web/sales-order/index.jsx';
import HeaderTable from '@generated/sales-order/generated/web/sales-order/HeaderTable';
import { ListView } from '@/components/contract-ui';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';

export default function SalesOrderWindow({ windowName, recordId, token, apiBaseUrl, ...rest }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [cloneTarget, setCloneTarget] = useState(null);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  if (recordId) {
    return (
      <GeneratedApp
        windowName={windowName}
        recordId={recordId}
        token={token}
        apiBaseUrl={apiBaseUrl}
        {...rest}
      />
    );
  }

  const docStatus = searchParams.get('DocStatus');
  const initialColumnFilters = docStatus ? { documentStatus: docStatus } : undefined;

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
