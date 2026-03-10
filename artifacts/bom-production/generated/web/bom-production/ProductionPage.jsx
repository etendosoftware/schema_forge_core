import { MasterDetailPage } from '@/components/contract-ui';
import ProductionTable from './ProductionTable';
import ProductionForm from './ProductionForm';
import ProductionLineTable from './ProductionLineTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
];

const statusField = 'docStatus';

const processes = [

];

const addLineFields = {
  entry: [
    { key: 'lineNo', column: 'Line', type: 'number', required: true, lookup: true },
    { key: 'product', column: 'M_Product_ID', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
    { key: 'locator', column: 'M_Locator_ID', type: 'selector', required: true, reference: 'Locator', inputMode: 'selector' },
    { key: 'movementQuantity', column: 'MovementQty', type: 'number', required: true },
  ],
  derived: [

  ],
};

export default function ProductionPage(props) {
  return (
    <MasterDetailPage
      entity="production"
      detailEntity="productionLine"
      Table={ProductionTable}
      Form={ProductionForm}
      DetailTable={ProductionLineTable}
      summary={summary}
      statusField={statusField}
      processes={processes}
      addLineFields={addLineFields}
      catalogs={catalogs}
      entityLabel="Production"
      detailLabel="Production Line"
      {...props}
    />
  );
}
