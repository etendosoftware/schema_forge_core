import { MasterDetailPage } from '@/components/contract-ui';
import WarehousePickingListTable from './WarehousePickingListTable';
import WarehousePickingListForm from './WarehousePickingListForm';
import WarehousePickingListLineTable from './WarehousePickingListLineTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'documentNo', label: 'Document No', type: 'string' },
];

const statusField = 'status';

const processes = [

];

const addLineFields = {
  entry: [
    { key: 'lineNo', label: 'Line No', type: 'number', required: true, lookup: true },
    { key: 'product', label: 'Product', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
    { key: 'locator', label: 'Locator', type: 'selector', required: true, reference: 'Locator', inputMode: 'selector' },
    { key: 'quantityRequired', label: 'Quantity Required', type: 'number', required: true },
    { key: 'quantityPicked', label: 'Quantity Picked', type: 'number' },
    { key: 'salesOrder', label: 'Sales Order', type: 'search', reference: 'SalesOrder', inputMode: 'search' },
    { key: 'description', label: 'Description', type: 'text' },
  ],
  derived: [

  ],
};

export default function WarehousePickingListPage(props) {
  return (
    <MasterDetailPage
      entity="warehousePickingList"
      detailEntity="warehousePickingListLine"
      Table={WarehousePickingListTable}
      Form={WarehousePickingListForm}
      DetailTable={WarehousePickingListLineTable}
      summary={summary}
      statusField={statusField}
      processes={processes}
      addLineFields={addLineFields}
      catalogs={catalogs}
      entityLabel="Warehouse Picking List"
      detailLabel="Warehouse Picking List Line"
      {...props}
    />
  );
}
