import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'product', label: 'Product', type: 'string' },
  { key: 'inventoryTransaction', label: 'Inventory Transaction', type: 'string' },
  { key: 'adjustmentAmount', label: 'Adjustment Amount', type: 'amount' },
  { key: 'lineNo', label: 'Line No', type: 'number' },
  { key: 'isSource', label: 'Is Source', type: 'boolean' },
  { key: 'isRelated', label: 'Is Related', type: 'boolean' },
  { key: 'currency', label: 'Currency', type: 'string' },
];

const filters = ['product'];

export default function CostAdjustmentLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
