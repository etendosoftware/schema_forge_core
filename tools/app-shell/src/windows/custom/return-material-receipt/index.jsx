import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useRowDelete } from '@/hooks/useRowDelete';
import ReturnMaterialReceiptPage from '@generated/return-material-receipt/generated/web/return-material-receipt/ReturnMaterialReceiptPage';
import ReturnMaterialReceiptPreview from './ReturnMaterialReceiptPreview';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';

export default function ReturnMaterialReceiptWindow({ windowName, recordId, apiBaseUrl, token, ...rest }) {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [cloneTargets, setCloneTargets] = useState(null);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const { requestDelete, deleteDialog } = useRowDelete({
    apiBaseUrl,
    entity: 'returnMaterialReceipt',
    token,
    onSuccess: () => setRefreshKey(k => k + 1),
  });

  const rowQuickActions = useMemo(() => ({
    enabled: true,
    editMode: 'navigate',
    documentPreview: true,
    statusField: 'documentStatus',
    hideDeleteWhenComplete: true,
    actions: {
      edit: { show: true },
      duplicate: { show: true },
      delete: { show: true },
    },
    onEdit: (row) => navigate(`/${windowName}/${row.id}`),
    onDelete: requestDelete,
    onClone: (row) => setCloneTargets([row]),
  }), [navigate, windowName, requestDelete]);

  if (recordId) {
    return (
      <ReturnMaterialReceiptPage
        windowName={windowName}
        recordId={recordId}
        apiBaseUrl={apiBaseUrl}
        token={token}
        {...rest}
      />
    );
  }

  return (
    <>
      <ReturnMaterialReceiptPage
        windowName={windowName}
        apiBaseUrl={apiBaseUrl}
        token={token}
        rowQuickActions={rowQuickActions}
        refreshTrigger={refreshKey}
        renderPreview={({ row, onClose, onEdit }) => (
          <ReturnMaterialReceiptPreview
            receipt={row}
            token={token}
            apiBaseUrl={apiBaseUrl}
            windowName={windowName}
            onClose={onClose}
            onEdit={onEdit}
          />
        )}
        {...rest}
      />
      {deleteDialog}
      {cloneTargets && createPortal(
        <CloneOrderModal
          records={cloneTargets}
          apiBaseUrl={apiBaseUrl}
          headers={headers}
          headerEntity="returnMaterialReceipt"
          routePrefix="/return-material-receipt/"
          onClose={() => setCloneTargets(null)}
          onCloned={() => { setCloneTargets(null); setRefreshKey(k => k + 1); }}
        />,
        document.body,
      )}
    </>
  );
}
