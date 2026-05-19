import { useSearchParams } from 'react-router-dom';
import GoodsShipmentPage from '@generated/goods-shipment/generated/web/goods-shipment/GoodsShipmentPage';
import GoodsShipmentTable from '@generated/goods-shipment/generated/web/goods-shipment/GoodsShipmentTable';
import BulkInvoiceFromShipment from '@generated/goods-shipment/custom/BulkInvoiceFromShipment';
import BulkDocumentAction, { buildInOutActions } from '@/components/contract-ui/BulkDocumentAction';
import { useBulkActionToast } from '@/hooks/useBulkActionToast';

const COLUMNS = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'string' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'string' },
  { key: 'movementDate', column: 'MovementDate', type: 'date', dot: false },
  { key: 'documentStatus', column: 'DocStatus', type: 'status' },
  { key: 'invoiced', column: 'Iscompletelyinvoiced', type: 'boolean', badge: true, badgeLabels: { 'true': 'Invoiced', 'false': 'Pending' } },
];

function CustomGoodsShipmentTable(props) {
  return <GoodsShipmentTable columns={COLUMNS} {...props} />;
}

export default function GoodsShipmentWindow(props) {
  useBulkActionToast();
  const [searchParams] = useSearchParams();
  const docStatus = searchParams.get('DocStatus');
  const initialColumnFilters = docStatus
    ? { documentStatus: { mode: 'enumLabel', value: [docStatus] } }
    : undefined;

  return (
    <GoodsShipmentPage
      {...props}
      Table={CustomGoodsShipmentTable}
      initialColumnFilters={initialColumnFilters}
      bulkActions={(ctx) => (
        <>
          <BulkInvoiceFromShipment {...ctx} />
          <BulkDocumentAction {...ctx} entity="goodsShipment" buildActions={buildInOutActions} labelKey="confirmBulk" />
        </>
      )}
    />
  );
}
