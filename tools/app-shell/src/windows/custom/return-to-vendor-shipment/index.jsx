import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useRowDelete } from '@/hooks/useRowDelete';
import ReturnToVendorShipmentPage from '@generated/return-to-vendor-shipment/generated/web/return-to-vendor-shipment/ReturnToVendorShipmentPage';
import ReturnToVendorShipmentPreview from './ReturnToVendorShipmentPreview';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';

export default function ReturnToVendorShipmentWindow({ windowName, recordId, apiBaseUrl, token, ...rest }) {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [cloneTargets, setCloneTargets] = useState(null);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const { requestDelete, deleteDialog } = useRowDelete({
    apiBaseUrl,
    entity: 'returnToVendorShipment',
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
      <ReturnToVendorShipmentPage
        windowName={windowName}
        recordId={recordId}
        apiBaseUrl={apiBaseUrl}
        token={token}
        hidePrint={true}
        {...rest}
      />
    );
  }

  return (
    <>
      <ReturnToVendorShipmentPage
        windowName={windowName}
        apiBaseUrl={apiBaseUrl}
        token={token}
        rowQuickActions={rowQuickActions}
        refreshTrigger={refreshKey}
        renderPreview={({ row, onClose, onEdit }) => (
          <ReturnToVendorShipmentPreview
            shipment={row}
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
          headerEntity="returnToVendorShipment"
          routePrefix="/return-to-vendor-shipment/"
          onClose={() => setCloneTargets(null)}
          onCloned={() => setRefreshKey(k => k + 1)}
        />,
        document.body,
      )}
    </>
  );
}
