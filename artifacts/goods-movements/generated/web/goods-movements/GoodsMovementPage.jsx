import { MasterDetailPage } from '@/components/contract-ui';
import GoodsMovementTable from './GoodsMovementTable';
import GoodsMovementForm from './GoodsMovementForm';
import GoodsMovementLineTable from './GoodsMovementLineTable';
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
    { key: 'locatorFrom', label: 'Locator From', type: 'selector', required: true, reference: 'Locator', inputMode: 'selector' },
    { key: 'locatorTo', label: 'Locator To', type: 'selector', required: true, reference: 'Locator', inputMode: 'selector' },
    { key: 'lineNo', label: 'Line No', type: 'number', required: true },
    { key: 'description', label: 'Description', type: 'text' },
  ],
  derived: [

  ],
};

export default function GoodsMovementPage(props) {
  return (
    <MasterDetailPage
      entity="goodsMovement"
      detailEntity="goodsMovementLine"
      Table={GoodsMovementTable}
      Form={GoodsMovementForm}
      DetailTable={GoodsMovementLineTable}
      summary={summary}
      statusField={statusField}
      processes={processes}
      addLineFields={addLineFields}
      catalogs={catalogs}
      entityLabel="Goods Movement"
      detailLabel="Goods Movement Line"
      {...props}
    />
  );
}
