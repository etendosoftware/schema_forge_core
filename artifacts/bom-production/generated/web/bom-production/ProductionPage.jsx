import { MasterDetailPage } from '@/components/contract-ui';
import ProductionTable from './ProductionTable';
import ProductionForm from './ProductionForm';
import ProductionLineTable from './ProductionLineTable';
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
    { key: 'movementQuantity', label: 'Movement Quantity', type: 'number', required: true },
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
