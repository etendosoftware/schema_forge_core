import { MasterDetailPage } from '@/components/contract-ui';
import GoodsShipmentTable from './GoodsShipmentTable';
import GoodsShipmentForm from './GoodsShipmentForm';
import GoodsShipmentLineTable from './GoodsShipmentLineTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'documentNo', label: 'Document No', type: 'string' },
];

const statusField = 'docStatus';

const processes = [

];

const addLineFields = {
  entry: [
    { key: 'product', label: 'Product', type: 'search', required: true, lookup: true, reference: 'Product', inputMode: 'search' },
    { key: 'movementQty', label: 'Movement Qty', type: 'number', required: true },
    { key: 'locator', label: 'Locator', type: 'selector', required: true, reference: 'Locator', inputMode: 'selector' },
    { key: 'lineNo', label: 'Line No', type: 'number', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
  ],
  derived: [

  ],
};

export default function GoodsShipmentPage(props) {
  return (
    <MasterDetailPage
      entity="goodsShipment"
      detailEntity="goodsShipmentLine"
      Table={GoodsShipmentTable}
      Form={GoodsShipmentForm}
      DetailTable={GoodsShipmentLineTable}
      summary={summary}
      statusField={statusField}
      processes={processes}
      addLineFields={addLineFields}
      catalogs={catalogs}
      entityLabel="Goods Shipment"
      detailLabel="Goods Shipment Line"
      {...props}
    />
  );
}
