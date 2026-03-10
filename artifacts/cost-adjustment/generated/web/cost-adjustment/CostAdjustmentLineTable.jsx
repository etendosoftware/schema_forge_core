import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'inventoryTransaction', column: 'M_Transaction_ID', type: 'string' },
  { key: 'adjustmentAmount', column: 'AdjustmentAmount', type: 'amount' },
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'isSource', column: 'IsSource', type: 'boolean' },
  { key: 'isRelated', column: 'IsRelated', type: 'boolean' },
  { key: 'currency', column: 'C_Currency_ID', type: 'string' },
];

const filters = ['product'];

export default function CostAdjustmentLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
