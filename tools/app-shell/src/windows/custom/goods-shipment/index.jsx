import { useSearchParams } from 'react-router-dom';
import GoodsShipmentPage from '@generated/goods-shipment/generated/web/goods-shipment/GoodsShipmentPage';
import BulkInvoiceFromShipment from '@generated/goods-shipment/custom/BulkInvoiceFromShipment';
import BulkDocumentAction, { buildInOutActions } from '@/components/contract-ui/BulkDocumentAction';
import { useBulkActionToast } from '@/hooks/useBulkActionToast';

export default function GoodsShipmentWindow(props) {
  useBulkActionToast();
  const [searchParams] = useSearchParams();
  const docStatus = searchParams.get('DocStatus');
  const initialColumnFilters = docStatus ? { documentStatus: docStatus } : undefined;

  return (
    <GoodsShipmentPage
      {...props}
      initialColumnFilters={initialColumnFilters}
      bulkActions={(ctx) => (
        <>
          <BulkInvoiceFromShipment {...ctx} />
          <BulkDocumentAction {...ctx} entity="goodsShipment" buildActions={buildInOutActions} />
        </>
      )}
    />
  );
}
