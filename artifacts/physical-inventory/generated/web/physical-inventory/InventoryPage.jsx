import { MasterDetailPage } from '@/components/contract-ui';
import InventoryTable from './InventoryTable';
import InventoryForm from './InventoryForm';
import InventoryLineTable from './InventoryLineTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'documentNo', label: 'Document No', type: 'string' },
];

const statusField = 'docStatus';

const processes = [

];

const addLineFields = {
  entry: [
    { key: 'lineNo', label: 'Line No', type: 'number', required: true, lookup: true },
    { key: 'product', label: 'Product', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
    { key: 'locator', label: 'Locator', type: 'selector', required: true, reference: 'Locator', inputMode: 'selector' },
    { key: 'countQuantity', label: 'Count Quantity', type: 'number', required: true },
  ],
  derived: [

  ],
};

export default function InventoryPage(props) {
  return (
    <MasterDetailPage
      entity="inventory"
      detailEntity="inventoryLine"
      Table={InventoryTable}
      Form={InventoryForm}
      DetailTable={InventoryLineTable}
      summary={summary}
      statusField={statusField}
      processes={processes}
      addLineFields={addLineFields}
      catalogs={catalogs}
      entityLabel="Inventory"
      detailLabel="Inventory Line"
      {...props}
    />
  );
}
