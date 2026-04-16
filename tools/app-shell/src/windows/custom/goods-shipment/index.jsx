import { useSearchParams } from 'react-router-dom';
import GoodsShipmentPage from '@generated/goods-shipment/generated/web/goods-shipment/GoodsShipmentPage';

export default function GoodsShipmentWindow(props) {
  const [searchParams] = useSearchParams();
  const docStatus = searchParams.get('DocStatus');
  const initialColumnFilters = docStatus ? { documentStatus: docStatus } : undefined;

  return <GoodsShipmentPage {...props} initialColumnFilters={initialColumnFilters} />;
}
