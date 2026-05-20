import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBulkActionToast } from '@/hooks/useBulkActionToast';
import { useRowDelete } from '@/hooks/useRowDelete';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';
import GoodsShipmentPage from '@generated/goods-shipment/generated/web/goods-shipment/GoodsShipmentPage';
import GoodsShipmentTable from '@generated/goods-shipment/generated/web/goods-shipment/GoodsShipmentTable';
import BulkInvoiceFromShipment from '@generated/goods-shipment/custom/BulkInvoiceFromShipment';
import BulkDocumentAction, { buildInOutActions } from '@/components/contract-ui/BulkDocumentAction';
import GoodsShipmentPreview from './GoodsShipmentPreview';

const LABEL_OVERRIDES = {
  es_ES: { InvoiceStatus: 'Estado de facturación' },
  en_US: { InvoiceStatus: 'Invoice Status' },
};

const COLUMNS = [
  { key: 'movementDate', column: 'MovementDate', type: 'date', dot: false },
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'documentStatus', column: 'DocStatus', type: 'status' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'string' },
  { key: 'invoiceStatus', column: 'InvoiceStatus', type: 'percent', noHoverHide: true },
];

function CustomGoodsShipmentTable(props) {
  return <GoodsShipmentTable columns={COLUMNS} {...props} />;
}

export default function GoodsShipmentWindow({ windowName, recordId, apiBaseUrl, token, ...rest }) {
  useBulkActionToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const docStatus = searchParams.get('DocStatus');
  const initialColumnFilters = docStatus
    ? { documentStatus: { mode: 'enumLabel', value: [docStatus] } }
    : undefined;

  const [cloneTargets, setCloneTargets] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { requestDelete, deleteDialog } = useRowDelete({
    apiBaseUrl,
    entity: 'header',
    token,
    onSuccess: () => setRefreshKey(k => k + 1),
  });

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

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
    onClone: (row) => setCloneTargets([row]),
    onDelete: requestDelete,
  }), [navigate, windowName, requestDelete]);

  if (recordId) {
    return (
      <GoodsShipmentPage
        windowName={windowName}
        recordId={recordId}
        apiBaseUrl={apiBaseUrl}
        token={token}
        Table={CustomGoodsShipmentTable}
        processes={[]}
        draftMode={{ enabled: true, label: 'Confirm', style: 'positive', onConfirm: () => window.dispatchEvent(new CustomEvent('goods-shipment:open-confirm-modal')) }}
        hideMoreMenu={true}
        {...rest}
      />
    );
  }

  return (
    <>
      <GoodsShipmentPage
        windowName={windowName}
        apiBaseUrl={apiBaseUrl}
        token={token}
        Table={CustomGoodsShipmentTable}
        initialColumnFilters={initialColumnFilters}
        rowQuickActions={rowQuickActions}
        onCloneRow={(rowOrRows) => setCloneTargets(Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows])}
        refreshTrigger={refreshKey}
        labelOverrides={LABEL_OVERRIDES}
        bulkActions={(ctx) => (
          <>
            <BulkInvoiceFromShipment {...ctx} />
            <BulkDocumentAction {...ctx} entity="goodsShipment" buildActions={buildInOutActions} />
          </>
        )}
        renderPreview={({ row, onClose, onEdit }) => (
          <GoodsShipmentPreview
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
          headerEntity="goodsShipment"
          routePrefix="/goods-shipment/"
          onClose={() => setCloneTargets(null)}
          onCloned={() => setRefreshKey(k => k + 1)}
        />,
        document.body,
      )}
    </>
  );
}
