import { MasterDetailPage } from '@/components/contract-ui';
import CostAdjustmentTable from './CostAdjustmentTable';
import CostAdjustmentForm from './CostAdjustmentForm';
import CostAdjustmentLineTable from './CostAdjustmentLineTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'documentNo', label: 'Document No', type: 'string' },
];

const statusField = 'docStatus';

const processes = [
  { name: 'completeCostAdjustment', label: 'Complete Cost Adjustment', style: 'positive' },
  { name: 'voidCostAdjustment', label: 'Void Cost Adjustment', style: 'destructive' },
];

const addLineFields = {
  entry: [
    { key: 'product', label: 'Product', type: 'search', required: true, lookup: true, reference: 'Product', inputMode: 'search' },
    { key: 'inventoryTransaction', label: 'Inventory Transaction', type: 'search', reference: 'MaterialTransaction', inputMode: 'search' },
    { key: 'lineNo', label: 'Line No', type: 'number', required: true },
    { key: 'description', label: 'Description', type: 'text' },
    { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true },
  ],
  derived: [
    { key: 'adjustmentAmount', label: 'Adjustment Amount', type: 'number' },
  ],
};

export default function CostAdjustmentPage(props) {
  return (
    <MasterDetailPage
      entity="costAdjustment"
      detailEntity="costAdjustmentLine"
      Table={CostAdjustmentTable}
      Form={CostAdjustmentForm}
      DetailTable={CostAdjustmentLineTable}
      summary={summary}
      statusField={statusField}
      processes={processes}
      addLineFields={addLineFields}
      catalogs={catalogs}
      entityLabel="Cost Adjustment"
      detailLabel="Cost Adjustment Line"
      {...props}
    />
  );
}
